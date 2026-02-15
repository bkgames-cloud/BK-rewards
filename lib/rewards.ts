import { createClient } from "@/lib/supabase/client"
import type { Cadeau } from "@/lib/types"

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

/**
 * Participe à un cadeau (déduit les points, crée un ticket, met à jour le cadeau)
 * @param cadeauId L'ID du cadeau
 * @param requiredTickets Le nombre de tickets requis pour participer
 * @param currentTickets Le nombre actuel de tickets de l'utilisateur
 * @returns Les nouvelles données (points restants, tickets actuels du cadeau, statut)
 */
export async function participateToGift(
  cadeauId: string,
  requiredTickets: number,
  currentTickets: number
): Promise<{
  newPoints: number
  updatedCadeaux: Cadeau[]
  wonCadeau: { nom: string } | null
}> {
  const supabase = createClient()
  
  // Vérifier que l'utilisateur est bien authentifié
  const { data: { user: currentUser } } = await supabase.auth.getUser()
  if (!currentUser || !currentUser.id) {
    throw new Error("Vous devez être connecté pour participer.")
  }

  // Vérifier que l'utilisateur a assez de tickets
  if (currentTickets < requiredTickets) {
    throw new Error(`Vous n'avez pas assez de tickets. Il vous faut ${requiredTickets} tickets pour participer.`)
  }

  // Récupérer le profil pour vérifier l'adresse
  const { data: userProfile, error: profileError } = await supabase
    .from("profiles")
    .select("adresse, code_postal, ville, points")
    .eq("id", currentUser.id)
    .single()

  if (profileError || !userProfile) {
    throw new Error("Erreur lors de la vérification du profil.")
  }

  // Vérifier que tous les champs d'adresse sont remplis
  if (!userProfile.adresse || !userProfile.code_postal || !userProfile.ville) {
    throw new Error("Veuillez compléter vos informations de livraison dans votre profil avant de participer.")
  }

  // Vérification finale des points depuis la base
  const userPoints = userProfile.points || 0
  if (userPoints < requiredTickets) {
    throw new Error(`Vous n'avez pas assez de tickets. Il vous faut ${requiredTickets} tickets pour participer.`)
  }

  // MISE À JOUR DIRECTE : Déduire les points
  const newPoints = userPoints - requiredTickets
  
  // Mise à jour directe dans la base de données
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ points: newPoints })
    .eq("id", currentUser.id)
  
  if (updateError) {
    throw new Error(`Erreur lors de la mise à jour : ${updateError.message}`)
  }
  
  // Créer le ticket dans la table tickets
  const { data: ticketData, error: ticketError } = await supabase
    .from("tickets")
    .insert({
      user_id: currentUser.id,
      cadeau_id: cadeauId,
    })
    .select()
    .single()
  
  if (ticketError) {
    // Annuler la mise à jour des points si la création du ticket échoue
    await supabase
      .from("profiles")
      .update({ points: userPoints })
      .eq("id", currentUser.id)
    throw new Error("Erreur lors de la création du ticket.")
  }
  
  // Mettre à jour le compteur de tickets du cadeau
  const { data: cadeauData, error: cadeauFetchError } = await supabase
    .from("cadeaux")
    .select("tickets_actuels, objectif_tickets, statut")
    .eq("id", cadeauId)
    .single()
  
  if (!cadeauFetchError && cadeauData) {
    const newTicketsActuels = (cadeauData.tickets_actuels || 0) + 1
    const newStatut = newTicketsActuels >= (cadeauData.objectif_tickets || 0) ? "complet" : cadeauData.statut
    
    await supabase
      .from("cadeaux")
      .update({ 
        tickets_actuels: newTicketsActuels,
        statut: newStatut as any
      })
      .eq("id", cadeauId)
  }
  
  // Recharger les cadeaux depuis Supabase
  const { data: reloadedData, error: reloadError } = await supabase
    .from("cadeaux")
    .select("*")
    .order("points_par_ticket", { ascending: false })
  
  const updatedCadeaux = (!reloadError && reloadedData)
    ? (reloadedData || []).filter((c: any) => c.nom && c.nom.trim() !== "") as Cadeau[]
    : []
  
  // Vérifier si l'utilisateur est maintenant gagnant
  const supabaseCheck = createClient()
  let wonCadeau: { nom: string } | null = null
  
  // Essayer d'abord une requête directe avec gagnant_id
  const { data: directCadeauxCheck, error: directErrorCheck } = await supabaseCheck
    .from("cadeaux")
    .select("id, nom, statut")
    .eq("gagnant_id", currentUser.id)
    .eq("statut", "complet")
    .limit(1)

  if (!directErrorCheck && directCadeauxCheck && directCadeauxCheck.length > 0 && directCadeauxCheck[0].nom && directCadeauxCheck[0].nom.trim() !== "") {
    wonCadeau = { nom: directCadeauxCheck[0].nom }
  } else {
    // Fallback via table gagnants
    const { data: gagnantsCheck, error: gagnantsCheckError } = await supabaseCheck
      .from("gagnants")
      .select("cadeau_id")
      .eq("user_id", currentUser.id)
    
    if (!gagnantsCheckError && gagnantsCheck && gagnantsCheck.length > 0) {
      const cadeauIdsCheck = gagnantsCheck.map((g: { cadeau_id: string }) => g.cadeau_id).filter(Boolean) as string[]
      if (cadeauIdsCheck.length > 0) {
        const { data: cadeauxCheck, error: cadeauxCheckError } = await supabaseCheck
          .from("cadeaux")
          .select("id, nom, statut")
          .in("id", cadeauIdsCheck)
          .eq("statut", "complet")
          .limit(1)
        
        if (!cadeauxCheckError && cadeauxCheck && cadeauxCheck.length > 0 && cadeauxCheck[0].nom && cadeauxCheck[0].nom.trim() !== "") {
          wonCadeau = { nom: cadeauxCheck[0].nom }
        }
      }
    }
  }
  
  return {
    newPoints,
    updatedCadeaux,
    wonCadeau,
  }
}
