"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Info, Lock, Ticket, Sparkles, RotateCw, Crown } from "lucide-react"
import { motion } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { VideoOverlay } from "@/components/video-overlay"
import { useToast } from "@/hooks/use-toast"
import { Confetti } from "@/components/confetti"
import { soundService } from "@/lib/sounds"
import { Capacitor } from "@capacitor/core"
import { showRewardVideo } from "@/lib/admob-rewarded"
import { countVideoViewsLastHour, isHourlyVideoQuotaExceeded } from "@/lib/video-quota"
import { updateUserPoints } from "@/lib/update-user-points"
import { ENABLE_SUPABASE_REALTIME } from "@/lib/supabase/client"

/** Pubs récompensées requises pour débloquer BKG Scratch (1 seule). */
const SCRATCH_REWARDED_ADS_REQUIRED = 1

export function ConcoursClient() {
  type LeaderboardEntry = {
    rank: number
    pseudo: string
    score: number
  }

  const loadTapLeaderboardDirect = async (): Promise<LeaderboardEntry[]> => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, tap_score, avatar_url")
      .gt("tap_score", 0)
      .order("tap_score", { ascending: false })
      .limit(10)

    // Fallback si certaines colonnes n'existent pas encore (évite blocage complet).
    if (error) {
      const { data: fallback, error: err2 } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, tap_score")
        .gt("tap_score", 0)
        .order("tap_score", { ascending: false })
        .limit(10)
      if (err2 || !fallback) return []
      return (fallback as Array<Record<string, unknown>>).map((row, index) => {
        const first = String((row.first_name as string | undefined) ?? "").trim()
        const last = String((row.last_name as string | undefined) ?? "").trim()
        const pseudo = `${first} ${last ? `${last[0]?.toUpperCase()}.` : ""}`.trim() || `Joueur ${index + 1}`
        const score = Number((row.tap_score as number | undefined) ?? 0)
        return { rank: index + 1, pseudo, score: Number.isFinite(score) ? score : 0 }
      })
    }

    const rows = (data as Array<Record<string, unknown>> | null) ?? []
    return rows.map((row, index) => {
      const pseudo =
        String((row.username as string | undefined) ?? "").trim() ||
        `Joueur ${index + 1}`
      const score = Number((row.tap_score as number | undefined) ?? 0)
      return { rank: index + 1, pseudo, score: Number.isFinite(score) ? score : 0 }
    })
  }

  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [isOverlayOpen, setIsOverlayOpen] = useState(false)
  const [videoAction, setVideoAction] = useState<"scratch" | null>(null)
  /** Toujours à jour avant AdMob / overlay : `handleVideoComplete` serait sinon capturé avec un `videoAction` obsolète (→ 2e vidéo nécessaire). */
  const videoActionRef = useRef<"scratch" | null>(null)
  const [adGateStatus, setAdGateStatus] = useState<string | null>(null)
  const [adGateCanRetry, setAdGateCanRetry] = useState(false)
  const [userPoints, setUserPoints] = useState(0)
  const [isVip, setIsVip] = useState(false)
  const [isVipPlus, setIsVipPlus] = useState(false)
  const [grade, setGrade] = useState<string>("")
  const [vipPlusCount, setVipPlusCount] = useState(0)
  const [previousWinner, setPreviousWinner] = useState<{ name: string; score: number } | null>(null)
  const [lastVipSlotAt, setLastVipSlotAt] = useState<Date | null>(null)
  const [lastScratchAt, setLastScratchAt] = useState<Date | null>(null)
  const [lastWheelAt, setLastWheelAt] = useState<Date | null>(null)
  const [now, setNow] = useState(Date.now())
  const [showConfetti, setShowConfetti] = useState(false)
  const [scratchUnlocked, setScratchUnlocked] = useState(false)
  const [showScratchModal, setShowScratchModal] = useState(false)
  const [scratchResult, setScratchResult] = useState<number | null>(null)
  const scratchCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const scratchIsDrawingRef = useRef(false)
  const [scratchScratchedPct, setScratchScratchedPct] = useState(0)
  const [showWheelModal, setShowWheelModal] = useState(false)
  const [wheelBet, setWheelBet] = useState(1)
  const [wheelOutcome, setWheelOutcome] = useState<0 | 1 | 3 | null>(null)
  const [wheelAngle, setWheelAngle] = useState(0)
  const [wheelSpinning, setWheelSpinning] = useState(false)
  const [infoModal, setInfoModal] = useState<"scratch" | "wheel" | null>(null)
  const [slotSpinning, setSlotSpinning] = useState(false)
  const [slotBet, setSlotBet] = useState<1 | 2 | 3>(1)
  const [slotStopPhase, setSlotStopPhase] = useState<0 | 1 | 2 | 3>(0)
  const [slotResult, setSlotResult] = useState<string[] | null>(null)
  const [slotMessage, setSlotMessage] = useState<string | null>(null)
  const [slotExtraSpinAvailable, setSlotExtraSpinAvailable] = useState(false)
  const [slotSpinSeed, setSlotSpinSeed] = useState(0)
  const [isSimulatingAd, setIsSimulatingAd] = useState(false)
  const lastVipAdClickRef = useRef<number>(0)
  const slotTimeoutRef = useRef<number | null>(null)
  const slotIntervalRef = useRef<number | null>(null)
  const adSimulationTimeoutRef = useRef<number | null>(null)
  const [tapArenaActive, setTapArenaActive] = useState(false)
  const [tapArenaCount, setTapArenaCount] = useState(0)
  const [tapArenaTimeLeft, setTapArenaTimeLeft] = useState(30)
  const [tapArenaResult, setTapArenaResult] = useState<string | null>(null)
  const [tapLeaderboard, setTapLeaderboard] = useState<LeaderboardEntry[]>([])
  /** Anti double déblocage Scratch après une seule pub AdMob. */
  const scratchPostAdHandledRef = useRef(false)
  const scratchAdsWatchedRef = useRef(0)
  /** État « pub visionnée » pour BKG Scratch — réinitialisé à chaque nouvelle partie / fermeture. */
  const [isAdWatched, setIsAdWatched] = useState(false)
  const tapLastClickRef = useRef<number>(0)
  const tapIntervalRef = useRef<number | null>(null)
  const tapArenaCountRef = useRef<number>(0)
  const { toast } = useToast()
  const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/

  // ─── Relire les points depuis Supabase ───
  const refreshPoints = async (uid?: string) => {
    const id = uid || userId
    if (!id) return
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id || user.id !== id) return
    const primary = await supabase
      .from("profiles")
      .select("points, grade, is_vip, is_vip_plus")
      .eq("id", id)
      .maybeSingle()
    const data =
      primary.error
        ? (
            await supabase
              .from("profiles")
              .select("points, is_vip, is_vip_plus")
              .eq("id", id)
              .maybeSingle()
          ).data
        : primary.data
    const raw = data?.points
    const parsed =
      typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN
    if (Number.isFinite(parsed)) {
      setUserPoints(Math.max(0, Math.floor(parsed)))
    }
    const vipPlus = Boolean((data as { is_vip_plus?: boolean | null } | null)?.is_vip_plus)
    const vipSimple = Boolean((data as { is_vip?: boolean | null } | null)?.is_vip)
    setIsVip(vipSimple || vipPlus)
    setIsVipPlus(vipPlus)
    const rawGrade = (data as { grade?: string | null } | null)?.grade
    const computed = vipPlus ? "VIP+" : vipSimple ? "VIP" : ""
    setGrade((typeof rawGrade === "string" ? rawGrade.trim() : "") || computed)
  }

  const postUpdatePoints = async (payload: {
    pointsToAdd?: number
    timestamps?: Partial<Record<"last_scratch_at" | "last_wheel_at" | "last_vip_slot_at", string>>
  }) => {
    if (!userId) {
      toast({ title: "Connexion requise", variant: "destructive" })
      return false
    }

    if (payload.pointsToAdd !== undefined && (typeof payload.pointsToAdd !== "number" || !Number.isFinite(payload.pointsToAdd))) {
      console.error("[concours] pointsToAdd invalide:", payload.pointsToAdd)
      return false
    }

    if (payload.timestamps) {
      for (const [key, value] of Object.entries(payload.timestamps)) {
        if (typeof value !== "string" || !ISO_DATE_REGEX.test(value)) {
          console.error(`[concours] timestamp invalide pour ${key}:`, value)
          return false
        }
      }
    }

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id || user.id !== userId) return false

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("points")
      .eq("id", userId)
      .maybeSingle()
    if (profileError || !profileData) return false

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    for (const [key, value] of Object.entries(payload.timestamps ?? {})) {
      updates[key] = value
    }

    const nextPoints = Number(profileData.points ?? 0) + Number(payload.pointsToAdd ?? 0)
    const res = await updateUserPoints(supabase, {
      userId,
      points: nextPoints,
      updatedAtIso: String(updates.updated_at),
      extra: Object.fromEntries(Object.entries(updates).filter(([k]) => k !== "updated_at")),
    })
    if (!res.ok) {
      console.error("[concours] updateUserPoints failed", {
        error: res.error,
        details: res.details,
        userId,
        pointsToAdd: payload.pointsToAdd ?? 0,
        nextPoints,
        timestamps: payload.timestamps ?? null,
        hint:
          res.details.isMissingPointsBalanceColumn
            ? "La colonne points_balance semble absente (fallback tenté)."
            : res.details.isPermissionDenied
              ? "Blocage probable RLS / permission denied sur profiles."
              : "Erreur UPDATE profiles (voir code/message).",
      })
      return false
    }
    return true
  }

  useEffect(() => {
    setLoading(false)
  }, [])

  // Init scratch layer à l'ouverture du modal
  useEffect(() => {
    if (!showScratchModal) return
    // Laisser le temps au canvas d'être monté
    const t = window.setTimeout(() => {
      initScratchCanvas()
      setScratchScratchedPct(0)
    }, 30)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showScratchModal])

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        setUserId(user?.id || null)

        if (!user?.id) {
          setUserPoints(0)
          setIsVip(false)
          setIsVipPlus(false)
          setLoading(false)
          return
        }

        // 1. Récupération du profil (Sécurisée)
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          // Sélection minimale pour éviter les 400 si certaines colonnes n'existent pas encore.
          .select("points, grade, tap_score, last_scratch_at, last_wheel_at, last_vip_slot_at")
          .eq("id", user.id)
          .maybeSingle()

        if (profileError) {
          console.error("Détail erreur profile:", profileError)
          // Si erreur 400 ici, une des colonnes ci-dessus n'existe pas dans ta table profiles
        }

        if (profileData) {
          setUserPoints(profileData.points ?? 0)
          const rawGrade = (profileData as { grade?: string | null }).grade
          const normalized = typeof rawGrade === "string" ? rawGrade.trim() : ""
          const effective = normalized === "VIP+" || normalized === "VIP" ? normalized : "Gratuit"
          setGrade(effective)
          setIsVip(effective === "VIP" || effective === "VIP+")
          setIsVipPlus(effective === "VIP+")

          setLastVipSlotAt(profileData.last_vip_slot_at ? new Date(profileData.last_vip_slot_at) : null)
          setLastScratchAt(profileData.last_scratch_at ? new Date(profileData.last_scratch_at) : null)
          setLastWheelAt(profileData.last_wheel_at ? new Date(profileData.last_wheel_at) : null)

          // 2. Fonctions VIP+ (dans un bloc séparé pour ne pas tout bloquer)
          if (effective === "VIP+") {
            try {
              // Récupérer le nombre de VIP+
              const { data: countData } = await supabase.rpc("get_vip_plus_count")
              if (countData !== null) setVipPlusCount(countData)

              // Récupérer le gagnant précédent
              const { data: winnerData } = await supabase.rpc("get_tap_tap_previous_week_winner")
              if (winnerData && winnerData.length > 0) {
                setPreviousWinner({
                  name: winnerData[0].display_name || "VIP+",
                  score: winnerData[0].score || 0,
                })
              }
            } catch (rpcErr) {
              console.error("Erreur RPC VIP+:", rpcErr)
            }
          }
        }
      } catch (err) {
        console.error("Erreur générale fetchUser:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchUser()
  }, [])

  useEffect(() => {
    if (!ENABLE_SUPABASE_REALTIME) return
    if (!userId) return
    const supabaseAny = createClient() as any
    try {
      const baseChannel = supabaseAny?.channel?.(`profiles-points-${userId}`)
      if (!baseChannel || typeof baseChannel.on !== "function" || typeof baseChannel.subscribe !== "function") {
        return
      }
      const channel = baseChannel
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
          () => {
            void refreshPoints(userId)
          },
        )
        .subscribe()
      return () => {
        try {
          void supabaseAny?.removeChannel?.(channel)
        } catch {}
      }
    } catch {
      return
    }
  }, [userId])

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000 * 30)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const loadTapLeaderboard = async () => {
      if (loading || !userId || !isVipPlus) {
        setTapLeaderboard([])
        return
      }
      const rows = await loadTapLeaderboardDirect()
      setTapLeaderboard(rows)
    }

    loadTapLeaderboard()
    const intervalId = window.setInterval(loadTapLeaderboard, 60_000)
    return () => window.clearInterval(intervalId)
  }, [isVipPlus, loading, userId])

  // 1. Nettoyage des timers au démontage du composant
  useEffect(() => {
    return () => {
      if (slotTimeoutRef.current) window.clearTimeout(slotTimeoutRef.current)
      if (slotIntervalRef.current) window.clearInterval(slotIntervalRef.current)
      if (adSimulationTimeoutRef.current) window.clearTimeout(adSimulationTimeoutRef.current)
      if (tapIntervalRef.current) window.clearInterval(tapIntervalRef.current)
    }
  }, [])

  // --- 1. CONFIGURATION DES TIMERS (UNE SEULE FOIS) ---
  const SCRATCH_COOLDOWN_MS = 24 * 60 * 60 * 1000 // 24h
  const WHEEL_COOLDOWN_MS = 24 * 60 * 60 * 1000 // 24h
  const VIP_SLOT_COOLDOWN_MS = 24 * 60 * 60 * 1000
  const effectiveScratchCooldownMs = isVipPlus ? SCRATCH_COOLDOWN_MS / 2 : SCRATCH_COOLDOWN_MS // VIP+ = 12h
  const effectiveWheelCooldownMs = isVipPlus ? WHEEL_COOLDOWN_MS / 2 : WHEEL_COOLDOWN_MS // VIP+ = 12h

  const scratchAvailable = !lastScratchAt || (now - lastScratchAt.getTime() >= effectiveScratchCooldownMs)
  const wheelAvailable = !lastWheelAt || (now - lastWheelAt.getTime() >= effectiveWheelCooldownMs)
  const vipSlotAvailable = !lastVipSlotAt || (now - lastVipSlotAt.getTime() >= VIP_SLOT_COOLDOWN_MS)

  const formatRemaining = (ms: number) => {
    if (ms <= 0) return "Disponible"
    const totalMinutes = Math.ceil(ms / 60000)
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
  }

  const scratchRemaining = scratchAvailable
    ? "Disponible"
    : formatRemaining(effectiveScratchCooldownMs - (now - (lastScratchAt?.getTime() || 0)))
  const wheelRemaining = wheelAvailable
    ? "Disponible"
    : formatRemaining(effectiveWheelCooldownMs - (now - (lastWheelAt?.getTime() || 0)))
  const vipSlotRemaining = vipSlotAvailable
    ? "Disponible"
    : formatRemaining(VIP_SLOT_COOLDOWN_MS - (now - (lastVipSlotAt?.getTime() || 0)))

  const parisDateParts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(now))
  const parisWeekday = parisDateParts.find((p) => p.type === "weekday")?.value ?? ""
  const parisHour = Number(parisDateParts.find((p) => p.type === "hour")?.value ?? "0")
  const parisMinute = Number(parisDateParts.find((p) => p.type === "minute")?.value ?? "0")
  const isTapTapSessionClosed = parisWeekday.toLowerCase().startsWith("sam") && parisHour === 23 && parisMinute >= 59
  const tapTapClosedMessage = "Session terminee. Resultats et nouvelle session dimanche a minuit."

  const handleVideoComplete = async () => {
    const gateAction = videoActionRef.current
    if (gateAction === "scratch") {
      if (scratchPostAdHandledRef.current) return
      // Web : pas d’AdMob — une vidéo simulée = 1 pub (équivalent adsWatched >= 1).
      if (!Capacitor.isNativePlatform()) {
        scratchAdsWatchedRef.current = SCRATCH_REWARDED_ADS_REQUIRED
      }
      if (scratchAdsWatchedRef.current < SCRATCH_REWARDED_ADS_REQUIRED) return
      scratchPostAdHandledRef.current = true
      setIsAdWatched(true)
      setScratchUnlocked(true)
      setShowScratchModal(true)
      return
    }
  }

  // --- 3. LOGIQUE DES JEUX (SCRATCH, WHEEL, SLOTS, ARENA) ---
  const openScratchUnlock = () => {
    if (!userId) {
      toast({ title: "Connexion requise", variant: "destructive" })
      return
    }
    if (!scratchAvailable) return
    scratchPostAdHandledRef.current = false
    scratchAdsWatchedRef.current = 0
    setIsAdWatched(false)
    if (!Capacitor.isNativePlatform()) {
      videoActionRef.current = "scratch"
      setVideoAction("scratch")
      setIsOverlayOpen(true)
      return
    }
    void runRewardedGate("scratch")
  }

  const revealScratch = async () => {
    if (!userId || scratchResult !== null) return
    const roll = Math.random()
    const resultPoints = roll < 0.65 ? 0 : roll < 0.9 ? 1 : 2
    const nowIso = new Date().toISOString()
    
    try {
      const ok = await postUpdatePoints({
        ...(resultPoints > 0 ? { pointsToAdd: resultPoints } : {}),
        timestamps: { last_scratch_at: nowIso },
      })
      if (!ok) return
      setLastScratchAt(new Date(nowIso))
      setScratchResult(resultPoints)
      await refreshPoints()
      if (resultPoints > 0) {
        setShowConfetti(true)
        setTimeout(() => setShowConfetti(false), 2500)
      }
    } catch (e) { console.error(e) }
  }

  const resetScratch = () => {
    scratchPostAdHandledRef.current = false
    scratchAdsWatchedRef.current = 0
    setIsAdWatched(false)
    setScratchUnlocked(false)
    setScratchResult(null)
    setShowScratchModal(false)
    setScratchScratchedPct(0)
  }

  const initScratchCanvas = () => {
    const canvas = scratchCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height

    // Couche à gratter "premium" (dégradé + bruit léger)
    const g = ctx.createLinearGradient(0, 0, w, h)
    g.addColorStop(0, "#2a2a2a")
    g.addColorStop(0.5, "#5b5b5b")
    g.addColorStop(1, "#1d1d1d")
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)

    // Grain subtil
    const img = ctx.getImageData(0, 0, w, h)
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() * 22) | 0
      img.data[i] = Math.min(255, img.data[i] + n)
      img.data[i + 1] = Math.min(255, img.data[i + 1] + n)
      img.data[i + 2] = Math.min(255, img.data[i + 2] + n)
      img.data[i + 3] = 255
    }
    ctx.putImageData(img, 0, 0)

    ctx.globalCompositeOperation = "source-over"
  }

  const computeScratchedPct = () => {
    const canvas = scratchCanvasRef.current
    if (!canvas) return 0
    const ctx = canvas.getContext("2d")
    if (!ctx) return 0
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    let transparent = 0
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] === 0) transparent += 1
    }
    const total = data.length / 4
    return total > 0 ? Math.round((transparent / total) * 100) : 0
  }

  const scratchAt = (clientX: number, clientY: number) => {
    const canvas = scratchCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * canvas.width
    const y = ((clientY - rect.top) / rect.height) * canvas.height
    ctx.globalCompositeOperation = "destination-out"
    ctx.beginPath()
    ctx.arc(x, y, 18, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalCompositeOperation = "source-over"
  }

  const handleScratchPointerDown = (e: React.PointerEvent) => {
    if (scratchResult !== null) return
    scratchIsDrawingRef.current = true
    scratchAt(e.clientX, e.clientY)
  }
  const handleScratchPointerMove = (e: React.PointerEvent) => {
    if (!scratchIsDrawingRef.current) return
    if (scratchResult !== null) return
    scratchAt(e.clientX, e.clientY)
  }
  const handleScratchPointerUp = () => {
    if (!scratchIsDrawingRef.current) return
    scratchIsDrawingRef.current = false
    const pct = computeScratchedPct()
    setScratchScratchedPct(pct)
  }

  const handleSpinWheel = async () => {
    if (!userId || !wheelAvailable || wheelSpinning) return
    if (userPoints < wheelBet) {
      toast({ title: "Points insuffisants", variant: "destructive" })
      return
    }

    const nowIso = new Date().toISOString()
    try {
      setWheelOutcome(null)
      const ok = await postUpdatePoints({ pointsToAdd: -wheelBet, timestamps: { last_wheel_at: nowIso } })
      if (!ok) return
      setUserPoints(userPoints - wheelBet)
      setLastWheelAt(new Date(nowIso))
      setNow(Date.now())
      setWheelSpinning(true)
      const nextWheelAngle = wheelAngle + 1440 + Math.floor(Math.random() * 1080)
      setWheelAngle(nextWheelAngle)
      
      const roll = Math.random()
      /** 0 = PERDU ; 1 = RÉCUPÉRÉ ; 3 = JACKPOT */
      const multiplier: 0 | 1 | 3 = roll < 0.58 ? 0 : roll < 0.92 ? 1 : 3

      setTimeout(async () => {
        setWheelSpinning(false)
        setWheelOutcome(multiplier)
        if (multiplier === 0) {
          soundService.playClickSound()
          return
        }
        await postUpdatePoints({ pointsToAdd: wheelBet * multiplier })
        await refreshPoints()
        soundService.playSuccess()
        setShowConfetti(true)
        setTimeout(() => setShowConfetti(false), 2500)
      }, 1500)
    } catch (e) { console.error(e) }
  }

  const runRewardedGate = async (action: "scratch") => {
    if (!userId) {
      toast({ title: "Connexion requise", variant: "destructive" })
      return
    }
    const supabase = createClient()
    const hourCount = await countVideoViewsLastHour(supabase, userId)
    console.log(`Utilisateur ID: ${userId} - Tentative de visionnage ${hourCount + 1}/5`)
    if (isHourlyVideoQuotaExceeded(hourCount)) {
      toast({
        title: "Limite atteinte",
        description: "Limite atteinte, reviens plus tard",
        variant: "destructive",
      })
      return
    }

    scratchPostAdHandledRef.current = false
    scratchAdsWatchedRef.current = 0
    videoActionRef.current = action
    setVideoAction(action)
    setAdGateStatus("Préparation de la vidéo...")
    setAdGateCanRetry(false)
    try {
      const result = await showRewardVideo({
        onRewardGranted: async () => {
          scratchAdsWatchedRef.current = SCRATCH_REWARDED_ADS_REQUIRED
          await handleVideoComplete()
        },
      })
      if (!result.ok) {
        const isTimeout =
          typeof result.message === "string" &&
          result.message.includes("timeout_prepare_rewarded_10s")
        setAdGateStatus(
          isTimeout
            ? "La vidéo met trop de temps à se préparer."
            : result.message || "Pub non disponible, réessaie plus tard.",
        )
        setAdGateCanRetry(true)
        toast({
          title: "Pub indisponible",
          description: isTimeout
            ? "La préparation a dépassé 10s. Réessaie ou signale un problème."
            : result.message,
          variant: "destructive",
        })
        return
      }
      setAdGateStatus(null)
      setAdGateCanRetry(false)
    } catch (e) {
      setAdGateStatus("Pub non disponible, réessaie plus tard.")
      setAdGateCanRetry(true)
    }
  }

  const handleSlotSpin = async () => {
    if (!userId || !isVip || slotSpinning || (!vipSlotAvailable && !slotExtraSpinAvailable)) return
    if (userPoints < slotBet) {
      toast({ title: "Points insuffisants", description: "Augmente ton solde ou baisse la mise.", variant: "destructive" })
      return
    }
    
    setSlotSpinning(true)
    setSlotMessage(null)
    setSlotSpinSeed((s) => s + 1)
    setSlotStopPhase(0)
    setSlotResult(null)

    const spinSymbols: Array<"🍒" | "💎" | "7️⃣" | "🔔"> = ["🍒", "💎", "7️⃣", "🔔"]
    const roll = Math.random()
    const multiplier: 0 | 1 | 3 = roll < 0.62 ? 0 : roll < 0.93 ? 1 : 3
    const finalSymbol = multiplier === 3 ? "7️⃣" : multiplier === 1 ? "💎" : (spinSymbols[Math.floor(Math.random() * spinSymbols.length)] ?? "🍒")

    if (slotIntervalRef.current) window.clearInterval(slotIntervalRef.current)
    if (slotTimeoutRef.current) window.clearTimeout(slotTimeoutRef.current)

    let frame = 0
    slotIntervalRef.current = window.setInterval(() => {
      frame += 1
      setSlotResult([
        spinSymbols[(frame + 1) % spinSymbols.length],
        spinSymbols[(frame + 2) % spinSymbols.length],
        spinSymbols[(frame + 3) % spinSymbols.length],
      ])
    }, 55)

    const stopDelaysMs = [700, 1000, 1300] as const
    stopDelaysMs.forEach((delay, idx) => {
      window.setTimeout(() => {
        setSlotStopPhase((p) => (p < (idx + 1) ? ((idx + 1) as 1 | 2 | 3) : p))
        soundService.playClickSound()
        setSlotResult((prev) => {
          const next: string[] = prev ? [...prev] : [spinSymbols[0], spinSymbols[1], spinSymbols[2]]
          next[idx] = finalSymbol
          return next
        })
      }, delay)
    })

    slotTimeoutRef.current = window.setTimeout(async () => {
      if (slotIntervalRef.current) {
        window.clearInterval(slotIntervalRef.current)
        slotIntervalRef.current = null
      }

      const nowIso = new Date().toISOString()
      const winPoints = slotBet * multiplier
      const ok = await postUpdatePoints({ pointsToAdd: winPoints, timestamps: { last_vip_slot_at: nowIso } })
      if (!ok) {
        setSlotSpinning(false)
        setSlotMessage("Erreur: impossible d'enregistrer la partie.")
        slotTimeoutRef.current = null
        return
      }
      setSlotResult([finalSymbol, finalSymbol, finalSymbol])
      setSlotSpinning(false)
      setLastVipSlotAt(new Date(nowIso))
      setNow(Date.now())
      await refreshPoints()
      if (winPoints > 0) {
        setShowConfetti(true)
        setTimeout(() => setShowConfetti(false), 2200)
      }
      setSlotMessage(winPoints > 0 ? `Gagné : +${winPoints} pts` : "Perdu")
      setSlotExtraSpinAvailable(false)
      slotTimeoutRef.current = null
    }, 1500)
  }

  const handleVipAdSimulation = () => {
    setIsSimulatingAd(true)
    setTimeout(() => {
      setIsSimulatingAd(false)
      setSlotExtraSpinAvailable(true)
    }, 5000)
  }

  const WHEEL_SEGMENTS: Array<"PERDU" | "x1" | "x3"> = [
    "PERDU",
    "x1",
    "PERDU",
    "x1",
    "PERDU",
    "x1",
    "PERDU",
    "x3",
    "PERDU",
    "x1",
    "PERDU",
    "PERDU",
  ]

  const startTapArena = () => {
    if (!isVipPlus || tapArenaActive || isTapTapSessionClosed) return
    setTapArenaCount(0)
    tapArenaCountRef.current = 0
    setTapArenaTimeLeft(30)
    setTapArenaActive(true)
    const interval = setInterval(() => {
      setTapArenaTimeLeft((p) => {
        if (p <= 1) {
          clearInterval(interval)
          setTapArenaActive(false)
          submitTapScore(tapArenaCountRef.current)
          return 0
        }
        return p - 1
      })
    }, 1000)
  }

  const submitTapScore = async (score: number) => {
    if (loading || !userId || !isVipPlus) return
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) return
    const { error } = await supabase
      .from("profiles")
      .update({ tap_score: Math.max(0, Math.floor(Number(score) || 0)), updated_at: new Date().toISOString() })
      .eq("id", user.id)
    if (error) {
      console.error("[concours] update tap_score failed:", {
        message: error.message,
        code: (error as { code?: string | null } | null)?.code ?? undefined,
        hint: (error as { hint?: string | null } | null)?.hint ?? undefined,
        details: (error as { details?: string | null } | null)?.details ?? undefined,
      })
      toast({ title: "Erreur", description: "Impossible d’enregistrer le score.", variant: "destructive" })
      return
    }
    toast({ title: "Score enregistré", description: `Score: ${score}` })
    const rows = await loadTapLeaderboardDirect()
    setTapLeaderboard(rows)
  }

  const handleTapArenaClick = () => {
    if (tapArenaActive) {
      setTapArenaCount(c => c + 1)
      tapArenaCountRef.current += 1
    }
  }

  // --- 4. GESTION DES REFS ---
  const videoContextLabel = videoAction === "scratch" ? "BKG Scratch" : "BKG Wheel"
  const videoRewardLabel = "Jeu débloqué"

  if (loading) return <div className="p-4 text-white">Chargement...</div>

  const requiredGradeLabel = (required: "VIP" | "VIP+") => `Niveau ${required} requis`
  const canPlayVip = isVip
  const canPlayVipPlus = isVipPlus

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Mini-jeux</h2>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Infos mini-jeux">
              <Info className="h-5 w-5" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Règles</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Certains jeux sont réservés aux grades VIP et VIP+. Probabilités de gain variables selon le jeu.
            </p>
            <div className="mt-3 space-y-2 text-sm">
              <p className="font-medium text-foreground">Probabilités</p>
              <div className="rounded-md border border-border/60 bg-secondary/20 p-3 text-muted-foreground">
                <p><span className="font-semibold text-foreground">Gratuit</span> : Tirage au sort</p>
                <p><span className="font-semibold text-foreground">VIP</span> : 1/50</p>
                <p><span className="font-semibold text-foreground">VIP+</span> : 1/10</p>
              </div>
            </div>
            {grade ? (
              <p className="text-sm text-muted-foreground">
                Ton niveau actuel : <span className="font-medium text-foreground">{grade}</span>
              </p>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
      {/* --- GRILLE DES JEUX STANDARDS --- */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* CARTE SCRATCH */}
        <Card className="relative overflow-hidden border border-white/10 bg-gradient-to-br from-[#0b0b12] via-[#111827] to-[#0a0a0a] p-4 shadow-[0_18px_55px_rgba(59,130,246,0.10)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.22),transparent_55%),radial-gradient(circle_at_80%_25%,rgba(168,85,247,0.20),transparent_60%)]" />
          <div className="relative">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest text-sky-200/80">BK Scratch</p>
                <h3 className="mt-1 text-xl font-extrabold text-white">Ticket Premium</h3>
                <p className="mt-2 text-sm text-slate-300">
                  <span className="inline-flex items-center gap-2">
                    <Ticket className="h-4 w-4 text-sky-300" aria-hidden />
                    Disponibilité : <span className="font-semibold text-white/90">{scratchRemaining}</span>
                  </span>
                </p>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10 backdrop-blur">
                <Sparkles className="h-5 w-5 text-sky-300" aria-hidden />
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>Gain potentiel</span>
                <span className="font-semibold text-amber-300">0–2 pts</span>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-black/40">
                <div
                  className="h-full w-1/3 rounded-full bg-gradient-to-r from-sky-400 via-violet-400 to-amber-300 opacity-80"
                  aria-hidden
                />
              </div>
            </div>

            <Button
              className="mt-4 w-full bg-gradient-to-r from-sky-500 via-indigo-500 to-violet-600 text-white shadow-[0_12px_30px_rgba(99,102,241,0.25)] hover:brightness-110"
              onClick={openScratchUnlock}
              disabled={!scratchAvailable || !userId}
            >
              {scratchAvailable ? "Gratter le ticket" : "Revenez plus tard"}
            </Button>
          </div>
        </Card>

        {/* CARTE WHEEL */}
        <Card className="relative overflow-hidden border border-white/10 bg-gradient-to-br from-[#0b0b12] via-[#140b2a] to-[#0a0a0a] p-4 shadow-[0_18px_55px_rgba(168,85,247,0.10)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_25%,rgba(168,85,247,0.25),transparent_55%),radial-gradient(circle_at_85%_20%,rgba(245,158,11,0.18),transparent_60%)]" />
          <div className="relative">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest text-violet-200/80">BK Wheel</p>
                <h3 className="mt-1 text-xl font-extrabold text-white">Roue Lumineuse</h3>
                <p className="mt-2 text-sm text-slate-300">
                  <span className="font-semibold text-white/90">{userPoints}</span> points • Disponibilité{" "}
                  <span className="font-semibold text-white/90">{wheelRemaining}</span>
                </p>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10 backdrop-blur">
                <RotateCw className="h-5 w-5 text-violet-300" aria-hidden />
              </div>
            </div>

            <Button
              className="mt-4 w-full bg-gradient-to-r from-violet-600 via-fuchsia-600 to-amber-500 text-white shadow-[0_12px_30px_rgba(168,85,247,0.22)] hover:brightness-110"
              onClick={() => setShowWheelModal(true)}
              disabled={!wheelAvailable || !userId}
            >
              Lancer la roue
            </Button>
          </div>
        </Card>
      </div>

      {/* --- ZONE VIP --- */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Zone Privée</h3>
        <Card className="relative overflow-hidden border border-amber-500/20 bg-gradient-to-br from-[#0b0b12] via-[#14110b] to-[#050505] p-4 shadow-[0_18px_55px_rgba(245,158,11,0.10)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(245,158,11,0.22),transparent_55%),radial-gradient(circle_at_80%_30%,rgba(59,130,246,0.14),transparent_60%)]" />
          <div className="relative">
          <p className="text-amber-300 font-extrabold tracking-wide mb-2 flex items-center gap-2">
            <Crown className="h-4 w-4" aria-hidden />
            Slot Machine VIP
          </p>
          <p className="text-sm text-slate-300 mb-4">Disponibilité : {vipSlotRemaining}</p>
          <div className="mb-3 grid grid-cols-3 gap-2">
            {([1, 2, 3] as const).map((bet) => (
              <Button
                key={bet}
                type="button"
                variant={slotBet === bet ? "default" : "outline"}
                className="w-full border-amber-400/20 bg-black/30 text-amber-50 hover:bg-black/40"
                onClick={() => setSlotBet(bet)}
                disabled={slotSpinning}
              >
                Mise {bet}
              </Button>
            ))}
          </div>
          <Button
            className="w-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-black shadow-[0_12px_30px_rgba(245,158,11,0.20)] hover:brightness-105"
            onClick={handleSlotSpin}
            disabled={!canPlayVip || slotSpinning || (!vipSlotAvailable && !slotExtraSpinAvailable) || userPoints < slotBet}
          >
            {slotSpinning ? "Rotation..." : "Tirer le levier"}
          </Button>
          {userPoints < slotBet ? (
            <p className="mt-2 text-center text-xs font-semibold text-rose-200/90">
              Points insuffisants pour cette mise.
            </p>
          ) : null}
          {!canPlayVip && (
            <p className="mt-2 text-center text-xs text-yellow-200/90">{requiredGradeLabel("VIP")}</p>
          )}
          {slotResult && (
            <div className="relative mt-4 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-black/55 to-black/30 p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05),0_18px_60px_rgba(0,0,0,0.45)]">
              {/* Cadre métallique */}
              <div className="pointer-events-none absolute inset-0 rounded-3xl bg-[linear-gradient(135deg,rgba(245,158,11,0.28),rgba(255,255,255,0.06),rgba(59,130,246,0.12))] opacity-70" />
              <div className="relative grid grid-cols-3 gap-2">
              {slotResult.map((s, idx) => (
                <motion.div
                  key={`${slotSpinSeed}-${idx}-${s}`}
                  className="flex h-16 items-center justify-center rounded-2xl border border-white/10 bg-black/35 text-3xl shadow-inner backdrop-blur-sm"
                  animate={
                    slotSpinning && idx >= slotStopPhase
                      ? { y: [0, -18, 0], filter: ["blur(1px)", "blur(3px)", "blur(1px)"] }
                      : { y: 0, scale: [1, 1.06, 1], filter: "blur(0px)" }
                  }
                  transition={slotSpinning && idx >= slotStopPhase ? { duration: 0.18, repeat: Infinity, ease: "linear" } : { duration: 0.22 }}
                >
                  {s}
                </motion.div>
              ))}
              </div>
            </div>
          )}
          {slotMessage && (
            <motion.p
              className="mt-3 text-center text-sm font-semibold text-amber-200"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
            >
              {slotMessage}
            </motion.p>
          )}

          {!isVip && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/45 backdrop-blur-[2px]">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-500/20 ring-2 ring-yellow-500/40">
                <Lock className="h-6 w-6 text-yellow-400" />
              </div>
              <p className="px-4 text-center text-sm font-medium text-yellow-100">
                Réservé aux VIP. Devenez VIP pour jouer !
              </p>
            </div>
          )}
          </div>
        </Card>
      </div>

      {/* --- ZONE TAP-TAP (VIP+) --- */}
      {!canPlayVipPlus ? (
        /* MODE BLOQUÉ POUR LES NON-VIP+ */
        <Card className="border border-slate-500/20 bg-slate-900/30 opacity-75">
          <CardContent className="p-6 text-center">
            <div className="flex justify-center mb-2 text-slate-500">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <p className="text-center text-sm font-semibold text-slate-300">
              Saison 1 : Du 01/04 au 30/04
            </p>
            <p className="mt-2 text-center text-sm font-bold text-amber-400/90">
              Cadeau : 5€ de crédits au 1er du classement !
            </p>
            <h3 className="mt-3 text-lg font-bold text-slate-400 font-mono italic tracking-wider">TAP-TAP ARENA</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4 italic">
              Devenez VIP+ pour jouer et gagner des TIX !
            </p>
            <p className="mb-3 text-xs text-slate-400">{requiredGradeLabel("VIP+")}</p>
            <Button 
              variant="outline" 
              className="w-full border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
              onClick={() => window.location.href = "/premium"}
            >
              Débloquer le mode VIP+
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* JEU ACTIF POUR LES VIP+ */
        <Card className="border-blue-500/40 bg-slate-900/50 p-4 shadow-lg shadow-blue-900/20">
          <p className="text-center text-sm font-semibold text-blue-100">
            Saison 1 : Du 01/04 au 30/04
          </p>
          <p className="mt-2 text-center text-sm font-bold text-amber-400">
            Cadeau : 5€ de crédits au 1er du classement !
          </p>
          <h3 className="mt-3 text-blue-100 font-bold text-center">Tap-Tap Arena VIP+</h3>
          {isTapTapSessionClosed && (
            <p className="mt-2 text-center text-sm text-yellow-300">{tapTapClosedMessage}</p>
          )}
          <div className="text-3xl font-black text-center my-4 text-white">
            {tapArenaCount} <span className="text-sm font-normal text-blue-300">TAPS</span>
          </div>
          <Button 
            className={`w-full font-bold h-12 ${tapArenaActive ? 'bg-red-600 animate-pulse' : 'bg-blue-600'}`} 
            onClick={tapArenaActive ? handleTapArenaClick : startTapArena} 
            disabled={isTapTapSessionClosed}
          >
            {isTapTapSessionClosed ? "SESSION TERMINEE" : tapArenaActive ? `VITE ! (${tapArenaTimeLeft}s)` : "DEMARRER LE DEFI"}
          </Button>
          {tapArenaResult && <p className="text-center text-xs mt-2 text-green-400">{tapArenaResult}</p>}
        </Card>
      )}

      {isVipPlus ? (
        <Card className="border border-slate-500/20 bg-slate-900/30">
          <CardHeader>
            <CardTitle className="text-base text-slate-100">Classement Tap-Tap (Top 10)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {tapLeaderboard.length === 0 ? (
              <p className="text-sm text-slate-400">Aucun score pour le moment.</p>
            ) : (
              <div className="space-y-2">
                {tapLeaderboard.slice(0, 10).map((entry) => (
                  <div
                    key={`${entry.rank}-${entry.pseudo}-${entry.score}`}
                    className="flex items-center justify-between rounded-md border border-slate-600/30 bg-slate-900/40 px-3 py-2 text-sm"
                  >
                    <span className="w-10 text-slate-300">#{entry.rank}</span>
                    <span className="flex-1 truncate px-2 text-slate-100">{entry.pseudo}</span>
                    <span className="font-semibold text-blue-300">{entry.score}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* --- TOUS LES MODALS (OBLIGATOIRES) --- */}
      <VideoOverlay
        isOpen={isOverlayOpen}
        onClose={() => setIsOverlayOpen(false)}
        onComplete={handleVideoComplete}
        contextLabel={videoContextLabel}
        rewardLabel={videoRewardLabel}
      />

      {/* Plus de récupération de mise : si PERDU, c'est PERDU. */}

      {adGateStatus ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4">
          <Card className="w-full max-w-sm border border-border/60 bg-[#111111] p-5 text-center">
            <p className="text-sm text-muted-foreground">{adGateStatus}</p>
            <div className="mt-4 flex gap-2">
              <Button
                className="flex-1"
                onClick={() => void runRewardedGate("scratch")}
                disabled={!adGateCanRetry}
              >
                Réessayer
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setAdGateStatus(null)
                  setAdGateCanRetry(false)
                  toast({
                    title: "Signaler un problème",
                    description:
                      "Si le problème persiste, redémarre l’app et vérifie ta connexion. (On ajoutera un lien support ensuite.)",
                  })
                }}
              >
                Signaler
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      {showScratchModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          data-scratch-ad-watched={isAdWatched ? "1" : "0"}
        >
          <Card className="relative w-full max-w-sm overflow-hidden border border-white/10 bg-gradient-to-br from-[#0b0b12] via-[#111827] to-[#050505] p-6 text-center shadow-[0_18px_55px_rgba(59,130,246,0.12)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(59,130,246,0.22),transparent_55%),radial-gradient(circle_at_85%_25%,rgba(168,85,247,0.18),transparent_60%)]" />
            <div className="relative space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <p className="text-xs font-semibold uppercase tracking-widest text-sky-200/80">BK Scratch</p>
                  <p className="mt-1 text-sm text-slate-300">Gratte la zone pour révéler ton gain</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10 backdrop-blur">
                  <Ticket className="h-5 w-5 text-sky-300" aria-hidden />
                </div>
              </div>

              <div className="relative mx-auto w-[280px] max-w-full">
                {/* Ticket (fond) */}
                <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 p-4 shadow-inner">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Ticket</span>
                    <span className="font-semibold text-amber-300">Premium</span>
                  </div>
                  <div className="mt-3 rounded-xl bg-white/5 p-4">
                    <p className="text-[11px] uppercase tracking-widest text-slate-400">Résultat</p>
                    <p className="mt-2 text-3xl font-black text-white">
                      {scratchResult === null ? "??" : scratchResult === 0 ? "0" : `+${scratchResult}`}
                      <span className="ml-2 text-base font-semibold text-slate-300">pts</span>
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {scratchResult === null ? `Progression : ${scratchScratchedPct}%` : "Révélé"}
                    </p>
                  </div>
                </div>

                {/* Couche à gratter (canvas) */}
                {scratchResult === null ? (
                  <canvas
                    ref={scratchCanvasRef}
                    width={280}
                    height={160}
                    className="absolute inset-0 h-full w-full touch-none select-none rounded-2xl"
                    onPointerDown={handleScratchPointerDown}
                    onPointerMove={handleScratchPointerMove}
                    onPointerUp={handleScratchPointerUp}
                    onPointerCancel={handleScratchPointerUp}
                    onPointerLeave={handleScratchPointerUp}
                    aria-label="Zone à gratter"
                  />
                ) : null}
              </div>

              <div className="grid gap-2">
                <Button
                  className="w-full bg-gradient-to-r from-sky-500 via-indigo-500 to-violet-600 text-white shadow-[0_12px_30px_rgba(99,102,241,0.25)] hover:brightness-110"
                  onClick={() => {
                    if (scratchResult !== null) {
                      resetScratch()
                      return
                    }
                    // Révèle automatiquement quand suffisamment gratté
                    if (scratchScratchedPct >= 55) {
                      void revealScratch()
                      return
                    }
                    // Sinon laisse le user continuer à gratter
                  }}
                  disabled={scratchResult === null && scratchScratchedPct < 55}
                >
                  {scratchResult === null ? "Révéler" : "Fermer"}
                </Button>
                {scratchResult === null ? (
                  <p className="text-xs text-slate-400">
                    Gratte au moins <span className="font-semibold text-white/90">55%</span> pour révéler.
                  </p>
                ) : null}
              </div>
            </div>
          </Card>
        </div>
      )}

      {showWheelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <Card className="relative w-full max-w-sm overflow-hidden border border-white/10 bg-gradient-to-br from-[#0b0b12] via-[#140b2a] to-[#050505] p-6 text-center text-white shadow-[0_18px_55px_rgba(168,85,247,0.14)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(168,85,247,0.25),transparent_55%),radial-gradient(circle_at_85%_25%,rgba(245,158,11,0.18),transparent_60%)]" />
            <div className="relative">
              <h3 className="text-xl font-extrabold tracking-tight text-white">BK Wheel</h3>
              <p className="mt-1 text-sm text-slate-300">Bordures lumineuses • rotation fluide</p>

              <div className="mt-5 flex items-center justify-center">
                <div className="relative">
                  {/* Glow ring */}
                  <div className="absolute -inset-3 rounded-full bg-[conic-gradient(from_180deg,rgba(168,85,247,0.45),rgba(59,130,246,0.35),rgba(245,158,11,0.35),rgba(168,85,247,0.45))] blur-xl opacity-60" />
                  <div className="relative h-44 w-44 rounded-full border border-white/10 bg-black/35 p-2 shadow-inner backdrop-blur">
                    {/* Pointer */}
                    <div className="absolute -top-2 left-1/2 z-10 h-0 w-0 -translate-x-1/2 border-x-[10px] border-b-[16px] border-x-transparent border-b-amber-300 drop-shadow-[0_6px_18px_rgba(245,158,11,0.45)]" />
                    <div
                      className="relative h-full w-full rounded-full border border-white/10 bg-[conic-gradient(from_90deg,#7c3aed,#2563eb,#f59e0b,#7c3aed)] shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
                      style={{
                        transform: `rotate(${wheelAngle}deg)`,
                        transitionProperty: "transform",
                        transitionDuration: "2600ms",
                        transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                      }}
                    >
                      {/* Segments glow + profondeur */}
                      <div className="absolute inset-0 rounded-full shadow-[inset_0_0_35px_rgba(0,0,0,0.6)]" />
                      {/* Rim labels (PERDU / x1 / x3) */}
                      <div className="pointer-events-none absolute inset-0">
                        {WHEEL_SEGMENTS.map((label, i) => {
                          const angle = (360 / WHEEL_SEGMENTS.length) * i
                          return (
                            <div
                              key={`${label}-${i}`}
                              className="absolute left-1/2 top-1/2"
                              style={{
                                transform: `rotate(${angle}deg) translateY(-74px) rotate(${-angle}deg)`,
                              }}
                            >
                              <div
                                className={cn(
                                  "select-none rounded-full px-2 py-0.5 text-[10px] font-extrabold tracking-wider shadow-sm",
                                  label === "PERDU"
                                    ? "bg-black/45 text-slate-200 ring-1 ring-white/10"
                                    : label === "x1"
                                      ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/30"
                                      : "bg-amber-500/18 text-amber-200 ring-1 ring-amber-400/35",
                                )}
                              >
                                {label}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      {/* Centre vide (sans texte) */}
                      <div className="absolute inset-6 rounded-full bg-black/40 backdrop-blur-sm" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 font-bold text-amber-300">
                {wheelOutcome !== null
                  ? wheelOutcome === 0
                    ? "PERDU (0x)"
                    : wheelOutcome === 1
                      ? "RÉCUPÉRÉ (x1)"
                      : "JACKPOT (x3)"
                  : `Mise : ${wheelBet} point${wheelBet > 1 ? "s" : ""}`}
              </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[1, 2, 3].map((bet) => (
                <Button
                  key={bet}
                  type="button"
                  variant={wheelBet === bet ? "default" : "outline"}
                  className="w-full border-white/15 bg-white/5 text-white hover:bg-white/10"
                  onClick={() => setWheelBet(bet)}
                  disabled={wheelSpinning}
                >
                  {bet}
                </Button>
              ))}
            </div>
            <Button
              className="mt-4 w-full bg-gradient-to-r from-violet-600 via-fuchsia-600 to-amber-500 text-white shadow-[0_12px_30px_rgba(168,85,247,0.22)] hover:brightness-110"
              onClick={handleSpinWheel}
              disabled={wheelSpinning || userPoints < wheelBet}
            >
              {wheelSpinning ? "Rotation..." : "Lancer la roue"}
            </Button>
            {userPoints < wheelBet ? (
              <p className="mt-2 text-center text-xs font-semibold text-rose-200/90">
                Points insuffisants pour cette mise.
              </p>
            ) : null}
            <Button variant="ghost" className="w-full mt-2 text-slate-300/70 hover:text-white" onClick={() => setShowWheelModal(false)}>
              Fermer
            </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}