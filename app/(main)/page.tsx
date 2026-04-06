"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { DashboardClient } from "@/components/dashboard-client"
import { SafePage } from "@/components/safe-page"
import { ReferralSourceCapture } from "@/components/referral-source-capture"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { ENABLE_SUPABASE_REALTIME } from "@/lib/supabase/client"
import { useAuthContext } from "@/hooks/use-auth-context"

export const dynamic = "force-static"

type HomeWinner = {
  name: string
  prize: string
  createdAt: string | null
}

function toTitleFromSnake(input: string) {
  return input
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase())
}

function toShortName(raw: string) {
  const parts = raw.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return raw
  const first = parts[0]
  const lastInitial = parts[parts.length - 1][0]?.toUpperCase()
  return lastInitial ? `${first} ${lastInitial}.` : first
}

function timeAgoFr(iso: string | null) {
  if (!iso) return "A l'instant"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "A l'instant"
  const diffMs = Date.now() - date.getTime()
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  if (diffMs < hour) {
    const mins = Math.max(1, Math.floor(diffMs / minute))
    return `Il y a ${mins} min`
  }
  if (diffMs < day) {
    const hours = Math.floor(diffMs / hour)
    return `Il y a ${hours} h`
  }
  const days = Math.floor(diffMs / day)
  return `Il y a ${days} jour${days > 1 ? "s" : ""}`
}

function mapWinnerRow(row: Record<string, unknown>): HomeWinner {
  const rawName =
    (row.display_name as string | undefined) ??
    (row.user_name as string | undefined) ??
    (row.full_name as string | undefined) ??
    (row.name as string | undefined) ??
    (row.winner_name as string | undefined) ??
    "Utilisateur"
  const rawPrize =
    (row.prize_name as string | undefined) ??
    (row.reward_name as string | undefined) ??
    (row.reward_type as string | undefined) ??
    (row.prize as string | undefined) ??
    "Cadeau"
  const rawCreatedAt =
    (row.created_at as string | undefined) ??
    (row.won_at as string | undefined) ??
    (row.updated_at as string | undefined) ??
    null

  return {
    name: toShortName(rawName),
    prize: rawPrize.includes("_") ? toTitleFromSnake(rawPrize) : rawPrize,
    createdAt: rawCreatedAt,
  }
}

const ACCOUNT_DELETED_STORAGE_KEY = "bk_account_deleted"

export default function HomePage() {
  const { user, profile, season, isAuthenticated, loading } = useAuthContext()
  const [winners, setWinners] = useState<HomeWinner[]>([])
  const [showAccountDeletedBanner, setShowAccountDeletedBanner] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (sessionStorage.getItem(ACCOUNT_DELETED_STORAGE_KEY) === "1") {
      sessionStorage.removeItem(ACCOUNT_DELETED_STORAGE_KEY)
      setShowAccountDeletedBanner(true)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const fetchRecentWinners = async () => {
      const supabase = createClient()
      const primary = await supabase
        .from("winners")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5)

      let rows: Record<string, unknown>[] = []
      if (primary.error) {
        const fallback = await supabase
          .from("winners")
          .select("*")
          .order("id", { ascending: false })
          .limit(5)
        rows = (fallback.data ?? []) as Record<string, unknown>[]
      } else {
        rows = (primary.data ?? []) as Record<string, unknown>[]
      }
      if (!cancelled) {
        setWinners(rows.map((row) => mapWinnerRow(row)))
      }
    }
    void fetchRecentWinners()

    const supabase = createClient()
    const channel = ENABLE_SUPABASE_REALTIME
      ? supabase
          .channel("winners-list-refresh")
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "winners" },
            () => {
              void fetchRecentWinners()
            },
          )
          .subscribe()
      : null

    const onFocus = () => {
      void fetchRecentWinners()
    }
    window.addEventListener("focus", onFocus)

    return () => {
      cancelled = true
      window.removeEventListener("focus", onFocus)
      if (channel) supabase.removeChannel(channel)
    }
  }, [])

  return (
    <SafePage>
      <Suspense fallback={<div>Chargement...</div>}>
        <div className="space-y-4 p-4">
          <ReferralSourceCapture />

          {showAccountDeletedBanner ? (
            <Card className="border border-green-500/40 bg-green-950/30 shadow-lg">
              <CardContent className="flex flex-col gap-2 p-4 text-sm text-green-50/95 sm:flex-row sm:items-center sm:justify-between">
                <p>
                  Votre compte a bien été supprimé. Merci d&apos;avoir utilisé BK Rewards.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setShowAccountDeletedBanner(false)}
                >
                  Fermer
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <Card className="border border-amber-500/35 bg-amber-950/25 shadow-lg backdrop-blur-sm">
            <CardContent className="p-4 text-sm leading-relaxed text-amber-50/95">
              <p className="font-semibold text-amber-100">Note de lancement</p>
              <p className="mt-2 text-amber-50/90">
                🚀 Mois de lancement : Pour garantir la sécurité des transactions, les premiers lots seront
                expédiés entre la fin du mois en cours et le début du mois prochain. Merci de votre confiance
                !
              </p>
            </CardContent>
          </Card>

          {loading ? (
            <div className="rounded-lg border border-border/50 bg-[#1a1a1a] p-4 text-sm text-muted-foreground">
              Chargement du profil...
            </div>
          ) : null}
          {!loading && profile ? (
            <DashboardClient
              isAuthenticated={isAuthenticated}
              userId={user?.id}
              profile={profile}
              season={season}
              showWelcome={false}
              showRewardsPools={false}
              minimalHome
            />
          ) : null}
          {!loading && isAuthenticated && !profile ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              Erreur profil : impossible de charger votre solde pour le moment.
            </div>
          ) : null}

          <Card className="border border-border/50 bg-[#1a1a1a] shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Derniers Gagnants</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {winners.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun gagnant recent pour le moment.</p>
              ) : (
                <div className="grid gap-2">
                  {winners.map((winner, idx) => (
                    <div
                      key={`${winner.name}-${winner.prize}-${idx}`}
                      className="flex items-center justify-between rounded-lg border border-border/40 bg-background/30 px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{winner.name}</p>
                        <p className="truncate text-muted-foreground">{winner.prize}</p>
                      </div>
                      <span className="ml-3 shrink-0 text-xs text-muted-foreground">{timeAgoFr(winner.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-border/50 bg-[#1a1a1a] shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Mini-jeux</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Accedez a la roue, au scratch et au Tap-Tap sur la page Concours.</p>
              <Button
                asChild
                className="group relative w-full overflow-hidden bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-black shadow-[0_0_20px_rgba(251,191,36,0.35)] transition-transform duration-200 hover:scale-[1.02] hover:shadow-[0_0_28px_rgba(251,191,36,0.45)] sm:w-auto"
              >
                <Link href="/concours">
                  <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/60 to-transparent opacity-90 animate-shimmer" />
                  <span className="relative font-semibold">Jouer aux Mini-Jeux</span>
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </Suspense>
    </SafePage>
  )
}
