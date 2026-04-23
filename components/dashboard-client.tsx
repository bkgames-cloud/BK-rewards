"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { SeasonTimer } from "@/components/season-timer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import type { Profile, Season } from "@/lib/types"
import { Trophy, Sparkles, Crown, Copy, Play, Target } from "lucide-react"
import { soundService } from "@/lib/sounds"
import { AnimatedCounter } from "@/components/animated-counter"
import { Confetti } from "@/components/confetti"
import { addInAppNotification } from "@/lib/in-app-notifications"
import { RewardPoolsGrid } from "@/components/reward-pools-grid"
import { showRewardVideo } from "@/lib/admob-rewarded"
import { cn } from "@/lib/utils"
import { openExternalUrl } from "@/lib/open-external-url"
import { updateUserPoints } from "@/lib/update-user-points"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { countVideoViewsLastHour, isHourlyVideoQuotaExceeded } from "@/lib/video-quota"
import { OFFERS_ENABLED } from "@/lib/offerwall-ui"

/** Offres : écran interne côté app, route interne côté web. */

interface DashboardClientProps {
  isAuthenticated: boolean
  userId?: string
  profile?: Profile | null
  season?: Season | null
  showWallet?: boolean
  showWelcome?: boolean
  showRewardsPools?: boolean
  minimalHome?: boolean
  /** Détection plateforme injectée par la page (Web vs Android natif). */
  isNativeApp?: boolean
}

export function DashboardClient({
  isAuthenticated,
  userId,
  profile,
  season,
  showWallet = true,
  showWelcome = true,
  showRewardsPools = false,
  minimalHome = false,
  isNativeApp: isNativeAppProp,
}: DashboardClientProps) {
  const { toast } = useToast()
  const [offersSoonOpen, setOffersSoonOpen] = useState(false)
  const [points, setPoints] = useState(profile?.points ?? 0)
  const [isVip, setIsVip] = useState(false)
  const [isVipPlus, setIsVipPlus] = useState(false)
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [lastVipPlusWinner, setLastVipPlusWinner] = useState<{ name: string; prize: string } | null>(null)
  /** Nombre total de vidéos récompensées (lifetime) — pour affichage +2 / +1. */
  const [videoLifetimeCount, setVideoLifetimeCount] = useState<number | null>(null)
  /** Nombre de réclamations mission (table `mission_action_claims`). */
  const [vipDailyClaimedToday, setVipDailyClaimedToday] = useState(false)
  const [userRewards, setUserRewards] = useState<
    Array<{
      id: string
      tickets_earned: number
      created_at: string
      pool_name: string
    }>
  >([])
  const [totalTickets, setTotalTickets] = useState(0)
  const [adsUsedToday, setAdsUsedToday] = useState(0)
  const [adsUsedThisHour, setAdsUsedThisHour] = useState(0)
  const [referralCode, setReferralCode] = useState<string | null>(profile?.referral_code || null)
  const [copyMessage, setCopyMessage] = useState<string | null>(null)
  const lastAdClickRef = useRef<number>(0)
  const simulationTimeoutRef = useRef<number | null>(null)
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  const hasValidUserId = Boolean(userId && UUID_REGEX.test(userId))

  
  // Vérifier le statut VIP
  useEffect(() => {
    async function checkVipStatus() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.id) return;
      
      // Protection 400 : vérifier userId ET user au tout début
      if (!hasValidUserId) {
        setIsVip(false)
        return
      }
      
      // Protection 400 : empêcher l'appel si user.id ne correspond pas à userId
      if (user.id !== userId) {
        setIsVip(false)
        return
      }
      
      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("is_vip, is_vip_plus, notification_message, last_claim_date")
        .eq("id", userId)
        .single()

      let effectiveProfile = profileData
      if (error) {
        const { data: fallbackProfile, error: fallbackError } = await supabase
          .from("profiles")
          .select("is_vip, is_vip_plus, last_claim_date")
          .eq("id", userId)
          .single()
        if (!fallbackError) {
          effectiveProfile = {
            ...(fallbackProfile as { is_vip?: boolean; is_vip_plus?: boolean }),
            notification_message: null,
          }
        }
      }

      if (effectiveProfile) {
        const vipPlus = effectiveProfile.is_vip_plus || false
        setIsVip(effectiveProfile.is_vip || vipPlus)
        setIsVipPlus(vipPlus)
        const lastClaim = effectiveProfile.last_claim_date ? new Date(effectiveProfile.last_claim_date) : null
        const today = new Date()
        setVipDailyClaimedToday(Boolean(lastClaim && lastClaim.toDateString() === today.toDateString()))
        if (effectiveProfile.notification_message) {
          setNotificationMessage(effectiveProfile.notification_message)
        }
      }
    }
    
    async function loadVipStatus() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return;
      checkVipStatus()
    }
    
    loadVipStatus()
  }, [userId]) // Recharger si userId change
  
  // Mettre à jour les points quand le profil change
  useEffect(() => {
    if (profile?.points !== undefined) {
      setPoints(profile.points)
    }
    if (profile?.referral_code) {
      setReferralCode(profile.referral_code)
    }
  }, [profile])

  useEffect(() => {
    const ensureReferralCode = async () => {
      if (!hasValidUserId) return;
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id || user.id !== userId) return;

      const isCodeMissing = (value: string | null | undefined) => !value || value.trim().length === 0;

      const generateCandidateCode = (firstName?: string | null) => {
        const cleanFirstName = (firstName || "")
          .replace(/[^a-zA-Z0-9]/g, "")
          .toUpperCase()
          .slice(0, 3);
        const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let suffix = "";
        for (let i = 0; i < 3; i += 1) {
          suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
        }
        return `${cleanFirstName}${suffix}`.slice(0, 6).padEnd(6, "X");
      };

      const buildUniqueCode = async (firstName?: string | null) => {
        for (let attempt = 0; attempt < 15; attempt += 1) {
          const candidate = generateCandidateCode(firstName);
          const { count, error } = await supabase
            .from("profiles")
            .select("id", { head: true, count: "exact" })
            .eq("referral_code", candidate);
          if (!error && (count ?? 0) === 0) {
            return candidate;
          }
        }
        return null;
      };

      // Generation locale du code (pas d'API Next.js en mode export).
      const { data: currentProfile, error: profileError } = await supabase
        .from("profiles")
        .select("referral_code, first_name")
        .eq("id", userId)
        .maybeSingle();

      if (profileError || !currentProfile) return;

      const existingCode = currentProfile.referral_code?.toUpperCase().trim() ?? "";
      if (!isCodeMissing(existingCode)) {
        setReferralCode(existingCode);
        return;
      }

      const generatedCode = await buildUniqueCode(currentProfile.first_name);
      if (!generatedCode) return;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ referral_code: generatedCode, updated_at: new Date().toISOString() })
        .eq("id", userId);

      if (!updateError) {
        setReferralCode(generatedCode);
      }
    };
    void ensureReferralCode();
  }, [userId]);

  // Bonus FLYER: attribue +3 points a la premiere connexion reussie au dashboard.
  useEffect(() => {
    const applyFlyerBonusOnDashboard = async () => {
      if (typeof window === "undefined") return
      if (!isAuthenticated || !hasValidUserId) return
      const uid = userId
      if (!uid) return

      const pendingReferral = window.sessionStorage.getItem("pending_referral")
      if (pendingReferral !== "FLYER") return

      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      // Securite: ne jamais modifier des points sans utilisateur authentifie.
      if (!user?.id || user.id !== uid) return

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("points, flyer_bonus_granted")
        .eq("id", uid)
        .maybeSingle()

      if (profileError || !profileData) return

      if (profileData.flyer_bonus_granted) {
        window.sessionStorage.removeItem("pending_referral")
        return
      }

      const nextPoints = (profileData.points ?? 0) + 3
      const res = await updateUserPoints(supabase, {
        userId: uid,
        points: nextPoints,
        extra: {
          flyer_bonus_granted: true,
        },
      })
      if (!res.ok) {
        console.error("[dashboard] flyer bonus updateUserPoints failed:", { error: res.error, details: res.details })
        return
      }

      setPoints(nextPoints)
      window.sessionStorage.removeItem("pending_referral")
    }

    void applyFlyerBonusOnDashboard()
  }, [isAuthenticated, userId])

  const fetchTicketsAndParticipations = useCallback(async () => {
    if (!hasValidUserId || !userId) {
      setUserRewards([])
      setTotalTickets(0)
      return
    }
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id || user.id !== userId) {
      setUserRewards([])
      setTotalTickets(0)
      return
    }
    const { count } = await supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
    setTotalTickets(count || 0)

    const { data, error } = await supabase
      .from("tickets")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10)

    if (!error && data) {
      const rows = data as Array<Record<string, unknown>>
      const poolIds = Array.from(
        new Set(
          rows
            .map((row) => String((row.pool_id as string | undefined) ?? (row.prize_id as string | undefined) ?? ""))
            .filter(Boolean),
        ),
      )

      let poolNameById = new Map<string, string>()
      if (poolIds.length > 0) {
        const { data: poolsData } = await supabase
          .from("rewards_pools")
          .select("id, name")
          .in("id", poolIds)
        poolNameById = new Map(
          (poolsData ?? []).map((pool: Record<string, unknown>) => [String(pool.id), String(pool.name ?? "Lot")]),
        )
      }

      const normalized = rows.map((row, index) => {
        const poolId = String((row.pool_id as string | undefined) ?? (row.prize_id as string | undefined) ?? "")
        const tickets = Number(
          (row.tickets_earned as number | undefined) ??
            (row.tickets as number | undefined) ??
            (row.quantity as number | undefined) ??
            1,
        )
        const createdAt = String((row.created_at as string | undefined) ?? new Date().toISOString())
        return {
          id: String((row.id as string | undefined) ?? `${poolId}-${index}`),
          tickets_earned: Number.isFinite(tickets) ? tickets : 1,
          created_at: createdAt,
          pool_name: poolNameById.get(poolId) ?? (poolId ? `Lot ${poolId.slice(0, 8)}` : "Lot inconnu"),
        }
      })
      setUserRewards(normalized)
    }
  }, [hasValidUserId, userId])

  useEffect(() => {
    void fetchTicketsAndParticipations()
  }, [fetchTicketsAndParticipations])

  const refreshProfilePointsFromSupabase = useCallback(async () => {
    if (!hasValidUserId || !userId) return
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id || user.id !== userId) return
    const { data, error } = await supabase.from("profiles").select("points").eq("id", userId).maybeSingle()
    if (error || !data) return
    const raw = data.points
    const parsed =
      typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN
    if (Number.isFinite(parsed)) {
      setPoints(Math.max(0, Math.floor(parsed)))
    }
  }, [hasValidUserId, userId])

  const lastDashboardForegroundRef = useRef(0)
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible") return
      const now = Date.now()
      if (now - lastDashboardForegroundRef.current < 4000) return
      lastDashboardForegroundRef.current = now
      void fetchTicketsAndParticipations()
      void refreshProfilePointsFromSupabase()
    }
    document.addEventListener("visibilitychange", onVis)
    return () => document.removeEventListener("visibilitychange", onVis)
  }, [fetchTicketsAndParticipations, refreshProfilePointsFromSupabase])


  // BONUS VIP/VIP+ : interdit en automatique — réclamation uniquement via bouton (page Profil / Premium).

  useEffect(() => {
    async function loadRewardPreviewCounts() {
      if (!hasValidUserId || !isAuthenticated || !userId) {
        setVideoLifetimeCount(null)
        return
      }
      const supabase = createClient()
      const { count: vc } = await supabase
        .from("video_views")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
      setVideoLifetimeCount(vc ?? 0)

    }
    void loadRewardPreviewCounts()
  }, [userId, isAuthenticated, hasValidUserId])

  // Quotas publicités (visuel) : 5/h et 25/j (ne change pas les règles serveur).
  useEffect(() => {
    const run = async () => {
      if (!hasValidUserId || !isAuthenticated || !userId) return
      const supabase = createClient()
      const now = Date.now()
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const hourStartIso = new Date(now - 60 * 60 * 1000).toISOString()
      const todayStartIso = todayStart.toISOString()

      const [{ count: cDay }, { count: cHour }] = await Promise.all([
        supabase
          .from("video_views")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .gte("created_at", todayStartIso),
        supabase
          .from("video_views")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .gte("created_at", hourStartIso),
      ])

      setAdsUsedToday(Math.max(0, Math.floor(cDay ?? 0)))
      setAdsUsedThisHour(Math.max(0, Math.floor(cHour ?? 0)))
    }
    void run()
  }, [hasValidUserId, isAuthenticated, userId])

  // Ancien système "cadeaux" supprimé

  const [isRewarding, setIsRewarding] = useState(false)
  const [isMissionRewarding, setIsMissionRewarding] = useState(false)
  const [isShowingRewardedAd, setIsShowingRewardedAd] = useState(false)
  const [videoWebPromoOpen, setVideoWebPromoOpen] = useState(false)
  const [videoWebPromoKind, setVideoWebPromoKind] = useState<"desktop" | "mobile_web" | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [statusType, setStatusType] = useState<"success" | "error" | null>(null)
  const router = useRouter()

  useEffect(() => {
    return () => {
      if (simulationTimeoutRef.current) {
        window.clearTimeout(simulationTimeoutRef.current)
        simulationTimeoutRef.current = null
      }
    }
  }, [])

  /**
   * Même flux que le Web : RPC `add_reward_points` (scripts/011_add_reward_points.sql) met à jour
   * `public.profiles.points` — les points du dashboard / wallet restent alignés partout.
   */
  const rewardUserForVideo = useCallback(async () => {
    if (!userId) return

    const supabase = createClient()

    // IMPORTANT: le crédit est côté callback de récompense uniquement (pas avant la fin de la pub).
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser()
    if (!currentUser || currentUser.id !== userId) {
      return { ok: false, message: "Vous devez être connecté pour gagner des points." }
    }

    const { data, error } = await supabase.rpc("add_reward_points").single()
    console.log(`Statut de la transaction Supabase : ${error ? "Erreur" : "Succès"}`)
    if (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[DashboardClient] reward_ad_view error:", error)
      }
      return {
        ok: false,
        message:
          error.message?.includes("hour_limit") || error.code === "P0001"
            ? "Limite atteinte : 5 vidéos par heure."
            : error.message?.includes("day_limit")
              ? "Limite atteinte : 25 vidéos par jour."
              : error.message?.includes("not_authenticated")
                ? "Vous devez être connecté pour gagner des points."
                : `Erreur : ${error.message || error.code || "Impossible d'ajouter des points pour le moment."}`,
      }
    }
    if (!data) {
      return { ok: false, message: "Aucune donnée retournée par la fonction." }
    }

    setPoints(data.new_points)
    setStatusMessage(
      data.bonus_applied
        ? "+2 points — bonus 1ère vidéo !"
        : "+1 point ajouté au wallet.",
    )
    setStatusType("success")
    setVideoLifetimeCount((c) => (c == null ? 1 : c + 1))

    // UI immédiate : le compteur “pubs restantes” doit se mettre à jour sans refresh manuel.
    setAdsUsedToday((n) => n + 1)
    setAdsUsedThisHour((n) => n + 1)

    addInAppNotification("Point reçu !")
    soundService.playCoinSound()
    if (!isNativeApp) {
      router.refresh()
    }
    // Relecture en arrière-plan pour se recaler exactement sur la DB (ex. changement d’heure / timezone).
    setTimeout(() => {
      const supa = createClient()
      const now = Date.now()
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const hourStartIso = new Date(now - 60 * 60 * 1000).toISOString()
      const todayStartIso = todayStart.toISOString()
      void Promise.all([
        supa
          .from("video_views")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .gte("created_at", todayStartIso),
        supa
          .from("video_views")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .gte("created_at", hourStartIso),
      ]).then(([dayRes, hourRes]) => {
        setAdsUsedToday(Math.max(0, Math.floor(dayRes.count ?? 0)))
        setAdsUsedThisHour(Math.max(0, Math.floor(hourRes.count ?? 0)))
      })
    }, 600)
    return { ok: true }
  }, [userId, router])

  const handleWatchRewardedAd = useCallback(async () => {
    if (!userId) return

    if (!isAuthenticated) {
      router.push("/auth/login/")
      return
    }

    const now = Date.now()
    const minGapMs = isNativeApp ? 3500 : 1200
    if (now - lastAdClickRef.current < minGapMs) {
      setStatusMessage("Patiente quelques secondes avant de relancer une publicité.")
      setStatusType("error")
      return
    }
    lastAdClickRef.current = now

    if (!isNativeApp) {
      return
    }

    const supabaseQuota = createClient()
    const hourCount = await countVideoViewsLastHour(supabaseQuota, userId)
    console.log(`Utilisateur ID: ${userId} - Tentative de visionnage ${hourCount + 1}/5`)
    if (isHourlyVideoQuotaExceeded(hourCount)) {
      toast({
        title: "Limite atteinte",
        description: "Limite atteinte, reviens plus tard",
        variant: "destructive",
      })
      setStatusMessage("Limite atteinte, reviens plus tard")
      setStatusType("error")
      return
    }

    setIsShowingRewardedAd(true)
    setIsRewarding(true)
    setStatusMessage("Chargement de la vidéo récompensée...")
    setStatusType(null)

    try {
      const result = await showRewardVideo({
        onRewardGranted: async () => {
          const rewardResult = await rewardUserForVideo()
          if (!rewardResult?.ok) {
            throw new Error(rewardResult?.message || "Impossible d’ajouter des points pour le moment.")
          }
        },
      })

      if (!result.ok) {
        setStatusMessage(result.message)
        setStatusType("error")
        return
      }

      setStatusMessage(null)
      setStatusType(null)
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[DashboardClient] rewarded ad error:", error)
      }
      setStatusMessage(
        error instanceof Error ? error.message : "Pub non disponible, réessaie plus tard.",
      )
      setStatusType("error")
    } finally {
      setIsShowingRewardedAd(false)
      setIsRewarding(false)
    }
  }, [userId, router, isAuthenticated, rewardUserForVideo, toast])

  /** Offre : tunnel interne (pas de navigation externe en natif). */
  const handleOpenOffers = useCallback(async () => {
    if (!userId) return
    if (!isAuthenticated) {
      router.push("/auth/login/")
      return
    }
    if (!OFFERS_ENABLED) {
      setStatusMessage("Offres momentanément indisponibles.")
      setStatusType("error")
      return
    }
    setIsMissionRewarding(true)
    setStatusMessage(null)
    setStatusType(null)
    try {
      // Web: pas encore de comptes Lootably/Revlum → modal "bientôt dispo".
      if (!isNativeApp) {
        setOffersSoonOpen(true)
        return
      }
      setStatusMessage("Offres disponibles dans l’écran interne de l’app.")
      setStatusType("error")
    } finally {
      setIsMissionRewarding(false)
    }
  }, [userId, router, isAuthenticated, isNativeApp])

  const handleCopyReferral = async () => {
    if (!referralCode) return
    try {
      await navigator.clipboard.writeText(referralCode)
      setCopyMessage("Code copie !")
      setTimeout(() => setCopyMessage(null), 1500)
    } catch {
      setCopyMessage("Copie impossible")
      setTimeout(() => setCopyMessage(null), 1500)
    }
  }

  // Ancien système de participation aux cadeaux supprimé

  const isFirstVideoEver = (videoLifetimeCount ?? 0) === 0
  const offersUiDisabled = !OFFERS_ENABLED
  const isNativeApp = Boolean(isNativeAppProp)
  // Web: on supprime complètement le bloc "Regarder une Vidéo" (pas de mention AdMob/Android).
  const showVideoPointsCard = isNativeApp && (minimalHome || !isVip) && isAuthenticated
  const offersCardOrder = !isNativeApp ? "order-1 sm:order-1" : "order-2 sm:order-2"
  const videoCardOrder = !isNativeApp ? "order-2 sm:order-2" : "order-1 sm:order-1"

  return (
    <div className="flex flex-col gap-4 p-4">
      {showConfetti && <Confetti duration={2000} particleCount={50} />}
      {!minimalHome && (
        <SeasonTimer season={season ?? ({ name: "Saison 1", end_date: null } as any)} />
      )}

      {!minimalHome && (
        <div className="sticky top-16 z-30 rounded-lg border border-border/50 bg-card/95 px-4 py-2 backdrop-blur-sm">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Points disponibles</span>
            <span className="font-semibold text-foreground">{points}</span>
          </div>
        </div>
      )}

      {/* Notification Message (depuis notification_message) */}
      {!minimalHome && notificationMessage && (
        <Card className="relative overflow-hidden border-2 border-green-500 bg-gradient-to-br from-green-500/30 via-green-500/20 to-green-500/10 shadow-2xl backdrop-blur-sm">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
          <CardContent className="relative p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-green-500 via-green-600 to-green-700 shadow-xl ring-4 ring-green-500/30">
                <Trophy className="h-7 w-7 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-foreground mb-2">Félicitations !</h3>
                <p className="text-base text-foreground/90">{notificationMessage}</p>
                <Button
                  onClick={async () => {
                    // Effacer la notification
                    if (!userId) return
                    
                    const supabase = createClient()
                    // Vérifier que l'utilisateur est bien authentifié avant la requête (protection 400)
                    const { data: { user: authUserNotify } } = await supabase.auth.getUser()
                    if (!authUserNotify || !authUserNotify.id || authUserNotify.id !== userId) return
                    
                    await supabase
                      .from("profiles")
                      .update({ notification_message: null })
                      .eq("id", userId)
                    setNotificationMessage(null)
                  }}
                  variant="outline"
                  size="sm"
                  className="mt-4"
                >
                  Fermer
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!minimalHome && lastVipPlusWinner && (
        <Card className="border border-slate-500/40 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 shadow-lg">
          <CardContent className="space-y-1 p-4 text-sm text-slate-200">
            <p className="font-semibold text-slate-100">Tap-Tap VIP+ — Gagnant récent</p>
            <p>
              {lastVipPlusWinner.name}{" "}
              {lastVipPlusWinner.prize ? `(${lastVipPlusWinner.prize})` : ""}
            </p>
          </CardContent>
        </Card>
      )}


      {/* Welcome Message */}
      {!minimalHome && showWelcome && (
      <div className="rounded-2xl bg-card p-4">
        <h2 className="text-lg font-semibold text-foreground">
          {isAuthenticated
            ? `Bienvenue${profile?.first_name ? `, ${profile.first_name}` : ""} !`
            : "Bienvenue sur BKG Rewards !"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {isAuthenticated
              ? "Regardez des publicités pour gagner des points et participer aux tirages."
              : "Connectez-vous pour participer et gagner des cadeaux."}
          </p>
        </div>
      )}

      {showWallet && isAuthenticated && (
        <div className="relative w-full">
          <Button
            type="button"
            className="relative w-full overflow-hidden bg-gradient-to-r from-[#D4AF37] via-amber-400 to-yellow-200 py-6 text-base font-extrabold text-black shadow-lg hover:from-amber-300 hover:to-yellow-100 disabled:opacity-60"
            onClick={() => {
              if (offersUiDisabled) {
                setStatusMessage("Offres momentanément indisponibles.")
                setStatusType("error")
                return
              }
              void handleOpenOffers()
            }}
            disabled={offersUiDisabled}
          >
            {offersUiDisabled ? (
              <>
                <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/60 to-transparent opacity-80 animate-shimmer" />
                <span className="relative">⏳ Offres en cours de mise à jour</span>
              </>
            ) : (
              "🔥 Actions (Offres Spéciales)"
            )}
          </Button>
        </div>
      )}

      {showWallet && isAuthenticated && (
        <div
          className={cn(
            "grid gap-3 sm:grid-cols-1",
          )}
        >
          <Card
            className={cn(
              "relative border border-violet-500/35 bg-gradient-to-br from-violet-950/60 via-card to-card shadow-lg",
              !showVideoPointsCard && "w-full",
              offersCardOrder,
            )}
          >
            <CardContent className="flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-violet-300">
                    <Target className="h-5 w-5" strokeWidth={2.5} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold leading-tight text-foreground">Actions (Revenus élevés)</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {isNativeApp
                        ? "Offres disponibles dans l’écran interne de l’app."
                        : "Accès direct aux offres (écran interne)."}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-violet-500/25 px-2.5 py-1 text-xs font-bold text-violet-100">
                  Offres
                </span>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleOpenOffers()}
                disabled={isMissionRewarding || offersUiDisabled}
                className="w-full border border-violet-500/40 bg-violet-500/15 text-foreground hover:bg-violet-500/25 disabled:opacity-60"
                aria-label="Ouvrir les offres"
              >
                {offersUiDisabled
                  ? "⏳ Offres en cours de mise à jour"
                  : isMissionRewarding
                    ? "Ouverture…"
                    : "Ouvrir les offres"}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={offersSoonOpen} onOpenChange={setOffersSoonOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Offres bientôt disponibles</DialogTitle>
            <DialogDescription>
              Offres bientôt disponibles sur le Web !
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setOffersSoonOpen(false)}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suppression des redirections vers des offres web externes depuis l'app */}

      {showWallet && isAuthenticated && statusMessage ? (
        <p
          className={`rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-sm ${
            statusType === "error" ? "text-destructive" : "text-emerald-400"
          }`}
        >
          {statusMessage}
        </p>
      ) : null}

      {showWallet && (
        <Card className="border-border bg-card">
          <CardContent className="flex flex-col gap-3 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Votre solde</p>
                <p className="text-2xl font-bold text-foreground">
                  <AnimatedCounter value={points} duration={500} /> points
        </p>
                <p className="mt-1 inline-flex items-center rounded-full bg-sky-500/15 px-2 py-0.5 text-xs font-semibold text-sky-300">
                  🎟️ {totalTickets} tickets
                </p>
      </div>
              {!minimalHome && isVip && (
                <div className="flex items-center gap-2 rounded-lg bg-yellow-500/20 px-3 py-2">
                  <Crown className="h-4 w-4 text-yellow-500" />
                  <span className="text-xs font-medium text-yellow-500">VIP</span>
                </div>
              )}
            </div>
            {!isAuthenticated && statusMessage ? (
              <p className={`text-sm ${statusType === "error" ? "text-destructive" : "text-accent"}`}>
                {statusMessage}
              </p>
            ) : null}

            {minimalHome && (
              <div className="rounded-lg border border-border/60 bg-background/40 p-3">
                <p className="text-xs text-muted-foreground">Mon code de parrainage</p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="rounded-md bg-secondary/60 px-2 py-1 text-sm font-semibold tracking-wide">
                    {referralCode || "Generation..."}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopyReferral}
                    disabled={!referralCode}
                  >
                    <Copy className="mr-1 h-3.5 w-3.5" />
                    Copier
                  </Button>
                </div>
                {copyMessage && <p className="mt-1 text-xs text-green-400">{copyMessage}</p>}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!showWallet && statusMessage && (
        <p className={`text-sm ${statusType === "error" ? "text-destructive" : "text-accent"}`}>{statusMessage}</p>
      )}

      {/* Mes participations */}
      {isAuthenticated && userId && (
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <h3 className="text-lg font-semibold text-foreground mb-3">Mes Participations</h3>
            {userRewards.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune participation pour le moment.</p>
            ) : (
              <div className="space-y-2">
                {userRewards.map((reward) => {
                  const rewardLabel = reward.pool_name || "Lot"
                  const ticketsLabel = `${reward.tickets_earned} ticket${reward.tickets_earned > 1 ? "s" : ""}`
                  const date = new Date(reward.created_at).toLocaleDateString("fr-FR")
                  
                  return (
                    <div key={reward.id} className="flex items-center justify-between rounded-lg border border-border/40 p-3 text-sm">
                      <div>
                        <p className="font-semibold text-foreground">{rewardLabel}</p>
                        <p className="text-xs text-muted-foreground">{date} - {ticketsLabel}</p>
                      </div>
                      <span className="font-medium text-sky-400">{ticketsLabel}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cagnottes Communautaires */}
      {!minimalHome && showRewardsPools && (
        <RewardPoolsGrid userId={userId} />
      )}

      {/* Mention audio */}
      {!minimalHome && (
        <p className="pt-6 text-center text-xs text-muted-foreground">
          Musique par Pixabay
        </p>
      )}

      {/* Suppression des promotions APK / redirections Android sur le Web */}
    </div>
  )
}
