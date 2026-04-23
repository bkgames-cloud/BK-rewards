"use client"

import { ProfileClient } from "@/components/profile-client"
import { useAuthContext } from "@/hooks/use-auth-context"

export default function ProfilePage() {
  const { loading, user, profile } = useAuthContext({
    requireAuth: true,
    redirectTo: "/auth/login/",
  })

  if (loading || !user) {
    return <div className="p-4 text-sm text-muted-foreground">Chargement...</div>
  }

  return <ProfileClient user={user} profile={profile} />
}

