"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { clearClientAuthStorageAndResetClient, createClient, ENABLE_SUPABASE_REALTIME } from "@/lib/supabase/client"
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
import { fetchInternalTestVipBonusEnabled } from "@/lib/app-settings-flags"
import { updateUserPoints } from "@/lib/update-user-points"
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
  const [androidPrices, setAndroidPrices] = useState<{
    weekly: string
    monthly: string
    vipPlusMonthly: string
  } | null>(null)
  const router = useRouter()
  const [localPoints, setLocalPoints] = useState(profile?.points ?? 0)
  const [isClaimingBonus, setIsClaimingBonus] = useState(false)
  const [claimMessage, setClaimMessage] = useState<string | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [myTickets, setMyTickets] = useState<Array<{ id: string; name: string; created_at: string }>>([])
  const [sessionLoading, setSessionLoading] = useState(true)
  const [lastClaimAtLocal, setLastClaimAtLocal] = useState<string | null>(
    profile?.last_bonus_claim ?? profile?.last_claim_date ?? null,
  )
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [deleteAccountMessage, setDeleteAccountMessage] = useState<string | null>(null)
  const [internalTestVipBonus, setInternalTestVipBonus] = useState(false)

  const vipUntil = profile?.vip_until ? new Date(profile.vip_until) : null
  /** Aligné sur l’RPC `claim_vip_bonus` (fenêtre 24 h glissante, pas « minuit » calendaire). */
  const lastClaimEffectiveIso = lastClaimAtLocal ?? profile?.last_bonus_claim ?? profile?.last_claim_date ?? null
  const claimBlockedBy24hCooldown = (() => {
    if (!lastClaimEffectiveIso) return false
    const t = new Date(lastClaimEffectiveIso).getTime()
    if (Number.isNaN(t)) return false
    return Date.now() - t < 24 * 60 * 60 * 1000
  })()

  useEffect(() => {
    setLocalPoints(profile?.points ?? 0)
  }, [profile?.points])

  const normalizedGrade = normalizeGrade(profile?.grade)
  const flagsFromGrade = gradeToFlags(normalizedGrade)
  // Fallback compat (colonnes booléennes) — désormais chargées par `useAuthContext`.
  const isVipPlus =
    flagsFromGrade.isVipPlus ||
    Boolean(profile?.is_vip_plus) ||
    (typeof profile?.vip_tier === "string" && profile.vip_tier.toLowerCase() === "vip_plus")
  const isVip = flagsFromGrade.isVip || Boolean(profile?.is_vip) || isVipPlus

  useEffect(() => {
    if (typeof window === "undefined") return
    const fg = gradeToFlags(normalizeGrade(profile?.grade))
    console.log("[bkg-profile-vip] statut détecté côté app", {
      gradeRaw: profile?.grade,
      normalizedGrade: normalizeGrade(profile?.grade),
      is_vip: profile?.is_vip,
      is_vip_plus: profile?.is_vip_plus,
      vip_tier: profile?.vip_tier,
      vip_until: profile?.vip_until,
      flagsFromGrade: fg,
      isVipComputed: isVip,
      isVipPlusComputed: isVipPlus,
      internalTestVipBonus,
      lastClaimEffectiveIso,
      claimBlockedBy24hCooldown,
    })
  }, [
    profile?.grade,
    profile?.is_vip,
    profile?.is_vip_plus,
    profile?.vip_tier,
    profile?.vip_until,
    isVip,
    isVipPlus,
    internalTestVipBonus,
    lastClaimEffectiveIso,
    claimBlockedBy24hCooldown,
  ])

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

  useEffect(() => {
    if (!PaymentService.isAndroidNative()) return
    let cancelled = false
    const run = async () => {
      try {
        const labels = await PaymentService.getAndroidPriceLabels()
        if (!cancelled) setAndroidPrices(labels)
      } catch {
        if (!cancelled) setAndroidPrices(null)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void fetchInternalTestVipBonusEnabled().then((on) => {
      if (!cancelled) setInternalTestVipBonus(on)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Sync live : si les points sont modifiés “à la main” dans Supabase, refléter sans redémarrer.
  useEffect(() => {
    if (!ENABLE_SUPABASE_REALTIME) return
    if (!user?.id) return
    const supabase = createClient()
    const channel = supabase
      .channel(`profiles-points-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        (payload: { new: Record<string, unknown> }) => {
          const raw = payload?.new?.points
          const parsed = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN
          if (Number.isFinite(parsed)) {
            setLocalPoints(Math.max(0, Math.floor(parsed)))
          }
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [user?.id])

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
        const res = await updateUserPoints(supabase, { userId: user.id, points: next })
        if (!res.ok) {
          console.error("[profile] updateUserPoints (FLYER) failed", { error: res.error, details: res.details })
          throw new Error(res.error)
        }
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

      const meRes = await updateUserPoints(supabase, { userId: user.id, points: myNext })
      if (!meRes.ok) {
        console.error("[profile] updateUserPoints (me) failed", { error: meRes.error, details: meRes.details })
        throw new Error(meRes.error)
      }

      const refRes = await updateUserPoints(supabase, { userId: referrer.id, points: refNext })
      if (!refRes.ok) {
        console.error("[profile] updateUserPoints (referrer) failed", { error: refRes.error, details: refRes.details })
        throw new Error(refRes.error)
      }

      setLocalPoints(myNext)
      setReferralMessage("Code appliqué ! +3 points.")
    } catch (err: any) {
      setReferralMessage(err?.message || "Erreur code invalide.")
    } finally {
      setIsApplyingReferral(false)
    }
  }

  // 3. Réclamer Bonus — RPC `claim_vip_bonus()` (écrit sur `public.profiles` : points, last_bonus_claim, last_claim_date, etc. ; lit `purchases` pour l’abonnement actif). Aucune date n’est envoyée depuis le client : la DB utilise `NOW()` (timestamptz).
  const handleClaimDaily = async () => {
    console.log("[bkg-profile-vip] clic Réclamer bonus", {
      claimBlockedBy24hCooldown,
      isVipPlus,
      isVip,
      userId: user?.id,
    })
    if (claimBlockedBy24hCooldown) {
      setClaimMessage("Déjà réclamé : attendez la fin du délai de 24 h.")
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
      if (!authUser?.id || authUser.id !== user.id) {
        console.warn("[bkg-profile-vip] session utilisateur incohérente pour claim")
        return
      }

      const { data, error } = await supabase.rpc("claim_vip_bonus")

      if (error) {
        console.error("[bkg-profile-vip] RPC claim_vip_bonus — erreur PostgREST / Postgres", {
          message: error.message,
          code: error.code,
          details: (error as { details?: string }).details,
          hint: (error as { hint?: string }).hint,
        })
        const msg = error.message || ""
        setClaimMessage(
          msg.includes("already_claimed_today")
            ? "Déjà réclamé : délai de 24 h non écoulé."
            : msg.includes("subscription_inactive")
              ? "Abonnement inactif : bonus indisponible."
              : msg.includes("not_authenticated")
                ? "Connexion requise."
                : `Erreur technique : ${msg || error.code || "inconnue"}`,
        )
        return
      }

      type ClaimRpcRow = { success?: boolean; tickets_granted?: number; message?: string | null }
      const row: ClaimRpcRow | null = Array.isArray(data)
        ? (data[0] as ClaimRpcRow)
        : data && typeof data === "object"
          ? (data as ClaimRpcRow)
          : null

      console.log("[bkg-profile-vip] RPC claim_vip_bonus — corps (sans error)", {
        rawData: data,
        row,
      })

      if (!row?.success) {
        const code = (row?.message || "").trim()
        console.warn("[bkg-profile-vip] claim refusé côté SQL (success=false)", { code, row })
        setClaimMessage(
          code === "already_claimed_today"
            ? "Déjà réclamé : délai de 24 h non écoulé."
            : code === "subscription_inactive"
              ? "Abonnement inactif : aucun achat actif dans « purchases » (voir script 051). Bonus indisponible."
              : code === "not_authenticated"
                ? "Connexion requise."
                : code
                  ? `Bonus impossible : ${code}`
                  : "Erreur bonus (réponse vide de la fonction).",
        )
        return
      }

      const granted = Number(row.tickets_granted ?? 0)
      setClaimMessage(`Bonus crédité ! +${granted} points`)
      setLastClaimAtLocal(new Date().toISOString())
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 2000)
      // Relecture des points (évite de recalculer côté client)
      const { data: refreshed } = await supabase
        .from("profiles")
        .select("points, last_claim_date, last_bonus_claim")
        .eq("id", user.id)
        .maybeSingle()
      if (refreshed?.points != null) setLocalPoints(Number(refreshed.points))
      const nextClaim =
        (refreshed as { last_bonus_claim?: string | null; last_claim_date?: string | null } | null)
          ?.last_bonus_claim ??
        (refreshed as { last_claim_date?: string | null } | null)?.last_claim_date
      if (nextClaim) setLastClaimAtLocal(nextClaim)
    } catch (e) {
      console.error("[bkg-profile-vip] handleClaimDaily exception", e)
      setClaimMessage(
        e instanceof Error ? `Erreur : ${e.message}` : "Erreur serveur.",
      )
    } finally {
      setIsClaimingBonus(false)
    }
  }

  // 4. Portail Stripe → /api/stripe/portal
  const handleManageSubscription = async () => {
    setSubscriptionMessage(null)
    if (PaymentService.isAndroidNative()) {
      setSubscriptionMessage("Gestion abonnement : disponible uniquement sur le Web (Stripe).")
      return
    }
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
      if (PaymentService.isAndroidNative()) {
        setSubscriptionMessage("Gestion abonnement : disponible uniquement sur le Web (Stripe).")
        return
      }
      window.location.href = data.url
    } catch (e) {
      console.error("[profile] stripe portal:", e)
      setSubscriptionMessage("Erreur réseau.")
    }
  }

  // 5. Abonnement : Google Play Billing sur Android natif, Stripe sur le Web.
  const handleCheckout = async (plan: string) => {
    setSubscriptionMessage(null)
    if (plan === "vip_plus") {
      try {
        const supabase = createClient()
        const {
          data: { session },
        } = await supabase.auth.getSession()
        await PaymentService.subscribe({
          plan: "vip_plus_monthly",
          accessToken: session?.access_token,
        })
        if (PaymentService.isAndroidNative()) {
          setSubscriptionMessage("Abonnement VIP+ activé.")
          router.refresh()
        }
        return
      } catch (e) {
        setSubscriptionMessage(e instanceof Error ? e.message : "Erreur abonnement VIP+.")
        return
      }
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
              <CardTitle className="text-lg text-foreground">Membre BKG Rewards</CardTitle>
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
            <Crown className="h-4 w-4 mr-2" /> VIP BKG (Hebdo) —{" "}
            {androidPrices?.weekly ? `${androidPrices.weekly}/sem` : "1,99€/sem"}
          </Button>
          <Button
            onClick={() => handleCheckout("monthly")}
            variant="outline"
            className="w-full border-yellow-600/50 hover:bg-yellow-600/10 text-yellow-300"
          >
            <Crown className="h-4 w-4 mr-2" /> VIP BKG (Mensuel) —{" "}
            {androidPrices?.monthly ? `${androidPrices.monthly}/mois` : "4,99€/mois"}
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
            <Star className="h-4 w-4 mr-2" /> BKG VIP+ (Mensuel) —{" "}
            {androidPrices?.vipPlusMonthly ? `${androidPrices.vipPlusMonthly}/mois` : "7,99€/mois"}
          </Button>
        </CardContent>
      </Card>

      {subscriptionMessage && (
        <p className="text-xs text-red-400 text-center">{subscriptionMessage}</p>
      )}

      {/* ═══════════════════ BONUS QUOTIDIEN VIP ═══════════════════ */}
      {(isVip || isVipPlus || internalTestVipBonus) && (
        <Card className={`border shadow-lg overflow-hidden ${
          isVipPlus
            ? "border-slate-400/30 bg-gradient-to-r from-slate-800/50 to-slate-700/30"
            : "border-yellow-500/30 bg-gradient-to-r from-yellow-900/20 to-amber-900/20"
        }`}>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">
                {internalTestVipBonus && !isVip && !isVipPlus
                  ? "👑 Bonus VIP quotidien (phase test)"
                  : isVipPlus
                    ? "⭐ Bonus VIP+ quotidien"
                    : "👑 Bonus VIP quotidien"}
              </p>
              <span className="text-xs text-foreground/50">{isVipPlus ? "+15 points/jour" : "+10 points/jour"}</span>
            </div>
            <Button
              onClick={handleClaimDaily}
              disabled={claimBlockedBy24hCooldown || isClaimingBonus}
              className={`w-full font-semibold ${
                claimBlockedBy24hCooldown
                  ? "bg-muted text-muted-foreground"
                  : isVipPlus
                    ? "bg-gradient-to-r from-slate-300 to-slate-400 text-slate-900 hover:from-slate-200 hover:to-slate-300"
                    : "bg-gradient-to-r from-yellow-500 to-amber-500 text-black hover:from-yellow-400 hover:to-amber-400"
              }`}
            >
              {isClaimingBonus
                ? "Chargement..."
                : claimBlockedBy24hCooldown
                  ? "✓ Bonus déjà réclamé (24 h)"
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
