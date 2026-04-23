import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}

function getParam(u: URL, names: string[]): string {
  for (const n of names) {
    const v = u.searchParams.get(n)
    if (v && v.trim()) return v.trim()
  }
  return ""
}

function parseIntSafe(v: string): number | null {
  const n = Number.parseInt(v, 10)
  if (!Number.isFinite(n)) return null
  return n
}

Deno.serve(async (req) => {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    const REVLUM_POSTBACK_SECRET = (Deno.env.get("REVLUM_POSTBACK_SECRET") ?? "").trim()
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json({ ok: false, error: "missing_supabase_env" }, 500)
    if (!REVLUM_POSTBACK_SECRET) return json({ ok: false, error: "missing_postback_secret" }, 503)

    const url = new URL(req.url)
    const secret = getParam(url, ["secret", "key", "token"])
    if (secret !== REVLUM_POSTBACK_SECRET) return json({ ok: false, error: "unauthorized" }, 401)

    const userId = getParam(url, ["user_id", "userid", "uid", "subid", "sub_id"])
    const pointsRaw = getParam(url, ["points", "amount", "payout"])
    const externalId = getParam(url, ["transaction_id", "txid", "event_id", "id"]) || crypto.randomUUID()

    const delta = parseIntSafe(pointsRaw)
    if (!userId) return json({ ok: false, error: "missing_user_id" }, 400)
    if (delta == null) return json({ ok: false, error: "missing_points" }, 400)
    if (delta <= 0) return json({ ok: false, error: "invalid_points" }, 400)

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

    // Idempotence + crédit atomique (table events + solde profiles)
    const { data, error } = await admin.rpc("apply_offerwall_postback", {
      p_provider: "revlum",
      p_external_id: externalId,
      p_user_id: userId,
      p_points: delta,
      p_raw: Object.fromEntries(url.searchParams.entries()),
    })

    if (error) {
      const msg = (error.message || "").toLowerCase()
      if (msg.includes("profile_not_found")) return json({ ok: false, error: "profile_not_found" }, 404)
      return json({ ok: false, error: "rpc_failed", detail: error.message }, 500)
    }

    const row = Array.isArray(data) ? data[0] : data
    const applied = Boolean(row?.applied)
    const alreadyApplied = Boolean(row?.already_applied)
    const pointsBalance = typeof row?.points_balance === "number" ? row.points_balance : null

    return json({
      ok: true,
      provider: "revlum",
      user_id: userId,
      external_id: externalId,
      credited: applied ? delta : 0,
      already_credited: alreadyApplied,
      points_balance: pointsBalance,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return json({ ok: false, error: "server_error", detail: msg.slice(0, 600) }, 500)
  }
})

