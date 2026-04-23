"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Crown, Sparkles, Shield, Check } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { notificationService } from "@/lib/notifications"
import { soundService } from "@/lib/sounds"
import { Confetti } from "@/components/confetti"
import { PaymentService } from "@/lib/payment-service"
import { getApiUrl } from "@/lib/api-origin"
import { fetchInternalTestVipBonusEnabled } from "@/lib/app-settings-flags"

export default function PremiumPage() {
  const [isVip, setIsVip] = useState(false)
  const [vipUntil, setVipUntil] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [sessionUser, setSessionUser] = useState<{ id: string; email?: string } | null>(null)
  const [claiming, setClaiming] = useState(false)
  const [lastClaim, setLastClaim] = useState<Date | null>(null)
  const [canClaim, setCanClaim] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [internalTestVipBonus, setInternalTestVipBonus] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const debugVip = (searchParams?.get("debugVip") || "").trim() === "1"

  useEffect(() => {
    async function checkVipStatus() {
      try {
        setLoading(true)
        const supabase = createClient()

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (!user) {
          setIsAuthenticated(false)
          setSessionUser(null)
          setIsVip(false)
          setLoading(false)
          return
        }

        if (userError && Object.keys(userError).length > 0) {
          console.warn("Error getting user:", userError)
          setIsAuthenticated(false)
          setSessionUser(null)
          setIsVip(false)
          setLoading(false)
          return
        }

        setIsAuthenticated(true)
        setSessionUser({ id: user.id, email: user.email ?? undefined })

        const { data: profile, error } = await supabase
          .from("profiles")
          .select("is_vip, last_bonus_claim, vip_until")
          .eq("id", user.id)
          .maybeSingle()

        if (error && Object.keys(error).length > 0 && error.code !== "PGRST116") {
          console.warn("Error fetching VIP status:", error)
        }

        if (profile) {
          setIsVip(profile.is_vip || false)
          setVipUntil(profile.vip_until || null)

          if (profile.last_bonus_claim) {
            const lastClaimDate = new Date(profile.last_bonus_claim)
            setLastClaim(lastClaimDate)

            const now = new Date()
            const hoursSinceClaim = (now.getTime() - lastClaimDate.getTime()) / (1000 * 60 * 60)
            setCanClaim(hoursSinceClaim >= 24)
          } else {
            setCanClaim(true)
          }
        } else {
          setIsVip(false)
          setCanClaim(false)
        }
      } catch (error) {
        console.warn("Unexpected error in checkVipStatus:", error)
        setIsVip(false)
        setIsAuthenticated(false)
      } finally {
        setLoading(false)
      }
    }

    checkVipStatus()
    void fetchInternalTestVipBonusEnabled().then(setInternalTestVipBonus)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubscribe = async (type: "weekly" | "monthly") => {
    try {
      if (notificationService.isSupported() && !notificationService.hasPermission()) {
        await notificationService.requestPermission()
      }

      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        toast({
          title: "Erreur",
          description: "Vous devez être connecté pour vous abonner.",
          variant: "destructive",
        })
        router.push("/auth/login")
        return
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()
      const accessToken = session?.access_token

      await PaymentService.subscribe({
        plan: type,
        accessToken,
      })

      if (PaymentService.isAndroidNative()) {
        toast({
          title: "Merci !",
          description: "Votre abonnement VIP a été pris en compte.",
        })
        router.refresh()
      }
    } catch (error) {
      console.error("Unexpected error:", error)
      const msg = error instanceof Error ? error.message : "Une erreur est survenue lors de l'abonnement."
      toast({
        title: "Erreur",
        description: msg,
        variant: "destructive",
      })
    }
  }

  const handlePurchaseSuccess = async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) {
      toast({ title: "Erreur", description: "Connexion requise.", variant: "destructive" })
      return
    }

    const vipUntilIso = new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString()
    const payload = {
      is_vip: true,
      is_vip_plus: true,
      vip_tier: "vip_plus",
      grade: "VIP+",
      vip_until: vipUntilIso,
      updated_at: new Date().toISOString(),
    } as const

    const { error } = await supabase.from("profiles").update(payload).eq("id", user.id)
    if (error) {
      toast({
        title: "Erreur",
        description: `Impossible d'activer VIP+ (RLS?): ${error.message}`,
        variant: "destructive",
      })
      return
    }

    toast({ title: "OK", description: "VIP+ activé (mode debug). Redémarre la page si besoin." })
    setIsVip(true)
    setVipUntil(vipUntilIso)
    setCanClaim(true)
    router.refresh()
  }

  const handleOpenPortal = async () => {
    if (PaymentService.isAndroidNative()) {
      toast({
        title: "Indisponible",
        description: "Gestion abonnement : disponible uniquement sur le Web (Stripe).",
        variant: "destructive",
      })
      return
    }
    try {
      const res = await fetch(getApiUrl("/api/stripe/portal"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ returnPath: "/premium" }),
      })
      const data = (await res.json()) as { url?: string }
      if (!res.ok || !data?.url) {
        toast({
          title: "Erreur",
          description: "Portail Stripe indisponible pour le moment.",
          variant: "destructive",
        })
        return
      }
      window.location.href = data.url
    } catch (e) {
      console.error("[premium] stripe portal:", e)
      toast({
        title: "Erreur",
        description: "Erreur réseau.",
        variant: "destructive",
      })
    }
  }

  const handleClaimBonus = async () => {
    if (!isVip && !internalTestVipBonus) {
      window.scrollTo({
        top: document.querySelector(".grid.gap-4.md\\:grid-cols-2")?.getBoundingClientRect().top || 0,
        behavior: "smooth",
      })
      return
    }

    setClaiming(true)
    const supabase = createClient()

    try {
      const { data, error } = await supabase.rpc("claim_vip_bonus")
      if (error) {
        toast({
          title: "Erreur",
          description:
            error.message?.includes("already_claimed_today")
              ? "Vous avez déjà réclamé votre bonus aujourd'hui. Revenez demain !"
              : error.message?.includes("subscription_inactive")
                ? "Aucun abonnement actif en base (table purchases)."
                : error.message?.includes("not_vip")
                  ? "Vous devez être VIP pour réclamer ce bonus."
                  : error.message || "Erreur lors de la réclamation du bonus.",
          variant: "destructive",
        })
        return
      }

      if (data && data.length > 0 && (data[0] as any).success) {
        const tickets = (data[0] as any).tickets_granted
        toast({
          title: "Bonus réclamé !",
          description: `Vous avez reçu ${tickets} points gratuits !`,
        })
        setLastClaim(new Date())
        setCanClaim(false)
        soundService.playCoinSound()
        setShowConfetti(true)
        setTimeout(() => setShowConfetti(false), 2000)

        if (notificationService.hasPermission()) {
          notificationService.scheduleNotification("🎁 Ton bonus quotidien VIP est prêt ! Viens le récupérer.", 24 * 60 * 60 * 1000, {
            body: "N'oublie pas de réclamer ton bonus VIP quotidien !",
            icon: "/favicon.ico",
            badge: "/favicon.ico",
            tag: "vip_bonus_reminder",
          })
        }

        router.refresh()
      } else {
        const message = ((data?.[0] as any) as { message?: string } | undefined)?.message || "Erreur inconnue"
        toast({
          title: "Erreur",
          description:
            message === "already_claimed_today"
              ? "Vous avez déjà réclamé votre bonus aujourd'hui."
              : message === "subscription_inactive"
                ? "Aucun achat actif (purchases) : le bonus nécessite un abonnement reconnu en base."
                : message,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error:", error)
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la réclamation.",
        variant: "destructive",
      })
    } finally {
      setClaiming(false)
    }
  }

  if (loading || (!sessionUser && isAuthenticated)) {
    return (
      <div className="flex min-h-screen flex-col gap-4 p-4">
        <div className="text-center">
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col gap-6 p-4">
      {showConfetti && <Confetti duration={2000} particleCount={60} />}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Crown className="h-8 w-8 text-yellow-500" />
          Pass Confort
        </h1>
        <p className="text-muted-foreground">
          Débloquez tous les avantages premium et profitez d&apos;une expérience sans publicité
        </p>
      </div>

      {!isAuthenticated && !loading && (
        <Card className="border border-border/50 bg-[#1a1a1a]/80 backdrop-blur-sm shadow-lg">
          <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
            <Crown className="h-16 w-16 text-yellow-500/50" />
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold text-foreground">Devenez membre VIP</h3>
              <p className="text-sm text-muted-foreground">Veuillez vous connecter pour accéder aux offres VIP</p>
            </div>
            <Button
              asChild
              className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-yellow-950 hover:from-yellow-600 hover:to-yellow-700"
            >
              <Link href="/auth/login">Se connecter pour devenir VIP</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {isAuthenticated && (isVip || internalTestVipBonus) && (
        <Card className="border-2 border-yellow-500/50 bg-gradient-to-br from-yellow-500/10 to-yellow-600/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Crown className="h-5 w-5 text-yellow-500" />
                  {internalTestVipBonus && !isVip ? "Bonus quotidien — phase test interne" : "Vous êtes VIP !"}
                </CardTitle>
                <CardDescription className="text-muted-foreground mt-1">Profitez de tous les avantages premium</CardDescription>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge className="bg-yellow-500 text-yellow-950">VIP</Badge>
                {vipUntil && (
                  <span className="text-xs text-muted-foreground">
                    Statut : VIP Actif • {new Date(vipUntil).toLocaleDateString("fr-FR")}
                  </span>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-secondary/50 p-4">
              <h3 className="font-semibold text-foreground mb-2">Bonus quotidien</h3>
              {canClaim ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Réclamez votre bonus de 5 à 10 points gratuits maintenant !</p>
                  <Button
                    onClick={() => {
                      soundService.playClickSound()
                      void handleClaimBonus()
                    }}
                    disabled={claiming}
                    className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 text-yellow-950 hover:from-yellow-600 hover:to-yellow-700"
                  >
                    <Sparkles className={`mr-2 h-4 w-4 ${claiming ? "animate-spin" : ""}`} />
                    {claiming ? "Réclamation..." : "Réclamer mon bonus"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Vous avez déjà réclamé votre bonus aujourd&apos;hui.</p>
                  {lastClaim && (
                    <p className="text-xs text-muted-foreground">
                      Dernière réclamation :{" "}
                      {lastClaim.toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">Prochaine réclamation disponible dans 24h</p>
                </div>
              )}
            </div>
            {isVip && (
              <Button
                onClick={() => void handleOpenPortal()}
                variant="outline"
                className="w-full border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/10 hover:text-yellow-600"
              >
                <Crown className="mr-2 h-4 w-4" />
                Gérer mon abonnement
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {isAuthenticated && !isVip && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border border-border/50 bg-[#1a1a1a]/80 backdrop-blur-sm shadow-lg">
            <CardHeader>
              <CardTitle className="text-foreground">Hebdomadaire</CardTitle>
              <div className="mt-2">
                <span className="text-3xl font-bold text-foreground">1,99€</span>
                <span className="text-muted-foreground"> / semaine</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm text-foreground">
                  <Check className="h-4 w-4 text-green-500" />
                  Zéro Publicité
                </li>
                <li className="flex items-center gap-2 text-sm text-foreground">
                  <Check className="h-4 w-4 text-green-500" />
                  Badge VIP
                </li>
                <li className="flex items-center gap-2 text-sm text-foreground">
                  <Check className="h-4 w-4 text-green-500" />
                  Crédit automatique de 5 à 10 points par jour
                </li>
              </ul>
              <Button
                className="w-full bg-gradient-to-r from-accent to-accent/80 text-accent-foreground hover:bg-accent/90"
                onClick={() => void handleSubscribe("weekly")}
              >
                S&apos;abonner
              </Button>
            </CardContent>
          </Card>

          <Card className="border-2 border-accent bg-[#1a1a1a]/80 backdrop-blur-sm shadow-lg relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge className="bg-accent text-accent-foreground">Recommandé</Badge>
            </div>
            <CardHeader>
              <CardTitle className="text-foreground">Mensuel</CardTitle>
              <div className="mt-2">
                <span className="text-3xl font-bold text-foreground">4,99€</span>
                <span className="text-muted-foreground"> / mois</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Économisez 50% par rapport à l&apos;hebdomadaire</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm text-foreground">
                  <Check className="h-4 w-4 text-green-500" />
                  Zéro Publicité
                </li>
                <li className="flex items-center gap-2 text-sm text-foreground">
                  <Check className="h-4 w-4 text-green-500" />
                  Badge VIP
                </li>
                <li className="flex items-center gap-2 text-sm text-foreground">
                  <Check className="h-4 w-4 text-green-500" />
                  Crédit automatique de 5 à 10 points par jour
                </li>
              </ul>
              <Button
                className="w-full bg-gradient-to-r from-accent to-accent/80 text-accent-foreground hover:bg-accent/90"
                onClick={() => {
                  soundService.playClickSound()
                  void handleSubscribe("monthly")
                }}
              >
                S&apos;abonner
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="border border-border/50 bg-[#1a1a1a]/80 backdrop-blur-sm shadow-lg">
        <CardHeader>
          <CardTitle className="text-foreground">Tous les avantages inclus</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-accent" />
                <h3 className="font-semibold text-foreground">Zéro Publicité</h3>
              </div>
              <p className="text-sm text-muted-foreground">Profitez d&apos;une expérience sans interruption, sans publicités.</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-yellow-500" />
                <h3 className="font-semibold text-foreground">Badge VIP</h3>
              </div>
              <p className="text-sm text-muted-foreground">Montrez votre statut premium avec un badge VIP exclusif.</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-accent" />
                <h3 className="font-semibold text-foreground">Points gratuits</h3>
              </div>
              <p className="text-sm text-muted-foreground">Recevez 5 à 10 points gratuits chaque jour automatiquement.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {debugVip && PaymentService.isAndroidNative() ? (
        <div className="mt-2 rounded-lg border border-border/40 bg-[#111111]/70 p-3 text-xs text-muted-foreground">
          <div className="flex items-center justify-between gap-2">
            <span>Mode debugVip actif.</span>
            <Button type="button" variant="outline" size="sm" onClick={() => void handlePurchaseSuccess()}>
              Simuler achat VIP+
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

