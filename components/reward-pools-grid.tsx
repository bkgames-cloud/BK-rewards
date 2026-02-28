"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { getPrizeFallbackImage } from "@/lib/prizes"
import type { RewardPool } from "@/lib/types"

interface RewardPoolsGridProps {
  userId?: string
  title?: string
  description?: string
}

export function RewardPoolsGrid({
  userId,
  title = "Cagnottes Communautaires",
  description = "Suivez l'avancée globale des lots et vos points personnels.",
}: RewardPoolsGridProps) {
  const [pools, setPools] = useState<RewardPool[]>([])
  const [loading, setLoading] = useState(true)
  const [userPoints, setUserPoints] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [selectedPool, setSelectedPool] = useState<RewardPool | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

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
        setUserPoints(0)
        return
      }
      const supabase = createClient()
      const { data: profile } = await supabase
        .from("profiles")
        .select("points")
        .eq("id", userId)
        .maybeSingle()
      setUserPoints(profile?.points || 0)
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
          const ticketCost = pool.ticket_cost || 10
          const lowerName = pool.name.toLowerCase()
          const isGenericPhone = lowerName.includes("samsung") || lowerName.includes("galaxy")
          const imageSrc =
            isGenericPhone
              ? "/smartphone-premium.svg"
              : pool.image_url && pool.image_url.trim() !== ""
                ? pool.image_url
                : getPrizeFallbackImage(pool.name)
          const isGiftCard =
            lowerName.includes("carte") ||
            lowerName.includes("amazon") ||
            lowerName.includes("psn") ||
            lowerName.includes("google")
          const amountMatch = pool.name.match(/(\d+)\s?€/)
          const amountLabel = amountMatch ? `${amountMatch[1]}€` : ""
          const giftBg =
            lowerName.includes("amazon")
              ? "from-slate-200/90 via-slate-100/80 to-slate-300/90"
              : lowerName.includes("google")
                ? "from-emerald-300/80 via-emerald-200/70 to-slate-100/80"
                : "from-slate-900/90 via-slate-800/80 to-slate-700/90"
          const giftTextColor =
            lowerName.includes("amazon") || lowerName.includes("google") ? "text-slate-900" : "text-white"
          return (
            <Card key={pool.id} className="border border-border/50 bg-[#1a1a1a] shadow-lg">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-foreground">{pool.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-secondary/40">
                  {isGiftCard ? (
                    <div
                      className={`absolute inset-0 rounded-xl bg-gradient-to-br ${giftBg} p-4 shadow-[0_10px_20px_rgba(0,0,0,0.25),inset_0_1px_2px_rgba(255,255,255,0.6)]`}
                    >
                      <div className="absolute inset-0 rounded-xl bg-[linear-gradient(135deg,rgba(255,255,255,0.35)_0%,rgba(255,255,255,0.08)_45%,rgba(0,0,0,0.15)_100%)]" />
                      <div className="absolute inset-0 rounded-xl opacity-50 bg-[linear-gradient(90deg,rgba(255,255,255,0.18)_0%,rgba(255,255,255,0.04)_20%,rgba(255,255,255,0.18)_40%,rgba(255,255,255,0.04)_60%,rgba(255,255,255,0.18)_80%,rgba(255,255,255,0.04)_100%)]" />
                      <div className={`relative flex h-full flex-col items-center justify-center ${giftTextColor}`}>
                        <span className="text-3xl font-bold tracking-wide">{amountLabel || ""}</span>
                        <span className="mt-2 text-xs uppercase tracking-widest opacity-80">Carte Cadeau</span>
                      </div>
                    </div>
                  ) : imageSrc.endsWith(".svg") ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={imageSrc}
                      alt={pool.name}
                      className="absolute inset-0 h-full w-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        if (!target.src.includes("/samsungs24.jpg")) {
                          target.src = "/samsungs24.jpg"
                        }
                      }}
                    />
                  ) : (
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
                  )}
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

                {!userId ? (
                  <Button className="w-full" asChild>
                    <a href="/auth/login">Se connecter pour acheter</a>
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    onClick={() => {
                      setSelectedPool(pool)
                      setShowModal(true)
                    }}
                    disabled={userPoints < ticketCost}
                  >
                    Acheter ({ticketCost} points)
                  </Button>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {showModal && selectedPool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <Card className="w-full max-w-sm border border-border/60 bg-[#111111] shadow-xl">
            <CardHeader className="pb-2 text-center">
              <CardTitle className="text-lg text-foreground">Acheter {selectedPool.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-secondary/40 p-3 text-sm text-muted-foreground">
                <p className="mb-1">Prix : <span className="font-semibold text-foreground">{selectedPool.ticket_cost || 10} points</span></p>
                <p>Votre solde : <span className="font-semibold text-foreground">{userPoints} points</span></p>
              </div>
              
              {successMessage ? (
                <div className="rounded-lg bg-green-500/20 p-3 text-sm text-green-400">
                  {successMessage}
                </div>
              ) : (
                <>
                  {userPoints < (selectedPool.ticket_cost || 10) && (
                    <p className="text-xs text-destructive text-center">
                      Solde insuffisant. Vous avez besoin de {selectedPool.ticket_cost || 10} points.
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      disabled={isSubmitting || userPoints < (selectedPool.ticket_cost || 10)}
                      onClick={async () => {
                        setIsSubmitting(true)
                        try {
                          const response = await fetch("/api/purchase", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              poolId: selectedPool.id,
                            }),
                          })
                          const payload = await response.json().catch(() => ({}))
                          
                          if (!response.ok) {
                            const errorMsg = payload.message === "insufficient_points" 
                              ? "Solde insuffisant"
                              : payload.message === "pool_not_found"
                              ? "Lot introuvable"
                              : "Erreur lors de l'achat"
                            setSuccessMessage(`Erreur : ${errorMsg}`)
                            return
                          }

                          if (typeof payload?.new_points === "number") {
                            setUserPoints(payload.new_points)
                          }
                          alert("Achat réussi ! Retrouvez votre lot dans vos participations.")
                          setSuccessMessage(`✅ Achat réussi ! Votre commande est en attente de traitement.`)
                          setTimeout(() => {
                            setShowModal(false)
                            setSuccessMessage(null)
                          }, 2000)
                        } catch (error) {
                          setSuccessMessage("Erreur lors de l'achat. Veuillez réessayer.")
                        } finally {
                          setIsSubmitting(false)
                        }
                      }}
                    >
                      {isSubmitting ? "Traitement..." : "Confirmer l'achat"}
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={() => {
                      setShowModal(false)
                      setSuccessMessage(null)
                    }}>
                      Annuler
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
