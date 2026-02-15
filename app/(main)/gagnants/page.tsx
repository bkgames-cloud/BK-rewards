"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BadgeCheck, Gift } from "lucide-react"

const winners = [
  {
    name: "Thomas",
    city: "Lyon",
    prize: "Carte Amazon 20€",
  },
  {
    name: "Sarah",
    city: "Paris",
    prize: "Nintendo Switch",
  },
  {
    name: "Mehdi",
    city: "Marseille",
    prize: "PS5",
  },
  {
    name: "Laura",
    city: "Bordeaux",
    prize: "Samsung",
  },
]

export default function WinnersPage() {
  return (
    <div className="flex flex-col gap-6 p-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Mur de la Gloire</h2>
        <p className="text-sm text-muted-foreground">
          Les derniers gagnants BK Rewards
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {winners.map((winner) => (
          <Card
            key={`${winner.name}-${winner.prize}`}
            className="border border-border/50 bg-[#1a1a1a]/80 backdrop-blur-sm shadow-lg"
          >
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base text-foreground">
                <Gift className="h-4 w-4 text-accent" />
                {winner.name} de {winner.city}
                <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-500">
                  <BadgeCheck className="h-3 w-3" />
                  Vérifié
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              a remporté <span className="font-medium text-foreground">{winner.prize}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border border-border/50 bg-gradient-to-r from-(--color-sky-start)/30 to-(--color-sky-end)/30">
        <CardContent className="p-4 text-center text-sm font-medium text-foreground">
          Le prochain, c&apos;est peut-être vous !
        </CardContent>
      </Card>
    </div>
  )
}
