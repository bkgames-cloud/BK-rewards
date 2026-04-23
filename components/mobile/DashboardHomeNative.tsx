import { useCallback, useEffect, useState } from "react"
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  Alert,
} from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { createClient } from "@/lib/supabase/client"
import { OFFERS_ENABLED } from "@/lib/offerwall-ui"
import { OffersWebViewNative } from "@/components/mobile/OffersWebViewNative"
import { LegalNoticesNative } from "@/components/mobile/LegalNoticesNative"

/**
 * Reproduction native du dashboard web (`DashboardClient` + home) : mêmes tons sombres, or, cartes sky/violet,
 * sans `div` / Tailwind. Les actions qui utilisaient Capacitor passent par `expo-web-browser`.
 *
 * Vidéo récompensée : dans Expo Go / shell sans plugin AdMob, on ouvre le site (flux points côté web).
 * L’app Android Capacitor conserve les pubs in-app via `lib/admob-rewarded.ts`.
 */

export function DashboardHomeNative() {
  const [refreshing, setRefreshing] = useState(false)
  const [points, setPoints] = useState<number | null>(null)
  const [totalTickets, setTotalTickets] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [screen, setScreen] = useState<"home" | "offers" | "legal">("home")
  const [userId, setUserId] = useState<string | null>(null)

  const loadPlaceholder = useCallback(async () => {
    setLoading(true)
    await new Promise((r) => setTimeout(r, 350))
    setPoints(null)
    setTotalTickets(0)
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadPlaceholder()
  }, [loadPlaceholder])

  useEffect(() => {
    const loadUser = async () => {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        setUserId(user?.id ?? null)
      } catch {
        setUserId(null)
      }
    }
    void loadUser()
  }, [])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadPlaceholder()
    setRefreshing(false)
  }, [loadPlaceholder])

  const onRewardedVideo = useCallback(() => {
    Alert.alert("Indisponible", "Les vidéos récompensées sont temporairement indisponibles dans cette version.")
  }, [])

  const onVipAccess = useCallback(() => {
    Alert.alert("Boutique", "Les achats se font uniquement via Google Play dans l’app Android.")
  }, [])

  const onOpenOffers = useCallback(() => {
    if (!OFFERS_ENABLED) {
      Alert.alert("Offres", "Offres momentanément indisponibles.")
      return
    }
    setScreen("offers")
  }, [])

  const topInset = Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) + 8 : 14

  if (screen === "offers") {
    return (
      <OffersWebViewNative
        userId={userId}
        onClose={() => setScreen("home")}
      />
    )
  }
  if (screen === "legal") {
    return <LegalNoticesNative onClose={() => setScreen("home")} />
  }

  return (
    <View style={[styles.screen, { paddingTop: topInset }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#d4af37" />}
      >
        {/* Barre solde — équivalent sticky « Points disponibles » */}
        <View style={styles.stickyBar}>
          <Text style={styles.mutedSm}>Points disponibles</Text>
          {loading ? (
            <ActivityIndicator size="small" color="#fafafa" />
          ) : (
            <Text style={styles.pointsSm}>{points ?? "—"}</Text>
          )}
        </View>

        {/* Bienvenue — rounded-2xl bg-card */}
        <View style={styles.welcomeCard}>
          <Text style={styles.welcomeTitle}>Bienvenue sur BKG Rewards !</Text>
          <Text style={styles.welcomeSub}>
            Regardez des publicités pour gagner des points et participer aux tirages.
          </Text>
        </View>

        {/* Note de lancement — bordure ambre */}
        <View style={styles.amberCard}>
          <Text style={styles.amberTitle}>Note de lancement</Text>
          <Text style={styles.amberBody}>
            Mois de lancement : pour garantir la sécurité des transactions, les premiers lots seront expédiés
            entre la fin du mois en cours et le début du mois prochain. Merci de votre confiance !
          </Text>
        </View>

        {/* Accès VIP — évite les chemins Capacitor / achats natifs non liés à Expo */}
        <Pressable
          onPress={onVipAccess}
          disabled={busy}
          style={({ pressed }) => [styles.vipPressable, pressed && styles.pressed]}
        >
          <LinearGradient colors={["#422006", "#1c1917", "#0c0a09"]} style={styles.vipCard}>
            <Text style={styles.vipEmoji}>👑</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.vipTitle}>Accès VIP</Text>
              <Text style={styles.vipSub}>Pass Confort — abonnements et avantages (page web sécurisée)</Text>
            </View>
            <Text style={styles.vipChevron}>›</Text>
          </LinearGradient>
        </Pressable>

        {/* Actions or — gradient D4AF37 */}
        <View style={styles.relative}>
          <Pressable onPress={onOpenOffers} disabled={busy || !OFFERS_ENABLED}>
            <LinearGradient
              colors={["#D4AF37", "#fbbf24", "#fef08a"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.goldBtn, (!OFFERS_ENABLED || busy) && styles.disabled]}
            >
              <Text style={styles.goldBtnText}>
                {!OFFERS_ENABLED ? "⏳ Offres en cours de mise à jour" : "🔥 Actions (Offres Spéciales)"}
              </Text>
            </LinearGradient>
          </Pressable>
          {!OFFERS_ENABLED ? (
            <View style={styles.comingSoonOverlay} pointerEvents="none">
              <Text style={styles.comingSoonText}>Prochainement</Text>
            </View>
          ) : null}
        </View>

        {/* Grille : vidéo sky + violet offres */}
        <View style={styles.gridCol}>
          <View style={styles.skyCard}>
            <View style={styles.rowTop}>
              <View style={styles.skyIconWrap}>
                <Text style={styles.playIcon}>▶</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardH3}>Regarder une Vidéo</Text>
                <Text style={styles.cardMutedXs}>
                  Chaque vidéo complétée rapporte +1 point sur le site. Sur Expo, ouverture du site (pas de crash
                  AdMob).
                </Text>
              </View>
              <View style={styles.badgeSky}>
                <Text style={styles.badgeSkyTxt}>+1 pt</Text>
              </View>
            </View>
            <Pressable onPress={onRewardedVideo} disabled={busy}>
              <LinearGradient
                colors={["#38bdf8", "#6366f1"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.skyCta}
              >
                <Text style={styles.skyCtaTxt}>{busy ? "Ouverture…" : "Lancer la vidéo"}</Text>
              </LinearGradient>
            </Pressable>
            <Text style={styles.quotaHint}>Pubs restantes : — /25 aujourd’hui • — /5 cette heure</Text>
          </View>

          <View style={styles.violetCard}>
            <View style={styles.rowTop}>
              <View style={styles.violetIconWrap}>
                <Text style={styles.targetIcon}>◎</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardH3}>Actions (Revenus élevés)</Text>
                <Text style={styles.cardMutedXs}>Offres partenaires — affichage interne dans l’app.</Text>
              </View>
              <View style={styles.badgeViolet}>
                <Text style={styles.badgeVioletTxt}>Offres</Text>
              </View>
            </View>
            <Pressable onPress={onOpenOffers} disabled={busy || !OFFERS_ENABLED}>
              <View style={[styles.violetBtn, (!OFFERS_ENABLED || busy) && styles.disabledSoft]}>
                <Text style={styles.violetBtnTxt}>
                  {!OFFERS_ENABLED ? "⏳ Offres en cours de mise à jour" : "Ouvrir les offres"}
                </Text>
              </View>
            </Pressable>
            {!OFFERS_ENABLED ? (
              <View style={styles.comingSoonOverlaySmall} pointerEvents="none">
                <Text style={styles.comingSoonText}>Prochainement</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Emerald */}
        <View style={styles.relative}>
          <Pressable onPress={onOpenOffers} disabled={busy || !OFFERS_ENABLED}>
            <LinearGradient
              colors={["#059669", "#0d9488"]}
              style={[styles.emeraldBtn, (!OFFERS_ENABLED || busy) && styles.disabled]}
            >
              <Text style={styles.emeraldTxt}>Offres</Text>
            </LinearGradient>
          </Pressable>
          {!OFFERS_ENABLED ? (
            <View style={styles.comingSoonOverlay} pointerEvents="none">
              <Text style={styles.comingSoonText}>Prochainement</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.hintXs}>Tunnel 100% interne — aucun lien externe.</Text>

        <Pressable
          onPress={() => setScreen("legal")}
          disabled={busy}
          style={({ pressed }) => [styles.outlineBtn, pressed && styles.pressed]}
        >
          <Text style={styles.outlineTxt}>Mentions légales (Privacy & CGU)</Text>
        </Pressable>

        {/* Wallet */}
        <View style={styles.walletCard}>
          <Text style={styles.mutedSm}>Votre solde</Text>
          <Text style={styles.walletPoints}>
            {loading ? "…" : points != null ? `${points} points` : "— points"}
          </Text>
          <View style={styles.ticketRow}>
            <Text style={styles.ticketBadge}>🎟️ {totalTickets} tickets</Text>
          </View>
        </View>

        {/* Derniers gagnants — carte comme le web */}
        <View style={styles.cardBase}>
          <Text style={styles.sectionTitle}>Derniers Gagnants</Text>
          <Text style={styles.cardMutedXs}>Aucun gagnant récent pour le moment.</Text>
        </View>

        {/* Mini-jeux */}
        <View style={styles.cardBase}>
          <Text style={styles.sectionTitle}>Mini-jeux</Text>
          <Text style={styles.cardMutedXs}>
            Accédez à la roue, au scratch et au Tap-Tap depuis la page Concours sur le site.
          </Text>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 0,
  },
  stickyBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(28, 28, 28, 0.95)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
  },
  mutedSm: {
    fontSize: 13,
    color: "#a3a3a3",
  },
  pointsSm: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fafafa",
  },
  welcomeCard: {
    borderRadius: 16,
    backgroundColor: "rgba(38, 38, 38, 0.95)",
    padding: 16,
    marginBottom: 14,
  },
  welcomeTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#fafafa",
  },
  welcomeSub: {
    marginTop: 6,
    fontSize: 13,
    color: "#a3a3a3",
    lineHeight: 18,
  },
  amberCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.35)",
    backgroundColor: "rgba(120, 53, 15, 0.28)",
    padding: 14,
    marginBottom: 14,
  },
  amberTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fde68a",
    marginBottom: 8,
  },
  amberBody: {
    fontSize: 13,
    lineHeight: 19,
    color: "rgba(254, 243, 199, 0.92)",
  },
  vipPressable: {
    marginBottom: 14,
    borderRadius: 14,
    overflow: "hidden",
  },
  vipCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(212, 175, 55, 0.35)",
  },
  vipEmoji: {
    fontSize: 28,
    marginRight: 12,
  },
  vipTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fef3c7",
  },
  vipSub: {
    marginTop: 4,
    fontSize: 12,
    color: "rgba(253, 230, 138, 0.85)",
    lineHeight: 16,
  },
  vipChevron: {
    fontSize: 28,
    color: "#d4af37",
    fontWeight: "300",
  },
  goldBtn: {
    paddingVertical: 20,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 14,
  },
  goldBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0a0a0a",
  },
  relative: {
    position: "relative",
    marginBottom: 14,
  },
  comingSoonOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.52)",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  comingSoonOverlaySmall: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  comingSoonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  gridCol: {
    gap: 12,
    marginBottom: 4,
  },
  skyCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(14, 165, 233, 0.35)",
    backgroundColor: "rgba(12, 74, 110, 0.45)",
    padding: 14,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  skyIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(14, 165, 233, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  playIcon: { color: "#7dd3fc", fontSize: 16 },
  cardH3: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fafafa",
  },
  cardMutedXs: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 15,
    color: "#a3a3a3",
  },
  badgeSky: {
    backgroundColor: "rgba(14, 165, 233, 0.22)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeSkyTxt: { fontSize: 11, fontWeight: "700", color: "#e0f2fe" },
  skyCta: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  skyCtaTxt: { color: "#fff", fontWeight: "700", fontSize: 14 },
  quotaHint: { marginTop: 8, fontSize: 11, color: "#94a3b8" },
  violetCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.35)",
    backgroundColor: "rgba(46, 16, 101, 0.35)",
    padding: 14,
    position: "relative",
    overflow: "hidden",
  },
  violetIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(139, 92, 246, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  targetIcon: { color: "#c4b5fd", fontSize: 18 },
  badgeViolet: {
    backgroundColor: "rgba(139, 92, 246, 0.22)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeVioletTxt: { fontSize: 11, fontWeight: "700", color: "#ede9fe" },
  violetBtn: {
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.4)",
    backgroundColor: "rgba(139, 92, 246, 0.12)",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  violetBtnTxt: { color: "#fafafa", fontWeight: "600", fontSize: 14 },
  emeraldBtn: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 10,
  },
  emeraldTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },
  outlineBtn: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(38,38,38,0.9)",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 6,
  },
  outlineTxt: { color: "#fafafa", fontSize: 14 },
  hintXs: {
    fontSize: 10,
    textAlign: "center",
    color: "#737373",
    marginBottom: 14,
  },
  walletCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "#141414",
    padding: 16,
    marginBottom: 14,
  },
  walletPoints: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fafafa",
    marginTop: 4,
  },
  ticketRow: { marginTop: 10 },
  ticketBadge: {
    fontSize: 12,
    fontWeight: "600",
    color: "#7dd3fc",
    backgroundColor: "rgba(14, 165, 233, 0.12)",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  cardBase: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "#1a1a1a",
    padding: 14,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fafafa",
    marginBottom: 8,
  },
  pressed: { opacity: 0.88 },
  disabled: { opacity: 0.55 },
  disabledSoft: { opacity: 0.5 },
})
