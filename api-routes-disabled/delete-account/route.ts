import { NextResponse } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

/** CORS explicites (préflight OPTIONS + POST) — demandés pour éviter les blocages navigateur. */
const DELETE_ACCOUNT_CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

function jsonWithDeletionCors(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers)
  for (const [k, v] of Object.entries(DELETE_ACCOUNT_CORS)) {
    headers.set(k, v)
  }
  return NextResponse.json(body, { ...init, headers })
}

/** Session cookie ou `Authorization: Bearer` (app native). */
async function getUserFromRequest(
  request: Request,
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  try {
    const authHeader = request.headers.get("authorization")
    const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : ""
    if (bearer) {
      return supabase.auth.getUser(bearer)
    }
    return supabase.auth.getUser()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[delete-account] getUserFromRequest:", msg)
    return { data: { user: null }, error: e as Error }
  }
}

/** Tables avec `user_id` → profil ; supprimées avant `auth.admin.deleteUser` pour éviter les blocages FK. */
const USER_DATA_TABLES = [
  "winners",
  "tickets",
  "notifications",
  "video_views",
  "mission_action_claims",
  "rewards",
  "contributions",
  "history_leaderboard",
  "tap_tap_leaderboard",
  "rewards_pool_views",
  "rewards_pool_tickets",
] as const

function assertUserId(user: User | null): user is User & { id: string } {
  return Boolean(user?.id && typeof user.id === "string")
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: DELETE_ACCOUNT_CORS,
  })
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await getUserFromRequest(request, supabase)

    if (authError || !assertUserId(user)) {
      return jsonWithDeletionCors({ error: "non_authentifie" }, { status: 401 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

    if (!url || !serviceKey) {
      console.error("[delete-account] NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant")
      return jsonWithDeletionCors({ error: "configuration_serveur" }, { status: 500 })
    }

    const supabaseServiceRole = createServiceClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const uid = user.id

    try {
      for (const table of USER_DATA_TABLES) {
        try {
          const { error: tableErr } = await supabaseServiceRole.from(table).delete().eq("user_id", uid)
          if (tableErr) {
            console.warn(`[delete-account] ${table}:`, tableErr.message)
          }
        } catch (tableEx) {
          const msg = tableEx instanceof Error ? tableEx.message : String(tableEx)
          console.warn(`[delete-account] ${table} (exception):`, msg)
        }
      }

      const { error: delErr } = await supabaseServiceRole.auth.admin.deleteUser(uid)
      if (delErr) {
        console.error("[delete-account] admin.deleteUser:", delErr.message)
        return jsonWithDeletionCors(
          { error: "suppression_impossible", detail: delErr.message },
          { status: 500 },
        )
      }
    } catch (adminBlockErr) {
      const msg = adminBlockErr instanceof Error ? adminBlockErr.message : String(adminBlockErr)
      console.error("[delete-account] opérations admin:", msg)
      return jsonWithDeletionCors({ error: "suppression_impossible", detail: msg }, { status: 500 })
    }

    return jsonWithDeletionCors({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[delete-account] fatal:", msg)
    return jsonWithDeletionCors({ error: "serveur" }, { status: 500 })
  }
}
