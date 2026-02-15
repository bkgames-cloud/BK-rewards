import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function ReglementPage() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <h2 className="text-xl font-semibold text-foreground">Règlement &amp; CGU</h2>
      <p className="text-sm text-muted-foreground">
        Retrouvez ici les règles de participation et les conditions générales d&apos;utilisation.
      </p>

      <Card className="border border-border/50 bg-[#1a1a1a] shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">1. Conditions générales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Le tirage au sort est ouvert à toute personne majeure disposant d&apos;un compte valide.</p>
          <p>Les points sont personnels et non transférables.</p>
          <p>Une participation correspond à un ticket généré pour un cadeau.</p>
        </CardContent>
      </Card>

      <Card className="border border-border/50 bg-[#1a1a1a] shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">2. Participation &amp; points</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Chaque publicité visionnée rapporte 1 point (limite : 5/h et 25/jour).</p>
          <p>Le coût en points par ticket est indiqué sur chaque cadeau.</p>
          <p>Le tirage est clôturé automatiquement à l&apos;atteinte de l&apos;objectif collectif.</p>
        </CardContent>
      </Card>

      <Card className="border border-border/50 bg-[#1a1a1a] shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">3. Tirage au sort</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Les gagnants sont sélectionnés aléatoirement parmi les tickets émis.</p>
          <p>Les gagnants sont contactés par e-mail.</p>
        </CardContent>
      </Card>

      <Card className="border border-border/50 bg-[#1a1a1a] shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">4. Mentions légales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Apple et Google ne sont pas des sponsors.</p>
        </CardContent>
      </Card>
    </div>
  )
}
