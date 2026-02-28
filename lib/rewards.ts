import { createClient } from "@/lib/supabase/client"

/**
 * Récompense la visualisation d'une publicité (+1 point)
 * @returns Le nouveau nombre de points ou null en cas d'erreur
 */
export async function addTicket(): Promise<{ new_points: number } | null> {
  const supabase = createClient()
  
  // Vérifier que l'utilisateur est bien authentifié
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.id) {
    throw new Error("Vous devez être connecté pour gagner des points.")
  }

  const { data, error } = await supabase.rpc("reward_ad_view").single()

  if (error) {
    if (error.message?.includes("hour_limit") || error.code === "P0001") {
      throw new Error("Limite atteinte : 5 vidéos par heure.")
    }
    if (error.message?.includes("day_limit")) {
      throw new Error("Limite atteinte : 25 vidéos par jour.")
    }
    if (error.message?.includes("not_authenticated")) {
      throw new Error("Vous devez être connecté pour gagner des points.")
    }
    throw new Error(error.message || error.code || "Impossible d'ajouter des points pour le moment.")
  }

  return data || null
}

// Ancien système "cadeaux" supprimé
