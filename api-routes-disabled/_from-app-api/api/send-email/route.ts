import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/** Garantit que la route n’est pas traitée comme statique (évite 404 côté hébergeur). */
export const dynamic = "force-dynamic"
// Récap gagnants / support / confirmation réception → lib/admin-config.ts
import {
  ADMIN_NOTIFY_EMAIL,
  RECEIPT_CONFIRMATION_TO_EMAIL,
  SUPPORT_INBOX_EMAIL,
  emailMatchesAdmin,
} from "@/lib/admin-config"
import type { ProfileAddressColumns } from "@/lib/profile-address"

/** Expéditeur fixe — domaine vérifié Resend (jamais l’e-mail du visiteur). */
export const RESEND_FROM_ADDRESS = "support@bkg-rewards.com"
const RESEND_FROM = `BK Rewards <${RESEND_FROM_ADDRESS}>`

function getResendApiKey(): string | undefined {
  const k = process.env.RESEND_API_KEY
  return typeof k === "string" && k.trim() !== "" ? k.trim() : undefined
}

type LegacyBody = {
  to?: string
  subject?: string
  html?: string
  text?: string
}

type DrawBody = {
  mode: "draw"
  winnerEmail?: string
  winnerName?: string
  poolName?: string
} & Partial<Record<keyof ProfileAddressColumns, string | undefined>>

type PrizeShippedBody = {
  mode: "prize_shipped"
  winnerEmail?: string
  winnerName?: string
  poolName?: string
}

type SupportBody = {
  mode: "support"
  name?: string
  email?: string
  subject?: string
  message?: string
}

type ReceiptConfirmedBody = {
  mode: "receipt_confirmed"
  winnerId?: string
}

type Body = LegacyBody | DrawBody | PrizeShippedBody | SupportBody | ReceiptConfirmedBody

function isDrawBody(b: Body): b is DrawBody {
  return (b as DrawBody).mode === "draw"
}

function isPrizeShippedBody(b: Body): b is PrizeShippedBody {
  return (b as PrizeShippedBody).mode === "prize_shipped"
}

function isSupportBody(b: Body): b is SupportBody {
  return (b as SupportBody).mode === "support"
}

function isReceiptConfirmedBody(b: Body): b is ReceiptConfirmedBody {
  return (b as ReceiptConfirmedBody).mode === "receipt_confirmed"
}

/** Session cookie (même origine) ou `Authorization: Bearer <access_token>` (app native / domaine API différent). */
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

async function sendViaResend(
  to: string | string[],
  subject: string,
  html: string,
  options?: { replyTo?: string },
): Promise<{ ok: boolean; id?: string; err?: string }> {
  const key = getResendApiKey()
  if (!key) {
    console.error("[send-email] Resend: RESEND_API_KEY absente ou vide (process.env.RESEND_API_KEY).")
    return {
      ok: false,
      err: "missing_resend_api_key: définissez RESEND_API_KEY sur Vercel / l’hôte API.",
    }
  }
  const toList = Array.isArray(to) ? to : [to]
  const payload: Record<string, unknown> = {
    from: RESEND_FROM,
    to: toList,
    subject,
    html,
  }
  if (options?.replyTo && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(options.replyTo)) {
    payload.reply_to = options.replyTo
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const errText = await res.text()
      console.error("[send-email] Resend erreur API", {
        httpStatus: res.status,
        statusText: res.statusText,
        resendBody: errText.slice(0, 800),
        subject,
        from: RESEND_FROM,
      })
      return { ok: false, err: `resend_http_${res.status}: ${errText.slice(0, 600)}` }
    }
    let parsed: { id?: string } = {}
    try {
      const t = await res.text()
      if (t) parsed = JSON.parse(t) as { id?: string }
    } catch (e) {
      console.warn("[send-email] Réponse Resend non-JSON", e)
    }
    return { ok: true, id: parsed.id }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[send-email] sendViaResend exception (réseau / fetch)", e)
    return { ok: false, err: `exception: ${msg}` }
  }
}

/** Envoi e-mail (Resend). `from` = domaine vérifié ; `to` selon le mode. */
export async function POST(request: Request) {
  try {
    let body: Body
    try {
      body = (await request.json()) as Body
    } catch (e) {
      console.error("[send-email] JSON body invalide:", e)
      return NextResponse.json({ ok: false, error: "json_invalide" }, { status: 400 })
    }

    // Public, sans session : doit rester AVANT createClient() / auth.getUser().
    if (isSupportBody(body)) {
      const name = typeof body.name === "string" ? body.name.trim() : ""
      const fromEmail = typeof body.email === "string" ? body.email.trim() : ""
      const subjectLine = typeof body.subject === "string" ? body.subject.trim() : ""
      const message = typeof body.message === "string" ? body.message.trim() : ""
      if (!name || !fromEmail || !subjectLine || !message) {
        return NextResponse.json(
          { ok: false, error: "champs_requis: name, email, subject, message" },
          { status: 400 },
        )
      }
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)
      if (!emailOk) {
        return NextResponse.json({ ok: false, error: "email_invalide" }, { status: 400 })
      }

      const mailSubject = `[SUPPORT] Nouveau message de ${name}`
      const html = `
<p><strong>Sujet :</strong> ${escapeHtml(subjectLine)}</p>
<p><strong>E-mail pour répondre :</strong> <a href="mailto:${escapeHtml(fromEmail)}">${escapeHtml(fromEmail)}</a></p>
<hr/>
<p style="white-space:pre-wrap;">${escapeHtml(message)}</p>
`.trim()

      let emailSent = false
      let resendMessageId: string | undefined
      let resendErr: string | null = null

      const key = getResendApiKey()
      if (!key) {
        resendErr =
          "RESEND_API_KEY manquante ou vide côté serveur (Vercel → Environment Variables)."
        console.error("[send-email] Support —", resendErr)
      } else {
        try {
          const r = await sendViaResend(SUPPORT_INBOX_EMAIL, mailSubject, html, { replyTo: fromEmail })
          if (r.ok) {
            emailSent = true
            resendMessageId = r.id
          } else {
            resendErr = r.err ?? "resend_echec"
            console.error("[send-email] Échec Resend (support)", {
              from: RESEND_FROM,
              to: SUPPORT_INBOX_EMAIL,
              detail: r.err,
            })
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e)
          console.error("[send-email] Support — exception sendViaResend", e)
          resendErr = msg
        }
      }

      const supabase = await createClient()
      const { data: inserted, error: insertErr } = await supabase
        .from("support_messages")
        .insert({
          full_name: name,
          email: fromEmail,
          subject: subjectLine,
          message,
          resend_sent: emailSent,
          resend_error: resendErr,
        })
        .select("id")
        .maybeSingle()

      if (insertErr || !inserted?.id) {
        console.error("[send-email] Support — insert support_messages:", insertErr)
        return NextResponse.json(
          {
            ok: false,
            error: "sauvegarde_impossible",
            detail: insertErr?.message ?? "Impossible d’enregistrer le message.",
          },
          { status: 500 },
        )
      }

      return NextResponse.json({
        ok: true,
        id: resendMessageId,
        mode: "support",
        saved: true,
        support_message_id: inserted.id,
        email_sent: emailSent,
        resend_failed: !emailSent,
        detail: resendErr ?? undefined,
        from: RESEND_FROM_ADDRESS,
      })
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await getUserFromRequest(request, supabase)

    if (isReceiptConfirmedBody(body)) {
      if (authError || !user?.id) {
        return NextResponse.json({ ok: false, error: "non_authentifie" }, { status: 401 })
      }
      const wid = typeof body.winnerId === "string" ? body.winnerId.trim() : ""
      if (!wid) {
        return NextResponse.json({ ok: false, error: "winner_id_requis" }, { status: 400 })
      }
      const uid = user.id
      const { data: row, error: qErr } = await supabase
        .from("winners")
        .select("id, user_id, status, winner_name, prize_name")
        .eq("id", wid)
        .eq("user_id", uid)
        .maybeSingle()
      if (qErr || !row) {
        return NextResponse.json(
          { ok: false, error: "gain_introuvable" },
          { status: 400 },
        )
      }
      const st = String(row.status ?? "").toLowerCase()
      if (st === "received") {
        return NextResponse.json({ ok: true, mode: "receipt_confirmed", already: true })
      }
      // Aucune exigence « shipped » : pending, sent, shipped → received au clic utilisateur.
      const { data: updated, error: upErr } = await supabase
        .from("winners")
        .update({ status: "received" })
        .eq("id", wid)
        .eq("user_id", uid)
        .select("id")
      if (upErr || !updated?.length) {
        return NextResponse.json(
          { ok: false, error: "mise_a_jour_impossible" },
          { status: 400 },
        )
      }

      const displayName = String(row.winner_name || "Un gagnant").trim() || "Un gagnant"
      const prize = String(row.prize_name || "Lot").trim() || "Lot"
      if (!getResendApiKey()) {
        console.warn("[send-email] receipt_confirmed — clé Resend manquante.")
        return NextResponse.json({
          ok: true,
          skipped: true,
          message: "RESEND_API_KEY non configure — aucun envoi.",
          mode: "receipt_confirmed",
        })
      }
      const mailSubject = `[BK Rewards] Réception confirmée — ${prize}`
      const html = `<p>Bonne nouvelle ! ${escapeHtml(displayName)} a confirmé la réception de son lot ${escapeHtml(prize)}.</p>`
      // `to` : iCloud uniquement pour cette alerte. Contact / support : SUPPORT_INBOX_EMAIL (Gmail).
      const mail = await sendViaResend(RECEIPT_CONFIRMATION_TO_EMAIL, mailSubject, html)
      if (!mail.ok) {
        return NextResponse.json(
          { ok: false, error: "resend_echec", detail: mail.err?.slice(0, 500) },
          { status: 502 },
        )
      }
      return NextResponse.json({ ok: true, id: mail.id, mode: "receipt_confirmed" })
    }

    if (authError || !user?.email) {
      return NextResponse.json({ ok: false, error: "non_authentifie" }, { status: 401 })
    }

    if (!user.email || !emailMatchesAdmin(user.email)) {
      return NextResponse.json({ ok: false, error: "interdit" }, { status: 403 })
    }

    if (!getResendApiKey()) {
      console.warn("[send-email] clé Resend manquante — aucun appel Resend.")
      return NextResponse.json({
        ok: true,
        skipped: true,
        message: "RESEND_API_KEY non configure — aucun envoi.",
      })
    }

    if (isDrawBody(body)) {
      const winnerName = typeof body.winnerName === "string" ? body.winnerName.trim() : "Gagnant"
      const poolName = typeof body.poolName === "string" ? body.poolName.trim() : "Lot"
      const winnerEmail =
        typeof body.winnerEmail === "string" && body.winnerEmail.trim() !== ""
          ? body.winnerEmail.trim()
          : ""

      const ids: string[] = []
      const errors: string[] = []

      const mailLabel = winnerEmail || "e-mail inconnu"
      const subj2 = `[BK Rewards] Lot « ${poolName} » — ${winnerName} (${mailLabel})`
      const street = typeof body.adresse === "string" ? body.adresse.trim() : ""
      const cp = typeof body.code_postal === "string" ? body.code_postal.trim() : ""
      const city = typeof body.ville === "string" ? body.ville.trim() : ""
      const html2 = `
<h2>Détails livraison (admin)</h2>
<p><strong>Gagnant :</strong> ${escapeHtml(winnerName)}</p>
<p><strong>E-mail :</strong> ${escapeHtml(mailLabel)}</p>
<p><strong>Rue :</strong> ${street ? escapeHtml(street) : "— (non renseignée)"}</p>
<p><strong>Code postal :</strong> ${cp ? escapeHtml(cp) : "—"}</p>
<p><strong>Ville :</strong> ${city ? escapeHtml(city) : "—"}</p>
<hr/>
<p>Le lot <strong>${escapeHtml(poolName)}</strong> vient d’être attribué. Tu peux expédier le lot à l’adresse ci-dessus.</p>
`.trim()

      if (winnerEmail) {
        const subj1 = `Félicitations ! Tu as gagné le lot ${poolName}`
        const html1 = `<p>${subj1}</p><p>Bonjour ${escapeHtml(winnerName)},</p><p>Tu peux suivre ton gain dans l'application BK Rewards.</p>`
        const [r1, r2] = await Promise.all([
          sendViaResend(winnerEmail, subj1, html1),
          sendViaResend(ADMIN_NOTIFY_EMAIL, subj2, html2),
        ])
        if (r1.ok && r1.id) ids.push(r1.id)
        if (!r1.ok) errors.push(`gagnant: ${r1.err ?? "echec"}`)
        if (r2.ok && r2.id) ids.push(r2.id)
        if (!r2.ok) errors.push(`admin: ${r2.err ?? "echec"}`)
      } else {
        const r2 = await sendViaResend(ADMIN_NOTIFY_EMAIL, subj2, html2)
        if (r2.ok && r2.id) ids.push(r2.id)
        if (!r2.ok) errors.push(`admin: ${r2.err ?? "echec"}`)
      }

      if (errors.length > 0) {
        return NextResponse.json(
          { ok: false, error: "resend_partiel", detail: errors.join("; ") },
          { status: 502 },
        )
      }
      return NextResponse.json({ ok: true, ids, mode: "draw" })
    }

    if (isPrizeShippedBody(body)) {
      const winnerName = typeof body.winnerName === "string" ? body.winnerName.trim() : "Gagnant"
      const poolName = typeof body.poolName === "string" ? body.poolName.trim() : "Lot"
      const winnerEmail =
        typeof body.winnerEmail === "string" && body.winnerEmail.trim() !== ""
          ? body.winnerEmail.trim()
          : ""

      if (!winnerEmail) {
        return NextResponse.json(
          { ok: false, error: "email_gagnant_requis" },
          { status: 400 },
        )
      }

      const subject = `Bonne nouvelle ! Ton lot ${poolName} a été expédié`
      const html = `
<p>Bonjour ${escapeHtml(winnerName)},</p>
<p>Bonne nouvelle ! Ton lot <strong>${escapeHtml(poolName)}</strong> a été expédié. Il arrivera bientôt chez toi.</p>
`.trim()

      const r = await sendViaResend(winnerEmail, subject, html)
      if (!r.ok) {
        return NextResponse.json(
          { ok: false, error: "resend_echec", detail: r.err?.slice(0, 500) },
          { status: 502 },
        )
      }
      return NextResponse.json({ ok: true, id: r.id, mode: "prize_shipped" })
    }

    const to = typeof (body as LegacyBody).to === "string" ? (body as LegacyBody).to!.trim() : ""
    const subject = typeof (body as LegacyBody).subject === "string" ? (body as LegacyBody).subject!.trim() : ""
    const html = typeof (body as LegacyBody).html === "string" ? (body as LegacyBody).html : undefined
    const text = typeof (body as LegacyBody).text === "string" ? (body as LegacyBody).text : undefined

    if (!to || !subject || (!html && !text)) {
      return NextResponse.json(
        { ok: false, error: "champs_requis: to, subject, html ou text" },
        { status: 400 },
      )
    }

    const legacyKey = getResendApiKey()
    if (!legacyKey) {
      console.error("[send-email] Legacy — clé Resend manquante, envoi annulé.")
      return NextResponse.json(
        { ok: false, error: "resend_non_configure", detail: "resend_non_configure" },
        { status: 503 },
      )
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${legacyKey}`,
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [to],
        subject,
        ...(html ? { html } : {}),
        ...(text ? { text } : {}),
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error("[send-email] Resend erreur API (legacy)", {
        httpStatus: res.status,
        statusText: res.statusText,
        resendBody: errText.slice(0, 400),
        subject,
      })
      return NextResponse.json(
        { ok: false, error: "resend_echec", detail: errText.slice(0, 500) },
        { status: 502 },
      )
    }

    let data: { id?: string } = {}
    try {
      const t = await res.text()
      if (t) data = JSON.parse(t) as { id?: string }
    } catch (e) {
      console.warn("[send-email] Réponse OK mais JSON invalide", e)
    }
    return NextResponse.json({ ok: true, id: data.id })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[send-email] POST exception:", e)
    return NextResponse.json(
      { ok: false, error: "serveur", detail: msg },
      { status: 500 },
    )
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
