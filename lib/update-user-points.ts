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
): Promise<
  | { ok: true; applied: "points_and_points_balance" | "points_only_fallback" }
  | {
      ok: false
      error: string
      details: {
        stage: "with_points_balance" | "without_points_balance"
        code?: string
        message?: string
        hint?: string
        isPermissionDenied?: boolean
        isMissingPointsBalanceColumn?: boolean
      }
    }
> {
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

  if (!err1) return { ok: true, applied: "points_and_points_balance" }

  // Compat: colonne absente ou schéma non à jour.
  const msg = (err1.message || "").toLowerCase()
  const code = (err1 as { code?: string | null } | null)?.code ?? undefined
  const hint = (err1 as { hint?: string | null } | null)?.hint ?? undefined
  const looksLikeMissingColumn =
    msg.includes("column") && msg.includes("points_balance") && (msg.includes("does not exist") || msg.includes("not found"))
  const isPermissionDenied =
    code === "42501" || msg.includes("permission denied") || msg.includes("violates row-level security")

  if (!looksLikeMissingColumn) {
    return {
      ok: false,
      error: err1.message || "update_failed",
      details: {
        stage: "with_points_balance",
        code,
        message: err1.message,
        hint,
        isPermissionDenied,
        isMissingPointsBalanceColumn: false,
      },
    }
  }

  const { error: err2 } = await supabase.from("profiles").update(payloadBase).eq("id", params.userId)
  if (err2) {
    const msg2 = (err2.message || "").toLowerCase()
    const code2 = (err2 as { code?: string | null } | null)?.code ?? undefined
    const hint2 = (err2 as { hint?: string | null } | null)?.hint ?? undefined
    const isPermissionDenied2 =
      code2 === "42501" || msg2.includes("permission denied") || msg2.includes("violates row-level security")
    return {
      ok: false,
      error: err2.message || "update_failed",
      details: {
        stage: "without_points_balance",
        code: code2,
        message: err2.message,
        hint: hint2,
        isPermissionDenied: isPermissionDenied2,
        isMissingPointsBalanceColumn: true,
      },
    }
  }
  return { ok: true, applied: "points_only_fallback" }
}

