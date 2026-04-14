import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Met à jour le solde utilisateur sur `public.profiles`.
 *
 * Objectif Nexus : garder `points` et `points_balance` synchronisés.
 * Compat : si `points_balance` n'existe pas encore, on retombe sur `points` seul.
 */
export async function updateUserPoints(
  supabase: SupabaseClient,
  params: {
    userId: string
    points: number
    updatedAtIso?: string
    extra?: Record<string, unknown>
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const updated_at = params.updatedAtIso ?? new Date().toISOString()
  const points = Number.isFinite(params.points) ? Math.max(0, Math.floor(params.points)) : 0

  const payloadBase: Record<string, unknown> = {
    points,
    updated_at,
    ...(params.extra ?? {}),
  }

  // Tentative 1: points + points_balance
  const { error: err1 } = await supabase
    .from("profiles")
    .update({ ...payloadBase, points_balance: points })
    .eq("id", params.userId)

  if (!err1) return { ok: true }

  // Compat: colonne absente ou schéma non à jour.
  const msg = (err1.message || "").toLowerCase()
  const looksLikeMissingColumn =
    msg.includes("column") && msg.includes("points_balance") && (msg.includes("does not exist") || msg.includes("not found"))

  if (!looksLikeMissingColumn) {
    return { ok: false, error: err1.message || "update_failed" }
  }

  const { error: err2 } = await supabase.from("profiles").update(payloadBase).eq("id", params.userId)
  if (err2) return { ok: false, error: err2.message || "update_failed" }
  return { ok: true }
}

