"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { OFFERWALL_MONLIX_COMING_SOON } from "@/lib/offerwall-ui"
import { getMonlixDirectUrl } from "@/lib/monlix-urls"

export default function OffersPage() {
  const monlixDisabled = OFFERWALL_MONLIX_COMING_SOON

  return (
    <div className="flex flex-col gap-4 p-4">
      <h2 className="text-xl font-semibold text-foreground">Offres</h2>
      <p className="text-sm text-muted-foreground">
        Cette section regroupe les offres partenaires accessibles depuis le Web.
      </p>

      <Card className="border border-border/50 bg-[#1a1a1a] shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">Offres partenaires</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Les offres (Lootably / Revlum) sont disponibles via un parcours interne dédié.
          </p>
          <p>
            Si cette page s’affiche, c’est que le bouton “Offres” pointe correctement et qu’il n’y a plus de lien mort.
          </p>
        </CardContent>
      </Card>

      {/* Monlix : code conservé, UI désactivée (pas d’appel / pas de clic). */}
      <Card
        className={`relative border border-border/50 bg-[#1a1a1a] shadow-lg ${monlixDisabled ? "opacity-50" : ""}`}
        aria-disabled={monlixDisabled}
      >
        {monlixDisabled ? (
          <span className="absolute right-3 top-3 z-10 rounded-full bg-[#D4AF37] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-black">
            Prochainement
          </span>
        ) : null}
        <CardHeader>
          <CardTitle className="text-lg text-foreground">Monlix</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Offerwall Monlix — activation après validation de la régie.</p>
          <button
            type="button"
            disabled={monlixDisabled}
            onClick={
              monlixDisabled
                ? undefined
                : () => {
                    // Réactivation future uniquement (pas d’ouverture tant que coming soon).
                    window.location.href = getMonlixDirectUrl()
                  }
            }
            className="w-full cursor-not-allowed rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm font-semibold text-foreground/70 disabled:pointer-events-none"
            aria-label="Monlix — prochainement"
          >
            {monlixDisabled ? "Monlix — Prochainement" : "Ouvrir Monlix"}
          </button>
        </CardContent>
      </Card>
    </div>
  )
}
