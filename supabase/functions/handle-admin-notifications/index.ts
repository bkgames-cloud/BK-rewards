// Supabase Edge Function — envoi e-mails admin via Resend (support + confirmations).
//
// Cette function est prévue pour être appelée par :
// - un Database Webhook Supabase (INSERT sur support_tickets / notifications_admin), ou
// - un appel manuel `supabase.functions.invoke('handle-admin-notifications', { body: ... })`.
//
// Body attendu (au choix) :
// 1) { table: "support_tickets", record: { full_name, email, subject, message } }
// 2) { table: "notifications_admin", record: { type, payload, target_email? } }
// 3) { table: "...", id: "<uuid>" } → la function tentera de relire la ligne en DB (service role).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

type SupportTicketRecord = {
  id?: string
  full_name?: string
  email?: string
  subject?: string
  message?: string
  created_at?: string
}

type AdminNotificationRecord = {
  id?: string
  type?: string
  target_email?: string
  payload?: unknown
  created_at?: string
}

type Body =
  | { table: "support_tickets"; record?: SupportTicketRecord; id?: string }
  | { table: "notifications_admin"; record?: AdminNotificationRecord; id?: string }
  | { table?: string; record?: Record<string, unknown>; id?: string }

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  })
}

const RESEND_FROM = "BK Rewards <support@bkg-rewards.com>"
const RESEND_TO = "support.bkgamers@gmail.com"

async function sendViaResend(subject: string, html: string) {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? ""
  if (!RESEND_API_KEY) {
    console.error("ERREUR : RESEND_API_KEY manquante (Edge Function handle-admin-notifications)")
    return { ok: false as const, status: 500, error: "missing_resend_api_key" }
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [RESEND_TO],
      subject,
      html,
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    return { ok: false as const, status: res.status, error: text.slice(0, 600) }
  }
  return { ok: true as const }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

Deno.serve(async (req) => {
  try {
    const body = (await req.json().catch(() => ({}))) as Body
    const table = typeof body.table === "string" ? body.table : ""

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    const canFetchDb = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)

    const supabase = canFetchDb
      ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
      : null

    if (table === "support_tickets") {
      let rec: SupportTicketRecord | null =
        body.record && typeof body.record === "object" ? (body.record as SupportTicketRecord) : null
      const id = typeof body.id === "string" ? body.id.trim() : ""
      if (!rec && id && supabase) {
        const { data } = await supabase
          .from("support_tickets")
          .select("id, full_name, email, subject, message, created_at")
          .eq("id", id)
          .maybeSingle()
        rec = (data as SupportTicketRecord | null) ?? null
      }
      if (!rec) return json({ ok: false, error: "support_ticket_missing_record" }, 400)

      const fullName = String(rec.full_name ?? "").trim() || "Utilisateur"
      const fromEmail = String(rec.email ?? "").trim() || "—"
      const subjectLine = String(rec.subject ?? "").trim() || "Sans sujet"
      const message = String(rec.message ?? "").trim() || "—"

      const mailSubject = `Nouveau Ticket Support — ${fullName}`
      const html = `
        <p><strong>Nom :</strong> ${escapeHtml(fullName)}</p>
        <p><strong>Email :</strong> ${escapeHtml(fromEmail)}</p>
        <p><strong>Sujet :</strong> ${escapeHtml(subjectLine)}</p>
        <hr/>
        <p style="white-space:pre-wrap;">${escapeHtml(message)}</p>
      `.trim()

      const r = await sendViaResend(mailSubject, html)
      if (!r.ok) return json({ ok: false, error: "resend_failed", detail: r }, 502)
      return json({ ok: true, mode: "support_tickets", to: RESEND_TO })
    }

    if (table === "notifications_admin") {
      let rec: AdminNotificationRecord | null =
        body.record && typeof body.record === "object" ? (body.record as AdminNotificationRecord) : null
      const id = typeof body.id === "string" ? body.id.trim() : ""
      if (!rec && id && supabase) {
        const { data } = await supabase
          .from("notifications_admin")
          .select("id, type, target_email, payload, created_at")
          .eq("id", id)
          .maybeSingle()
        rec = (data as AdminNotificationRecord | null) ?? null
      }
      if (!rec) return json({ ok: false, error: "admin_notification_missing_record" }, 400)

      const type = String(rec.type ?? "").trim()
      if (type !== "receipt_confirmed") {
        return json({ ok: true, skipped: true, reason: "unsupported_type", type })
      }

      const payloadPretty = escapeHtml(JSON.stringify(rec.payload ?? {}, null, 2))

      const mailSubject = "Confirmation Réception Lot"
      const html = `
        <p>Un utilisateur a confirmé la réception d'un lot.</p>
        <p><strong>Type :</strong> ${escapeHtml(type)}</p>
        <p><strong>target_email (DB) :</strong> ${escapeHtml(String(rec.target_email ?? ""))}</p>
        <hr/>
        <pre style="white-space:pre-wrap;background:#0b0b0b;color:#eaeaea;padding:12px;border-radius:8px;">${payloadPretty}</pre>
      `.trim()

      const r = await sendViaResend(mailSubject, html)
      if (!r.ok) return json({ ok: false, error: "resend_failed", detail: r }, 502)
      return json({ ok: true, mode: "notifications_admin", to: RESEND_TO })
    }

    return json({ ok: false, error: "unsupported_table", table }, 400)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return json({ ok: false, error: "server_error", detail: msg.slice(0, 800) }, 500)
  }
})

