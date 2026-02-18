"use client"

import { useEffect, useRef, useState } from "react"
import { Copy, Check, QrCode, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"

interface ReferralQRProps {
  referralCode: string | null | undefined
  referredCount?: number
}

export function ReferralQR({ referralCode, referredCount = 0 }: ReferralQRProps) {
  const [copied, setCopied] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [localReferralCode, setLocalReferralCode] = useState<string | null>(referralCode || null)
  const [isGenerating, setIsGenerating] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { toast } = useToast()

  useEffect(() => {
    setLocalReferralCode(referralCode || null)
  }, [referralCode])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setIsAuthenticated(Boolean(data?.user))
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session?.user))
    })
    return () => subscription.unsubscribe()
  }, [])

  const generateReferralCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    let code = "BKG-"
    for (let i = 0; i < 4; i += 1) {
      code += chars[Math.floor(Math.random() * chars.length)]
    }
    return code
  }

  useEffect(() => {
    const ensureReferralCode = async () => {
      if (!isAuthenticated) return
      if (isGenerating) return
      if (localReferralCode && localReferralCode.trim() !== "") return

      setIsGenerating(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.id) {
        setIsGenerating(false)
        return
      }

      const newCode = generateReferralCode()
      const { error } = await supabase
        .from("profiles")
        .update({ referral_code: newCode })
        .eq("id", user.id)

      if (!error) {
        setLocalReferralCode(newCode)
      }
      setIsGenerating(false)
    }
    ensureReferralCode()
  }, [isAuthenticated, isGenerating, localReferralCode])

  // Générer le lien de parrainage (en développement, utiliser l'IP locale ou localhost)
  const getReferralLink = () => {
    if (!localReferralCode) return ""

    return `https://bkg-rewards.com/signup?ref=${localReferralCode}`
  }

  const referralLink = getReferralLink()

  // Générer le QR code en utilisant une API externe (ou une bibliothèque)
  useEffect(() => {
    if (!localReferralCode || !referralLink) return

    // Utiliser une API QR code gratuite (QR Server)
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(referralLink)}`
    setQrDataUrl(qrUrl)
  }, [localReferralCode, referralLink])

  const handleCopy = async () => {
    if (!referralLink) return

    try {
      await navigator.clipboard.writeText(referralLink)
      setCopied(true)
      toast({
        title: "Lien copié !",
        description: "Le lien de parrainage a été copié dans le presse-papiers",
      })
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error("Erreur lors de la copie:", error)
      toast({
        title: "Erreur",
        description: "Impossible de copier le lien",
        variant: "destructive",
      })
    }
  }

  if (!localReferralCode && !isAuthenticated) {
    return (
      <div className="rounded-lg border border-border/50 bg-secondary/20 p-4 text-center">
        <p className="text-sm text-muted-foreground">Votre code de parrainage sera disponible après l'inscription</p>
      </div>
    )
  }

  if (!localReferralCode && isAuthenticated) {
    return (
      <div className="rounded-lg border border-border/50 bg-secondary/20 p-4 text-center">
        <p className="text-sm text-muted-foreground">Génération de votre code de parrainage...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <QrCode className="h-5 w-5 text-foreground" />
        <h3 className="font-semibold text-foreground">Parrainez vos amis</h3>
      </div>
      
      <p className="text-sm text-muted-foreground">
        Rejoins-moi sur BK&apos;reward et tente de gagner des cadeaux ! Voici mon code :{" "}
        <span className="font-bold text-foreground">{localReferralCode}</span>
      </p>
      <div className="rounded-xl border border-border/60 bg-secondary/30 p-4 text-center">
        <span className="text-3xl font-bold tracking-widest text-foreground">{localReferralCode}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Parrainages confirmés : <span className="font-semibold text-foreground">{referredCount}</span>
      </p>

      {/* Code de parrainage */}
      <div className="space-y-2">
        <Label htmlFor="referral-code" className="text-sm text-foreground">
          Votre code de parrainage
        </Label>
        <div className="flex gap-2">
          <Input
            id="referral-code"
            value={localReferralCode || ""}
            readOnly
            className="bg-input text-foreground font-mono font-bold"
          />
          <Button
            variant="outline"
            onClick={() => {
              if (!localReferralCode) return
              navigator.clipboard.writeText(localReferralCode)
              toast({
                title: "Code copié !",
                description: "Le code de parrainage a été copié",
              })
            }}
            className="shrink-0"
          >
            <Copy className="mr-2 h-4 w-4" />
            Copier mon code
          </Button>
        </div>
      </div>

      {/* Lien de parrainage */}
      <div className="space-y-2">
        <Label htmlFor="referral-link" className="text-sm text-foreground">
          Lien de parrainage
        </Label>
        <div className="flex gap-2">
          <Input
            id="referral-link"
            value={referralLink}
            readOnly
            className="bg-input text-foreground text-sm"
          />
          <Button
            variant="outline"
            onClick={handleCopy}
            className="shrink-0"
          >
            {copied ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Copié
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Copier
              </>
            )}
          </Button>
        </div>
      </div>

      {/* QR Code Stylisé */}
      {qrDataUrl && (
        <div className="flex flex-col items-center gap-2">
          <div className="relative rounded-2xl border-4 border-gradient-to-br from-blue-500/30 via-blue-600/20 to-yellow-500/30 bg-gradient-to-br from-white via-blue-50/50 to-yellow-50/30 p-6 shadow-xl backdrop-blur-sm" style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(234, 179, 8, 0.1) 100%)',
            borderImage: 'linear-gradient(135deg, rgba(59, 130, 246, 0.5), rgba(234, 179, 8, 0.5)) 1',
          }}>
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/10 via-transparent to-yellow-500/10" />
            <div className="relative rounded-xl bg-white p-3 shadow-inner">
              <img
                src={qrDataUrl}
                alt="QR Code de parrainage BK'reward"
                className="h-48 w-48 rounded-lg"
              />
            </div>
            {/* Badge décoratif */}
            <div className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-yellow-500 shadow-lg">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Scannez ce QR code pour partager votre lien de parrainage
          </p>
          {/* En développement, afficher le lien en texte pour vérification */}
          {(typeof window !== "undefined" && (window.location.origin.includes("localhost") || window.location.origin.includes("127.0.0.1"))) && (
            <div className="mt-2 rounded-lg bg-muted/50 p-2">
              <p className="text-xs font-mono text-muted-foreground break-all text-center">
                {referralLink}
              </p>
              <p className="text-xs text-muted-foreground text-center mt-1">
                (Lien de développement - visible uniquement en localhost)
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
