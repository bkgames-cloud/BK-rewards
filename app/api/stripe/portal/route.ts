import { stripe } from "@/lib/stripe"
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !user.email) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  try {
    // Rechercher le customer Stripe par email
    const search = await stripe.customers.search({
      query: `email:'${user.email}'`,
      limit: 1,
    })

    const customer = search.data[0]
    if (!customer) {
      return NextResponse.json({ error: "Client Stripe introuvable" }, { status: 404 })
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/dashboard`,
    })
    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error("[Stripe Portal] Error:", err)
    return NextResponse.json({ error: "Erreur Stripe" }, { status: 500 })
  }
}
