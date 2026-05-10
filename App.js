import { useEffect, useMemo, useRef, useState } from "react"
import { View, Text, StyleSheet, ActivityIndicator } from "react-native"
import { WebView } from "react-native-webview"
import { createClient } from "@/lib/supabase/client"
import * as RNIap from "react-native-iap"

/**
 * Point d’entrée Expo (`package.json` → `"main": "expo/AppEntry.js"` → `../../App`).
 * L’UI reprend le design du dashboard web dans `components/mobile/DashboardHomeNative.tsx`
 * (React Native + StyleSheet + expo-linear-gradient + expo-web-browser).
 * Aucun import depuis `app/` (Next / Vercel).
 */
export default function App() {
  const [loading, setLoading] = useState(true)
  const [sessionPayload, setSessionPayload] = useState(null)
  const webViewRef = useRef(null)
  const purchaseUpdateSubRef = useRef(null)
  const purchaseErrorSubRef = useRef(null)

  const PRODUCT_IDS = useMemo(() => ["vip_hebdo_bkg", "vip_mensuel_bkg", "vip_plus_mensuel_bkg"], [])

  const requestSubscriptionCompat = async (sku) => {
    // react-native-iap a changé de signature selon les versions.
    // On tente les deux formes (objet puis string) pour rester compatible.
    try {
      return await RNIap.requestSubscription({ sku })
    } catch {
      return await RNIap.requestSubscription(sku)
    }
  }

  useEffect(() => {
    let mounted = true
    const init = async () => {
      try {
        const supabase = createClient()
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (!mounted) return
        if (session?.access_token) {
          setSessionPayload({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            token_type: session.token_type,
            expires_at: session.expires_at,
            expires_in: session.expires_in,
            user: session.user,
          })
        } else {
          setSessionPayload(null)
        }
      } catch {
        if (!mounted) return
        setSessionPayload(null)
      } finally {
        if (!mounted) return
        setLoading(false)
      }
    }
    void init()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let alive = true

    const initIap = async () => {
      try {
        await RNIap.initConnection()

        // Nettoyage des achats "pending" (Android) pour éviter des états incohérents.
        try {
          await RNIap.flushFailedPurchasesCachedAsPendingAndroid()
        } catch {
          // ignore
        }

        purchaseUpdateSubRef.current = RNIap.purchaseUpdatedListener(async (purchase) => {
          try {
            if (!alive) return

            // Finalise l'achat côté store.
            await RNIap.finishTransaction({ purchase, isConsumable: false })

            const purchasedSku = String(purchase?.productId || purchase?.sku || "")
            const nextPlanStatus =
              purchasedSku === "vip_plus_mensuel_bkg"
                ? "VIP+"
                : purchasedSku === "vip_hebdo_bkg" || purchasedSku === "vip_mensuel_bkg"
                  ? "VIP"
                  : null

            if (nextPlanStatus) {
              const supabase = createClient()
              const userId =
                sessionPayload?.user?.id ||
                (await supabase.auth.getUser().then((r) => r.data.user?.id).catch(() => null))

              if (userId) {
                // Note: suppose une table `profiles` avec `plan_status`.
                await supabase.from("profiles").update({ plan_status: nextPlanStatus }).eq("id", userId)
              }
            }

            // Notifie le site (optionnel) : event CustomEvent.
            const payload = {
              type: "purchase:success",
              sku: purchasedSku,
              plan_status: nextPlanStatus,
            }
            webViewRef.current?.injectJavaScript?.(`
              (function(){
                try {
                  window.dispatchEvent(new CustomEvent('bkg:nativePurchase', { detail: ${JSON.stringify(payload)} }));
                } catch(e) {}
              })();
              true;
            `)
          } catch (e) {
            webViewRef.current?.injectJavaScript?.(`
              (function(){
                try {
                  window.dispatchEvent(new CustomEvent('bkg:nativePurchase', { detail: ${JSON.stringify({
                    type: "purchase:error",
                    message: String(e?.message || e),
                  })} }));
                } catch(e2) {}
              })();
              true;
            `)
          }
        })

        purchaseErrorSubRef.current = RNIap.purchaseErrorListener((_err) => {
          // On remonte l'erreur au site pour debug, sans toucher au design.
          webViewRef.current?.injectJavaScript?.(`
            (function(){
              try {
                window.dispatchEvent(new CustomEvent('bkg:nativePurchase', { detail: ${JSON.stringify({
                  type: "purchase:error",
                  message: "purchaseErrorListener",
                })} }));
              } catch(e) {}
            })();
            true;
          `)
        })
      } catch {
        // IAP indisponible : ne bloque pas l'app (WebView reste fonctionnelle).
      }
    }

    void initIap()

    return () => {
      alive = false
      try {
        purchaseUpdateSubRef.current?.remove?.()
      } catch {
        // ignore
      }
      try {
        purchaseErrorSubRef.current?.remove?.()
      } catch {
        // ignore
      }
      try {
        RNIap.endConnection()
      } catch {
        // ignore
      }
    }
  }, [PRODUCT_IDS, sessionPayload])

  const injectedJavaScriptBeforeContentLoaded = useMemo(() => {
    if (!sessionPayload) return ""
    // Supabase stocke la session dans localStorage sous `sb-<project-ref>-auth-token`
    const storageKey = "sb-zfoamfyyllmjxmiwcyzr-auth-token"
    const sessionJson = JSON.stringify(sessionPayload)
    return `
      (function() {
        try {
          localStorage.setItem(${JSON.stringify(storageKey)}, ${JSON.stringify(sessionJson)});
          window.__BKG_NATIVE_SESSION_INJECTED__ = true;
        } catch (e) {
          // ignore
        }
      })();
      true;
    `
  }, [sessionPayload])

  return (
    <View style={styles.root}>
      <WebView
        ref={webViewRef}
        style={styles.webview}
        source={{ uri: "https://bkg-rewards.com/" }}
        originWhitelist={["*"]}
        setSupportMultipleWindows={false}
        javaScriptEnabled
        domStorageEnabled
        injectedJavaScriptBeforeContentLoaded={injectedJavaScriptBeforeContentLoaded}
        onMessage={async (event) => {
          const raw = String(event?.nativeEvent?.data || "").trim()
          if (!raw) return

          // Format attendu : "purchase:<sku>"
          if (raw.startsWith("purchase:")) {
            const sku = raw.slice("purchase:".length).trim()
            if (!sku) return
            if (!PRODUCT_IDS.includes(sku)) return
            try {
              await requestSubscriptionCompat(sku)
            } catch (e) {
              webViewRef.current?.injectJavaScript?.(`
                (function(){
                  try {
                    window.dispatchEvent(new CustomEvent('bkg:nativePurchase', { detail: ${JSON.stringify({
                      type: "purchase:error",
                      sku,
                      message: String(e?.message || e),
                    })} }));
                  } catch(e2) {}
                })();
                true;
              `)
            }
            return
          }

          // Optionnel : JSON { type: "purchase", sku: "..." }
          if (raw.startsWith("{") && raw.endsWith("}")) {
            try {
              const msg = JSON.parse(raw)
              if (msg?.type === "purchase" && typeof msg?.sku === "string") {
                const sku = msg.sku.trim()
                if (PRODUCT_IDS.includes(sku)) {
                  await requestSubscriptionCompat(sku)
                }
              }
            } catch {
              // ignore
            }
          }
        }}
      />

      {loading ? (
        <View pointerEvents="none" style={styles.loadingOverlay}>
          <ActivityIndicator color="#D4AF37" />
          <Text style={styles.loadingTxt}>Chargement…</Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  webview: { flex: 1, backgroundColor: "#000" },
  loadingOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  loadingTxt: { color: "#fff", marginTop: 10, fontSize: 12, fontWeight: "700" },
})
