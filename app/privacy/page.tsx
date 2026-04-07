"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export default function PrivacyPage() {
  const router = useRouter()

  return (
    <div className="flex flex-col gap-4 p-4">
      <Button
        type="button"
        variant="ghost"
        onClick={() => router.back()}
        className="w-fit gap-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour
      </Button>
      <h2 className="text-xl font-semibold text-foreground">Politique de confidentialité</h2>
      <p className="text-sm text-muted-foreground">
        Cette page explique comment BKG Rewards collecte, utilise et protège vos données.
      </p>

      <Card className="border border-border/50 bg-[#1a1a1a] shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">1. Donnees collectees</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Nous utilisons principalement votre adresse e-mail pour la création et la gestion de votre compte.</p>
          <p>Nous pouvons également stocker des informations de profil (ex. nom, adresse de livraison si vous la renseignez).</p>
          <p>Aucune vente de donnees personnelles a des tiers n&apos;est realisee.</p>
        </CardContent>
      </Card>

      <Card className="border border-border/50 bg-[#1a1a1a] shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">2. Conformite RGPD</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Vous disposez d&apos;un droit d&apos;acces, de rectification et de suppression de vos donnees.</p>
          <p>Pour toute demande, contactez le support via l&apos;adresse e-mail indiquee dans l&apos;application.</p>
        </CardContent>
      </Card>

      <Card className="border border-border/50 bg-[#1a1a1a] shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">3. Paiements (Stripe)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Les paiements et la gestion des abonnements sont traités par Stripe. BKG Rewards ne stocke pas vos données de carte bancaire.
          </p>
          <p>
            Stripe peut traiter des informations nécessaires au paiement (ex. identifiants de transaction) conformément à sa propre politique
            de confidentialité.
          </p>
        </CardContent>
      </Card>

      <Card className="border border-border/50 bg-[#1a1a1a] shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">4. Publicité (Google AdMob / Google)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Nous utilisons des cookies et technologies similaires pour ameliorer l&apos;experience utilisateur et
            diffuser de la publicité, notamment via Google AdMob (et services Google associés).
          </p>
          <p>
            Ces cookies peuvent servir a mesurer l&apos;audience, limiter la fraude et personnaliser l&apos;affichage des
            annonces.
          </p>
        </CardContent>
      </Card>

      <Card className="border border-border/50 bg-[#1a1a1a] shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">5. Contact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Pour toute question relative à la confidentialité, vous pouvez nous contacter via la page Support.</p>
        </CardContent>
      </Card>
    </div>
  )
}

