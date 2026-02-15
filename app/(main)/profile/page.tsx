import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { ProfileClient } from "@/components/profile-client"

export default async function ProfilePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !user.id) {
    redirect("/auth/login")
  }

  // Get profile - seulement si user.id est défini
  let profile = null
  try {
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single()

    // Ne pas logger l'erreur si c'est juste que le profil n'existe pas encore
    if (profileError && profileError.code !== "PGRST116") {
      console.error("[ProfilePage] Error loading profile:", profileError)
    } else if (profileData) {
      profile = profileData
    }
  } catch (error) {
    console.error("[ProfilePage] Error:", error)
  }

  return <ProfileClient user={user} profile={profile} />
}
