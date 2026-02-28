import { Suspense } from "react"
import { ConcoursClient } from "@/components/concours-client"
import { SafePage } from "@/components/safe-page"

export default function ConcoursPage() {
  return (
    <SafePage>
      <Suspense fallback={<div>Chargement...</div>}>
        <ConcoursClient />
      </Suspense>
    </SafePage>
  )
}
