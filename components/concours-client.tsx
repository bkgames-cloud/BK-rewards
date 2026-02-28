"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Info } from "lucide-react"
import { motion } from "framer-motion"
import confetti from "canvas-confetti"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { VideoOverlay } from "@/components/video-overlay"
import { useToast } from "@/hooks/use-toast"
import { Confetti } from "@/components/confetti"
import { soundService } from "@/lib/sounds"

export function ConcoursClient() {
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [isOverlayOpen, setIsOverlayOpen] = useState(false)
  const [videoAction, setVideoAction] = useState<"scratch" | "wheel-rescue" | null>(null)
  const [userPoints, setUserPoints] = useState(0)
  const [isVip, setIsVip] = useState(false)
  const [isVipPlus, setIsVipPlus] = useState(false)
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
  const [showWheelModal, setShowWheelModal] = useState(false)
  const [wheelBet, setWheelBet] = useState(1)
  const [wheelResult, setWheelResult] = useState<number | null>(null)
  const [wheelAngle, setWheelAngle] = useState(0)
  const [wheelSpinning, setWheelSpinning] = useState(false)
  const [showRescueModal, setShowRescueModal] = useState(false)
  const [pendingRescueBet, setPendingRescueBet] = useState<number | null>(null)
  const [infoModal, setInfoModal] = useState<"scratch" | "wheel" | null>(null)
  const [slotSpinning, setSlotSpinning] = useState(false)
  const [slotResult, setSlotResult] = useState<string[] | null>(null)
  const [slotMessage, setSlotMessage] = useState<string | null>(null)
  const [slotExtraSpinAvailable, setSlotExtraSpinAvailable] = useState(false)
  const [slotSpinSeed, setSlotSpinSeed] = useState(0)
  const [isSimulatingAd, setIsSimulatingAd] = useState(false)
  const lastVipAdClickRef = useRef<number>(0)
  const slotTimeoutRef = useRef<number | null>(null)
  const adSimulationTimeoutRef = useRef<number | null>(null)
  const [tapArenaActive, setTapArenaActive] = useState(false)
  const [tapArenaCount, setTapArenaCount] = useState(0)
  const [tapArenaTimeLeft, setTapArenaTimeLeft] = useState(30)
  const [tapArenaResult, setTapArenaResult] = useState<string | null>(null)
  const tapLastClickRef = useRef<number>(0)
  const tapIntervalRef = useRef<number | null>(null)
  const tapArenaCountRef = useRef<number>(0)
  const { toast } = useToast()

  // ─── Relire les points depuis Supabase ───
  const refreshPoints = async (uid?: string) => {
    const id = uid || userId
    if (!id) return
    const supabase = createClient()
    const { data } = await supabase
      .from("profiles")
      .select("points")
      .eq("id", id)
      .maybeSingle()
    if (typeof data?.points === "number") {
      setUserPoints(data.points)
    }
  }

  useEffect(() => {
    setLoading(false)
  }, [])

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUserId(user?.id || null)

      if (!user?.id) {
        // Pas d'utilisateur connecté — réinitialiser les états
        setUserPoints(0)
        setIsVip(false)
        setIsVipPlus(false)
        setLastScratchAt(null)
        setLastWheelAt(null)
        setLastVipSlotAt(null)
        setLoading(false)
        return
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("points, last_scratch_at, last_wheel_at, is_vip, is_vip_plus, last_vip_slot_at")
        .eq("id", user.id)
        .maybeSingle()

      // On force l'affichage des points
      const points = profileData?.points ?? 0
      setUserPoints(points)
      
      const vipPlus = !!profileData?.is_vip_plus
      const vipSimple = !!profileData?.is_vip
      setIsVip(vipSimple || vipPlus)
      setIsVipPlus(vipPlus)

      // Timers pour les jeux
      setLastVipSlotAt(profileData?.last_vip_slot_at ? new Date(profileData.last_vip_slot_at) : null)
      setLastScratchAt(profileData?.last_scratch_at ? new Date(profileData.last_scratch_at) : null)
      setLastWheelAt(profileData?.last_wheel_at ? new Date(profileData.last_wheel_at) : null)

      if (vipPlus) {
        const { data: vipPlusCountData } = await supabase.rpc("get_vip_plus_count")
        if (typeof vipPlusCountData === "number") {
          setVipPlusCount(vipPlusCountData)
        }
      }

      // TRÈS IMPORTANT : on dit que le chargement est terminé
      setLoading(false)
      if (vipPlus) {
        const { data: vipPlusCountData } = await supabase.rpc("get_vip_plus_count")
        if (typeof vipPlusCountData === "number") {
          setVipPlusCount(vipPlusCountData)
        }
        const { data: previousWinnerData } = await supabase.rpc("get_tap_tap_previous_week_winner")
        if (previousWinnerData && previousWinnerData.length > 0) {
          const winner = previousWinnerData[0] as { display_name?: string; score?: number }
          setPreviousWinner({
            name: winner.display_name || "VIP+",
            score: winner.score || 0,
          })
        } else {
          setPreviousWinner(null)
        }
      }

      // Aucun chargement de points ici : la page Concours ne montre que les mini-jeux.
    }

    fetchUser()
  }, [])

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000 * 30)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    return () => {
      if (slotTimeoutRef.current) {
        window.clearTimeout(slotTimeoutRef.current)
        slotTimeoutRef.current = null
      }
      if (adSimulationTimeoutRef.current) {
        window.clearTimeout(adSimulationTimeoutRef.current)
        adSimulationTimeoutRef.current = null
      }
      if (tapIntervalRef.current) {
        window.clearInterval(tapIntervalRef.current)
        tapIntervalRef.current = null
      }
    }
  }, [])

  const handleVideoComplete = async () => {
    if (videoAction === "scratch") {
      setScratchUnlocked(true)
      setShowScratchModal(true)
      return
    }

    if (videoAction === "wheel-rescue" && pendingRescueBet && userId) {
      try {
        const response = await fetch("/api/user/update-points", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pointsToAdd: pendingRescueBet }),
        })
        if (response.ok) {
          setPendingRescueBet(null)
          setShowRescueModal(false)
          // Relire les points depuis la base
          await refreshPoints()
          toast({
            title: "Mise récupérée !",
            description: "Votre mise a été recréditée.",
          })
        }
      } catch {
        toast({
          title: "Erreur",
          description: "Impossible de récupérer la mise.",
          variant: "destructive",
        })
      }
      return
    }
  }

  const cooldownMultiplier = isVipPlus ? 0.5 : 1
  const SCRATCH_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000 * cooldownMultiplier
  const WHEEL_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000 * cooldownMultiplier
  const VIP_SLOT_COOLDOWN_MS = 24 * 60 * 60 * 1000

  const scratchAvailable = !lastScratchAt || now - lastScratchAt.getTime() >= SCRATCH_COOLDOWN_MS
  const wheelAvailable = !lastWheelAt || now - lastWheelAt.getTime() >= WHEEL_COOLDOWN_MS
  const vipSlotAvailable = !lastVipSlotAt || now - lastVipSlotAt.getTime() >= VIP_SLOT_COOLDOWN_MS

  const formatRemaining = (ms: number) => {
    if (ms <= 0) return "Disponible"
    const totalMinutes = Math.ceil(ms / 60000)
    const days = Math.floor(totalMinutes / (60 * 24))
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
    const minutes = totalMinutes % 60
    if (days > 0) return `${days}j ${hours}h`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const scratchRemaining = scratchAvailable
    ? "Disponible"
    : formatRemaining(SCRATCH_COOLDOWN_MS - (now - (lastScratchAt?.getTime() || 0)))
  const wheelRemaining = wheelAvailable
    ? "Disponible"
    : formatRemaining(WHEEL_COOLDOWN_MS - (now - (lastWheelAt?.getTime() || 0)))
  const vipSlotRemaining = vipSlotAvailable
    ? "Disponible"
    : formatRemaining(VIP_SLOT_COOLDOWN_MS - (now - (lastVipSlotAt?.getTime() || 0)))

  const openScratchUnlock = () => {
    if (!userId) {
      toast({ title: "Connexion requise", description: "Connectez-vous pour jouer.", variant: "destructive" })
      return
    }
    if (!scratchAvailable) return
    setVideoAction("scratch")
    setIsOverlayOpen(true)
  }

  const revealScratch = async () => {
    if (!userId) return
    if (scratchResult !== null) return
    const roll = Math.random()
    let resultPoints = 0
    if (roll < 0.65) resultPoints = 0
    else if (roll < 0.9) resultPoints = 1
    else resultPoints = 2

    const nowIso = new Date().toISOString()
    
    // Utiliser l'API unique pour points + timestamp (contourne les RLS)
    try {
      await fetch("/api/user/update-points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(resultPoints > 0 ? { pointsToAdd: resultPoints } : {}),
          timestamps: { last_scratch_at: nowIso },
        }),
      })
    } catch {
      // Ignore error, continue anyway
    }

    // Persister le timer scratch dans localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem("bk_last_scratch_at", nowIso)
    }

    setLastScratchAt(new Date(nowIso))
    setScratchResult(resultPoints)

    // Relire les points depuis la base pour avoir le solde exact
    await refreshPoints()

    if (resultPoints > 0) {
      setShowConfetti(true)
      soundService.playSuccess()
      setTimeout(() => setShowConfetti(false), 2500)
    }
  }

  const resetScratch = () => {
    setScratchUnlocked(false)
    setScratchResult(null)
    setShowScratchModal(false)
  }

  const spinWheel = async () => {
    if (!userId) return
    if (!wheelAvailable) return
    if (wheelSpinning) return
    if (userPoints < wheelBet) {
      toast({
        title: "Points insuffisants",
        description: `Il vous faut ${wheelBet} points pour miser.`,
        variant: "destructive",
      })
      return
    }

    const nowIso = new Date().toISOString()
    const pointsAfterBet = userPoints - wheelBet
    
    // Utiliser l'API unique pour déduire la mise + mettre à jour le timer (contourne les RLS)
    try {
      const response = await fetch("/api/user/update-points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pointsToAdd: -wheelBet,
          timestamps: { last_wheel_at: nowIso },
        }),
      })
      if (!response.ok) {
        toast({
          title: "Erreur",
          description: "Impossible de placer la mise.",
          variant: "destructive",
        })
        return
      }
      setUserPoints(pointsAfterBet)
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de placer la mise.",
        variant: "destructive",
      })
      return
    }

    setLastWheelAt(new Date(nowIso))

    setWheelResult(null)
    setWheelSpinning(true)
    const spinTurns = 3 + Math.random() * 3
    const spinAngle = 360 * spinTurns + Math.random() * 360
    setWheelAngle((prev) => prev + spinAngle)

    const roll = Math.random()
    let multiplier = 0
    if (roll < 0.5) multiplier = 0
    else if (roll < 0.8) multiplier = 1
    else if (roll < 0.95) multiplier = 2
    else multiplier = 3

    setTimeout(async () => {
      setWheelResult(multiplier)
      setWheelSpinning(false)

      if (multiplier === 0) {
        setPendingRescueBet(wheelBet)
        setShowRescueModal(true)
        return
      }

      const payout = wheelBet * multiplier
      if (payout > 0) {
        // Utiliser l'API pour ajouter les gains
        try {
          await fetch("/api/user/update-points", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pointsToAdd: payout }),
          })
        } catch {
          // Ignore error, continue anyway
        }
      }

      // Relire les points depuis la base pour avoir le solde exact
      await refreshPoints()

      setShowConfetti(true)
      soundService.playSuccess()
      setTimeout(() => setShowConfetti(false), 2500)
    }, 1500)
  }

  const slotSymbols = ["💎", "💰", "🎁", "🎫", "❌"]

  const getSlotOutcome = () => {
    const roll = Math.random()
    if (roll < 0.01) return { symbol: "💎", reward: 250, label: "Jackpot", isJackpot: true }
    if (roll < 0.06) return { symbol: "💰", reward: 100, label: "Grand gain", isJackpot: false }
    if (roll < 0.21) return { symbol: "🎁", reward: 20, label: "Petit gain", isJackpot: false }
    if (roll < 0.41) return { symbol: "🎫", reward: 5, label: "Consolation", isJackpot: false }
    return { symbol: "❌", reward: 0, label: "Perdu", isJackpot: false }
  }

  const finalizeSlotReward = async (reward: number, isJackpot: boolean) => {
    if (!userId) return
    const nowIso = new Date().toISOString()
    
    // Utiliser l'API unique pour points + timestamp (contourne les RLS)
    try {
      await fetch("/api/user/update-points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(reward > 0 ? { pointsToAdd: reward } : {}),
          timestamps: { last_vip_slot_at: nowIso },
        }),
      })
    } catch {
      // Ignore error, continue anyway
    }
    
    // Relire les points depuis la base pour avoir le solde exact
    await refreshPoints()
    setLastVipSlotAt(new Date(nowIso))
    if (isJackpot) {
      try {
        confetti({ particleCount: 180, spread: 75, origin: { y: 0.6 } })
      } catch {
        // ignore
      }
    }
  }

  const handleVipSpin = async () => {
    if (!userId || !isVip) return
    if (slotSpinning || isSimulatingAd) return
    if (!vipSlotAvailable && !slotExtraSpinAvailable) {
      setSlotMessage("Regardez une vidéo pour rejouer.")
      return
    }

    const outcome = getSlotOutcome()
    setSlotMessage(null)
    setSlotResult([outcome.symbol, outcome.symbol, outcome.symbol])
    setSlotExtraSpinAvailable(false)
    setSlotSpinning(true)
    setSlotSpinSeed((prev) => prev + 1)

    if (slotTimeoutRef.current) {
      window.clearTimeout(slotTimeoutRef.current)
      slotTimeoutRef.current = null
    }

    slotTimeoutRef.current = window.setTimeout(async () => {
      setSlotSpinning(false)
      await finalizeSlotReward(outcome.reward, outcome.isJackpot)
      if (outcome.reward > 0) {
        setSlotMessage(`${outcome.label} : +${outcome.reward} point${outcome.reward > 1 ? "s" : ""}`)
      } else {
        setSlotMessage("Perdu. Retentez votre chance plus tard.")
      }
    }, 1800)
  }

  const handleVipAdSimulation = () => {
    if (!userId || !isVip) return
    if (isSimulatingAd || slotSpinning) return
    const nowTime = Date.now()
    if (nowTime - lastVipAdClickRef.current < 1000) {
      setSlotMessage("Veuillez patienter avant de relancer une simulation.")
      return
    }
    lastVipAdClickRef.current = nowTime

    setIsSimulatingAd(true)
    setSlotMessage("Simulation de publicité en cours...")

    if (adSimulationTimeoutRef.current) {
      window.clearTimeout(adSimulationTimeoutRef.current)
      adSimulationTimeoutRef.current = null
    }

    adSimulationTimeoutRef.current = window.setTimeout(() => {
      setIsSimulatingAd(false)
      setSlotExtraSpinAvailable(true)
      setSlotMessage("Spin supplémentaire débloqué !")
    }, 5000)
  }

  const startTapArena = () => {
    if (!isVipPlus || tapArenaActive) return
    setTapArenaResult(null)
    setTapArenaCount(0)
    tapArenaCountRef.current = 0
    setTapArenaTimeLeft(30)
    setTapArenaActive(true)

    if (tapIntervalRef.current) {
      window.clearInterval(tapIntervalRef.current)
      tapIntervalRef.current = null
    }

    tapIntervalRef.current = window.setInterval(() => {
      setTapArenaTimeLeft((prev) => {
        if (prev <= 1) {
          if (tapIntervalRef.current) {
            window.clearInterval(tapIntervalRef.current)
            tapIntervalRef.current = null
          }
          setTapArenaActive(false)
          const finalScore = tapArenaCountRef.current
          setTapArenaResult(`Score final : ${finalScore} taps`)
          submitTapScore(finalScore)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const handleTapArenaClick = () => {
    if (!tapArenaActive) return
    const nowTime = performance.now()
    if (nowTime - tapLastClickRef.current < 60) {
      return
    }
    tapLastClickRef.current = nowTime
    setTapArenaCount((prev) => prev + 1)
    tapArenaCountRef.current += 1
  }

  const submitTapScore = async (score: number) => {
    if (!userId || !isVipPlus) return
    const supabase = createClient()
    const { error } = await supabase.rpc("submit_tap_tap_score", { p_score: score })
    if (error) {
      console.error("[TapTap] Score submit error:", error)
      return
    }
    toast({
      title: "Score enregistré",
      description: `Votre score (${score}) a été ajouté au classement.`,
    })
  }

  const videoContextLabel = useMemo(() => {
    if (videoAction === "scratch") return "BK Scratch"
    if (videoAction === "wheel-rescue") return "BK Wheel"
    return "Concours"
  }, [videoAction])

  const videoRewardLabel = useMemo(() => {
    if (videoAction === "scratch") return "Jeu débloqué"
    if (videoAction === "wheel-rescue") return "Récupérer la mise"
    return "Mini-jeux"
  }, [videoAction])

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <h2 className="text-xl font-semibold text-foreground">Mini-Jeux</h2>
        <p className="text-sm text-muted-foreground">Chargement...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-4">
    <div className="flex flex-col gap-2">
      <h2 className="text-xl font-semibold text-foreground">Mini-Jeux</h2>
      <p className="text-sm text-muted-foreground">
        Gagnez des points bonus avec nos mini-jeux.
      </p>
    </div>

    {showConfetti && <Confetti />}

    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border border-border/50 bg-[#1a1a1a] shadow-lg">
        <CardHeader className="pb-2 flex items-center justify-between">
          <CardTitle className="text-lg text-foreground">BK Scratch</CardTitle>
          <button
            className="rounded-full border border-border/60 p-1 text-muted-foreground hover:text-foreground"
            onClick={() => setInfoModal("scratch")}
          >
            <Info className="h-4 w-4" />
          </button>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Grattez pour gagner des points.</p>
          <div className="rounded-lg bg-secondary/40 p-3 text-sm">
            <p>Disponibilité : <span className="font-semibold">{scratchRemaining}</span></p>
          </div>
          <Button className="w-full" onClick={openScratchUnlock} disabled={!scratchAvailable || !userId}>
            {scratchAvailable ? "Regarder une vidéo" : "Revenez plus tard"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border border-border/50 bg-[#1a1a1a] shadow-lg">
        <CardHeader className="pb-2 flex items-center justify-between">
          <CardTitle className="text-lg text-foreground">BK Wheel</CardTitle>
          <button
            className="rounded-full border border-border/60 p-1 text-muted-foreground hover:text-foreground"
            onClick={() => setInfoModal("wheel")}
          >
            <Info className="h-4 w-4" />
          </button>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Multipliez vos points.</p>
          <div className="rounded-lg bg-secondary/40 p-3 text-sm">
            <p>Points : <span className="font-semibold">{userPoints}</span></p>
          </div>
          <Button className="w-full" onClick={() => setShowWheelModal(true)} disabled={!wheelAvailable || !userId}>
            Lancer la roue
          </Button>
        </CardContent>
      </Card>
    </div>

    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-foreground">Zone VIP</h3>
      {!isVip ? (
        <Card className="border border-border/50 bg-[#1a1a1a] shadow-lg">
          <CardContent className="p-4 text-sm text-muted-foreground">Réservé aux membres VIP.</CardContent>
        </Card>
      ) : (
        <Card className="border border-yellow-500/30 bg-[#0d0b07] shadow-[0_0_30px_rgba(245,158,11,0.12)]">
          <CardHeader><CardTitle className="text-lg text-yellow-300">Slot Machine VIP</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-center">
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((idx) => (
                <div key={idx} className="h-20 flex items-center justify-center rounded-lg border border-yellow-500/30 bg-black/70 text-3xl">
                  {slotSpinning ? "🎰" : (slotResult ? slotResult[idx] : "❔")}
                </div>
              ))}
            </div>
            <Button className="w-full bg-yellow-500 text-black" onClick={handleVipSpin} disabled={slotSpinning || (!vipSlotAvailable && !slotExtraSpinAvailable)}>
              Lancer le spin
            </Button>
          </CardContent>
        </Card>
      )}

      {/* --- ZONE TAP-TAP --- */}
      {isVipPlus && (
        <Card className="border border-slate-500/40 bg-slate-900/50">
          <CardHeader><CardTitle className="text-slate-100">Tap-Tap Arena VIP+</CardTitle></CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="text-2xl font-bold text-white">{tapArenaCount} Taps</div>
            <Button className="w-full" onClick={startTapArena} disabled={tapArenaActive}>
              {tapArenaActive ? `Temps: ${tapArenaTimeLeft}s` : "Démarrer"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>

    {/* --- MODALS (Tout à la suite sans fermer le div principal) --- */}
    <VideoOverlay
      isOpen={isOverlayOpen}
      onClose={() => setIsOverlayOpen(false)}
      onComplete={handleVideoComplete}
      contextLabel={videoContextLabel}
      rewardLabel={videoRewardLabel}
    />

    {showScratchModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
        <Card className="w-full max-w-sm border-border/60 bg-[#111111] text-white">
          <CardContent className="p-6 text-center space-y-4">
            <div className="bg-secondary/30 p-6 rounded-xl border-dashed border text-2xl font-bold">
              {scratchResult === null ? "BK" : (scratchResult === 0 ? "Perdu" : `+${scratchResult} pts`)}
            </div>
            <Button className="w-full" onClick={scratchResult === null ? revealScratch : resetScratch}>
              {scratchResult === null ? "Gratter" : "Fermer"}
            </Button>
          </CardContent>
        </Card>
      </div>
    )}

    {showWheelModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
        <Card className="w-full max-w-sm border-border/60 bg-[#111111] text-white p-6 text-center space-y-4">
          <h3 className="text-lg font-bold">BK Wheel</h3>
          <div className="text-xl">{wheelResult === null ? "Prêt ?" : `Résultat: x${wheelResult}`}</div>
          <Button className="w-full" onClick={spinWheel} disabled={wheelSpinning}>
            {wheelSpinning ? "Rotation..." : "Tourner la roue"}
          </Button>
          <Button variant="outline" className="w-full" onClick={() => setShowWheelModal(false)}>Fermer</Button>
        </Card>
      </div>
    )}

    {infoModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
        <Card className="w-full max-w-sm border-border/60 bg-[#111111] text-white p-6 text-center">
          <p>Règlement : Jeux gratuits, points virtuels uniquement.</p>
          <Button className="mt-4 w-full" onClick={() => setInfoModal(null)}>Fermer</Button>
        </Card>
      </div>
    )}
  </div>
);
}