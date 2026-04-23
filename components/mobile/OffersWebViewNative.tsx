import { useCallback, useMemo, useState } from "react"
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from "react-native"
import { WebView } from "react-native-webview"

function safeUrlWithUserId(rawUrl: string, userId: string): string {
  const u = rawUrl.trim()
  if (!u) return ""
  if (u.includes("{user_id}")) return u.replaceAll("{user_id}", encodeURIComponent(userId))
  try {
    const parsed = new URL(u)
    if (!parsed.searchParams.get("user_id")) parsed.searchParams.set("user_id", userId)
    return parsed.toString()
  } catch {
    const sep = u.includes("?") ? "&" : "?"
    return `${u}${sep}user_id=${encodeURIComponent(userId)}`
  }
}

function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return ""
  }
}

const BLOCKED_HOSTS = new Set(["bkg-dashboard.com"])

function isAllowedHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  if (!h) return true
  if (BLOCKED_HOSTS.has(h)) return false
  // Lootably / Revlum (et sous-domaines)
  if (h === "lootably.com" || h.endsWith(".lootably.com")) return true
  if (h === "revlum.com" || h.endsWith(".revlum.com")) return true
  // Autoriser pages internes de tracking si elles sont sur les mêmes domaines
  return false
}

export function OffersWebViewNative(props: { userId: string | null; onClose: () => void }) {
  const [tab, setTab] = useState<"lootably" | "revlum">("lootably")
  const [loading, setLoading] = useState(true)

  const lootablyBase = String(process.env.NEXT_PUBLIC_LOOTABLY_URL || "").trim()
  const revlumBase = String(process.env.NEXT_PUBLIC_REVLUM_URL || "").trim()

  const canOpen = Boolean(props.userId && (lootablyBase || revlumBase))

  const url = useMemo(() => {
    if (!props.userId) return ""
    const base = tab === "lootably" ? lootablyBase : revlumBase
    return safeUrlWithUserId(base, props.userId)
  }, [props.userId, tab, lootablyBase, revlumBase])

  const onShouldStartLoadWithRequest = useCallback((req: any) => {
    const nextUrl = String(req?.url || "")
    if (!nextUrl) return false
    if (nextUrl.startsWith("about:blank")) return true
    if (!/^https?:\/\//i.test(nextUrl)) return false
    const host = hostFromUrl(nextUrl)
    const allowed = isAllowedHost(host)
    if (!allowed) {
      Alert.alert("Navigation bloquée", "Pour votre sécurité, les liens externes sont désactivés dans l’app.")
    }
    return allowed
  }, [])

  if (!canOpen) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable onPress={props.onClose} style={styles.backBtn}>
            <Text style={styles.backTxt}>‹ Retour</Text>
          </Pressable>
          <Text style={styles.title}>Offres</Text>
          <View style={{ width: 70 }} />
        </View>
        <View style={styles.center}>
          <Text style={styles.errTitle}>Offres indisponibles</Text>
          <Text style={styles.errBody}>
            {props.userId ? "Configuration manquante (URLs Lootably/Revlum)." : "Connecte-toi pour accéder aux offres."}
          </Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={props.onClose} style={styles.backBtn}>
          <Text style={styles.backTxt}>‹ Retour</Text>
        </Pressable>
        <Text style={styles.title}>Offres</Text>
        <View style={{ width: 70 }} />
      </View>

      <View style={styles.tabs}>
        <Pressable onPress={() => setTab("lootably")} style={[styles.tab, tab === "lootably" && styles.tabActive]}>
          <Text style={[styles.tabTxt, tab === "lootably" && styles.tabTxtActive]}>Lootably</Text>
        </Pressable>
        <Pressable onPress={() => setTab("revlum")} style={[styles.tab, tab === "revlum" && styles.tabActive]}>
          <Text style={[styles.tabTxt, tab === "revlum" && styles.tabTxtActive]}>Revlum</Text>
        </Pressable>
      </View>

      <View style={styles.webviewWrap}>
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="small" color="#fafafa" />
            <Text style={styles.loadingTxt}>Chargement…</Text>
          </View>
        ) : null}
        <WebView
          source={{ uri: url }}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
          setSupportMultipleWindows={false}
          javaScriptEnabled
          domStorageEnabled
          incognito
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0a0a0a" },
  header: {
    paddingTop: 14,
    paddingBottom: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.10)",
  },
  title: { color: "#fafafa", fontSize: 16, fontWeight: "700" },
  backBtn: { paddingVertical: 6, paddingHorizontal: 8 },
  backTxt: { color: "#d4af37", fontSize: 14, fontWeight: "700" },
  tabs: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  tabActive: { borderColor: "rgba(212,175,55,0.55)", backgroundColor: "rgba(212,175,55,0.12)" },
  tabTxt: { color: "rgba(255,255,255,0.75)", fontWeight: "700", fontSize: 13 },
  tabTxtActive: { color: "#fafafa" },
  webviewWrap: { flex: 1 },
  loading: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  loadingTxt: { color: "#fafafa", fontSize: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  errTitle: { color: "#fafafa", fontSize: 18, fontWeight: "800", marginBottom: 8 },
  errBody: { color: "rgba(255,255,255,0.75)", textAlign: "center" },
})

