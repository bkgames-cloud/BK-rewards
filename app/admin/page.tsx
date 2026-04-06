"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { AdminPanel } from "@/components/admin-panel"
import { emailMatchesAdmin } from "@/lib/admin-config"

export default function AdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    let cancelled = false
    const guard = async () => {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (cancelled) return
      const user = session?.user ?? null
      const allowed = emailMatchesAdmin(user?.email ?? null)
      setIsAdmin(allowed)
      setLoading(false)
      // Un seul renvoi vers l’accueil si non autorisé (pas de redirect() serveur ici → pas de boucle avec /admin).
      if (!allowed) {
        router.replace("/")
      }
    }
    void guard()
    return () => {
      cancelled = true
    }
  }, [router])

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Chargement...</div>
  }

  return isAdmin ? <AdminPanel /> : null
}
