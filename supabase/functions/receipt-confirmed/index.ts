// Supabase Edge Function (Deno) — envoi mail à l’admin quand un utilisateur confirme la réception.
// Appel côté client : supabase.functions.invoke('receipt-confirmed', { body: { winnerId } })

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

type Body = { winnerId?: string }

Deno.serve(async (req) => {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? ""

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ ok: false, error: "missing_supabase_env" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }

    const authHeader = req.headers.get("Authorization") ?? ""
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : ""
    if (!jwt) {
      return new Response(JSON.stringify({ ok: false, error: "non_authentifie" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false },
    })

    const { data: auth, error: authErr } = await supabase.auth.getUser()
    if (authErr || !auth?.user?.id) {
      return new Response(JSON.stringify({ ok: false, error: "non_authentifie" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    const body = (await req.json().catch(() => ({}))) as Body
    const winnerId = typeof body.winnerId === "string" ? body.winnerId.trim() : ""
    if (!winnerId) {
      return new Response(JSON.stringify({ ok: false, error: "winner_id_requis" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    const { data: row, error: qErr } = await supabase
      .from("winners")
      .select("id, user_id, status, winner_name, prize_name")
      .eq("id", winnerId)
      .eq("user_id", auth.user.id)
      .maybeSingle()

    if (qErr || !row) {
      return new Response(JSON.stringify({ ok: false, error: "gain_introuvable" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    const st = String(row.status ?? "").toLowerCase()
    if (st === "received") {
      return new Response(JSON.stringify({ ok: true, updated: true, already: true, mode: "receipt_confirmed" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    const { data: updated, error: upErr } = await supabase
      .from("winners")
      .update({ status: "received" })
      .eq("id", winnerId)
      .eq("user_id", auth.user.id)
      .select("id")

    if (upErr || !updated?.length) {
      return new Response(JSON.stringify({ ok: false, error: "mise_a_jour_impossible" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    if (!RESEND_API_KEY) {
      console.error("ERREUR : RESEND_API_KEY manquante (Edge Function receipt-confirmed)")
      return new Response(
        JSON.stringify({ ok: true, updated: true, skipped: true, mode: "receipt_confirmed" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )
    }

    const displayName = String(row.winner_name || "Un gagnant").trim() || "Un gagnant"
    const prize = String(row.prize_name || "Lot").trim() || "Lot"

    const mailSubject = `[BK Rewards] Réception confirmée — ${prize}`
    const html = `<p>Bonne nouvelle ! ${displayName} a confirmé la réception de son lot <strong>${prize}</strong>.</p>`

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "BK Rewards <support@bkg-rewards.com>",
        to: ["support.bkgamers@gmail.com"],
        subject: mailSubject,
        html,
      }),
    })

    if (!r.ok) {
      const text = await r.text().catch(() => "")
      return new Response(JSON.stringify({ ok: false, error: "resend_echec", detail: text.slice(0, 400) }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      })
    }

    return new Response(JSON.stringify({ ok: true, updated: true, mode: "receipt_confirmed" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ ok: false, error: "server_error", detail: msg.slice(0, 400) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})

