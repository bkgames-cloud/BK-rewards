import { createClient } from "@/lib/supabase/server"
import { DashboardClient } from "@/components/dashboard-client"
import type { Profile, Season } from "@/lib/types"

export default async function HomePage() {
  let user = null
  let profile: Profile | null = null
  let season: Season | null = null

  try {
    const supabase = await createClient()

    // Get current user (optional - dashboard is public)
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError) {
      console.log("[HomePage] User error (expected if not logged in):", userError.message)
    }
    user = userData?.user || null

    // Get active season (utiliser limit(1).maybeSingle pour éviter l'erreur si plusieurs saisons actives)
    const { data: seasonData, error: seasonError } = await supabase
      .from("seasons")
      .select("*")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle()

    // Ne pas logger l'erreur - la saison est optionnelle
    if (seasonData) {
      season = seasonData
    }

    // Les cadeaux sont maintenant chargés directement dans DashboardClient via useEffect
    // Plus besoin de les charger ici

    if (user && user.id) {
      try {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single()

        // Ne pas logger l'erreur si c'est juste que le profil n'existe pas encore
        if (profileError && profileError.code !== "PGRST116") {
          console.error("[HomePage] Profile error:", profileError.message)
        } else if (profileData) {
          profile = profileData
        }
      } catch (error) {
        console.error("[HomePage] Error loading profile:", error)
      }
    }
  } catch (error) {
    console.error("[HomePage] Critical error:", error)
  }

  return (
    <DashboardClient
      cadeaux={[]} // Vide car chargé dans DashboardClient
      isAuthenticated={!!user}
      userId={user?.id}
      profile={profile}
      season={season}
    />
  )
}
