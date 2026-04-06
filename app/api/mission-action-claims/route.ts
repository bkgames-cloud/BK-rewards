import { createClient } from "@/lib/supabase/server"
import { nextJsonWithCors, nextCorsPreflight } from "@/lib/api-cors"

export const dynamic = "force-dynamic"

async function getUserFromRequest(
  request: Request,
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const authHeader = request.headers.get("authorization")
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : ""
  if (bearer) {
    return supabase.auth.getUser(bearer)
  }
  return supabase.auth.getUser()
}

/**
 * GET : nombre de réclamations mission + indicateur 1ère action (pour l’UI).
 * POST : appelle la RPC `add_mission_action_points` (même logique +5 / +3 que le client direct).
 */
export async function OPTIONS(request: Request) {
  return nextCorsPreflight(request)
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await getUserFromRequest(request, supabase)
    if (authError || !user?.id) {
      return nextJsonWithCors(request, { ok: false, error: "non_authentifie" }, { status: 401 })
    }

    const { count, error } = await supabase
      .from("mission_action_claims")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)

    if (error) {
      return nextJsonWithCors(
        request,
        { ok: false, error: "mission_table_introuvable", detail: error.message },
        { status: 503 },
      )
    }

    const c = count ?? 0
    return nextJsonWithCors(request, {
      ok: true,
      count: c,
      isFirstAction: c === 0,
    })
  } catch (e) {
    console.error("[mission-action-claims GET]", e)
    return nextJsonWithCors(request, { ok: false, error: "serveur" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await getUserFromRequest(request, supabase)
    if (authError || !user?.id) {
      return nextJsonWithCors(request, { ok: false, error: "non_authentifie" }, { status: 401 })
    }

    const { data, error } = await supabase.rpc("add_mission_action_points").single()
    if (error) {
      return nextJsonWithCors(
        request,
        { ok: false, error: "rpc_echec", detail: error.message, code: error.code },
        { status: 400 },
      )
    }

    const row = data as { new_points?: number; first_action?: boolean } | null
    return nextJsonWithCors(request, {
      ok: true,
      new_points: row?.new_points,
      first_action: row?.first_action ?? false,
    })
  } catch (e) {
    console.error("[mission-action-claims POST]", e)
    return nextJsonWithCors(request, { ok: false, error: "serveur" }, { status: 500 })
  }
}
