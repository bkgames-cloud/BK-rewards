import { createClient } from "@/lib/supabase/server"
import { DashboardClient } from "@/components/dashboard-client"
import type { Cadeau, Profile } from "@/lib/types"

export default async function PrizesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Get all cadeaux - MÊME REQUÊTE QUE L'ADMIN
  const { data: cadeaux, error: cadeauxError } = await supabase
    .from("cadeaux")
    .select("*")
    .order("points_par_ticket", { ascending: false }) // Tri par prix décroissant comme l'admin

  if (cadeauxError) {
    console.log("[PrizesPage] Error loading cadeaux:", cadeauxError.message)
  }

  let profile: Profile | null = null
  if (user && user.id) {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()
      
      // Ne pas logger l'erreur si c'est juste que le profil n'existe pas encore
      if (profileError && profileError.code !== "PGRST116") {
        console.error("[PrizesPage] Profile error:", profileError.message)
      } else if (profileData) {
        profile = profileData
      }
    } catch (error) {
      console.error("[PrizesPage] Error loading profile:", error)
    }
  }

  return (
    <DashboardClient
      cadeaux={((cadeaux || []) as Cadeau[]).filter((c) => c.nom && c.nom.trim() !== "")}
      isAuthenticated={!!user}
      userId={user?.id}
      profile={profile}
      showWallet={false}
      showWelcome={false}
      showVideoButton={false}
    />
  )
}
