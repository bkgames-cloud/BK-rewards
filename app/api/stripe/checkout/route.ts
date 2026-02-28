import { stripe } from "@/lib/stripe"
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// Chaque plan pointe uniquement vers une variable d'environnement — aucun hardcode
const PLANS: Record<string, { priceEnv: string; label: string }> = {
  weekly:   { priceEnv: "STRIPE_PRICE_ID_HEBDO",    label: "VIP Hebdomadaire" },
  monthly:  { priceEnv: "STRIPE_PRICE_ID_MENSUEL",  label: "VIP Mensuel" },
  vip_plus: { priceEnv: "STRIPE_PRICE_ID_VIP_PLUS", label: "VIP+ Mensuel" },
}

export async function POST(req: Request) {
  try {
    const rawUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL
    const siteUrl = rawUrl?.replace(/\/+$/, "") // supprime le slash final éventuel

    if (!siteUrl) {
      console.error("[stripe/checkout] NEXT_PUBLIC_SITE_URL manquant")
      return NextResponse.json({ error: "NEXT_PUBLIC_SITE_URL manquant" }, { status: 500 })
    }

    // ── Auth : récupérer l'utilisateur depuis la session serveur ──
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.id) {
      console.error("[stripe/checkout] Utilisateur non authentifié")
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    // ── Plan demandé ──
    const body = await req.json().catch(() => ({}))
    console.log("BODY REÇU PAR L'API:", body)
    const planKey = (body.plan as string) || "monthly"
    const planConfig = PLANS[planKey]

    if (!planConfig) {
      console.error(`[stripe/checkout] Plan invalide: "${planKey}"`)
      return NextResponse.json({ error: "Plan invalide" }, { status: 400 })
    }

    // ── Price ID depuis les variables d'environnement uniquement ──
    const priceId = process.env[planConfig.priceEnv]
    if (!priceId) {
      console.error(
        `[stripe/checkout] Price ID manquant pour le plan "${planKey}". ` +
        `Variable d'env: ${planConfig.priceEnv} = ${process.env[planConfig.priceEnv] ?? "(undefined)"}`
      )
      return NextResponse.json(
        { error: `Variable d'environnement ${planConfig.priceEnv} manquante` },
        { status: 500 },
      )
    }

    console.log(`[stripe/checkout] Création session: plan=${planKey}, priceId=${priceId}, user=${user.id}`)
    console.log("PRICE ID UTILISÉ:", priceId)

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/profile?subscription=success`,
      cancel_url: `${siteUrl}/profile?subscription=canceled`,
      customer_email: user.email ?? undefined,
      metadata: {
        supabase_user_id: user.id,
        plan: planKey,
      },
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          plan: planKey,
        },
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (err: unknown) {
    // ── Diagnostic complet : type d'erreur ──
    const isStripeError =
      err && typeof err === "object" && "type" in err && typeof (err as Record<string, unknown>).type === "string"

    if (isStripeError) {
      const se = err as { type: string; code?: string; message?: string; statusCode?: number; param?: string; raw?: unknown }
      console.error("[stripe/checkout] ❌ Erreur Stripe:", {
        type: se.type,
        code: se.code,
        message: se.message,
        statusCode: se.statusCode,
        param: se.param,
      })
      return NextResponse.json(
        {
          error: "Erreur Stripe",
          stripe_type: se.type,
          stripe_code: se.code,
          stripe_param: se.param,
          details: se.message || "Erreur Stripe inconnue",
          statusCode: se.statusCode,
        },
        { status: se.statusCode || 500 },
      )
    }

    // ── Erreur JS classique (env manquante, import cassé, etc.) ──
    const jsError = err instanceof Error ? err : null
    console.error("[stripe/checkout] ❌ Erreur inattendue:", {
      name: jsError?.name,
      message: jsError?.message,
      stack: jsError?.stack,
      raw: err,
    })
    return NextResponse.json(
      {
        error: "Erreur serveur",
        details: jsError?.message || String(err),
        errorType: jsError?.name || typeof err,
      },
      { status: 500 },
    )
  }
}
