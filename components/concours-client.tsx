"use client"

import { useEffect, useMemo, useState } from "react"
import { Info } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { VideoOverlay } from "@/components/video-overlay"
import { useToast } from "@/hooks/use-toast"
import { Confetti } from "@/components/confetti"
import { soundService } from "@/lib/sounds"
import type { RewardPool } from "@/lib/types"

interface UserStatsMap {
  [poolId: string]: { views: number; tickets: number }
}

export function ConcoursClient() {
  const [pools, setPools] = useState<RewardPool[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [userStats, setUserStats] = useState<UserStatsMap>({})
  const [selectedPoolId, setSelectedPoolId] = useState<string>("")
  const [isOverlayOpen, setIsOverlayOpen] = useState(false)
  const [videoAction, setVideoAction] = useState<"bonus" | "scratch" | "wheel-rescue" | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [userPoints, setUserPoints] = useState(0)
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
  const { toast } = useToast()

  useEffect(() => {
    const fetchPools = async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("rewards_pools")
        .select("*")
        .order("target_videos", { ascending: false })
      if (!error && data) {
        setPools(data as RewardPool[])
        if (!selectedPoolId && data.length > 0) {
          setSelectedPoolId(data[0].id)
        }
      }
      setLoading(false)
    }
    fetchPools()
  }, [])

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUserId(user?.id || null)

      if (!user?.id) {
        setUserStats({})
        return
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("points, last_scratch_at, last_wheel_at")
        .eq("id", user.id)
        .maybeSingle()

      setUserPoints(profileData?.points || 0)
      setLastScratchAt(profileData?.last_scratch_at ? new Date(profileData.last_scratch_at) : null)
      setLastWheelAt(profileData?.last_wheel_at ? new Date(profileData.last_wheel_at) : null)

      const { data: stats } = await supabase
        .from("rewards_pool_tickets")
        .select("pool_id, views_count, tickets_count")
        .eq("user_id", user.id)

      const map: UserStatsMap = {}
      for (const row of stats || []) {
        const poolId = (row as { pool_id?: string }).pool_id
        if (!poolId) continue
        map[poolId] = {
          views: (row as { views_count?: number }).views_count || 0,
          tickets: (row as { tickets_count?: number }).tickets_count || 0,
        }
      }
      setUserStats(map)
    }

    fetchUser()
  }, [])

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000 * 30)
    return () => clearInterval(interval)
  }, [])

  const handleOpenVideo = () => {
    if (!selectedPoolId) {
      toast({ title: "Erreur", description: "Choisissez un lot avant de lancer la vidéo.", variant: "destructive" })
      return
    }
    setVideoAction("bonus")
    setIsOverlayOpen(true)
  }

  const handleBonusVideoComplete = async () => {
    if (!selectedPoolId) return
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/rewards-pools/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poolId: selectedPoolId }),
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        const message =
          payload?.message === "day_limit"
            ? "Limite journalière atteinte (25 vidéos)."
            : "Impossible d'enregistrer la vidéo."
        toast({ title: "Erreur", description: message, variant: "destructive" })
        return
      }

      setUserStats((prev) => ({
        ...prev,
        [selectedPoolId]: {
          views: payload.user_views ?? ((prev[selectedPoolId]?.views || 0) + 1),
          tickets: payload.user_tickets ?? (prev[selectedPoolId]?.tickets || 0),
        },
      }))

      toast({
        title: "Merci !",
        description: "Votre vidéo a été prise en compte.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleVideoComplete = async () => {
    if (videoAction === "bonus") {
      await handleBonusVideoComplete()
      return
    }

    if (videoAction === "scratch") {
      setScratchUnlocked(true)
      setShowScratchModal(true)
      return
    }

    if (videoAction === "wheel-rescue" && pendingRescueBet && userId) {
      const newPoints = userPoints + pendingRescueBet
      const supabase = createClient()
      await supabase
        .from("profiles")
        .update({ points: newPoints })
        .eq("id", userId)
      setUserPoints(newPoints)
      setPendingRescueBet(null)
      setShowRescueModal(false)
      toast({
        title: "Mise récupérée !",
        description: "Votre mise a été recréditée.",
      })
      return
    }
  }

  const SCRATCH_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000
  const WHEEL_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

  const scratchAvailable = !lastScratchAt || now - lastScratchAt.getTime() >= SCRATCH_COOLDOWN_MS
  const wheelAvailable = !lastWheelAt || now - lastWheelAt.getTime() >= WHEEL_COOLDOWN_MS

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
    let resultTickets = 0
    if (roll < 0.65) resultTickets = 0
    else if (roll < 0.9) resultTickets = 1
    else resultTickets = 2

    const supabase = createClient()
    const nowIso = new Date().toISOString()
    const newPoints = userPoints + resultTickets
    await supabase
      .from("profiles")
      .update({ points: newPoints, last_scratch_at: nowIso })
      .eq("id", userId)

    setUserPoints(newPoints)
    setLastScratchAt(new Date(nowIso))
    setScratchResult(resultTickets)

    if (resultTickets > 0) {
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
        title: "Tickets insuffisants",
        description: `Il vous faut ${wheelBet} tickets pour miser.`,
        variant: "destructive",
      })
      return
    }

    const supabase = createClient()
    const nowIso = new Date().toISOString()
    const pointsAfterBet = userPoints - wheelBet
    await supabase
      .from("profiles")
      .update({ points: pointsAfterBet, last_wheel_at: nowIso })
      .eq("id", userId)

    setUserPoints(pointsAfterBet)
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
      const finalPoints = pointsAfterBet + payout
      await supabase
        .from("profiles")
        .update({ points: finalPoints })
        .eq("id", userId)
      setUserPoints(finalPoints)

      setShowConfetti(true)
      soundService.playSuccess()
      setTimeout(() => setShowConfetti(false), 2500)
    }, 1500)
  }

  const selectedStats = selectedPoolId ? userStats[selectedPoolId] : null

  const videoContextLabel = useMemo(() => {
    if (videoAction === "scratch") return "BK Scratch"
    if (videoAction === "wheel-rescue") return "BK Wheel"
    return "Concours"
  }, [videoAction])

  const videoRewardLabel = useMemo(() => {
    if (videoAction === "scratch") return "Ticket débloqué"
    if (videoAction === "wheel-rescue") return "Récupérer la mise"
    return "+1 vidéo"
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
          Essayez bientôt nos mini-jeux et gagnez des tickets bonus.
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
            <p className="text-sm text-muted-foreground">
              Grattez pour tenter de gagner des tickets bonus.
            </p>
            <div className="rounded-lg bg-secondary/40 p-3 text-sm">
              <p className="text-muted-foreground">
                Disponibilité : <span className="font-semibold text-foreground">{scratchRemaining}</span>
              </p>
            </div>
            <Button
              className="w-full"
              onClick={openScratchUnlock}
              disabled={!scratchAvailable || !userId}
            >
              {scratchAvailable ? "Regarder une vidéo pour débloquer" : "Revenez plus tard"}
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
            <p className="text-sm text-muted-foreground">
              Misez vos tickets et tentez de multiplier votre gain.
            </p>
            <div className="rounded-lg bg-secondary/40 p-3 text-sm">
              <p className="text-muted-foreground">
                Disponibilité : <span className="font-semibold text-foreground">{wheelRemaining}</span>
              </p>
              <p className="text-muted-foreground mt-2">
                Vos tickets : <span className="font-semibold text-foreground">{userPoints}</span>
              </p>
            </div>
            <Button
              className="w-full"
              onClick={() => setShowWheelModal(true)}
              disabled={!wheelAvailable || !userId}
            >
              {wheelAvailable ? "Lancer la roue" : "Revenez plus tard"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-border/50 bg-[#1a1a1a] shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-foreground">Bonus tickets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="pool-select" className="text-sm text-muted-foreground">
              Choisissez un lot
            </label>
            <select
              id="pool-select"
              value={selectedPoolId}
              onChange={(event) => setSelectedPoolId(event.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              {pools.map((pool) => (
                <option key={pool.id} value={pool.id}>
                  {pool.name}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-lg bg-secondary/40 p-3 text-sm">
            <p className="text-muted-foreground">
              Vos vues : <span className="font-semibold text-foreground">{selectedStats?.views || 0}</span>
            </p>
            <p className="text-muted-foreground">
              Vos tickets : <span className="font-semibold text-foreground">{selectedStats?.tickets || 0}</span>
            </p>
          </div>

          <Button
            className="w-full"
            onClick={handleOpenVideo}
            disabled={!userId || isSubmitting}
          >
            {userId ? "Regarder une vidéo" : "Connectez-vous pour participer"}
          </Button>
        </CardContent>
      </Card>

      <VideoOverlay
        isOpen={isOverlayOpen}
        onClose={() => setIsOverlayOpen(false)}
        onComplete={handleVideoComplete}
        contextLabel={videoContextLabel}
        rewardLabel={videoRewardLabel}
      />

      {showScratchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <Card className="w-full max-w-sm border border-border/60 bg-[#111111] shadow-xl">
            <CardHeader className="pb-2 text-center">
              <CardTitle className="text-lg text-foreground">BK Scratch</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <div className="relative overflow-hidden rounded-xl border border-dashed border-border/60 bg-secondary/30 p-6 text-2xl font-bold tracking-wide">
                <div className="relative z-10">
                  {scratchResult === null
                    ? "BK"
                    : scratchResult === 0
                      ? "Perdu"
                      : `+${scratchResult} ticket${scratchResult > 1 ? "s" : ""}`}
                </div>
                {scratchResult === null && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-yellow-500/30 via-yellow-300/20 to-yellow-600/30 text-3xl font-black text-yellow-200/80">
                    BK
                  </div>
                )}
              </div>
              {scratchResult === null ? (
                <Button className="w-full" onClick={revealScratch}>
                  Gratter
                </Button>
              ) : scratchResult === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Perdu, mais retente ta chance d'ici 3 jours.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Bravo ! Votre gain est ajouté à votre solde.
                </p>
              )}
              <Button variant="outline" className="w-full" onClick={resetScratch}>
                Fermer
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {showWheelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <Card className="w-full max-w-sm border border-border/60 bg-[#111111] shadow-xl">
            <CardHeader className="pb-2 text-center">
              <CardTitle className="text-lg text-foreground">BK Wheel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <div className="relative mx-auto h-48 w-48">
                <div
                  className="absolute inset-0 rounded-full border-4 border-border/60 bg-[conic-gradient(from_90deg,#fbbf24_0%25,#fde68a_25%25,#f97316_50%25,#fbbf24_75%25,#fde68a_100%)] shadow-lg transition-transform duration-1000 ease-out"
                  style={{ transform: `rotate(${wheelAngle}deg)` }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="rounded-full bg-background/80 px-4 py-2 text-sm font-semibold">
                    {wheelResult === null
                      ? "Tournez la roue"
                      : wheelResult === 0
                        ? "Perdu"
                        : `x${wheelResult}`}
                  </div>
                </div>
                <div className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 bg-accent shadow-md" />
              </div>
              <div className="flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => setWheelBet((prev) => Math.max(1, prev - 1))}
                >
                  -
                </Button>
                <span className="text-lg font-semibold">{wheelBet} ticket(s)</span>
                <Button
                  variant="outline"
                  onClick={() => setWheelBet((prev) => Math.min(3, prev + 1))}
                >
                  +
                </Button>
              </div>
              <Button className="w-full" onClick={spinWheel} disabled={isSubmitting || wheelSpinning}>
                Lancer la roue
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setShowWheelModal(false)}>
                Fermer
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {showRescueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <Card className="w-full max-w-sm border border-border/60 bg-[#111111] shadow-xl">
            <CardHeader className="pb-2 text-center">
              <CardTitle className="text-lg text-foreground">Tout n'est pas perdu</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                Visionne une vidéo et récupère ta mise.
              </p>
              <Button
                className="w-full"
                onClick={() => {
                  setVideoAction("wheel-rescue")
                  setIsOverlayOpen(true)
                }}
              >
                Visionner
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setShowRescueModal(false)}>
                Annuler
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {infoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <Card className="w-full max-w-sm border border-border/60 bg-[#111111] shadow-xl">
            <CardHeader className="pb-2 text-center">
              <CardTitle className="text-lg text-foreground">Informations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Règlement des Mini-Jeux BK Rewards :</p>
              <p>
                Gratuité : Tous les jeux sont gratuits. Les tickets gagnés sont des points virtuels sans valeur
                monétaire réelle.
              </p>
              <p>Probabilités de gain :</p>
              <p>Grattage : Perte (65%), 1 Ticket (25%), 2 Tickets (10%).</p>
              <p>Roue : Perte (50%), x1 (30%), x2 (15%), x3 (5%).</p>
              <p>
                Conditions : L'utilisation de robots, VPN ou toute fraude entraîne la suppression des tickets et le
                bannissement.
              </p>
              <p>
                Indépendance : Apple Inc. et Google LLC ne sont pas impliqués dans ces concours et ne parrainent pas
                cette application.
              </p>
              <Button className="w-full" onClick={() => setInfoModal(null)}>
                Fermer
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
