"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const faqItems = [
  {
    question: "Comment sont envoyés les lots ?",
    answer:
      "Les lots physiques sont expédiés par transporteur à l’adresse renseignée dans votre profil.",
  },
  {
    question: "Combien de temps pour recevoir ma carte cadeau ?",
    answer:
      "Les cartes cadeaux sont envoyées par email sous 48 à 72h après validation.",
  },
  {
    question: "Est-ce vraiment gratuit ?",
    answer:
      "Oui. Vous gagnez des points en regardant des publicités et pouvez participer sans frais.",
  },
]

export default function FaqPage() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <Card className="border border-border/50 bg-[#1a1a1a]/80 backdrop-blur-sm shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">FAQ / Support</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible>
            {faqItems.map((item) => (
              <AccordionItem key={item.question} value={item.question}>
                <AccordionTrigger>{item.question}</AccordionTrigger>
                <AccordionContent>{item.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  )
}
