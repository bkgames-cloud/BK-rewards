// Supabase Edge Function — notifie support.bkgamers@gmail.com quand un ticket support est créé.
// Appel : supabase.functions.invoke('support-ticket-notify', { body: { ticketId } })

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

type Body = { ticketId?: string }

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

    // Auth facultative : le ticket peut être créé sans session (support public).
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })

    const body = (await req.json().catch(() => ({}))) as Body
    const ticketId = typeof body.ticketId === "string" ? body.ticketId.trim() : ""
    if (!ticketId) {
      return new Response(JSON.stringify({ ok: false, error: "ticket_id_requis" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    const { data: row, error } = await supabase
      .from("support_tickets")
      .select("id, user_id, name, email, subject, message, created_at")
      .eq("id", ticketId)
      .maybeSingle()

    if (error || !row) {
      return new Response(JSON.stringify({ ok: false, error: "ticket_introuvable" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      })
    }

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "missing_resend_key" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    const subject = `[SUPPORT] ${row.subject ?? "Nouveau ticket"}`
    const html = `
      <p><strong>Nom :</strong> ${row.name}</p>
      <p><strong>Email :</strong> ${row.email}</p>
      <p><strong>Ticket ID :</strong> ${row.id}</p>
      <p><strong>Date :</strong> ${row.created_at}</p>
      <hr/>
      <p style="white-space:pre-wrap;">${row.message}</p>
    `.trim()

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "BKG Rewards <support@bkg-rewards.com>",
        to: ["support.bkgamers@gmail.com"],
        subject,
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

    return new Response(JSON.stringify({ ok: true }), {
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

