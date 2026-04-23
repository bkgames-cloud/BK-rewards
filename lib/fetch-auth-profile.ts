import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js"

/**
 * Listes `select` du plus riche au minimal. Si une colonne manque en base, PostgREST
 * renvoie une erreur (souvent HTTP 400) et **toute** la ligne est perdue — d’où un
 * profil `null` et bonus VIP invisible.
 */
const PROFILE_SELECT_ATTEMPTS: readonly string[] = [
  "id, points, points_balance, grade, is_vip, is_vip_plus, vip_tier, vip_until, last_bonus_claim, last_claim_date, username, avatar_url, tap_score",
  "id, points, grade, is_vip, is_vip_plus, vip_tier, vip_until, last_bonus_claim, last_claim_date, username, avatar_url, tap_score",
  "id, points, grade, is_vip, is_vip_plus, vip_until, last_bonus_claim, last_claim_date, username, avatar_url, tap_score",
  "id, points, grade, is_vip, is_vip_plus, vip_until, username, avatar_url, tap_score",
  "id, points, grade, is_vip, is_vip_plus, username, avatar_url, tap_score",
  "id, points, grade, username, avatar_url, tap_score",
]

function httpStatusFromError(error: PostgrestError | null): number | undefined {
  if (!error) return undefined
  const s = (error as PostgrestError & { status?: number }).status
  return typeof s === "number" ? s : undefined
}

function shouldRetryWithNarrowerSelect(error: PostgrestError): boolean {
  const msg = (error.message || "").toLowerCase()
  const code = error.code || ""
  if (code === "PGRST116") return false
  if (code === "42501" || msg.includes("permission denied") || msg.includes("row-level security")) return false
  if (msg.includes("jwt") || msg.includes("invalid claim") || code === "401") return false
  if (msg.includes("points_balance")) return true
  if (msg.includes("column") && (msg.includes("does not exist") || msg.includes("unknown"))) return true
  if (msg.includes("schema cache")) return true
  return false
}

/**
 * Charge la ligne `profiles` avec repli automatique si des colonnes optionnelles manquent.
 */
export async function fetchAuthProfileForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ data: Record<string, unknown> | null; error: PostgrestError | null }> {
  let lastError: PostgrestError | null = null

  for (let i = 0; i < PROFILE_SELECT_ATTEMPTS.length; i++) {
    const select = PROFILE_SELECT_ATTEMPTS[i]
    const { data, error } = await supabase.from("profiles").select(select).eq("id", userId).maybeSingle()

    const httpStatus = httpStatusFromError(error)

    if (!error) {
      if (typeof window !== "undefined") {
        console.log("[fetchAuthProfileForUser] OK", { attempt: i + 1, select, hasData: !!data })
      }
      return { data: (data as Record<string, unknown>) ?? null, error: null }
    }

    lastError = error

    if (typeof window !== "undefined") {
      console.warn("[fetchAuthProfileForUser] tentative échouée", {
        attempt: i + 1,
        of: PROFILE_SELECT_ATTEMPTS.length,
        select,
        code: error.code,
        httpStatus,
        message: error.message,
        details: (error as { details?: string }).details,
        hint: (error as { hint?: string }).hint,
      })
    }

    const canRetry = i < PROFILE_SELECT_ATTEMPTS.length - 1 && shouldRetryWithNarrowerSelect(error)
    if (!canRetry) {
      if (typeof window !== "undefined") {
        console.error("[fetchAuthProfileForUser] abandon (pas de repli ou erreur finale)", {
          code: error.code,
          httpStatus,
          message: error.message,
        })
      }
      return { data: null, error }
    }
  }

  return { data: null, error: lastError }
}
