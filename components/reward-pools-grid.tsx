"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Capacitor } from "@capacitor/core"
import { createClient } from "@/lib/supabase/client"
import { Spinner } from "@/components/ui/spinner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { getPrizeFallbackImage } from "@/lib/prizes"
import type { RewardPool } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { soundService } from "@/lib/sounds"
import confetti from "canvas-confetti"
import { addInAppNotification } from "@/lib/in-app-notifications"
import { DB_NOTIFICATIONS_CHANGED_EVENT } from "@/lib/db-notifications"
import { formatCooldownMmSs, remainingCooldownMs } from "@/lib/draw-cooldown"
import { getPoolTicketCost } from "@/lib/rewards-pool-normalize"

const PROFILE_USER_ID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function poolParticipationCost(pool: RewardPool): number {
  const n = Number(pool.ticket_cost)
  if (Number.isFinite(n) && n >= 1) return Math.floor(n)
  return 10
}

interface RewardPoolsGridProps {
  userId?: string
  title?: string
  description?: string
  limit?: number
  /** Realtime = mises à jour live ; désactivé par défaut pour éviter boucles de re-render (page Cadeaux). */
  enableRealtime?: boolean
}

/** Format attendu : { success, new_points } ; tolère aussi { ok, points }. */
function parseBuySecureRpcPayload(data: unknown): { points: number } | null {
  if (data == null) return null
  let obj: Record<string, unknown>
  if (typeof data === "string") {
    try {
      const parsed: unknown = JSON.parse(data)
      if (typeof parsed !== "object" || parsed === null) return null
      obj = parsed as Record<string, unknown>
    } catch {
      return null
    }
  } else if (Array.isArray(data) && data.length > 0) {
    return parseBuySecureRpcPayload(data[0])
  } else if (typeof data === "object" && data !== null) {
    obj = data as Record<string, unknown>
  } else {
    return null
  }
  const raw =
    obj.new_points !== undefined
      ? obj.new_points
      : obj.points !== undefined
        ? obj.points
        : undefined
  let n: number
  if (typeof raw === "number" && Number.isFinite(raw)) {
    n = raw
  } else if (typeof raw === "string") {
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) return null
    n = parsed
  } else {
    return null
  }
  return { points: Math.max(0, Math.floor(n)) }
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

/** Signature stable pour éviter setState si les lots n’ont pas changé (anti-clignotement). */
function poolsDataSignature(pools: RewardPool[]): string {
  if (pools.length === 0) return "__empty__"
  return [...pools]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((p) => `${p.id}:${p.current_videos}:${p.target_videos}:${poolParticipationCost(p)}`)
    .join("|")
}

/** Compte à rebours tirage : intervalle local (ne force plus tout le grid à se redessiner chaque seconde). */
function PoolCardCooldown({ last_draw_at }: { last_draw_at: string | null | undefined }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (remainingCooldownMs(last_draw_at, Date.now()) <= 0) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [last_draw_at])
  const ms = remainingCooldownMs(last_draw_at, now)
  if (ms <= 0) return null
  return (
    <p className="text-center text-sm tabular-nums text-amber-200/90">
      Prochain tirage disponible dans : {formatCooldownMmSs(ms)}
    </p>
  )
}

/** Données issues du select explicite sur `rewards_pools` (inclut `ticket_cost`). */
function normalizePoolRow(row: Record<string, unknown>): RewardPool {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? "Lot"),
    target_videos: Math.max(0, Math.floor(Number(row.target_videos) || 0)),
    current_videos: Math.max(0, Math.floor(Number(row.current_videos) || 0)),
    image_url: typeof row.image_url === "string" ? row.image_url : null,
    ticket_cost: getPoolTicketCost(row, 10),
    is_active: true,
    last_draw_at: null,
  }
}

export function RewardPoolsGrid({
  userId,
  title = "Cagnottes Communautaires",
  description = "Suivez l'avancée globale des lots et vos points personnels.",
  limit,
  enableRealtime = true,
}: RewardPoolsGridProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [pools, setPools] = useState<RewardPool[]>([])
  const [loading, setLoading] = useState(true)
  const [userPoints, setUserPoints] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [selectedPool, setSelectedPool] = useState<RewardPool | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  /** Dernière signature affichée — évite setPools inutile si les données serveur sont identiques. */
  const displayedPoolsSigRef = useRef<string>("__init__")
  const lastForegroundPoolsFetchRef = useRef(0)

  /** Minimum attendu pour current_videos jusqu’à ce que Supabase renvoie une valeur >= (évite l’écrasement par une lecture obsolète). */
  const optimisticFloorByPoolId = useRef<Record<string, number>>({})
  /** Après un achat, ignore les reload Realtime trop tôt (course avec le commit SQL / réplication). */
  const suppressRealtimeReloadUntil = useRef(0)
  const realtimeDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const mergeServerPoolsWithOptimisticFloors = useCallback((visiblePools: RewardPool[]) => {
    const floors = optimisticFloorByPoolId.current
    return visiblePools.map((p) => {
      const floor = floors[p.id]
      if (floor === undefined) return p
      const serverC = Math.max(0, Number(p.current_videos) || 0)
      if (serverC >= floor) {
        delete floors[p.id]
        return p
      }
      return { ...p, current_videos: Math.max(serverC, floor) }
    })
  }, [])

  const loadPoolsFromServer = useCallback(async (options?: { showLoading?: boolean }) => {
    const showLoading = options?.showLoading !== false
    if (showLoading) setLoading(true)
    let visiblePools: RewardPool[] = []
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("rewards_pools")
        .select("id, name, current_videos, target_videos, image_url, ticket_cost")
      if (error) {
        console.error("[rewards-pools] Erreur Supabase:", error)
        return visiblePools
      }
      if (data) {
        const rows = data as Array<Record<string, unknown>>
        const normalized = rows.map((row) => normalizePoolRow(row))
        visiblePools = normalized.filter((pool) => {
          const markedAsDrawn = String(pool.name || "").includes("[TIRE]")
          return !markedAsDrawn
        })
        visiblePools.sort((a, b) => b.target_videos - a.target_videos)
        const merged = mergeServerPoolsWithOptimisticFloors(visiblePools)

        const nextSig = poolsDataSignature(merged)
        if (nextSig !== displayedPoolsSigRef.current) {
          displayedPoolsSigRef.current = nextSig
          setPools(merged)
        }
        return merged
      }
    } finally {
      if (showLoading) setLoading(false)
    }
    return visiblePools
  }, [mergeServerPoolsWithOptimisticFloors])

  const fetchUserPointsFresh = useCallback(async () => {
    if (!userId || !PROFILE_USER_ID_REGEX.test(userId)) return
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id || user.id !== userId) return
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("points")
      .eq("id", userId)
      .maybeSingle()
    if (error) return
    const raw = profile?.points
    const parsed =
      typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN
    if (Number.isFinite(parsed)) {
      setUserPoints(Math.max(0, Math.floor(parsed)))
    }
  }, [userId])

  useEffect(() => {
    displayedPoolsSigRef.current = "__init__"
    void loadPoolsFromServer({ showLoading: true })
  }, [loadPoolsFromServer, userId])

  // Revalidation : on veut refléter les changements faits “à la main” dans Supabase rapidement.
  const FOREGROUND_POOLS_MIN_MS = 500

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return
      const now = Date.now()
      if (now - lastForegroundPoolsFetchRef.current < FOREGROUND_POOLS_MIN_MS) return
      lastForegroundPoolsFetchRef.current = now
      void loadPoolsFromServer({ showLoading: false })
      void fetchUserPointsFresh()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [loadPoolsFromServer, fetchUserPointsFresh])

  // Poll léger (sans cache) pour que les edits Supabase apparaissent sans refresh manuel.
  useEffect(() => {
    const POLL_MS = 15000
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return
      void loadPoolsFromServer({ showLoading: false })
      void fetchUserPointsFresh()
    }, POLL_MS)
    return () => window.clearInterval(id)
  }, [loadPoolsFromServer, fetchUserPointsFresh])

  useEffect(() => {
    const onFocus = () => {
      void loadPoolsFromServer({ showLoading: false })
      void fetchUserPointsFresh()
    }
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [loadPoolsFromServer, fetchUserPointsFresh])

  useEffect(() => {
    if (!enableRealtime) return
    const supabase = createClient()
    const scheduleRefetch = () => {
      if (Date.now() < suppressRealtimeReloadUntil.current) {
        return
      }
      if (realtimeDebounceTimer.current) {
        clearTimeout(realtimeDebounceTimer.current)
      }
      realtimeDebounceTimer.current = window.setTimeout(() => {
        realtimeDebounceTimer.current = null
        void loadPoolsFromServer({ showLoading: false })
        void fetchUserPointsFresh()
      }, 450)
    }
    const channel = supabase
      .channel("rewards_pools_progress")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rewards_pools" },
        scheduleRefetch,
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "rewards_pools" },
        scheduleRefetch,
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "rewards_pools" },
        scheduleRefetch,
      )
      .subscribe()
    return () => {
      if (realtimeDebounceTimer.current) {
        clearTimeout(realtimeDebounceTimer.current)
      }
      void supabase.removeChannel(channel)
    }
  }, [loadPoolsFromServer, enableRealtime, fetchUserPointsFresh])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!window.location.search) return
    const cleanUrl = `${window.location.pathname}${window.location.hash || ""}`
    window.history.replaceState({}, "", cleanUrl)
  }, [])

  useEffect(() => {
    void fetchUserPointsFresh()
  }, [fetchUserPointsFresh])

  const poolsWithProgress = useMemo(() => {
    const mapped = pools.map((pool) => {
      const target = Math.max(0, Math.floor(Number(pool.target_videos) || 0))
      /** Avancement global : `current_videos` / `target_videos` (colonnes `rewards_pools`). */
      const current = Math.max(0, Math.floor(Number(pool.current_videos) || 0))
      /** Pourcentage réel (non arrondi) : current / target * 100 */
      const progressRaw =
        target > 0 ? Math.min((current / target) * 100, 100) : 0
      /**
       * La barre Radix utilise translateX ; sous ~0,5 % la zone colorée est invisible.
       * On impose un plancher d’affichage uniquement lorsqu’il y a déjà des participations.
       */
      const progressBar =
        current > 0 && target > 0 && progressRaw > 0 && progressRaw < 0.5
          ? Math.max(progressRaw, 0.5)
          : progressRaw
      return { ...pool, current_videos: current, progressRaw, progressBar }
    })
    const sortedByPopularity = [...mapped].sort((a, b) => b.current_videos - a.current_videos)
    return typeof limit === "number" ? sortedByPopularity.slice(0, Math.max(0, limit)) : sortedByPopularity
  }, [pools, limit])


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
          const costPoints = poolParticipationCost(pool)
          const lowerName = pool.name.toLowerCase()
          const isGenericPhone = lowerName.includes("samsung") || lowerName.includes("galaxy")
          const samsungPlaceholder =
            "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?q=80&w=500"
          const isPs5 = lowerName.includes("ps5") || lowerName.includes("playstation 5")
          const ps5Placeholder =
            "https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?q=80&w=500"
          const imageSrc =
            isGenericPhone
              ? samsungPlaceholder
              : isPs5 && (!pool.image_url || pool.image_url.trim() === "")
                ? ps5Placeholder
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
                        const fallback = isPs5
                          ? ps5Placeholder
                          : isGenericPhone
                            ? samsungPlaceholder
                            : getPrizeFallbackImage(pool.name)
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
                    <span className="text-foreground font-semibold tabular-nums">
                      {pool.current_videos} / {pool.target_videos}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        (
                        {pool.progressRaw < 0.1 && pool.progressRaw > 0
                          ? `${pool.progressRaw.toFixed(2)}`
                          : pool.progressRaw < 10
                            ? `${pool.progressRaw.toFixed(1)}`
                            : `${Math.round(pool.progressRaw)}`}
                        %)
                      </span>
                    </span>
                  </div>
                  <Progress value={pool.progressBar} />
                </div>

                <PoolCardCooldown
                  key={`${pool.id}-${pool.last_draw_at ?? ""}`}
                  last_draw_at={pool.last_draw_at}
                />

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
                    disabled={userPoints < costPoints}
                  >
                    Acheter ({costPoints} points)
                  </Button>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {showModal && selectedPool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <Card className="relative w-full max-w-sm border border-border/60 bg-[#111111] shadow-xl">
            <CardHeader className="pb-2 text-center">
              <CardTitle className="text-lg text-foreground">Acheter {selectedPool.name}</CardTitle>
            </CardHeader>
            <CardContent className="relative space-y-4">
              {isSubmitting ? (
                <div
                  className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-lg bg-[#111111]/92 backdrop-blur-sm"
                  aria-busy="true"
                  aria-live="polite"
                >
                  <Spinner className="size-9 text-primary" />
                  <p className="text-center text-sm text-muted-foreground">
                    Traitement de l’achat avec Supabase…
                  </p>
                </div>
              ) : null}
              <div className="rounded-lg bg-secondary/40 p-3 text-sm text-muted-foreground">
                <p className="mb-1">Prix : <span className="font-semibold text-foreground">{poolParticipationCost(selectedPool)} points</span></p>
                <p>Votre solde : <span className="font-semibold text-foreground">{userPoints} points</span></p>
              </div>
              
              {successMessage ? (
                <div className="rounded-lg bg-green-500/20 p-3 text-sm text-green-400">
                  {successMessage}
                </div>
              ) : (
                <>
                  {userPoints < poolParticipationCost(selectedPool) && (
                    <p className="text-xs text-destructive text-center">
                      Solde insuffisant. Vous avez besoin de {poolParticipationCost(selectedPool)} points.
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      disabled={isSubmitting || userPoints < poolParticipationCost(selectedPool)}
                      onClick={async () => {
                        setIsSubmitting(true)
                        try {
                          const supabase = createClient()
                          const {
                            data: { user },
                          } = await supabase.auth.getUser()
                          if (!user?.id || user.id !== userId) {
                            setSuccessMessage("Erreur : session invalide")
                            return
                          }

                          const costPoints = Math.max(
                            0,
                            Math.floor(poolParticipationCost(selectedPool)) || 0,
                          )
                          if (!Number.isFinite(costPoints) || costPoints < 1) {
                            setSuccessMessage("Erreur : coût invalide")
                            return
                          }

                          /** Même logique que `scripts/027_rpc_success_new_points_and_draw_debit.sql` : incrémente `rewards_pools.current_videos`. */
                          const rpcArgs = {
                            p_pool_id: selectedPool.id,
                            p_amount: costPoints,
                            p_idempotency_key: crypto.randomUUID(),
                          }

                          console.log("[reward-pools] RPC decrement_points — paramètres :", rpcArgs)

                          const { data: rpcResult, error: rpcError } = await supabase.rpc(
                            "decrement_points",
                            rpcArgs,
                          )

                          let nextPoints: number | null = null

                          if (rpcError) {
                            console.error("Détail erreur RPC:", {
                              message: rpcError.message,
                              code: rpcError.code,
                              details: rpcError.details,
                              hint: rpcError.hint,
                              rpcArgs,
                              hint403:
                                rpcError.code === "42501" || rpcError.message?.toLowerCase().includes("permission")
                                  ? "Possible blocage RLS ou droit EXECUTE sur decrement_points."
                                  : undefined,
                            })
                            const msg = rpcError.message || ""
                            if (msg.includes("insufficient_points") || msg.includes("insufficient")) {
                              setSuccessMessage("Erreur : Solde insuffisant")
                            } else if (msg.includes("pool_not_found") || msg.includes("invalid_pool")) {
                              setSuccessMessage("Erreur : lot introuvable")
                            } else {
                              setSuccessMessage(`Erreur : ${msg || "achat impossible"}`)
                            }
                            return
                          } else {
                            const parsed = parseBuySecureRpcPayload(rpcResult)
                            if (parsed) {
                              nextPoints = parsed.points
                            } else {
                              console.error("Réponse RPC inattendue (achat lot):", rpcResult)
                              const { data: profileAfter } = await supabase
                                .from("profiles")
                                .select("points")
                                .eq("id", user.id)
                                .maybeSingle()
                              const recovered = Number(profileAfter?.points ?? NaN)
                              if (Number.isFinite(recovered)) {
                                nextPoints = Math.max(0, Math.floor(recovered))
                              } else {
                                console.error("Détail erreur RPC:", {
                                  message: "reponse_sans_points_recuperables",
                                  rpcResult,
                                  rpcArgs,
                                })
                                setSuccessMessage("Erreur : reponse serveur invalide")
                                return
                              }
                            }
                          }

                          if (nextPoints === null || !Number.isFinite(nextPoints)) {
                            setSuccessMessage("Erreur : solde inconnu")
                            return
                          }

                          setUserPoints(nextPoints)

                          const poolId = selectedPool.id
                          suppressRealtimeReloadUntil.current = Date.now() + 1800

                          // Optimiste + plancher : base sur l’état React à jour (évite une closure « pools » obsolète).
                          setPools((prev) => {
                            const row = prev.find((p) => p.id === poolId)
                            const base = Math.max(
                              0,
                              Number(row?.current_videos ?? selectedPool.current_videos ?? 0),
                            )
                            const nextFloor = base + 1
                            optimisticFloorByPoolId.current[poolId] = Math.max(
                              optimisticFloorByPoolId.current[poolId] ?? 0,
                              nextFloor,
                            )
                            const next = prev.map((p) =>
                              p.id === poolId
                                ? { ...p, current_videos: base + 1 }
                                : p,
                            )
                            displayedPoolsSigRef.current = poolsDataSignature(next)
                            return next
                          })
                          setSelectedPool((prev) =>
                            prev && prev.id === poolId
                              ? {
                                  ...prev,
                                  current_videos: Math.max(
                                    0,
                                    Number(prev.current_videos || 0) + 1,
                                  ),
                                }
                              : prev,
                          )

                          const { error: notifErr } = await supabase.from("notifications").insert({
                            user_id: user.id,
                            title: "Participation enregistrée !",
                            message: `Ta participation au lot ${selectedPool.name} a bien été prise en compte. Bonne chance !`,
                            created_at: new Date().toISOString(),
                          })
                          if (notifErr) {
                            console.error("[reward-pools] notification:", notifErr)
                          }
                          window.dispatchEvent(new Event(DB_NOTIFICATIONS_CHANGED_EVENT))
                          if (!Capacitor.isNativePlatform()) {
                            router.refresh()
                          }
                          void fetchUserPointsFresh()
                          // Laisser le temps au RPC / trigger SQL de commit avant le SELECT (évite lecture obsolète).
                          await delay(450)
                          const freshPools = await loadPoolsFromServer({ showLoading: false })
                          const refreshed = freshPools.find((p) => p.id === poolId)
                          if (refreshed) {
                            setSelectedPool(refreshed)
                          }
                          confetti({
                            particleCount: 120,
                            spread: 75,
                            startVelocity: 45,
                            origin: { y: 0.72 },
                          })
                          confetti({
                            particleCount: 80,
                            spread: 95,
                            startVelocity: 35,
                            origin: { y: 0.72, x: 0.25 },
                          })
                          confetti({
                            particleCount: 80,
                            spread: 95,
                            startVelocity: 35,
                            origin: { y: 0.72, x: 0.75 },
                          })
                          toast({
                            title: "Achat réussi",
                            description: "Votre participation est enregistrée dans Mes Participations.",
                          })
                          addInAppNotification(`Confirmation : Votre participation au lot ${selectedPool.name} a bien ete enregistree !`)
                          soundService.playCoinSound()
                          soundService.playSuccess()
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
