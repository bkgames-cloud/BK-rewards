"use client"

import { RewardPoolsGrid } from "@/components/reward-pools-grid"
import { useAuthContext } from "@/hooks/use-auth-context"

export default function PrizesPage() {
  const { user, loading } = useAuthContext()

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <p className="text-sm text-muted-foreground">Chargement de la session...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <RewardPoolsGrid
        userId={user?.id}
        title="Catalogue cadeaux"
        description="Tous les lots disponibles pour depenser vos points. Aucun bouton video sur cette page."
      />
    </div>
  )
}
