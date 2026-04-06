"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { clearClientAuthStorageAndResetClient, createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Crown, Star, MapPin, LogOut, Trash2 } from "lucide-react"
import type { User as SupabaseUser } from "@supabase/supabase-js"
import type { Profile } from "@/lib/types"
import { ReferralQR } from "@/components/referral-qr"
import { Confetti } from "@/components/confetti"
import { emailMatchesAdmin } from "@/lib/admin-config"
import { gradeToFlags, normalizeGrade } from "@/lib/grade"
import { getApiUrl } from "@/lib/api-origin"
import { PaymentService } from "@/lib/payment-service"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface ProfileClientProps {
  user: SupabaseUser
  profile: Profile | null
}

export function ProfileClient({ user, profile }: ProfileClientProps) {
  const [firstName, setFirstName] = useState(profile?.first_name || "")
  const [lastName, setLastName] = useState(profile?.last_name || "")
  const [adresse, setAdresse] = useState(profile?.adresse || "")
  const [codePostal, setCodePostal] = useState(profile?.code_postal || "")
  const [ville, setVille] = useState(profile?.ville || "")
  const [referralCode, setReferralCode] = useState(profile?.referral_code || "")
  const isAdmin = emailMatchesAdmin(user?.email ?? null)
  const profileEmail =
    profile?.email && typeof profile.email === "string" ? profile.email.trim() : ""
  const displayConnectionEmail = profileEmail || user.email?.trim() || ""
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
  const [myTickets, setMyTickets] = useState<Array<{ id: string; name: string; created_at: string }>>([])
  const [sessionLoading, setSessionLoading] = useState(true)
  const [lastClaimAtLocal, setLastClaimAtLocal] = useState<string | null>(profile?.last_claim_date ?? null)
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [deleteAccountMessage, setDeleteAccountMessage] = useState<string | null>(null)

  const vipUntil = profile?.vip_until ? new Date(profile.vip_until) : null
  const lastClaimDate = lastClaimAtLocal ? new Date(lastClaimAtLocal) : null
  const claimedToday =
    lastClaimDate && lastClaimDate.toDateString() === new Date().toDateString()

  const normalizedGrade = normalizeGrade(profile?.grade)
  const flagsFromGrade = gradeToFlags(normalizedGrade)
  // Fallback compat (anciennes colonnes), mais on priorise grade.
  const isVipPlus = flagsFromGrade.isVipPlus || Boolean(profile?.is_vip_plus)
  const isVip = flagsFromGrade.isVip || Boolean(profile?.is_vip) || isVipPlus

  // 1. Fetch initial pour l'ID de session (Sécurité anti-400)
  useEffect(() => {
    const fetchSessionUser = async () => {
      const supabase = createClient()
      const { data } = await supabase.auth.getUser()
      setSessionUserId(data?.user?.id || null)
      setSessionLoading(false)
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
      const supabase = createClient()
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()
      if (!authUser?.id || authUser.id !== user.id) {
        setReferralMessage("Session invalide.")
        return
      }

      const normalizedCode = referralInput.trim().toUpperCase()
      const { data: me } = await supabase
        .from("profiles")
        .select("id, points, referral_code")
        .eq("id", user.id)
        .maybeSingle()
      if (!me) {
        setReferralMessage("Profil introuvable.")
        return
      }

      if (normalizedCode === "FLYER") {
        const next = Number(me.points ?? 0) + 3
        const { error } = await supabase
          .from("profiles")
          .update({ points: next, updated_at: new Date().toISOString() })
          .eq("id", user.id)
        if (error) throw error
        setLocalPoints(next)
        setReferralMessage("Code appliqué ! +3 points.")
        return
      }

      const { data: referrer } = await supabase
        .from("profiles")
        .select("id, points, referral_code")
        .eq("referral_code", normalizedCode)
        .maybeSingle()

      if (!referrer?.id) {
        setReferralMessage("Code invalide.")
        return
      }
      if (referrer.id === user.id) {
        setReferralMessage("Auto-parrainage interdit.")
        return
      }

      const myNext = Number(me.points ?? 0) + 3
      const refNext = Number(referrer.points ?? 0) + 5

      const { error: meError } = await supabase
        .from("profiles")
        .update({ points: myNext, updated_at: new Date().toISOString() })
        .eq("id", user.id)
      if (meError) throw meError

      await supabase
        .from("profiles")
        .update({ points: refNext, updated_at: new Date().toISOString() })
        .eq("id", referrer.id)

      setLocalPoints(myNext)
      setReferralMessage("Code appliqué ! +3 points.")
    } catch (err: any) {
      setReferralMessage(err?.message || "Erreur code invalide.")
    } finally {
      setIsApplyingReferral(false)
    }
  }

  // 3. Réclamer Bonus → /api/user/claim-daily
  const handleClaimDaily = async () => {
    if (claimedToday) {
      setClaimMessage("Déjà réclamé aujourd'hui.")
      return
    }
    if (!user?.id) return
    setIsClaimingBonus(true)
    setClaimMessage(null)
    try {
      const supabase = createClient()
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()
      if (!authUser?.id || authUser.id !== user.id) return

      const { data: me } = await supabase
        .from("profiles")
        .select("points, is_vip, is_vip_plus, last_claim_date")
        .eq("id", user.id)
        .maybeSingle()
      if (!me) {
        setClaimMessage("Profil introuvable.")
        return
      }
      if (!me.is_vip && !me.is_vip_plus) {
        setClaimMessage("Réservé aux membres VIP.")
        return
      }

      const now = new Date()
      const lastClaim = me.last_claim_date ? new Date(me.last_claim_date) : null
      if (lastClaim && lastClaim.toDateString() === now.toDateString()) {
        setClaimMessage("Déjà réclamé aujourd'hui.")
        setLastClaimAtLocal(now.toISOString())
        return
      }

      const nextPoints = Number(me.points ?? 0) + 10
      const { error } = await supabase
        .from("profiles")
        .update({ points: nextPoints, last_claim_date: now.toISOString() })
        .eq("id", user.id)
      if (error) {
        setClaimMessage("Erreur bonus.")
        return
      }

      setLocalPoints(nextPoints)
      setLastClaimAtLocal(now.toISOString())
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
    setSubscriptionMessage(null)
    try {
      const res = await fetch(getApiUrl("/api/stripe/portal"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ returnPath: "/profile" }),
      })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !data?.url) {
        setSubscriptionMessage("Portail Stripe indisponible pour le moment.")
        return
      }
      window.location.href = data.url
    } catch (e) {
      console.error("[profile] stripe portal:", e)
      setSubscriptionMessage("Erreur réseau.")
    }
  }

  // 5. Abonnement : Google Play sur Android natif, Stripe sur le Web (VIP+ reste Stripe partout).
  const handleCheckout = async (plan: string) => {
    setSubscriptionMessage(null)
    if (plan === "vip_plus") {
      const vipPlus = process.env.NEXT_PUBLIC_STRIPE_VIP_PLUS_LINK
      if (!vipPlus) {
        setSubscriptionMessage("Paiement VIP+ indisponible pour le moment.")
        return
      }
      window.location.href = vipPlus
      return
    }
    try {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      await PaymentService.subscribe({
        plan: plan === "weekly" ? "weekly" : "monthly",
        accessToken: session?.access_token,
      })
      if (PaymentService.isAndroidNative()) {
        setSubscriptionMessage("Abonnement VIP activé.")
        router.refresh()
      }
    } catch (e) {
      setSubscriptionMessage(e instanceof Error ? e.message : "Erreur abonnement.")
    }
  }

  // 6. Sauvegarde profil (colonnes adresse : adresse, code_postal, ville — voir lib/profile-address.ts)
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

  const handleConfirmDeleteAccount = async () => {
    setDeleteAccountMessage(null)
    setIsDeletingAccount(true)
    try {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch(getApiUrl("/api/delete-account"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean }
      if (!res.ok || !data.ok) {
        setDeleteAccountMessage(
          data.error === "non_authentifie"
            ? "Session expirée. Reconnectez-vous."
            : "Impossible de supprimer le compte pour le moment.",
        )
        return
      }
      setDeleteAccountOpen(false)
      // Session serveur déjà invalidée par l’API — pas de signOut() (évite 403).
      clearClientAuthStorageAndResetClient()
      if (typeof window !== "undefined") {
        sessionStorage.setItem("bk_account_deleted", "1")
      }
      router.push("/")
      router.refresh()
    } catch {
      setDeleteAccountMessage("Erreur réseau.")
    } finally {
      setIsDeletingAccount(false)
    }
  }

  useEffect(() => {
    const fetchMyParticipations = async () => {
      if (sessionLoading || !user?.id || !sessionUserId || sessionUserId !== user.id) return
      const supabase = createClient()
      const { data } = await supabase
        .from("tickets")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10)
      if (!data) {
        setMyTickets([])
        return
      }

      const rows = data as Array<Record<string, unknown>>
      const ids = Array.from(
        new Set(
          rows
            .map((row) => String((row.pool_id as string | undefined) ?? (row.prize_id as string | undefined) ?? ""))
            .filter(Boolean),
        ),
      )
      let names = new Map<string, string>()
      if (ids.length > 0) {
        const { data: pools } = await supabase.from("rewards_pools").select("id, name").in("id", ids)
        names = new Map((pools ?? []).map((p: Record<string, unknown>) => [String(p.id), String(p.name ?? "Cadeau")]))
      }

      setMyTickets(
        rows.map((row, i) => {
          const refId = String((row.pool_id as string | undefined) ?? (row.prize_id as string | undefined) ?? "")
          return {
            id: String((row.id as string | undefined) ?? `${refId}-${i}`),
            name: names.get(refId) ?? (refId ? `Lot ${refId.slice(0, 8)}` : "Cadeau"),
            created_at: String((row.created_at as string | undefined) ?? new Date().toISOString()),
          }
        }),
      )
    }
    fetchMyParticipations()
  }, [user?.id, sessionLoading, sessionUserId])

  return (
    <div className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      {showConfetti && <Confetti duration={2000} particleCount={60} />}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold text-foreground">Mon Profil</h2>
        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          {isAdmin ? (
            <Link
              href="/admin"
              className="text-sm font-medium text-amber-400 underline underline-offset-4 hover:text-amber-300"
            >
              Administration
            </Link>
          ) : null}
          <Link
            href="/gains"
            className="text-sm font-medium text-primary underline underline-offset-4 hover:text-primary/90"
          >
            Mes gains
          </Link>
        </div>
      </div>

      {displayConnectionEmail ? (
        <p className="text-sm text-muted-foreground">
          E-mail de connexion :{" "}
          <span className="font-medium text-foreground break-all">{displayConnectionEmail}</span>
        </p>
      ) : null}

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
                {normalizedGrade === "VIP+" ? (
                  <span className="bg-gradient-to-r from-slate-300/20 to-slate-400/20 text-slate-200 px-2 py-0.5 rounded-full text-[10px] font-bold border border-slate-400/30">
                    VIP+
                  </span>
                ) : normalizedGrade === "VIP" ? (
                  <span className="bg-gradient-to-r from-yellow-500/20 to-amber-500/20 text-yellow-400 px-2 py-0.5 rounded-full text-[10px] font-bold border border-yellow-500/30">
                    VIP
                  </span>
                ) : (
                  <span className="bg-gradient-to-r from-emerald-500/15 to-sky-500/10 text-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold border border-emerald-500/25">
                    Gratuit
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
          <div className="space-y-2">
            <Label htmlFor="profile-adresse-rue">Rue</Label>
            <Input
              id="profile-adresse-rue"
              value={adresse}
              onChange={(e) => setAdresse(e.target.value)}
              placeholder="Numéro et nom de rue"
              autoComplete="street-address"
            />
          </div>
          <div className="flex gap-2">
            <div className="w-1/3 space-y-2">
              <Label htmlFor="profile-adresse-cp">Code postal</Label>
              <Input
                id="profile-adresse-cp"
                value={codePostal}
                onChange={(e) => setCodePostal(e.target.value)}
                placeholder="CP"
                autoComplete="postal-code"
              />
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="profile-adresse-ville">Ville</Label>
              <Input
                id="profile-adresse-ville"
                value={ville}
                onChange={(e) => setVille(e.target.value)}
                placeholder="Ville"
                autoComplete="address-level2"
              />
            </div>
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

      <Card className="border border-border/50 bg-[#1a1a1a]/80 shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Mes Participations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {myTickets.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aucun ticket pour le moment.</p>
          ) : (
            myTickets.map((ticket) => (
              <div key={ticket.id} className="flex items-center justify-between rounded-lg border border-border/40 p-2 text-sm">
                <span className="font-medium text-foreground">{ticket.name}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(ticket.created_at).toLocaleDateString("fr-FR")}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* ═══════════════════ ZONE DE DANGER ═══════════════════ */}
      <Card className="border border-destructive/40 bg-destructive/5 shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-destructive">Zone de danger</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            La suppression de votre compte est définitive : accès, points et historique seront effacés.
          </p>
          {deleteAccountMessage && (
            <p className="text-xs text-red-400">{deleteAccountMessage}</p>
          )}
          <Button
            type="button"
            variant="outline"
            className="w-full border-destructive/50 text-destructive hover:bg-destructive/10"
            onClick={() => {
              setDeleteAccountMessage(null)
              setDeleteAccountOpen(true)
            }}
            disabled={isDeletingAccount}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Supprimer mon compte
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={deleteAccountOpen} onOpenChange={setDeleteAccountOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le compte ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr ? Cette action est irréversible et vous perdrez tous vos points.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingAccount}>Annuler</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleConfirmDeleteAccount}
              disabled={isDeletingAccount}
            >
              {isDeletingAccount ? "Suppression…" : "Confirmer la suppression"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ═══════════════════ DÉCONNEXION ═══════════════════ */}
      <Button onClick={handleSignOut} disabled={isLoading} variant="destructive" className="w-full">
        <LogOut className="h-4 w-4 mr-2" />
        {isLoading ? "Déconnexion..." : "Se déconnecter"}
      </Button>
    </div>
  )
}
