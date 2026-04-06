"use client"

import { DashboardClient } from "@/components/dashboard-client"
import { useAuthContext } from "@/hooks/use-auth-context"

export function DashboardRouteClient() {
  const { loading, isAuthenticated, user, profile, season } = useAuthContext({
    requireAuth: true,
    redirectTo: "/auth/login",
  })

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Chargement...</div>
  }

  return (
    <DashboardClient
      isAuthenticated={isAuthenticated}
      userId={user?.id}
      profile={profile}
      season={season}
      showWelcome
      showRewardsPools
      minimalHome={false}
    />
  )
}
