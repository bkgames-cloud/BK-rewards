import { NextResponse } from "next/server"

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = "onboarding@resend.dev"
const TO_EMAIL = "bkgamers@icloud.com"

export async function POST() {
  if (!RESEND_API_KEY) {
    return NextResponse.json({ error: "Missing RESEND_API_KEY" }, { status: 500 })
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [TO_EMAIL],
        subject: "🏆 [BKG Rewards] Test envoi email",
        html: `
          <p>Ceci est un test d'envoi Resend pour BKG Rewards.</p>
          <p>Si vous recevez ce message, la configuration email est OK.</p>
        `,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error("[SendEmail] Resend error:", error)
      return NextResponse.json({ error }, { status: 500 })
    }

    const data = await response.json()
    return NextResponse.json({ ok: true, data })
  } catch (error) {
    console.error("[SendEmail] Error:", error)
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 })
  }
}
