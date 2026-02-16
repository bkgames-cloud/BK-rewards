import Stripe from "stripe"
import { createClient } from "@/lib/supabase/server"

export async function POST() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL

  if (!stripeSecretKey || !siteUrl) {
    return new Response("Stripe env vars missing", { status: 500 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return new Response("Unauthorized", { status: 401 })
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" })
  const search = await stripe.customers.search({
    query: `email:'${user.email}'`,
    limit: 1,
  })

  const customer = search.data[0]
  if (!customer) {
    return new Response("Stripe customer not found", { status: 404 })
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customer.id,
    return_url: `${siteUrl}/premium`,
  })

  return Response.json({ url: portalSession.url })
}
