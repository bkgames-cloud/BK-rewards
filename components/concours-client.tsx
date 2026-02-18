"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { VideoOverlay } from "@/components/video-overlay"
import { useToast } from "@/hooks/use-toast"
import { getPrizeFallbackImage } from "@/lib/prizes"
import type { RewardPool } from "@/lib/types"

interface UserStatsMap {
  [poolId: string]: { views: number; tickets: number }
}

export function ConcoursClient() {
  const [pools, setPools] = useState<RewardPool[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [userStats, setUserStats] = useState<UserStatsMap>({})
  const [isOverlayOpen, setIsOverlayOpen] = useState(false)
  const [selectedPool, setSelectedPool] = useState<RewardPool | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    const fetchPools = async () => {
      const supabase = createClient()
      const { data, error } = await supabase.from("rewards_pools").select("*").order("target_videos", {
        ascending: false,
      })
      if (!error && data) {
        setPools(data as RewardPool[])
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

  const openVideo = (pool: RewardPool) => {
    setSelectedPool(pool)
    setIsOverlayOpen(true)
  }

  const handleVideoComplete = async () => {
    if (!selectedPool) return
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/rewards-pools/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poolId: selectedPool.id }),
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

      setPools((prev) =>
        prev.map((pool) =>
          pool.id === selectedPool.id
            ? { ...pool, current_videos: payload.current_videos ?? pool.current_videos }
            : pool,
        ),
      )

      setUserStats((prev) => ({
        ...prev,
        [selectedPool.id]: {
          views: payload.user_views ?? (prev[selectedPool.id]?.views || 0) + 1,
          tickets: payload.user_tickets ?? prev[selectedPool.id]?.tickets || 0,
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

  const poolsWithProgress = useMemo(() => {
    return pools.map((pool) => {
      const progress = pool.target_videos > 0
        ? Math.min((pool.current_videos / pool.target_videos) * 100, 100)
        : 0
      return { ...pool, progress }
    })
  }, [pools])

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <h2 className="text-xl font-semibold text-foreground">Concours</h2>
        <p className="text-sm text-muted-foreground">Chargement des cagnottes...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold text-foreground">Concours Communautaires</h2>
        <p className="text-sm text-muted-foreground">
          Regardez des vidéos pour faire avancer la cagnotte de votre lot préféré.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {poolsWithProgress.map((pool) => {
          const views = userStats[pool.id]?.views || 0
          const tickets = userStats[pool.id]?.tickets || 0
          const imageSrc =
            pool.image_url && pool.image_url.trim() !== ""
              ? pool.image_url
              : getPrizeFallbackImage(pool.name)

          return (
            <Card key={pool.id} className="border border-border/50 bg-[#1a1a1a] shadow-lg">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-foreground">{pool.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-secondary/40">
                  <Image
                    src={imageSrc}
                    alt={pool.name}
                    fill
                    className="object-cover"
                    unoptimized
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      const fallback = getPrizeFallbackImage(pool.name)
                      if (!target.src.includes(fallback)) {
                        target.src = fallback
                      }
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Avancement global</span>
                    <span className="text-foreground font-semibold">
                      {pool.current_videos} / {pool.target_videos}
                    </span>
                  </div>
                  <Progress value={pool.progress} />
                </div>

                <div className="rounded-lg bg-secondary/40 p-3 text-sm">
                  <p className="text-muted-foreground">
                    Vos vues : <span className="font-semibold text-foreground">{views}</span>
                  </p>
                  <p className="text-muted-foreground">
                    Vos tickets : <span className="font-semibold text-foreground">{tickets}</span>
                  </p>
                </div>

                <Button
                  className="w-full"
                  onClick={() => openVideo(pool)}
                  disabled={!userId || isSubmitting}
                >
                  {userId ? "Regarder une vidéo" : "Connectez-vous pour participer"}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="border border-border/50 bg-[#121212]">
        <CardHeader>
          <CardTitle className="text-base">Règlement des Concours</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>La participation est gratuite et sans obligation d'achat.</p>
          <p>Le tirage au sort a lieu dès que la barre de progression atteint 100%.</p>
          <p>Plus vous avez de tickets, plus vos chances de gagner au tirage au sort sont élevées.</p>
          <p>
            BKG Rewards se réserve le droit d'annuler les tickets en cas de fraude (clics robots, VPN, etc.).
          </p>
        </CardContent>
      </Card>

      <VideoOverlay
        isOpen={isOverlayOpen}
        onClose={() => setIsOverlayOpen(false)}
        onComplete={handleVideoComplete}
        contextLabel="Concours"
        rewardLabel="+1 vidéo"
      />
    </div>
  )
}
