import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { stripe } from "@/lib/stripe"

type Body = { returnPath?: string }

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user?.email) {
      return NextResponse.json({ error: "non_authentifie" }, { status: 401 })
    }

    let body: Body = {}
    try {
      body = (await req.json()) as Body
    } catch {
      body = {}
    }

    const origin = (await headers()).get("origin") ?? ""
    const returnPath = typeof body.returnPath === "string" ? body.returnPath : "/"
    const returnUrl = origin ? `${origin}${returnPath.startsWith("/") ? returnPath : `/${returnPath}`}` : undefined

    const existing = await stripe.customers.list({ email: user.email, limit: 1 })
    const customer =
      existing.data[0] ??
      (await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      }))

    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      ...(returnUrl ? { return_url: returnUrl } : {}),
    })

    return NextResponse.json({ url: session.url })
  } catch (e) {
    console.error("[stripe-portal]", e)
    return NextResponse.json({ error: "serveur" }, { status: 500 })
  }
}

