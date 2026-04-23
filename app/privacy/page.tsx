"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LegalPage } from "@/components/legal/legal-page"
import { PRIVACY_POLICY } from "@/lib/legal-text"

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
      <LegalPage title={PRIVACY_POLICY.title} intro={PRIVACY_POLICY.intro} sections={PRIVACY_POLICY.sections} />
    </div>
  )
}

