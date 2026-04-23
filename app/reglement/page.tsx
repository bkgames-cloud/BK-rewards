import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ShieldCheck, Coins, Trophy, Crown, Scale } from "lucide-react"

export default function ReglementPage() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <h2 className="text-xl font-semibold text-foreground">Règlement &amp; CGU</h2>
      <p className="text-sm text-muted-foreground">
        Version officielle des conditions de participation et d&apos;utilisation.
      </p>

      <Card className="border border-white/10 bg-white/5 backdrop-blur-md shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-foreground">
            <ShieldCheck className="h-5 w-5 text-sky-300" /> 1. Conditions Générales
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Participation gratuite, sans obligation d&apos;achat, réservée aux majeurs.</p>
        </CardContent>
      </Card>

      <Card className="border border-white/10 bg-white/5 backdrop-blur-md shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-foreground">
            <Coins className="h-5 w-5 text-yellow-300" /> 2. Attribution des Points
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>1 publicité visionnée = 1 point.</p>
          <p>Limites : 5 points par heure et 25 points par jour.</p>
          <p>Lutte contre la fraude active : bots et usages automatisés interdits.</p>
        </CardContent>
      </Card>

      <Card className="border border-white/10 bg-white/5 backdrop-blur-md shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-foreground">
            <Trophy className="h-5 w-5 text-amber-300" /> 3. Tirages au sort
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Tirage aléatoire via algorithme dès que le quota de participation est atteint.</p>
          <p>
            Le compteur est réinitialisé après chaque tirage ; les tickets au-delà du seuil participent au tirage en
            cours.
          </p>
          <p>Les gagnants sont notifiés par e-mail.</p>
          <p>Réponse du gagnant sous 7 jours maximum, sinon le lot est remis en jeu.</p>
        </CardContent>
      </Card>

      <Card className="border border-white/10 bg-white/5 backdrop-blur-md shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-foreground">
            <Crown className="h-5 w-5 text-purple-300" /> 4. Abonnements
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Les avantages VIP/VIP+ incluent des probabilités de gains améliorées sur les{" "}
            <span className="font-medium text-foreground">MINI-JEUX</span> et la suppression des timers. Cependant, ils
            n&apos;augmentent pas les chances statistiques lors des{" "}
            <span className="font-medium text-foreground">TIRAGES AU SORT</span> de cadeaux.
          </p>
        </CardContent>
      </Card>

      <Card className="border border-white/10 bg-white/5 backdrop-blur-md shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-foreground">
            <Scale className="h-5 w-5 text-emerald-300" /> 5. Responsabilité
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Apple et Google ne sont pas impliqués dans l&apos;organisation des tirages.</p>
          <p>Les points sont des unités de fidélité sans valeur monétaire et ne sont pas convertibles en argent.</p>
        </CardContent>
      </Card>
    </div>
  )
}

