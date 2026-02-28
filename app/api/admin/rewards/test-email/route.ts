import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const ADMIN_EMAIL = "bkgamers@icloud.com"

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    return NextResponse.json({ error: "Missing RESEND_API_KEY" }, { status: 500 })
  }

  const fromEmail = "onboarding@resend.dev"

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [ADMIN_EMAIL],
      subject: "🏆 [BKG Rewards] Test envoi email",
      html: `
        <p>Ceci est un test d'envoi Resend pour BKG Rewards.</p>
        <p>Si vous recevez ce message, la configuration email est OK.</p>
      `,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error("[AdminTestEmail] Resend error:", error)
    return NextResponse.json({ error }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
