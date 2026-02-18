"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Application error:", error)
  }, [error])

  return (
    <div className="flex min-h-svh w-full flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <h2 className="text-xl font-semibold text-foreground">Une erreur est survenue</h2>
      <p className="text-sm text-muted-foreground">
        Nous avons rencontré un problème. Vous pouvez réessayer ou recharger la page.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={reset}>Réessayer</Button>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Recharger
        </Button>
      </div>
    </div>
  )
}
