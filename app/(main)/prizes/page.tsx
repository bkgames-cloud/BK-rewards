import { createClient } from "@/lib/supabase/server"
import { RewardPoolsGrid } from "@/components/reward-pools-grid"
import type { Profile } from "@/lib/types"

export default async function PrizesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

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
    <div className="flex flex-col gap-4 p-4">
      <RewardPoolsGrid
        userId={user?.id}
        title="Cadeaux disponibles"
        description="Participez aux cagnottes communautaires en utilisant vos points."
      />
    </div>
  )
}
