"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Crown, Sparkles, Shield, X, Check, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { notificationService } from "@/lib/notifications"
import { soundService } from "@/lib/sounds"
import { Confetti } from "@/components/confetti"

export default function PremiumPage() {
  const [isVip, setIsVip] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [lastClaim, setLastClaim] = useState<Date | null>(null)
  const [canClaim, setCanClaim] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    async function checkVipStatus() {
      try {
        setLoading(true)
        const supabase = createClient()
        
        // Vérifier d'abord si l'utilisateur est connecté
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        
        // Si user est null, arrêter immédiatement et afficher le message
        if (!user) {
          setIsAuthenticated(false)
          setIsVip(false)
          setLoading(false)
          return
        }

        // Si erreur utilisateur critique (pas juste pas de session)
        if (userError && Object.keys(userError).length > 0) {
          console.warn("Error getting user:", userError)
          setIsAuthenticated(false)
          setIsVip(false)
          setLoading(false)
          return
        }

        setIsAuthenticated(true)

        // Récupérer le profil VIP - sans cache, directement depuis Supabase
        if (!user?.id) {
          setIsAuthenticated(false)
          setIsVip(false)
          setLoading(false)
          return
        }
        
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("is_vip, last_bonus_claim, vip_expires_at")
          .eq("id", user.id)
          .maybeSingle() // Utiliser maybeSingle pour éviter les erreurs si le profil n'existe pas

        // Vérifier si c'est une vraie erreur (pas juste un objet vide ou PGRST116)
        if (error && Object.keys(error).length > 0 && error.code !== 'PGRST116') {
          // Erreur critique, logger en warning
          console.warn("Error fetching VIP status:", error)
          // On continue quand même avec is_vip = false
        }

        // Si profile existe, utiliser ses données, sinon is_vip reste false
        if (profile) {
          setIsVip(profile.is_vip || false)
          
          if (profile.last_bonus_claim) {
            const lastClaimDate = new Date(profile.last_bonus_claim)
            setLastClaim(lastClaimDate)
            
            // Vérifier si on peut réclamer (24h écoulées)
            const now = new Date()
            const hoursSinceClaim = (now.getTime() - lastClaimDate.getTime()) / (1000 * 60 * 60)
            setCanClaim(hoursSinceClaim >= 24)
          } else {
            setCanClaim(true) // Première réclamation
          }
        } else {
          // Pas de profil trouvé (data est null), initialiser simplement à false
          // Ce n'est pas une erreur, juste un profil inexistant
          setIsVip(false)
          setCanClaim(false)
        }
      } catch (error) {
        // Erreur inattendue, logger en warning
        console.warn("Unexpected error in checkVipStatus:", error)
        // Ne pas afficher d'erreur agressive, juste initialiser à false
        setIsVip(false)
        setIsAuthenticated(false)
      } finally {
        setLoading(false)
      }
    }

    checkVipStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Tableau de dépendances vide stable - ne se relance qu'une seule fois au montage

  const handleSubscribe = async (type: 'weekly' | 'monthly') => {
    try {
      // Demander la permission de notification au premier clic
      if (notificationService.isSupported() && !notificationService.hasPermission()) {
        await notificationService.requestPermission()
      }

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        toast({
          title: "Erreur",
          description: "Vous devez être connecté pour vous abonner.",
          variant: "destructive",
        })
        router.push("/auth/login")
        return
      }

      if (!user?.id) {
        toast({
          title: "Erreur",
          description: "Utilisateur non identifié",
          variant: "destructive",
        })
        return
      }

      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: type }),
      })

      if (!response.ok) {
        toast({
          title: "Erreur",
          description: "Impossible de créer la session de paiement.",
          variant: "destructive",
        })
        return
      }

      const { url } = await response.json()
      if (url) {
        window.location.href = url
      }
    } catch (error) {
      console.error("Unexpected error:", error)
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de l'abonnement.",
        variant: "destructive",
      })
    }
  }

  const handleCancelSubscription = async () => {
    const confirmed = window.confirm(
      "Êtes-vous sûr de vouloir annuler votre abonnement VIP ?\n\n" +
      "Vous perdrez tous les avantages premium :\n" +
      "- Zéro Publicité\n" +
      "- Badge VIP\n" +
      "- Tickets gratuits quotidiens\n\n" +
      "Cette action est irréversible."
    )

    if (!confirmed) {
      return
    }

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        toast({
          title: "Erreur",
          description: "Vous devez être connecté pour effectuer cette action.",
          variant: "destructive",
        })
        return
      }

      if (!user?.id) {
        toast({
          title: "Erreur",
          description: "Utilisateur non identifié",
          variant: "destructive",
        })
        return
      }
      
      const { error } = await supabase
        .from("profiles")
        .update({ is_vip: false })
        .eq("id", user.id)

      if (error) {
        console.error("Error canceling subscription:", error)
        toast({
          title: "Erreur",
          description: "Impossible d'annuler l'abonnement. Veuillez réessayer.",
          variant: "destructive",
        })
        return
      }

      // Mettre à jour l'état local immédiatement (sans recharger la page)
      setIsVip(false)
      
      toast({
        title: "Abonnement annulé",
        description: "Votre abonnement VIP a été annulé avec succès.",
      })
    } catch (error) {
      console.error("Unexpected error:", error)
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de l'annulation.",
        variant: "destructive",
      })
    }
  }

  const handleClaimBonus = async () => {
    if (!isVip) {
      // Rediriger vers l'abonnement (scroll vers les abonnements)
      window.scrollTo({ top: document.querySelector('.grid.gap-4.md\\:grid-cols-2')?.getBoundingClientRect().top || 0, behavior: 'smooth' })
      return
    }

    setClaiming(true)
    const supabase = createClient()

    try {
      const { data, error } = await supabase.rpc("claim_vip_bonus")

      if (error) {
        console.error("Error claiming bonus:", error)
        toast({
          title: "Erreur",
          description: error.message?.includes("already_claimed_today")
            ? "Vous avez déjà réclamé votre bonus aujourd'hui. Revenez demain !"
            : error.message?.includes("not_vip")
              ? "Vous devez être VIP pour réclamer ce bonus."
              : "Erreur lors de la réclamation du bonus.",
          variant: "destructive",
        })
        setClaiming(false)
        return
      }

      if (data && data.length > 0 && data[0].success) {
        const tickets = data[0].tickets_granted
        toast({
          title: "Bonus réclamé !",
          description: `Vous avez reçu ${tickets} tickets gratuits !`,
        })
        setLastClaim(new Date())
        setCanClaim(false)
        
        // Jouer le son de gain de pièces
        soundService.playCoinSound()
        
        // Afficher les confettis
        setShowConfetti(true)
        setTimeout(() => {
          setShowConfetti(false)
        }, 2000)
        
        // Programmer une notification pour dans 24 heures
        if (notificationService.hasPermission()) {
          notificationService.scheduleNotification(
            "🎁 Ton bonus quotidien de 10 tickets est prêt ! Viens le récupérer.",
            24 * 60 * 60 * 1000, // 24 heures en millisecondes
            {
              body: "N'oublie pas de réclamer ton bonus VIP quotidien !",
              icon: "/favicon.ico",
              badge: "/favicon.ico",
              tag: "vip_bonus_reminder",
            }
          )
        }
        
        // Recharger la page pour mettre à jour les points
        router.refresh()
      } else {
        const message = data?.[0]?.message || "Erreur inconnue"
        toast({
          title: "Erreur",
          description: message === "already_claimed_today"
            ? "Vous avez déjà réclamé votre bonus aujourd'hui."
            : "Impossible de réclamer le bonus pour le moment.",
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

  if (loading) {
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
          Débloquez tous les avantages premium et profitez d'une expérience sans publicité
        </p>
      </div>

      {/* Message si non connecté */}
      {!isAuthenticated && !loading && (
        <Card className="border border-border/50 bg-[#1a1a1a]/80 backdrop-blur-sm shadow-lg">
          <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
            <Crown className="h-16 w-16 text-yellow-500/50" />
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold text-foreground">Devenez membre VIP</h3>
              <p className="text-sm text-muted-foreground">
                Veuillez vous connecter pour accéder aux offres VIP
              </p>
            </div>
            <Button asChild className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-yellow-950 hover:from-yellow-600 hover:to-yellow-700">
              <Link href="/auth/login">
                Se connecter pour devenir VIP
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Statut VIP actuel */}
      {isAuthenticated && isVip && (
        <Card className="border-2 border-yellow-500/50 bg-gradient-to-br from-yellow-500/10 to-yellow-600/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Crown className="h-5 w-5 text-yellow-500" />
                  Vous êtes VIP !
                </CardTitle>
                <CardDescription className="text-muted-foreground mt-1">
                  Profitez de tous les avantages premium
                </CardDescription>
              </div>
              <Badge className="bg-yellow-500 text-yellow-950">VIP</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-secondary/50 p-4">
              <h3 className="font-semibold text-foreground mb-2">Bonus quotidien</h3>
              {canClaim ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Réclamez votre bonus de 5 à 10 tickets gratuits maintenant !
                  </p>
                  <Button
                    onClick={() => {
                      soundService.playClickSound()
                      handleClaimBonus()
                    }}
                    disabled={claiming}
                    className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 text-yellow-950 hover:from-yellow-600 hover:to-yellow-700"
                  >
                    {claiming ? (
                      <>
                        <Sparkles className="mr-2 h-4 w-4 animate-spin" />
                        Réclamation...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Réclamer mon bonus
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Vous avez déjà réclamé votre bonus aujourd'hui.
                  </p>
                  {lastClaim && (
                    <p className="text-xs text-muted-foreground">
                      Dernière réclamation : {lastClaim.toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Prochaine réclamation disponible dans 24h
                  </p>
                </div>
              )}
            </div>
            {/* Bouton Annuler l'abonnement - uniquement si VIP */}
            {isVip && (
              <Button
                onClick={handleCancelSubscription}
                variant="outline"
                className="w-full border-red-500/50 text-red-500 hover:bg-red-500/10 hover:text-red-600"
              >
                <X className="mr-2 h-4 w-4" />
                Annuler l'abonnement
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Abonnements - Cachés si VIP ou non connecté */}
      {isAuthenticated && !isVip && (
        <div className="grid gap-4 md:grid-cols-2">
        {/* Abonnement Hebdomadaire */}
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
                Crédit Automatique de 5 à 10 tickets par jour
              </li>
            </ul>
            <Button
              className="w-full bg-gradient-to-r from-accent to-accent/80 text-accent-foreground hover:bg-accent/90"
              onClick={() => handleSubscribe('weekly')}
            >
              S'abonner
            </Button>
          </CardContent>
        </Card>

        {/* Abonnement Mensuel */}
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
            <p className="text-xs text-muted-foreground mt-1">
              Économisez 50% par rapport à l'abonnement hebdomadaire
            </p>
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
                Crédit Automatique de 5 à 10 tickets par jour
              </li>
            </ul>
            <Button
              className="w-full bg-gradient-to-r from-accent to-accent/80 text-accent-foreground hover:bg-accent/90"
              onClick={() => {
                soundService.playClickSound()
                handleSubscribe('monthly')
              }}
            >
              S'abonner
            </Button>
          </CardContent>
        </Card>
        </div>
      )}

      {/* Avantages détaillés */}
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
              <p className="text-sm text-muted-foreground">
                Profitez d'une expérience sans interruption, sans publicités.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-yellow-500" />
                <h3 className="font-semibold text-foreground">Badge VIP</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Montrez votre statut premium avec un badge VIP exclusif.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-accent" />
                <h3 className="font-semibold text-foreground">Tickets Gratuits</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Recevez 5 à 10 tickets gratuits chaque jour automatiquement.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
