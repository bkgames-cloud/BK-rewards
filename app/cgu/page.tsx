import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function CGUPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-[#0a0a0a] via-[#1a1a1a] to-[#0a0a0a] p-4">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Conditions Générales d'Utilisation</h1>
          <p className="text-muted-foreground">Article 4 - Déclenchement des tirages au sort</p>
        </div>

        <Card className="border border-border/50 bg-[#1a1a1a]/80 backdrop-blur-sm shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl text-foreground">
              Article 4 - Déclenchement des tirages au sort
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-foreground leading-relaxed">
              Les tirages au sort sont basés sur un seuil de financement publicitaire. Un tirage est officiellement confirmé dès que le nombre de tickets défini (ex: 1 000) est atteint. Si la participation dépasse ce seuil, les tickets excédentaires sont automatiquement reportés sur un second tirage (Lot n°2) du même produit. L'Organisateur se réserve le droit de regrouper les tirages financés en fin de mois calendaire pour une gestion logistique optimale.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
