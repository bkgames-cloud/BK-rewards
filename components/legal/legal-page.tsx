"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { LegalSection } from "@/lib/legal-text"

export function LegalPage(props: { title: string; intro: string; sections: LegalSection[] }) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <h2 className="text-xl font-semibold text-foreground">{props.title}</h2>
      <p className="text-sm text-muted-foreground">{props.intro}</p>
      <div className="grid gap-4">
        {props.sections.map((s) => (
          <Card key={s.title} className="border border-border/50 bg-[#1a1a1a] shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">{s.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              {s.paragraphs.map((p, i) => (
                <p key={`${s.title}-${i}`}>{p}</p>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

