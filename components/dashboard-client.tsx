"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { SeasonTimer } from "@/components/season-timer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import type { Profile, Season } from "@/lib/types"
import { Trophy, Sparkles, Crown } from "lucide-react"
import { soundService } from "@/lib/sounds"
import { AnimatedCounter } from "@/components/animated-counter"
import { Confetti } from "@/components/confetti"
import { addInAppNotification } from "@/lib/in-app-notifications"
import { RewardPoolsGrid } from "@/components/reward-pools-grid"


interface DashboardClientProps {
  isAuthenticated: boolean
  userId?: string
  profile?: Profile | null
  season?: Season | null
  showWallet?: boolean
  showWelcome?: boolean
  showRewardsPools?: boolean
}

export function DashboardClient({
  isAuthenticated,
  userId,
  profile,
  season,
  showWallet = true,
  showWelcome = true,
  showRewardsPools = false,
}: DashboardClientProps) {
  const [points, setPoints] = useState(profile?.points ?? 0)
  const [isVip, setIsVip] = useState(false)
  const [isVipPlus, setIsVipPlus] = useState(false)
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [lastVipPlusWinner, setLastVipPlusWinner] = useState<{ name: string; prize: string } | null>(null)
  const [hasInteracted, setHasInteracted] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [dailyBoostAvailable, setDailyBoostAvailable] = useState(false)
  const [userRewards, setUserRewards] = useState<Array<{ id: string; reward_type: string; status: string; created_at: string }>>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const lastAdClickRef = useRef<number>(0)
  const simulationTimeoutRef = useRef<number | null>(null)

  
  // Vérifier le statut VIP
  useEffect(() => {
    async function checkVipStatus() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.id) return;
      
      // Protection 400 : vérifier userId ET user au tout début
      if (!userId) {
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
        .select("is_vip, is_vip_plus, notification_message")
        .eq("id", userId)
        .single()
      
      // Ne pas logger l'erreur si c'est juste que le profil n'existe pas encore
      if (error && error.code !== "PGRST116") {
        // Erreur silencieuse pour éviter les erreurs 400
      } else if (profileData) {
        const vipPlus = profileData.is_vip_plus || false
        setIsVip(profileData.is_vip || vipPlus)
        setIsVipPlus(vipPlus)
        if (profileData.notification_message) {
          setNotificationMessage(profileData.notification_message)
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
  }, [profile])

  // Charger les récompenses de l'utilisateur
  useEffect(() => {
    const fetchRewards = async () => {
      if (!userId) {
        setUserRewards([])
        return
      }
      const supabase = createClient()
      const { data, error } = await supabase
        .from("rewards")
        .select("id, reward_type, status, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10)
      
      if (!error && data) {
        setUserRewards(data)
      }
    }
    fetchRewards()
  }, [userId])


  useEffect(() => {
    let cancelled = false
    const claimVipPlusDaily = async () => {
      if (!isVipPlus || !userId) return
      try {
        const response = await fetch("/api/user/claim-daily", { method: "POST" })
        if (!response.ok) return
        const data = await response.json().catch(() => null)
        if (!data || cancelled) return
        if (typeof data.points === "number") {
          setPoints(data.points)
          addInAppNotification("Bonus VIP+ : +15 points ajoutés.")
        }
      } catch {
        // ignore
      }
    }
    claimVipPlusDaily()
    return () => {
      cancelled = true
    }
  }, [isVipPlus, userId])

  // Daily Boost: première pub du jour (fuseau local) = x2
  useEffect(() => {
    async function fetchDailyBoostStatus() {
      if (!userId || !isAuthenticated) {
        setDailyBoostAvailable(false)
        return
      }
      const supabase = createClient()
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const { count } = await supabase
        .from("video_views")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", todayStart.toISOString())
      setDailyBoostAvailable((count || 0) === 0)
    }
    fetchDailyBoostStatus()
  }, [userId, isAuthenticated])

  // Musique de fond liée au bouton haut-parleur
  useEffect(() => {
    if (typeof window === "undefined") return

    if (!audioRef.current) {
      audioRef.current = new Audio("/ambiance.mp3")
      audioRef.current.loop = true
      audioRef.current.volume = 0.1
    }

    const audio = audioRef.current
    if (!audio) return

    const muted = localStorage.getItem("sounds_enabled") === "false"
    audio.muted = muted
    setIsMuted(muted || Boolean(audio.paused))

    const markInteracted = () => setHasInteracted(true)
    window.addEventListener("pointerdown", markInteracted, { once: true })
    window.addEventListener("keydown", markInteracted, { once: true })
    window.addEventListener("touchstart", markInteracted, { once: true })

    return () => {
      audio.pause()
      window.removeEventListener("pointerdown", markInteracted)
      window.removeEventListener("keydown", markInteracted)
      window.removeEventListener("touchstart", markInteracted)
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return

    const handleToggle = (event?: Event) => {
      const enabled =
        (event as CustomEvent<boolean> | undefined)?.detail ??
        localStorage.getItem("sounds_enabled") !== "false"

      setIsMuted(!enabled)
      if (!enabled) {
        if (audioRef.current && !audioRef.current.paused) {
          audioRef.current.pause()
          audioRef.current.muted = true
        }
        return
      }

      if (!hasInteracted) return

      if (audioRef.current && audioRef.current.paused) {
        audioRef.current.muted = false
        audioRef.current.play().catch(() => {
          // Ignore autoplay restrictions
        })
      }
    }

    handleToggle()
    window.addEventListener("sounds-enabled-changed", handleToggle)
    window.addEventListener("storage", handleToggle)

    return () => {
      window.removeEventListener("sounds-enabled-changed", handleToggle)
      window.removeEventListener("storage", handleToggle)
    }
  }, [hasInteracted])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (isMuted) {
      audio.muted = true
      if (!audio.paused) audio.pause()
      return
    }
    audio.muted = false
    if (!hasInteracted) return
    if (audio.paused) {
      audio.play().catch(() => {
        // Ignore autoplay restrictions
      })
    }
  }, [isMuted, hasInteracted])


  // Ancien système "cadeaux" supprimé

  const [isRewarding, setIsRewarding] = useState(false)
  const [isSimulatingAd, setIsSimulatingAd] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [statusType, setStatusType] = useState<"success" | "error" | null>(null)
  const router = useRouter()

  useEffect(() => {
    return () => {
      // Nettoyer un éventuel timeout de simulation à la destruction
      if (simulationTimeoutRef.current) {
        window.clearTimeout(simulationTimeoutRef.current)
        simulationTimeoutRef.current = null
      }
    }
  }, [])

  const handleSimulateAd = useCallback(async () => {
    if (!userId) return

    if (!isAuthenticated) {
      router.push("/auth/login")
      return
    }

    const now = Date.now()
    if (now - lastAdClickRef.current < 1000) {
      setStatusMessage("Veuillez patienter avant de relancer une simulation.")
      setStatusType("error")
      return
    }
    lastAdClickRef.current = now

    setIsSimulatingAd(true)
    setStatusMessage("Simulation de publicité en cours...")
    setStatusType(null)

    if (simulationTimeoutRef.current) {
      window.clearTimeout(simulationTimeoutRef.current)
      simulationTimeoutRef.current = null
    }

    simulationTimeoutRef.current = window.setTimeout(async () => {
      setIsRewarding(true)
      setStatusMessage(null)
      setStatusType(null)

      const supabase = createClient()

      // Vérifier que l'utilisateur est bien authentifié
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) {
        setStatusMessage("Vous devez être connecté pour gagner des points.")
        setStatusType("error")
        setIsRewarding(false)
        setIsSimulatingAd(false)
        return
      }

      const { data, error } = await supabase.rpc("add_reward_points").single()

      if (error) {
        console.error("[DashboardClient] reward_ad_view error:", error)
        console.error("[DashboardClient] Error details:", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        })
        const message =
          error.message?.includes("hour_limit") || error.code === "P0001"
            ? "Limite atteinte : 5 vidéos par heure."
            : error.message?.includes("day_limit")
              ? "Limite atteinte : 25 vidéos par jour."
              : error.message?.includes("not_authenticated")
                ? "Vous devez être connecté pour gagner des points."
                : `Erreur : ${error.message || error.code || "Impossible d'ajouter des points pour le moment."}`
        setStatusMessage(message)
        setStatusType("error")
      } else if (data) {
        setPoints(data.new_points)
        setStatusMessage(
          data.bonus_applied ? "+2 points (Bonus quotidien)" : "+1 point ajouté au wallet.",
        )
        setStatusType("success")
        if (data.bonus_applied) {
          setDailyBoostAvailable(false)
        }
        addInAppNotification("Point reçu !")
        // Jouer le son de gain de pièces
        soundService.playCoinSound()
      } else {
        setStatusMessage("Aucune donnée retournée par la fonction.")
        setStatusType("error")
      }

      setIsRewarding(false)
      setIsSimulatingAd(false)
      router.refresh()
    }, 5000)
  }, [userId, router, isAuthenticated])

  // Ancien système de participation aux cadeaux supprimé

  return (
    <div className="flex flex-col gap-4 p-4">
      {showConfetti && <Confetti duration={2000} particleCount={50} />}
      {/* Season Timer */}
      <SeasonTimer season={season ?? { name: "Saison 1", end_date: null } as any} />

      <div className="sticky top-16 z-30 rounded-lg border border-border/50 bg-card/95 px-4 py-2 backdrop-blur-sm">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Points disponibles</span>
          <span className="font-semibold text-foreground">{points}</span>
        </div>
      </div>

      {/* Notification Message (depuis notification_message) */}
      {notificationMessage && (
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

      {lastVipPlusWinner && (
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
      {showWelcome && (
      <div className="rounded-2xl bg-card p-4">
        <h2 className="text-lg font-semibold text-foreground">
          {isAuthenticated
            ? `Bienvenue${profile?.first_name ? `, ${profile.first_name}` : ""} !`
            : "Bienvenue sur Bk'Rewards !"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {isAuthenticated
              ? "Regardez des publicités pour gagner des points et participer aux tirages."
              : "Connectez-vous pour participer et gagner des cadeaux."}
          </p>
        </div>
      )}

      {showWallet && (
        <Card className="border-border bg-card">
          <CardContent className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Votre solde</p>
                <p className="text-2xl font-bold text-foreground">
                  <AnimatedCounter value={points} duration={500} /> points
        </p>
      </div>
              {!isVip && (
                <Button
                  onClick={handleSimulateAd}
                  disabled={!isAuthenticated || isRewarding || isSimulatingAd}
                  className="bg-gradient-to-r from-(--color-sky-start) to-(--color-sky-end) text-primary-foreground"
                >
                  Regarder une vidéo
                  {dailyBoostAvailable && (
                    <span className="ml-2 rounded-full bg-yellow-400/30 px-2 py-0.5 text-[10px] font-semibold text-yellow-900">
                      Bonus Quotidien x2
                    </span>
                  )}
                </Button>
              )}
              {isVip && (
                <div className="flex items-center gap-2 rounded-lg bg-yellow-500/20 px-3 py-2">
                  <Crown className="h-4 w-4 text-yellow-500" />
                  <span className="text-xs font-medium text-yellow-500">VIP</span>
                </div>
              )}
            </div>
            {statusMessage && (
              <p className={`text-sm ${statusType === "error" ? "text-destructive" : "text-accent"}`}>
                {statusMessage}
              </p>
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
            <h3 className="text-lg font-semibold text-foreground mb-3">Mes participations</h3>
            {userRewards.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune participation pour le moment.</p>
            ) : (
              <div className="space-y-2">
                {userRewards.map((reward) => {
                  const rewardLabel = reward.reward_type
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (l) => l.toUpperCase())
                  const statusLabel = reward.status === "pending" ? "En attente" : "Envoyé"
                  const statusColor = reward.status === "pending" ? "text-yellow-500" : "text-green-500"
                  const date = new Date(reward.created_at).toLocaleDateString("fr-FR")
                  
                  return (
                    <div key={reward.id} className="flex items-center justify-between rounded-lg border border-border/40 p-3 text-sm">
                      <div>
                        <p className="font-semibold text-foreground">{rewardLabel}</p>
                        <p className="text-xs text-muted-foreground">{date}</p>
                      </div>
                      <span className={`font-medium ${statusColor}`}>{statusLabel}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cagnottes Communautaires */}
      {showRewardsPools && <RewardPoolsGrid userId={userId} />}

      {/* Mode test : pas de publicité, uniquement le bouton de simulation */}
      <p className="pt-6 text-center text-xs text-muted-foreground">
        Musique par Pixabay
      </p>
    </div>
  )
}
