import type { SupabaseClient } from "@supabase/supabase-js"

/** Événement window pour synchroniser le badge (cloche) après lecture / suppression. */
export const DB_NOTIFICATIONS_CHANGED_EVENT = "db-notifications-changed"

export type DbNotificationRow = {
  id: string
  user_id: string
  title: string | null
  message: string | null
  created_at: string | null
  read?: boolean | null
}

/** Compte uniquement les lignes avec `read === false` (colonne `read` sur `notifications`). */
export async function fetchUnreadNotificationsCount(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false)

  if (!error && typeof count === "number") return count

  if (error) {
    console.warn("[db-notifications] fetchUnreadNotificationsCount:", error.message)
  }
  return 0
}

/** Marque toutes les notifications du user comme lues (sans filtre sur `read`, évite les 400 RLS / requête). */
/** Après achat réussi d’un ticket sur un lot. */
export async function insertTicketValidatedNotification(
  supabase: SupabaseClient,
  userId: string,
  poolName: string,
): Promise<string | null> {
  const lot = String(poolName || "Lot").trim() || "Lot"
  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    title: "Ticket validé !",
    message: `Ton ticket pour le lot ${lot} a bien été pris en compte. Bonne chance !`,
    created_at: new Date().toISOString(),
  })
  return error ? error.message : null
}

/** Quand l’admin marque le gain comme expédié. */
export async function insertPrizeShippedNotification(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    title: "Lot expédié ! 📦",
    message: "Ton cadeau est en route.",
    created_at: new Date().toISOString(),
  })
  return error ? error.message : null
}

export async function markAllNotificationsRead(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)

  if (error) {
    console.warn("[db-notifications] markAllNotificationsRead:", error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}
