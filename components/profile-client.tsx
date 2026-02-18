"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Info, LogOut, Save, Crown, Users, Ticket, MapPin, Star } from "lucide-react"
import Link from "next/link"
import type { User as SupabaseUser } from "@supabase/supabase-js"
import type { Profile } from "@/lib/types"
import { ReferralQR } from "@/components/referral-qr"
import { Confetti } from "@/components/confetti"

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
  const [ticketsSummary, setTicketsSummary] = useState<
    { cadeauId: string; nom: string; count: number }[]
  >([])
  const [referralCode, setReferralCode] = useState(profile?.referral_code || "")
  const [isGeneratingReferral, setIsGeneratingReferral] = useState(false)
  const [referredCount, setReferredCount] = useState(0)
  const [totalViews, setTotalViews] = useState(0)
  const [gradeSettings, setGradeSettings] = useState<{
    grade_debutant_label: string
    grade_bronze_label: string
    grade_argent_label: string
    grade_or_label: string
    grade_debutant_max: number
    grade_bronze_max: number
    grade_argent_max: number
  } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()
  const [localPoints, setLocalPoints] = useState(profile?.points ?? 0)
  const [isClaimingBonus, setIsClaimingBonus] = useState(false)
  const [claimMessage, setClaimMessage] = useState<string | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const points = localPoints
  const vipUntil = profile?.vip_until ? new Date(profile.vip_until) : null
  const lastClaimDate = profile?.last_claim_date ? new Date(profile.last_claim_date) : null
  const claimedToday =
    lastClaimDate && lastClaimDate.toDateString() === new Date().toDateString()

  useEffect(() => {
    const fetchTicketsSummary = async () => {
      if (!user?.id) return
      const supabase = createClient()
      const { data, error } = await supabase
        .from("tickets")
        .select("cadeau_id, cadeaux(nom)")
        .eq("user_id", user.id)

      if (error) {
        setTicketsSummary([])
        return
      }

      const counts: Record<string, { nom: string; count: number }> = {}
      for (const row of data || []) {
        const cadeauId = (row as { cadeau_id?: string }).cadeau_id
        const nom = (row as { cadeaux?: { nom?: string } }).cadeaux?.nom || "Cadeau"
        if (!cadeauId) continue
        counts[cadeauId] = counts[cadeauId]
          ? { nom, count: counts[cadeauId].count + 1 }
          : { nom, count: 1 }
      }

      setTicketsSummary(
        Object.entries(counts)
          .map(([cadeauId, value]) => ({
            cadeauId,
            nom: value.nom,
            count: value.count,
          }))
          .sort((a, b) => b.count - a.count),
      )
    }

    fetchTicketsSummary()
  }, [user?.id])

  const update_referral_code = async (newCode: string) => {
    if (!user?.id) return
    const supabase = createClient()
    const { error } = await supabase
      .from("profiles")
      .update({ referral_code: newCode })
      .eq("id", user.id)
    if (!error) {
      setReferralCode(newCode)
    }
  }

  const generateReferralCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    let code = ""
    for (let i = 0; i < 6; i += 1) {
      code += chars[Math.floor(Math.random() * chars.length)]
    }
    return code
  }

  useEffect(() => {
    const ensureReferralCode = async () => {
      if (!user?.id) return
      if (isGeneratingReferral) return
      if (referralCode && referralCode.trim() !== "") return
      setIsGeneratingReferral(true)
      const newCode = generateReferralCode()
      await update_referral_code(newCode)
      setIsGeneratingReferral(false)
    }
    ensureReferralCode()
  }, [user?.id, referralCode, isGeneratingReferral])

  useEffect(() => {
    if (profile?.referral_code && profile.referral_code.trim() !== "") {
      setReferralCode(profile.referral_code)
    }
  }, [profile?.referral_code])

  useEffect(() => {
    const fetchReferredCount = async () => {
      if (!user?.id) return
      const supabase = createClient()
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("referred_by", user.id)
      setReferredCount(count || 0)
    }
    fetchReferredCount()
  }, [user?.id])

  useEffect(() => {
    const fetchTotalViews = async () => {
      if (!user?.id) return
      const supabase = createClient()
      const { count } = await supabase
        .from("video_views")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
      setTotalViews(count || 0)
    }

    fetchTotalViews()
  }, [user?.id])

  useEffect(() => {
    const fetchGradeSettings = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from("app_settings")
        .select(
          "grade_debutant_label, grade_bronze_label, grade_argent_label, grade_or_label, grade_debutant_max, grade_bronze_max, grade_argent_max",
        )
        .eq("id", 1)
        .single()
      if (data) {
        setGradeSettings(data)
      }
    }
    fetchGradeSettings()
  }, [])

  const getGrade = (views: number) => {
    const settings = gradeSettings || {
      grade_debutant_label: "Débutant",
      grade_bronze_label: "Bronze",
      grade_argent_label: "Argent",
      grade_or_label: "Or",
      grade_debutant_max: 100,
      grade_bronze_max: 500,
      grade_argent_max: 1500,
    }
    if (views <= settings.grade_debutant_max) {
      return {
        label: settings.grade_debutant_label,
        color: "bg-muted text-foreground",
        min: 0,
        max: settings.grade_debutant_max,
      }
    }
    if (views <= settings.grade_bronze_max) {
      return {
        label: settings.grade_bronze_label,
        color: "bg-amber-700/40 text-amber-200",
        min: settings.grade_debutant_max + 1,
        max: settings.grade_bronze_max,
      }
    }
    if (views <= settings.grade_argent_max) {
      return {
        label: settings.grade_argent_label,
        color: "bg-slate-400/40 text-slate-100",
        min: settings.grade_bronze_max + 1,
        max: settings.grade_argent_max,
      }
    }
    return {
      label: settings.grade_or_label,
      color: "bg-yellow-500/40 text-yellow-100",
      min: settings.grade_argent_max + 1,
      max: settings.grade_argent_max + 500,
    }
  }

  const grade = getGrade(totalViews)
  const progressMax = grade.max - grade.min + 1
  const progressValue =
    totalViews >= grade.min
      ? Math.min(((totalViews - grade.min + 1) / progressMax) * 100, 100)
      : 0

  const handleSignOut = async () => {
    setIsLoading(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  const handleSave = async () => {
    if (!user?.id) {
      setMessage("Erreur : utilisateur non identifié")
      return
    }
    
    setIsSaving(true)
    setMessage(null)

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

    if (error) {
      setMessage("Erreur lors de la sauvegarde")
    } else {
      setMessage("Profil mis à jour avec succès")
    }

    setIsSaving(false)
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {showConfetti && <Confetti duration={2000} particleCount={60} />}
      <h2 className="text-xl font-semibold text-foreground">Mon Profil</h2>

      <Card className="border border-border/50 bg-gradient-to-br from-blue-600/40 via-indigo-600/30 to-purple-600/40 backdrop-blur-sm shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-(--color-sky-start) to-(--color-sky-end)">
              <Crown className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg text-foreground">Membre BK Rewards</CardTitle>
              <div className="flex items-center gap-2">
                <p className="text-sm text-foreground/80">
                  {firstName || lastName ? `${firstName} ${lastName}` : "Utilisateur"}
                </p>
                {profile?.is_vip && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/20 px-2 py-0.5 text-[10px] font-semibold text-yellow-400">
                    <Star className="h-3 w-3" />
                    Membre VIP
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-foreground/80">Points</p>
              <p className="text-lg font-bold text-foreground">{points}</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card className="border border-border/50 bg-[#1a1a1a]/80 backdrop-blur-sm shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg text-foreground flex items-center gap-2">
            <Ticket className="h-5 w-5 text-accent" />
            Mes Tickets
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {ticketsSummary.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune participation pour le moment.</p>
          ) : (
            ticketsSummary.map((item) => (
              <div key={item.cadeauId} className="flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-2">
                <span className="text-sm text-foreground">{item.nom}</span>
                <span className="text-sm text-muted-foreground">{item.count} participation{item.count > 1 ? "s" : ""}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border border-border/50 bg-[#1a1a1a]/80 backdrop-blur-sm shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg text-foreground flex items-center gap-2">
            Progression de Grade
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Info className="h-3.5 w-3.5" />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                Montez en grade pour débloquer des bonus exclusifs lors de vos futurs gains !
              </TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Vues totales</span>
            <span className="text-sm font-semibold text-foreground">{totalViews}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${grade.color}`}>
              {grade.label}
            </span>
            <span className="text-xs text-muted-foreground">
              {grade.min}–{grade.max}
            </span>
          </div>
          <Progress value={progressValue} className="h-2" />
        </CardContent>
      </Card>

      <Card className="border border-border/50 bg-[#1a1a1a]/80 backdrop-blur-sm shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg text-foreground flex items-center gap-2">
            <MapPin className="h-5 w-5 text-accent" />
            Informations de livraison
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="firstName" className="text-foreground">
                  Prénom
                </Label>
                <Input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="bg-input text-foreground"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lastName" className="text-foreground">
                  Nom
                </Label>
                <Input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="bg-input text-foreground"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="adresse" className="text-foreground">
                Adresse
              </Label>
              <Input
                id="adresse"
                type="text"
                value={adresse}
                onChange={(e) => setAdresse(e.target.value)}
                placeholder="Numéro et nom de rue"
                className="bg-input text-foreground"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="codePostal" className="text-foreground">
                  Code Postal
                </Label>
                <Input
                  id="codePostal"
                  type="text"
                  value={codePostal}
                  onChange={(e) => setCodePostal(e.target.value)}
                  placeholder="75001"
                  className="bg-input text-foreground"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ville" className="text-foreground">
                  Ville
                </Label>
                <Input
                  id="ville"
                  type="text"
                  value={ville}
                  onChange={(e) => setVille(e.target.value)}
                  placeholder="Paris"
                  className="bg-input text-foreground"
                />
              </div>
            </div>
          </div>

          {message && (
            <p className={`text-sm ${message.includes("Erreur") ? "text-destructive" : "text-accent"}`}>{message}</p>
          )}

          <Button onClick={handleSave} disabled={isSaving} className="w-full" variant="secondary">
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? "Enregistrement..." : "Enregistrer mes informations"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border border-border/50 bg-[#1a1a1a]/80 backdrop-blur-sm shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg text-foreground flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-500" />
            Pass Confort
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {profile?.is_vip 
              ? "Vous êtes membre VIP ! Profitez de tous les avantages premium."
              : "Débloquez tous les avantages premium : Zéro Publicité, Badge VIP, et tickets gratuits quotidiens."}
          </p>
          {profile?.is_vip ? (
            <div className="space-y-3 rounded-lg bg-secondary/40 p-3">
              <p className="text-sm text-foreground">
                Statut : <span className="font-semibold">VIP Actif</span>
                {" • "}
                Expiration :{" "}
                <span className="font-semibold">
                  {vipUntil ? vipUntil.toLocaleDateString("fr-FR") : "Non renseignée"}
                </span>
              </p>
              <Button
                onClick={async () => {
                  setIsClaimingBonus(true)
                  setClaimMessage(null)
                  try {
                    const response = await fetch("/api/claim-daily", { method: "POST" })
                    if (!response.ok) {
                      setClaimMessage(
                        response.status === 409
                          ? "Déjà réclamé aujourd'hui."
                          : "Impossible de réclamer le bonus.",
                      )
                      return
                    }
                    const data = await response.json()
                    setLocalPoints(data.points)
                    setClaimMessage("Bonus VIP crédité !")
                    setShowConfetti(true)
                    setTimeout(() => setShowConfetti(false), 2000)
                  } finally {
                    setIsClaimingBonus(false)
                  }
                }}
                disabled={claimedToday || isClaimingBonus}
                className="w-full bg-gradient-to-r from-accent to-accent/80 text-accent-foreground"
              >
                {claimedToday
                  ? "Déjà réclamé"
                  : isClaimingBonus
                    ? "Réclamation..."
                    : "Réclamer mon bonus VIP"}
              </Button>
              {claimMessage && (
                <p className="text-xs text-muted-foreground">{claimMessage}</p>
              )}
              <Button
                onClick={async () => {
                  const response = await fetch("/api/portal", { method: "POST" })
                  if (!response.ok) return
                  const { url } = await response.json()
                  if (url) window.location.href = url
                }}
                className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 text-yellow-950 hover:from-yellow-600 hover:to-yellow-700"
              >
                <Crown className="mr-2 h-4 w-4" />
                Gérer mon abonnement
              </Button>
            </div>
          ) : (
            <Button asChild className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 text-yellow-950 hover:from-yellow-600 hover:to-yellow-700">
              <Link href="/premium">
                <Crown className="mr-2 h-4 w-4" />
                Découvrir le Pass Confort
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Section Parrainage */}
      <Card className="border border-border/50 bg-[#1a1a1a]/80 backdrop-blur-sm shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg text-foreground flex items-center gap-2">
            <Users className="h-5 w-5 text-accent" />
            Parrainage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ReferralQR
            referralCode={referralCode || profile?.referral_code}
            referredCount={referredCount}
          />
        </CardContent>
      </Card>

      <Card className="border border-border/50 bg-[#1a1a1a]/80 backdrop-blur-sm shadow-lg">
        <CardContent className="pt-6">
          <Button onClick={handleSignOut} disabled={isLoading} variant="destructive" className="w-full">
            <LogOut className="mr-2 h-4 w-4" />
            {isLoading ? "Déconnexion..." : "Se déconnecter"}
          </Button>
        </CardContent>
      </Card>

      {/* Footer avec signature */}
      <div className="pt-4 text-center">
        <p className="text-xs text-muted-foreground">Propulsé par BK&apos;reward</p>
      </div>
    </div>
  )
}
