"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Sparkles } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col gap-6 p-4">
      {/* Back Button */}
      <Link href="/" className="mb-2 flex items-center gap-2 text-muted-foreground">
        <ArrowLeft className="h-4 w-4" />
        <span className="text-sm">Retour</span>
      </Link>

      <div className="flex flex-1 flex-col items-center justify-center">
        {/* Logo */}
        <div className="mb-8 flex items-center gap-2">
          <div className="rounded-full bg-gradient-to-r from-(--color-sky-start) to-(--color-sky-end) p-3">
            <Sparkles className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            BK&apos;reward
          </h1>
        </div>

        <Card className="w-full max-w-2xl border-border bg-card">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-foreground">À propos de BK&apos;reward</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4 text-foreground">
              <p className="text-lg leading-relaxed">
                Salut ! Je suis BK, le créateur de cette plateforme.
              </p>
              
              <div className="space-y-3">
                <h3 className="text-xl font-semibold text-foreground">Pourquoi j&apos;ai lancé BK&apos;reward ?</h3>
                <p className="leading-relaxed text-muted-foreground">
                  Parce que je trouvais ça injuste que les grandes plateformes profitent de votre attention sans jamais rien vous rendre en retour.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-xl font-semibold text-foreground">Mon concept est simple :</h3>
                <p className="leading-relaxed text-muted-foreground">
                  Vous donnez quelques secondes de votre temps pour regarder une publicité, et en échange, je redistribue les revenus sous forme de cadeaux réels (iPhone, consoles, cartes cadeaux). C&apos;est un contrat gagnant-gagnant. Plus la communauté BK&apos;reward grandit, plus les lots deviennent énormes !
                </p>
              </div>

              <p className="text-lg font-medium text-foreground">
                Merci de faire partie de l&apos;aventure. On se retrouve au prochain tirage !
              </p>
            </div>

            <div className="pt-4">
              <Button asChild variant="secondary" className="w-full">
                <Link href="/">Retour à l&apos;accueil</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
