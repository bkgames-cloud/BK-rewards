"use client"
import { useState } from "react"
import Image from "next/image"
import { Lock, Smartphone, Gamepad2, Gift, Headphones, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { Cadeau } from "@/lib/types"
import { cn } from "@/lib/utils"
import { getPrizeFallbackImage } from "@/lib/prizes"
import { notificationService } from "@/lib/notifications"
import { soundService } from "@/lib/sounds"

interface CadeauCardProps {
  cadeau: Cadeau
  onParticipate: (cadeauId: string, pointsParTicket: number) => void
  isParticipating: boolean
  isAuthenticated: boolean
  canParticipate: boolean
  userTickets: number
  isVip?: boolean
}

export function CadeauCard({
  cadeau,
  onParticipate,
  isParticipating,
  isAuthenticated,
  canParticipate,
  userTickets,
  isVip = false,
}: CadeauCardProps) {
  const [showModal, setShowModal] = useState(false)
  // Utiliser tickets_total en priorité, fallback sur objectif_tickets
  const ticketsTotal = (cadeau as any).tickets_total || cadeau.objectif_tickets || 0
  const ticketsOwned = Math.max(0, userTickets || 0)
  
  // Progression : si dépassement, afficher 100%, sinon le pourcentage normal
  const progressPercentage =
    ticketsTotal > 0
      ? Math.min((ticketsOwned / ticketsTotal) * 100, 100)
      : 0
  
  // Un cadeau est complété si le statut est 'complet' ou si on a atteint au moins un tirage
  const isCompleted = cadeau.statut === "complet" || (cadeau.tickets_actuels || 0) >= ticketsTotal
  // Utiliser getPrizeFallbackImage si image_url est vide ou null
  const initialImageSrc = (cadeau.image_url && cadeau.image_url.trim() !== "")
    ? cadeau.image_url
    : getPrizeFallbackImage(cadeau.nom)
  const [imageSrc, setImageSrc] = useState(initialImageSrc)

  const getRarityBadge = (name: string) => {
    const lower = name.toLowerCase()
    if (lower.includes("iphone") || lower.includes("playstation") || lower.includes("ps5") || lower.includes("samsung")) {
      return "Premium"
    }
    if (lower.includes("amazon") || lower.includes("psn") || lower.includes("netflix")) return "Flash"
    return "Populaire"
  }
  const rarityBadge = getRarityBadge(cadeau.nom)
  const isPremium = rarityBadge === "Premium"

  const Icon =
    cadeau.nom.toLowerCase().includes("iphone") || cadeau.nom.toLowerCase().includes("samsung")
      ? Smartphone
      : cadeau.nom.toLowerCase().includes("ps5") || cadeau.nom.toLowerCase().includes("xbox")
        ? Gamepad2
        : cadeau.nom.toLowerCase().includes("airpods")
          ? Headphones
          : cadeau.nom.toLowerCase().includes("carte cadeau")
            ? Gift
            : undefined

  return (
    <Card
      className={cn(
        "relative overflow-hidden border border-border/50 bg-[#1a1a1a]/80 backdrop-blur-sm shadow-lg transition-all duration-300",
        isCompleted && "ring-2 ring-accent",
        "hover:scale-[1.02] hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-xl",
        isPremium && "shine-premium",
      )}
    >
      {/* Completed Badge */}
      {isCompleted && (
        <div className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-full bg-accent px-2 py-1">
          <CheckCircle2 className="h-3 w-3 text-accent-foreground" />
          <span className="text-xs font-bold text-accent-foreground">Complet</span>
        </div>
      )}

      <CardContent className="p-4">
        <div className="flex gap-4">
        {/* Prize Image */}
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-secondary group">
          <span className="absolute left-2 top-2 z-10 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
            {rarityBadge}
          </span>
          <Image
            src={imageSrc}
            alt={cadeau.nom}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => {
              // Si l'image échoue (404, Unsplash cassé, etc.), utiliser le fallback
              const fallback = getPrizeFallbackImage(cadeau.nom)
              if (imageSrc !== fallback) {
                setImageSrc(fallback)
              }
            }}
          />
          {Icon && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-gradient-to-t from-background/60 to-transparent">
              <Icon className="h-8 w-8 text-foreground/70" />
            </div>
          )}
        </div>

        {/* Prize Info */}
        <div className="flex flex-1 flex-col justify-between">
          <div>
            <h3 className="font-semibold text-foreground">{cadeau.nom}</h3>
            <p className="text-sm text-muted-foreground">
              {ticketsOwned} / {ticketsTotal} tickets
            </p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1">
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className={cn(
                  "h-full transition-all duration-300",
                  progressPercentage >= 100 ? "bg-green-500" : "bg-blue-500"
                )}
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">{Math.round(progressPercentage)}% complété</p>
          </div>
        </div>
        </div>

        {/* Action Button */}
        <div className="mt-4">
        {isCompleted ? (
          <Button disabled className="w-full bg-accent text-accent-foreground">
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Tirage terminé
          </Button>
        ) : !isAuthenticated ? (
          <Button variant="secondary" className="w-full" asChild>
            <a href="/auth/login">
              <Lock className="mr-2 h-4 w-4" />
              Connectez-vous pour participer
            </a>
          </Button>
        ) : (
          <>
            <Button
              onClick={() => setShowModal(true)}
              disabled={isParticipating || !canParticipate}
              className={cn(
                "w-full",
                canParticipate
                  ? "bg-gradient-to-r from-(--color-sky-start) to-(--color-sky-end) text-primary-foreground"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              {isParticipating
                ? "Participation..."
                : !canParticipate
                  ? `Tickets insuffisants (${cadeau.points_par_ticket} requis)`
                  : `Participer - ${cadeau.points_par_ticket} points`}
            </Button>
            
            <Dialog open={showModal} onOpenChange={setShowModal}>
              <DialogContent className="border border-border/50 bg-[#1a1a1a]/95 backdrop-blur-sm">
                <DialogHeader>
                  <DialogTitle className="text-foreground">Obtenir un ticket</DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    {isVip 
                      ? "En tant que membre VIP, vous pouvez participer directement."
                      : "Regardez une vidéo pour obtenir 1 ticket pour ce cadeau."}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {isVip ? (
                    <>
                      <p className="text-sm text-foreground">
                        En tant que membre VIP, vous pouvez participer directement au tirage au sort de <strong>{cadeau.nom}</strong> sans regarder de publicité.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          onClick={async () => {
                            // Jouer le son de clic
                            soundService.playClickSound()
                            // Demander la permission de notification au premier clic
                            if (notificationService.isSupported() && !notificationService.hasPermission()) {
                              await notificationService.requestPermission()
                            }
                            await onParticipate(cadeau.id, cadeau.points_par_ticket)
                            setShowModal(false)
                          }}
                          disabled={isParticipating || !canParticipate}
                          className={cn(
                            "flex-1",
                            canParticipate
                              ? "bg-gradient-to-r from-(--color-sky-start) to-(--color-sky-end) text-primary-foreground"
                              : "bg-muted text-muted-foreground cursor-not-allowed"
                          )}
                        >
                          {isParticipating
                            ? "Participation..."
                            : !canParticipate
                              ? `Tickets insuffisants (${cadeau.points_par_ticket} requis)`
                              : "Participer directement"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setShowModal(false)}
                          className="flex-1"
                        >
                          Annuler
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-foreground">
                        Vous pouvez participer directement au tirage au sort de <strong>{cadeau.nom}</strong>.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          onClick={async () => {
                            // Jouer le son de clic
                            soundService.playClickSound()
                            // Demander la permission de notification au premier clic
                            if (notificationService.isSupported() && !notificationService.hasPermission()) {
                              await notificationService.requestPermission()
                            }
                            await onParticipate(cadeau.id, cadeau.points_par_ticket)
                            setShowModal(false)
                          }}
                          disabled={isParticipating || !canParticipate}
                          className={cn(
                            "flex-1",
                            canParticipate
                              ? "bg-gradient-to-r from-(--color-sky-start) to-(--color-sky-end) text-primary-foreground"
                              : "bg-muted text-muted-foreground cursor-not-allowed"
                          )}
                        >
                          Participer
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setShowModal(false)}
                          className="flex-1"
                        >
                          Annuler
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}
        {!isCompleted && isAuthenticated && !canParticipate && (
          <p className="mt-2 text-xs text-destructive">Solde insuffisant pour participer.</p>
        )}
        </div>
      </CardContent>
    </Card>
  )
}
