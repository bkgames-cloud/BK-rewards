"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Crown, Star, MapPin, LogOut } from "lucide-react"
import type { User as SupabaseUser } from "@supabase/supabase-js"
import type { Profile } from "@/lib/types"
import { ReferralQR } from "@/components/referral-qr"
import { Confetti } from "@/components/confetti"

interface ProfileClientProps {
  user: SupabaseUser
  profile: Profile | null
}

const ADMIN_EMAIL = "bkgamers@icloud.com"

export function ProfileClient({ user, profile }: ProfileClientProps) {
  const [firstName, setFirstName] = useState(profile?.first_name || "")
  const [lastName, setLastName] = useState(profile?.last_name || "")
  const [adresse, setAdresse] = useState(profile?.adresse || "")
  const [codePostal, setCodePostal] = useState(profile?.code_postal || "")
  const [ville, setVille] = useState(profile?.ville || "")
  const [referralCode, setReferralCode] = useState(profile?.referral_code || "")
  const isAdmin = user?.email === ADMIN_EMAIL
  const [sessionUserId, setSessionUserId] = useState<string | null>(null)
  const [isGeneratingReferral, setIsGeneratingReferral] = useState(false)
  const [referredCount, setReferredCount] = useState(0)
  const [referralInput, setReferralInput] = useState("")
  const [referralMessage, setReferralMessage] = useState<string | null>(null)
  const [isApplyingReferral, setIsApplyingReferral] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [subscriptionMessage, setSubscriptionMessage] = useState<string | null>(null)
  const router = useRouter()
  const [localPoints, setLocalPoints] = useState(profile?.points ?? 0)
  const [isClaimingBonus, setIsClaimingBonus] = useState(false)
  const [claimMessage, setClaimMessage] = useState<string | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)

  const vipUntil = profile?.vip_until ? new Date(profile.vip_until) : null
  const lastClaimDate = profile?.last_claim_date ? new Date(profile.last_claim_date) : null
  const claimedToday =
    lastClaimDate && lastClaimDate.toDateString() === new Date().toDateString()

  const isVip = profile?.is_vip || false
  const isVipPlus = profile?.is_vip_plus || false

  // 1. Fetch initial pour l'ID de session (Sécurité anti-400)
  useEffect(() => {
    const fetchSessionUser = async () => {
      const supabase = createClient()
      const { data } = await supabase.auth.getUser()
      setSessionUserId(data?.user?.id || null)
    }
    fetchSessionUser()
  }, [])

  // ── Guard anti-400 : ne rien rendre tant que la session n'est pas chargée ──
  if (!user?.id) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-8">
        <p className="text-muted-foreground text-sm">Chargement du profil…</p>
      </div>
    )
  }

  // 2. Gestion du Parrainage
  const handleApplyReferral = async () => {
    if (!referralInput.trim()) {
      setReferralMessage("Veuillez saisir un code.")
      return
    }
    setIsApplyingReferral(true)
    try {
      const response = await fetch("/api/referral/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: referralInput.trim() }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.message)
      setLocalPoints(payload.new_points)
      setReferralMessage("Code appliqué ! +5 points.")
    } catch (err: any) {
      setReferralMessage("Erreur code invalide.")
    } finally {
      setIsApplyingReferral(false)
    }
  }

  // 3. Réclamer Bonus → /api/user/claim-daily
  const handleClaimDaily = async () => {
    if (!user?.id) return
    setIsClaimingBonus(true)
    setClaimMessage(null)
    try {
      const response = await fetch("/api/user/claim-daily", { method: "POST" })
      if (!response.ok) {
        setClaimMessage(response.status === 409 ? "Déjà réclamé aujourd'hui." : "Erreur bonus.")
        return
      }
      const data = await response.json()
      setLocalPoints(data.points)
      setClaimMessage("Bonus crédité !")
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 2000)
    } catch {
      setClaimMessage("Erreur serveur.")
    } finally {
      setIsClaimingBonus(false)
    }
  }

  // 4. Portail Stripe → /api/stripe/portal
  const handleManageSubscription = async () => {
    try {
      const response = await fetch("/api/stripe/portal", { method: "POST" })
      const { url } = await response.json()
      if (url) window.location.href = url
      else throw new Error()
    } catch {
      alert("Impossible d'accéder au portail client.")
    }
  }

  // 5. Checkout Stripe → /api/stripe/checkout
  const handleCheckout = async (plan: string) => {
    setSubscriptionMessage(null)
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      })
      const data = await response.json()
      if (data.url) window.location.href = data.url
      else setSubscriptionMessage(data.error || "Erreur lors de la création de la session.")
    } catch {
      setSubscriptionMessage("Erreur de connexion à Stripe.")
    }
  }

  // 6. Sauvegarde profil
  const handleSave = async () => {
    if (!user?.id) return
    setIsSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: firstName,
        last_name: lastName,
        adresse: adresse || null,
        code_postal: codePostal || null,
        ville: ville || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
    setMessage(error ? "Erreur sauvegarde" : "Profil mis à jour !")
    setIsSaving(false)
    setTimeout(() => setMessage(null), 3000)
  }

  // 7. Déconnexion
  const handleSignOut = async () => {
    setIsLoading(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      {showConfetti && <Confetti duration={2000} particleCount={60} />}
      <h2 className="text-xl font-semibold text-foreground">Mon Profil</h2>

      {/* ═══════════════════ CARTE HEADER ═══════════════════ */}
      <Card className="border border-border/50 bg-gradient-to-br from-blue-600/40 via-indigo-600/30 to-purple-600/40 backdrop-blur-sm shadow-lg overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-sky-400 to-blue-600 shadow-md">
              <Crown className="h-7 w-7 text-white" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg text-foreground">Membre BK Rewards</CardTitle>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-sm text-foreground/80">{firstName || "Utilisateur"}</p>
                {isVipPlus && (
                  <span className="bg-gradient-to-r from-slate-300/20 to-slate-400/20 text-slate-200 px-2 py-0.5 rounded-full text-[10px] font-bold border border-slate-400/30">
                    VIP+
                  </span>
                )}
                {isVip && !isVipPlus && (
                  <span className="bg-gradient-to-r from-yellow-500/20 to-amber-500/20 text-yellow-400 px-2 py-0.5 rounded-full text-[10px] font-bold border border-yellow-500/30">
                    VIP
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-foreground/60">Points</p>
              <p className="text-2xl font-bold text-foreground">{localPoints}</p>
            </div>
          </div>
        </CardHeader>
        {vipUntil && (
          <div className="px-6 pb-3">
            <p className="text-xs text-foreground/50">
              Abonnement actif jusqu'au {vipUntil.toLocaleDateString("fr-FR")}
            </p>
          </div>
        )}
      </Card>

      {/* ═══════════════════ INFOS LIVRAISON ═══════════════════ */}
      <Card className="border border-border/50 bg-[#1a1a1a]/80 shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4 text-blue-400" /> Adresse de livraison
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="Adresse" />
          <div className="flex gap-2">
            <Input value={codePostal} onChange={(e) => setCodePostal(e.target.value)} placeholder="Code postal" className="w-1/3" />
            <Input value={ville} onChange={(e) => setVille(e.target.value)} placeholder="Ville" className="flex-1" />
          </div>
          <Button onClick={handleSave} disabled={isSaving} className="w-full" variant="secondary">
            {isSaving ? "Sauvegarde..." : "Enregistrer les infos"}
          </Button>
          {message && <p className="text-xs text-center text-green-400">{message}</p>}
        </CardContent>
      </Card>

      {/* ═══════════════════ ABONNEMENTS VIP ═══════════════════ */}
      {/* --- Carte VIP Gold --- */}
      <Card className="border border-yellow-500/30 bg-gradient-to-br from-yellow-900/30 via-amber-900/20 to-orange-900/30 shadow-lg shadow-yellow-900/10 overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-400" />
            <span className="bg-gradient-to-r from-yellow-300 to-amber-400 bg-clip-text text-transparent font-bold">
              VIP
            </span>
          </CardTitle>
          <p className="text-xs text-foreground/60 mt-1">
            Bonus quotidien, roue de la fortune, jeu à gratter
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            onClick={() => handleCheckout("weekly")}
            variant="outline"
            className="w-full border-yellow-600/50 hover:bg-yellow-600/10 text-yellow-300"
          >
            <Crown className="h-4 w-4 mr-2" /> VIP Hebdo — 1,99€/sem
          </Button>
          <Button
            onClick={() => handleCheckout("monthly")}
            variant="outline"
            className="w-full border-yellow-600/50 hover:bg-yellow-600/10 text-yellow-300"
          >
            <Crown className="h-4 w-4 mr-2" /> VIP Mensuel — 4,99€/mois
          </Button>
        </CardContent>
      </Card>

      {/* --- Carte VIP+ Platine --- */}
      <Card className="border border-slate-400/30 bg-gradient-to-br from-slate-800/60 via-slate-700/40 to-slate-600/30 shadow-lg shadow-slate-900/20 overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Star className="h-5 w-5 text-slate-300" />
            <span className="bg-gradient-to-r from-slate-200 to-slate-400 bg-clip-text text-transparent font-bold">
              VIP+
            </span>
          </CardTitle>
          <p className="text-xs text-foreground/60 mt-1">
            Tous les avantages VIP + machine à sous exclusive + bonus doublé
          </p>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => handleCheckout("vip_plus")}
            className="w-full bg-gradient-to-r from-slate-200 to-slate-400 text-slate-900 font-bold hover:from-slate-100 hover:to-slate-300"
          >
            <Star className="h-4 w-4 mr-2" /> VIP+ Mensuel — 7,99€/mois
          </Button>
        </CardContent>
      </Card>

      {subscriptionMessage && (
        <p className="text-xs text-red-400 text-center">{subscriptionMessage}</p>
      )}

      {/* ═══════════════════ BONUS QUOTIDIEN VIP ═══════════════════ */}
      {(isVip || isVipPlus) && (
        <Card className={`border shadow-lg overflow-hidden ${
          isVipPlus
            ? "border-slate-400/30 bg-gradient-to-r from-slate-800/50 to-slate-700/30"
            : "border-yellow-500/30 bg-gradient-to-r from-yellow-900/20 to-amber-900/20"
        }`}>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">
                {isVipPlus ? "⭐ Bonus VIP+ quotidien" : "👑 Bonus VIP quotidien"}
              </p>
              <span className="text-xs text-foreground/50">+10 points/jour</span>
            </div>
            <Button
              onClick={handleClaimDaily}
              disabled={!!claimedToday || isClaimingBonus}
              className={`w-full font-semibold ${
                claimedToday
                  ? "bg-muted text-muted-foreground"
                  : isVipPlus
                    ? "bg-gradient-to-r from-slate-300 to-slate-400 text-slate-900 hover:from-slate-200 hover:to-slate-300"
                    : "bg-gradient-to-r from-yellow-500 to-amber-500 text-black hover:from-yellow-400 hover:to-amber-400"
              }`}
            >
              {isClaimingBonus
                ? "Chargement..."
                : claimedToday
                  ? "✓ Bonus déjà réclamé aujourd'hui"
                  : "Réclamer mon bonus quotidien"}
            </Button>
            {claimMessage && (
              <p className={`text-xs text-center ${claimMessage.includes("crédité") ? "text-green-400" : "text-red-400"}`}>
                {claimMessage}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════ GESTION ABONNEMENT ═══════════════════ */}
      {(isVip || isVipPlus) && (
        <Button
          onClick={handleManageSubscription}
          variant="outline"
          className={`w-full ${
            isVipPlus
              ? "border-slate-400/50 text-slate-300 hover:bg-slate-700/30"
              : "border-yellow-500/50 text-yellow-400 hover:bg-yellow-900/20"
          }`}
        >
          Gérer mon abonnement
        </Button>
      )}

      {/* ═══════════════════ PARRAINAGE ═══════════════════ */}
      <Card className="border border-border/50 bg-[#1a1a1a]/80 shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Parrainage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {referralCode && <ReferralQR referralCode={referralCode} referredCount={referredCount} />}
          <div className="flex gap-2">
            <Input
              value={referralInput}
              onChange={(e) => setReferralInput(e.target.value)}
              placeholder="Code parrain"
              className="flex-1"
            />
            <Button onClick={handleApplyReferral} disabled={isApplyingReferral} variant="secondary">
              {isApplyingReferral ? "..." : "Appliquer"}
            </Button>
          </div>
          {referralMessage && (
            <p className={`text-xs ${referralMessage.includes("appliqué") ? "text-green-400" : "text-red-400"}`}>
              {referralMessage}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ═══════════════════ DÉCONNEXION ═══════════════════ */}
      <Button onClick={handleSignOut} disabled={isLoading} variant="destructive" className="w-full">
        <LogOut className="h-4 w-4 mr-2" />
        {isLoading ? "Déconnexion..." : "Se déconnecter"}
      </Button>
    </div>
  )
}
