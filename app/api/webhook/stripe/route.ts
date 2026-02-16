import Stripe from "stripe"
import { createClient } from "@supabase/supabase-js"

export async function POST(req: Request) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const weeklyPriceId = process.env.STRIPE_PRICE_ID_HEBDO
  const monthlyPriceId = process.env.STRIPE_PRICE_ID_MENSUEL

  if (!stripeSecretKey || !webhookSecret || !supabaseUrl || !serviceRoleKey) {
    return new Response("Missing env vars", { status: 500 })
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" })
  const signature = req.headers.get("stripe-signature")
  if (!signature) {
    return new Response("Missing stripe-signature", { status: 400 })
  }

  const body = await req.text()
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch {
    return new Response("Invalid signature", { status: 400 })
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session
    const supabaseUserId = session.metadata?.supabase_user_id
    const priceId = session.metadata?.price_id
    console.log("[stripe-webhook] checkout.session.completed", {
      supabaseUserId,
      priceId,
      sessionId: session.id,
    })

    if (supabaseUserId && priceId) {
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
      const durationDays =
        priceId === weeklyPriceId ? 7 : priceId === monthlyPriceId ? 30 : 0
      const durationMs = durationDays * 24 * 60 * 60 * 1000
      const vipUntil = new Date(Date.now() + durationMs).toISOString()

      console.log("Update pour user:", supabaseUserId)

      const { error } = await supabaseAdmin
        .from("profiles")
        .update({
          is_vip: true,
          vip_until: vipUntil,
        })
        .eq("id", supabaseUserId)

      if (error) {
        console.error(error)
      } else {
        console.log("[stripe-webhook] Profile updated", {
          supabaseUserId,
          vip_until: vipUntil,
        })
      }
    } else {
      console.warn("[stripe-webhook] Missing metadata", {
        supabaseUserId,
        priceId,
      })
    }
  }

  return new Response("ok", { status: 200 })
}
