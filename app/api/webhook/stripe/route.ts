import Stripe from "stripe"
import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const weeklyPriceId = process.env.STRIPE_PRICE_ID_HEBDO
  const monthlyPriceId = process.env.STRIPE_PRICE_ID_MENSUEL
  const vipPlusPriceId = process.env.STRIPE_PRICE_ID_VIP_PLUS

  if (!webhookSecret || !supabaseUrl || !serviceRoleKey) {
    console.error("[stripe-webhook] Missing env vars")
    return new Response("Missing env vars", { status: 500 })
  }

  const signature = req.headers.get("stripe-signature")
  if (!signature) {
    return new Response("Missing stripe-signature", { status: 400 })
  }

  const body = await req.text()
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error("[stripe-webhook] Invalid signature:", err)
    return new Response("Invalid signature", { status: 400 })
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

  // ─── Checkout Session terminée (premier paiement) ───
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session
    const supabaseUserId = session.metadata?.supabase_user_id
    const plan = session.metadata?.plan

    console.log("[stripe-webhook] checkout.session.completed", {
      supabaseUserId,
      plan,
      sessionId: session.id,
    })

    if (supabaseUserId) {
      await activateVip(supabaseAdmin, supabaseUserId, plan, weeklyPriceId, monthlyPriceId, vipPlusPriceId)
    } else {
      console.warn("[stripe-webhook] Missing supabase_user_id in metadata")
    }
  }

  // ─── Renouvellement d'abonnement réussi ───
  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object as Stripe.Invoice
    // Ne traiter que les renouvellements (pas le premier paiement)
    if (invoice.billing_reason === "subscription_cycle") {
      const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.toString()
      if (subscriptionId) {
        try {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          const supabaseUserId = subscription.metadata?.supabase_user_id
          const plan = subscription.metadata?.plan

          console.log("[stripe-webhook] invoice.payment_succeeded (renewal)", {
            supabaseUserId,
            plan,
          })

          if (supabaseUserId) {
            await activateVip(supabaseAdmin, supabaseUserId, plan, weeklyPriceId, monthlyPriceId, vipPlusPriceId)
          }
        } catch (err) {
          console.error("[stripe-webhook] Error retrieving subscription:", err)
        }
      }
    }
  }

  // ─── Abonnement annulé ou expiré ───
  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription
    const supabaseUserId = subscription.metadata?.supabase_user_id

    console.log("[stripe-webhook] customer.subscription.deleted", { supabaseUserId })

    if (supabaseUserId) {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({
          is_vip: false,
          is_vip_plus: false,
          vip_until: null,
        })
        .eq("id", supabaseUserId)

      if (error) {
        console.error("[stripe-webhook] Error deactivating VIP:", error)
      } else {
        console.log("[stripe-webhook] VIP deactivated for", supabaseUserId)
      }
    }
  }

  return NextResponse.json({ received: true })
}

// ─── Helper : activer le VIP dans Supabase ───
async function activateVip(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  plan: string | undefined,
  weeklyPriceId: string | undefined,
  monthlyPriceId: string | undefined,
  vipPlusPriceId: string | undefined,
) {
  const isVipPlus = plan === "vip_plus"
  const durationDays = plan === "weekly" ? 7 : 30
  const vipUntil = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString()

  const updateData: Record<string, unknown> = {
    is_vip: true,
    vip_until: vipUntil,
  }

  if (isVipPlus) {
    updateData.is_vip_plus = true
  }

  const { error } = await supabaseAdmin
    .from("profiles")
    .update(updateData)
    .eq("id", userId)

  if (error) {
    console.error("[stripe-webhook] Error activating VIP:", error)
  } else {
    console.log("[stripe-webhook] VIP activated", {
      userId,
      plan,
      vip_until: vipUntil,
      is_vip_plus: isVipPlus,
    })
  }
}
