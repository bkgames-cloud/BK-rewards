"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { getPrizeFallbackImage } from "@/lib/prizes"
import type { RewardPool } from "@/lib/types"

interface UserStatsMap {
  [poolId: string]: { views: number; tickets: number }
}

interface RewardPoolsGridProps {
  userId?: string
  title?: string
  description?: string
}

export function RewardPoolsGrid({
  userId,
  title = "Cagnottes Communautaires",
  description = "Suivez l'avancée globale des lots et vos tickets personnels.",
}: RewardPoolsGridProps) {
  const [pools, setPools] = useState<RewardPool[]>([])
  const [loading, setLoading] = useState(true)
  const [userStats, setUserStats] = useState<UserStatsMap>({})

  useEffect(() => {
    const fetchPools = async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("rewards_pools")
        .select("*")
        .order("target_videos", { ascending: false })
      if (!error && data) {
        setPools(data as RewardPool[])
      }
      setLoading(false)
    }
    fetchPools()
  }, [])

  useEffect(() => {
    const fetchUserStats = async () => {
      if (!userId) {
        setUserStats({})
        return
      }
      const supabase = createClient()
      const { data } = await supabase
        .from("rewards_pool_tickets")
        .select("pool_id, views_count, tickets_count")
        .eq("user_id", userId)

      const map: UserStatsMap = {}
      for (const row of data || []) {
        const poolId = (row as { pool_id?: string }).pool_id
        if (!poolId) continue
        map[poolId] = {
          views: (row as { views_count?: number }).views_count || 0,
          tickets: (row as { tickets_count?: number }).tickets_count || 0,
        }
      }
      setUserStats(map)
    }
    fetchUserStats()
  }, [userId])

  const poolsWithProgress = useMemo(() => {
    return pools.map((pool) => {
      const progress =
        pool.target_videos > 0
          ? Math.min((pool.current_videos / pool.target_videos) * 100, 100)
          : 0
      return { ...pool, progress }
    })
  }, [pools])

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">Chargement des cagnottes...</p>
      </div>
    )
  }

  if (pools.length === 0) {
    return (
      <Card className="border border-border/50 bg-[#1a1a1a]/80 backdrop-blur-sm shadow-lg">
        <CardContent className="flex items-center justify-center py-10">
          <p className="text-muted-foreground">Aucune cagnotte disponible pour le moment.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
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
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
