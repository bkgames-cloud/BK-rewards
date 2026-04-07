// Supabase Edge Function — envoie un e-mail support via Resend lors d’un INSERT sur `support_messages`.
// Déclenchement recommandé : Database Webhook Supabase (INSERT) → Function `send-support-email`.
//
// Payload attendu (webhook DB) : { record: { id, full_name, email, subject, message, created_at, ... }, table, type, schema }
// Fallback : { id } ou { record_id }.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

type WebhookPayload = {
  type?: string
  table?: string
  schema?: string
  record?: {
    id?: string
    full_name?: string
    email?: string
    subject?: string
    message?: string
    created_at?: string
    resend_sent?: boolean
    resend_error?: string | null
  }
  old_record?: unknown
  id?: string
  record_id?: string
}

const SUPPORT_TO = "support.bkgamers@gmail.com"
const RESEND_FROM = "BK Rewards <support@bkg-rewards.com>"

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

Deno.serve(async (req) => {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? ""

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json({ ok: false, error: "missing_supabase_env" }, 500)
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })

    const payload = (await req.json().catch(() => ({}))) as WebhookPayload
    const id =
      (typeof payload.record?.id === "string" ? payload.record.id.trim() : "") ||
      (typeof payload.id === "string" ? payload.id.trim() : "") ||
      (typeof payload.record_id === "string" ? payload.record_id.trim() : "")

    if (!id) {
      return json({ ok: false, error: "missing_record_id" }, 400)
    }

    const { data: row, error: qErr } = await supabase
      .from("support_messages")
      .select("id, full_name, email, subject, message, created_at, resend_sent, resend_error")
      .eq("id", id)
      .maybeSingle()

    if (qErr || !row) {
      return json({ ok: false, error: "support_message_not_found", detail: qErr?.message }, 404)
    }

    // Idempotence : si déjà envoyé, on ne renvoie pas.
    if (row.resend_sent === true) {
      return json({ ok: true, skipped: true, reason: "already_sent", id: row.id }, 200)
    }

    if (!RESEND_API_KEY) {
      await supabase
        .from("support_messages")
        .update({ resend_sent: false, resend_error: "missing_resend_key" })
        .eq("id", row.id)
      return json({ ok: true, skipped: true, reason: "missing_resend_key", id: row.id }, 200)
    }

    const safeName = escapeHtml(String(row.full_name ?? "").trim())
    const safeEmail = escapeHtml(String(row.email ?? "").trim())
    const safeSubject = escapeHtml(String(row.subject ?? "").trim() || "Support")
    const safeMessage = escapeHtml(String(row.message ?? "").trim())
    const createdAt = escapeHtml(String(row.created_at ?? ""))

    const subject = `[SUPPORT] ${safeSubject} — ${safeName || "Visiteur"}`
    const html = `
      <p><strong>Nom :</strong> ${safeName}</p>
      <p><strong>E-mail :</strong> <a href="mailto:${safeEmail}">${safeEmail}</a></p>
      <p><strong>ID :</strong> ${escapeHtml(row.id)}</p>
      <p><strong>Date :</strong> ${createdAt}</p>
      <hr/>
      <p><strong>Sujet :</strong> ${safeSubject}</p>
      <p style="white-space:pre-wrap;">${safeMessage}</p>
    `.trim()

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [SUPPORT_TO],
        subject,
        html,
        reply_to: safeEmail,
      }),
    })

    if (!r.ok) {
      const text = await r.text().catch(() => "")
      const detail = `resend_http_${r.status}: ${text.slice(0, 600)}`
      await supabase
        .from("support_messages")
        .update({ resend_sent: false, resend_error: detail })
        .eq("id", row.id)
      return json({ ok: false, error: "resend_failed", id: row.id, detail }, 502)
    }

    await supabase.from("support_messages").update({ resend_sent: true, resend_error: null }).eq("id", row.id)
    return json({ ok: true, id: row.id }, 200)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return json({ ok: false, error: "server_error", detail: msg.slice(0, 600) }, 500)
  }
})

