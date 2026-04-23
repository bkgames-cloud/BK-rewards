"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function OffersPage() {
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
    </div>
  )
}

