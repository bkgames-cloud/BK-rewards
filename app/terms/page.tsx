"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LegalPage } from "@/components/legal/legal-page"
import { TERMS_OF_SERVICE } from "@/lib/legal-text"

export default function TermsPage() {
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
      <LegalPage
        title={TERMS_OF_SERVICE.title}
        intro={TERMS_OF_SERVICE.intro}
        sections={TERMS_OF_SERVICE.sections}
      />
    </div>
  )
}

