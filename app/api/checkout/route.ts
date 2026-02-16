import Stripe from "stripe"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  const weeklyPriceId = process.env.STRIPE_PRICE_ID_HEBDO
  const monthlyPriceId = process.env.STRIPE_PRICE_ID_MENSUEL
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

  if (!stripeSecretKey || !weeklyPriceId || !monthlyPriceId) {
    return new Response("Stripe env vars missing", { status: 500 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return new Response("Unauthorized", { status: 401 })
  }

  const { plan } = await req.json().catch(() => ({ plan: "monthly" }))
  const priceId = plan === "weekly" ? weeklyPriceId : monthlyPriceId

  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" })

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${siteUrl}/premium?success=1`,
    cancel_url: `${siteUrl}/premium?canceled=1`,
    metadata: {
      supabase_user_id: user.id,
      price_id: priceId,
      plan: plan === "weekly" ? "weekly" : "monthly",
    },
  })

  return Response.json({ url: session.url })
}
