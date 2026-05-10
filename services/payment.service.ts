import { App } from "@capacitor/app"
import { Platform } from "react-native"
import {
  ANDROID_PACKAGE_NAME,
  GOOGLE_PLAY_VIP_MONTHLY_PRODUCT_ID,
  GOOGLE_PLAY_VIP_PLUS_MONTHLY_PRODUCT_ID,
  GOOGLE_PLAY_VIP_WEEKLY_PRODUCT_ID,
} from "@/lib/payment-constants"
import { createClient } from "@/lib/supabase/client"

/**
 * Paiements hybrides (Web / Android natif)
 *
 * **Web** : redirection vers les liens Stripe (`NEXT_PUBLIC_STRIPE_*_LINK`).
 *
 * **Android** : `react-native-iap` (Google Play Billing). Validation via Edge `verify-google-purchase`
 * (enregistre dans `public.purchases`).
 */

export type SubscribePlan = "weekly" | "monthly"
export type AndroidPriceLabels = {
  weekly: string
  monthly: string
  vipPlusMonthly: string
}

function isAndroidNative(): boolean {
  if (typeof window === "undefined") return false
  return Platform.OS === "android"
}

const GOOGLE_PURCHASE_TOKEN_CACHE_KEY = "bk_gp_purchase_tokens_v1"

function readCachedGooglePurchaseTokens(): Record<string, string> {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(GOOGLE_PURCHASE_TOKEN_CACHE_KEY) || ""
    const json = raw ? (JSON.parse(raw) as unknown) : null
    if (!json || typeof json !== "object") return {}
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(json as Record<string, unknown>)) {
      if (typeof k === "string" && typeof v === "string" && k.trim() && v.trim()) {
        out[k.trim()] = v.trim()
      }
    }
    return out
  } catch {
    return {}
  }
}

function writeCachedGooglePurchaseToken(productId: string, purchaseToken: string) {
  if (typeof window === "undefined") return
  const next = { ...readCachedGooglePurchaseTokens(), [productId]: purchaseToken }
  try {
    window.localStorage.setItem(GOOGLE_PURCHASE_TOKEN_CACHE_KEY, JSON.stringify(next))
  } catch {
    // ignore (stockage plein / privé)
  }
}

/** Attend le bridge natif Capacitor + éventuel `deviceready` Cordova (plugin IAP). */
async function waitForNativePurchaseBridge(): Promise<void> {
  if (typeof window === "undefined") return
  try {
    await App.getInfo()
  } catch {
    /* Web / pas encore prêt */
  }
  await new Promise<void>((resolve) => {
    if (typeof document === "undefined") {
      resolve()
      return
    }
    const w = window as Window & { cordova?: unknown }
    if (w.cordova) {
      document.addEventListener("deviceready", () => resolve(), { once: true })
      setTimeout(resolve, 4000)
    } else {
      resolve()
    }
  })
}

/** Abonnement VIP mensuel : Stripe sur le Web ; Google Play (`vip-mensuel-bkg`) sur Android. Validation via Edge `verify-google-purchase`. */
export async function buyVIP(accessToken: string | null | undefined): Promise<void> {
  if (!isAndroidNative()) {
    const monthly = process.env.NEXT_PUBLIC_STRIPE_MONTHLY_LINK
    if (!monthly) {
      throw new Error("Paiement Stripe indisponible (NEXT_PUBLIC_STRIPE_MONTHLY_LINK manquant).")
    }
    window.location.href = monthly
    return
  }
  await purchaseAndroidSubscriptionWithReactNativeIap(GOOGLE_PLAY_VIP_MONTHLY_PRODUCT_ID, accessToken)
}

/** Abonnement VIP+ mensuel : Google Play sur Android ; Stripe sur le Web (si configuré). */
export async function buyVIPPlus(accessToken: string | null | undefined): Promise<void> {
  if (!isAndroidNative()) {
    const vipPlus = process.env.NEXT_PUBLIC_STRIPE_VIP_PLUS_LINK
    if (!vipPlus) {
      throw new Error("Paiement VIP+ indisponible (NEXT_PUBLIC_STRIPE_VIP_PLUS_LINK manquant).")
    }
    window.location.href = vipPlus
    return
  }
  await purchaseAndroidSubscriptionWithReactNativeIap(GOOGLE_PLAY_VIP_PLUS_MONTHLY_PRODUCT_ID, accessToken)
}

export class PaymentService {
  static isAndroidNative(): boolean {
    return isAndroidNative()
  }

  static async getAndroidPriceLabels(): Promise<AndroidPriceLabels> {
    const fallback: AndroidPriceLabels = {
      weekly: "1,99€",
      monthly: "4,99€",
      vipPlusMonthly: "7,99€",
    }
    if (!isAndroidNative()) return fallback
    try {
      const iap = await getIapSafe()
      const skus = [
        GOOGLE_PLAY_VIP_WEEKLY_PRODUCT_ID,
        GOOGLE_PLAY_VIP_MONTHLY_PRODUCT_ID,
        GOOGLE_PLAY_VIP_PLUS_MONTHLY_PRODUCT_ID,
      ].filter(Boolean)

      await iap.initConnection()
      try {
        const subs = await iap.getSubscriptions({ skus })
        const pick = (sku: string): string | null => {
          const p = subs.find((x: any) => x?.productId === sku)
          const pretty =
            (typeof (p as any)?.localizedPrice === "string" && (p as any).localizedPrice) ||
            (typeof (p as any)?.price === "string" && (p as any).price) ||
            null
          return pretty
        }
        return {
          weekly: pick(GOOGLE_PLAY_VIP_WEEKLY_PRODUCT_ID) || fallback.weekly,
          monthly: pick(GOOGLE_PLAY_VIP_MONTHLY_PRODUCT_ID) || fallback.monthly,
          vipPlusMonthly: pick(GOOGLE_PLAY_VIP_PLUS_MONTHLY_PRODUCT_ID) || fallback.vipPlusMonthly,
        }
      } finally {
        try {
          await iap.endConnection()
        } catch {
          // ignore
        }
      }
    } catch (e) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[PaymentService] getAndroidPriceLabels:", e)
      }
      return fallback
    }
  }

  /**
   * Android only — revalide les abonnements connus via tokens en cache.
   * Cela re-synchronise `public.purchases` et donc `profiles.is_vip`/`grade` via triggers SQL.
   */
  static async verifyAndroidSubscriptionsOnLaunch(accessToken: string | null | undefined): Promise<void> {
    if (!isAndroidNative()) return
    if (!accessToken?.trim()) return
    const cached = readCachedGooglePurchaseTokens()
    const entries = Object.entries(cached).filter(([pid, tok]) => pid && tok)
    if (entries.length === 0) return
    const supabase = createClient()
    await Promise.all(
      entries.map(async ([productId, purchaseToken]) => {
        try {
          await supabase.functions.invoke("verify-google-purchase", {
            body: {
              packageName: ANDROID_PACKAGE_NAME,
              productId,
              purchaseToken,
            },
          })
        } catch {
          // ignore
        }
      }),
    )
  }

  static async subscribe(params: {
    plan: SubscribePlan | "vip_plus_monthly"
    accessToken: string | null | undefined
  }): Promise<void> {
    const { plan, accessToken } = params

    if (isAndroidNative()) {
      const productId =
        plan === "vip_plus_monthly"
          ? GOOGLE_PLAY_VIP_PLUS_MONTHLY_PRODUCT_ID
          : plan === "monthly"
            ? GOOGLE_PLAY_VIP_MONTHLY_PRODUCT_ID
            : GOOGLE_PLAY_VIP_WEEKLY_PRODUCT_ID
      await purchaseAndroidSubscriptionWithReactNativeIap(productId, accessToken)
      return
    }

    const weekly = process.env.NEXT_PUBLIC_STRIPE_WEEKLY_LINK
    const monthly = process.env.NEXT_PUBLIC_STRIPE_MONTHLY_LINK
    const checkoutUrl = plan === "weekly" ? weekly : monthly
    if (!checkoutUrl) {
      throw new Error("Paiement Stripe indisponible (variables NEXT_PUBLIC_STRIPE_*_LINK manquantes).")
    }
    window.location.href = checkoutUrl
  }
}

type IapModule = typeof import("react-native-iap")

async function getIapSafe(): Promise<IapModule> {
  try {
    return (await import("react-native-iap")) as IapModule
  } catch (e) {
    console.error("[IAP] react-native-iap import failed", e)
    throw new Error("Paiement Google Play indisponible sur cet environnement.")
  }
}

async function purchaseAndroidSubscriptionWithReactNativeIap(
  productId: string,
  accessToken: string | null | undefined,
): Promise<void> {
  try {
    if (!accessToken?.trim()) {
      throw new Error("Session requise pour valider l’achat sur le serveur.")
    }

    const iap = await getIapSafe()
    await iap.initConnection()

    let subUpdate: { remove: () => void } | null = null
    let subError: { remove: () => void } | null = null

    try {
      const purchaseToken = await new Promise<string>((resolve, reject) => {
        let settled = false

        const done = (fn: () => void) => {
          if (settled) return
          settled = true
          try {
            subUpdate?.remove()
          } catch {
            // ignore
          }
          try {
            subError?.remove()
          } catch {
            // ignore
          }
          fn()
        }

        subError = iap.purchaseErrorListener((err: any) => {
          const code = String(err?.code || "")
          const msg = String(err?.message || "")
          if (code.toLowerCase().includes("cancel") || msg.toLowerCase().includes("cancel")) {
            done(() => reject(new Error("Achat annulé.")))
            return
          }
          done(() => reject(new Error("Erreur Google Play Billing. Réessaie plus tard.")))
        })

        subUpdate = iap.purchaseUpdatedListener(async (purchase: any) => {
          try {
            const token = typeof purchase?.purchaseToken === "string" ? purchase.purchaseToken : ""
            const pid = typeof purchase?.productId === "string" ? purchase.productId : ""
            if (!token || pid !== productId) return

            writeCachedGooglePurchaseToken(productId, token)

            const supabase = createClient()
            const { data: fnRes, error: fnErr } = await supabase.functions.invoke("verify-google-purchase", {
              body: {
                packageName: ANDROID_PACKAGE_NAME,
                productId,
                purchaseToken: token,
              },
            })
            if (fnErr) throw new Error(fnErr.message || "Échec de la validation serveur.")
            if (!fnRes || (fnRes as { ok?: boolean; error?: string }).ok !== true) {
              const errMsg = (fnRes as { error?: string } | null)?.error || "Échec de la validation serveur."
              throw new Error(errMsg)
            }

            await iap.finishTransaction({ purchase, isConsumable: false })
            done(() => resolve(token))
          } catch (e) {
            done(() => reject(e instanceof Error ? e : new Error(String(e))))
          }
        })

        void iap
          .requestSubscription({
            sku: productId,
          } as any)
          .catch((e: any) => {
            const msg = e instanceof Error ? e.message : String(e)
            done(() => reject(new Error(msg || "Impossible de lancer l’achat.")))
          })
      })

      if (!purchaseToken) {
        throw new Error("Jeton d’achat Google manquant.")
      }
    } finally {
      try {
        await iap.endConnection()
      } catch {
        // ignore
      }
    }
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e)
    if (raw.includes("introuvable") || raw.includes("Produit Google Play")) {
      throw new Error(
        "Abonnement indisponible pour le moment (produit en cours de validation sur Google Play). Réessaie plus tard.",
      )
    }
    if (raw.includes("Google Play") || raw.includes("Billing") || raw.includes("IAP")) {
      throw new Error(raw)
    }
    throw new Error("Impossible de finaliser l’achat pour le moment. Réessaie plus tard.")
  }
}
