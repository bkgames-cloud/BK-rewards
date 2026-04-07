import { NextResponse } from "next/server"
import { google } from "googleapis"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { GOOGLE_PLAY_VIP_MONTHLY_PRODUCT_ID } from "@/lib/payment-constants"

export const dynamic = "force-dynamic"

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

const ACTIVE_SUBSCRIPTION_STATES = new Set([
  "SUBSCRIPTION_STATE_ACTIVE",
  "SUBSCRIPTION_STATE_IN_GRACE_PERIOD",
])

type Body = {
  packageName?: string
  productId?: string
  purchaseToken?: string
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await getUserFromRequest(request, supabase)

    if (authError || !user?.id) {
      return NextResponse.json({ ok: false, error: "non_authentifie" }, { status: 401 })
    }

    let body: Body
    try {
      body = (await request.json()) as Body
    } catch {
      return NextResponse.json({ ok: false, error: "json_invalide" }, { status: 400 })
    }

    const packageName =
      typeof body.packageName === "string" && body.packageName.trim()
        ? body.packageName.trim()
        : process.env.GOOGLE_PLAY_PACKAGE_NAME?.trim() || "com.bkrewards.rewards"
    const productId = typeof body.productId === "string" ? body.productId.trim() : ""
    const purchaseToken = typeof body.purchaseToken === "string" ? body.purchaseToken.trim() : ""

    if (!purchaseToken || !productId) {
      return NextResponse.json({ ok: false, error: "champs_requis" }, { status: 400 })
    }

    const allowedProducts = new Set<string>([GOOGLE_PLAY_VIP_MONTHLY_PRODUCT_ID])
    const weeklyEnv = process.env.NEXT_PUBLIC_GOOGLE_PLAY_VIP_WEEKLY_ID?.trim()
    if (weeklyEnv) allowedProducts.add(weeklyEnv)
    if (!allowedProducts.has(productId)) {
      return NextResponse.json({ ok: false, error: "produit_non_autorisé" }, { status: 400 })
    }

    const saJson = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON?.trim()
    if (!saJson) {
      console.error("[verify-google-purchase] GOOGLE_PLAY_SERVICE_ACCOUNT_JSON manquant")
      return NextResponse.json({ ok: false, error: "configuration_google_play" }, { status: 503 })
    }

    let credentials: Record<string, unknown>
    try {
      credentials = JSON.parse(saJson) as Record<string, unknown>
    } catch {
      return NextResponse.json({ ok: false, error: "credentials_invalides" }, { status: 500 })
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/androidpublisher"],
    })

    const androidpublisher = google.androidpublisher({ version: "v3", auth })

    const { data: sub } = await androidpublisher.purchases.subscriptionsv2.get({
      packageName,
      token: purchaseToken,
    })

    const state = sub.subscriptionState ?? ""
    if (!ACTIVE_SUBSCRIPTION_STATES.has(state)) {
      return NextResponse.json(
        { ok: false, error: "abonnement_inactif", subscriptionState: state },
        { status: 400 },
      )
    }

    const lineItems = sub.lineItems ?? []
    const match = lineItems.find((li) => li.productId === productId)
    if (!match) {
      return NextResponse.json({ ok: false, error: "produit_incohérent" }, { status: 400 })
    }

    const expiryIso = match.expiryTime ?? null
    const vipUntil = expiryIso ? new Date(expiryIso).toISOString() : null

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) {
      return NextResponse.json({ ok: false, error: "configuration_serveur" }, { status: 500 })
    }

    const admin = createServiceClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { error: insErr } = await admin.from("purchases").insert({
      user_id: user.id,
      purchase_token: purchaseToken,
      product_id: productId,
      status: "active",
      provider: "google",
      expiry_date: vipUntil,
    })

    if (insErr) {
      if (String(insErr.code) === "23505") {
        return NextResponse.json({ ok: true, vip_until: vipUntil, already_recorded: true })
      }
      console.error("[verify-google-purchase] purchases insert:", insErr.message)
      return NextResponse.json({ ok: false, error: "enregistrement_achat" }, { status: 500 })
    }

    return NextResponse.json({ ok: true, vip_until: vipUntil })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[verify-google-purchase]", msg)
    return NextResponse.json({ ok: false, error: "serveur" }, { status: 500 })
  }
}
