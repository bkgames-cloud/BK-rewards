// Supabase Edge Function — vérifie un abonnement Google Play (Billing) et enregistre l’achat dans `public.purchases`.
// Appel côté app : supabase.functions.invoke('verify-google-purchase', { body: { packageName, productId, purchaseToken }})
//
// Secrets requis (Supabase → Functions → Secrets) :
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - GOOGLE_PLAY_SERVICE_ACCOUNT_JSON  (JSON complet du service account)
//
// Optionnel :
// - GOOGLE_PLAY_PACKAGE_NAME (fallback)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

type Body = {
  packageName?: string
  productId?: string
  purchaseToken?: string
}

const ACTIVE_SUBSCRIPTION_STATES = new Set(["SUBSCRIPTION_STATE_ACTIVE", "SUBSCRIPTION_STATE_IN_GRACE_PERIOD"])

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

async function importPrivateKeyFromServiceAccount(sa: Record<string, unknown>): Promise<CryptoKey> {
  const pk = String(sa.private_key ?? "")
  // service account JSON contient une clé PEM PKCS8
  const pem = pk.replaceAll("\\n", "\n").trim()
  const b64 = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replaceAll("\n", "")
    .trim()
  const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  return crypto.subtle.importKey(
    "pkcs8",
    der.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  )
}

function base64UrlEncode(data: Uint8Array): string {
  let s = ""
  for (let i = 0; i < data.length; i += 1) s += String.fromCharCode(data[i])
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")
}

async function signJwtRS256(params: {
  privateKey: CryptoKey
  header: Record<string, unknown>
  payload: Record<string, unknown>
}): Promise<string> {
  const enc = new TextEncoder()
  const headerB64 = base64UrlEncode(enc.encode(JSON.stringify(params.header)))
  const payloadB64 = base64UrlEncode(enc.encode(JSON.stringify(params.payload)))
  const toSign = `${headerB64}.${payloadB64}`
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", params.privateKey, enc.encode(toSign))
  return `${toSign}.${base64UrlEncode(new Uint8Array(sig))}`
}

async function getGoogleAccessToken(sa: Record<string, unknown>): Promise<string> {
  const clientEmail = String(sa.client_email ?? "")
  if (!clientEmail) throw new Error("missing_client_email")

  const privateKey = await importPrivateKeyFromServiceAccount(sa)
  const now = Math.floor(Date.now() / 1000)
  const jwt = await signJwtRS256({
    privateKey,
    header: { alg: "RS256", typ: "JWT" },
    payload: {
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/androidpublisher",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 55 * 60,
    },
  })

  const form = new URLSearchParams()
  form.set("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer")
  form.set("assertion", jwt)

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  })
  const t = await r.text()
  if (!r.ok) throw new Error(`google_oauth_http_${r.status}: ${t.slice(0, 400)}`)
  const j = JSON.parse(t) as { access_token?: string }
  if (!j.access_token) throw new Error("missing_access_token")
  return j.access_token
}

Deno.serve(async (req) => {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    const saJson = Deno.env.get("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON") ?? ""
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json({ ok: false, error: "missing_supabase_env" }, 500)
    if (!saJson) return json({ ok: false, error: "missing_google_sa_json" }, 503)

    const body = (await req.json().catch(() => ({}))) as Body
    const packageName =
      (typeof body.packageName === "string" && body.packageName.trim()) ||
      (Deno.env.get("GOOGLE_PLAY_PACKAGE_NAME") ?? "com.bkrewards.rewards")
    const productId = typeof body.productId === "string" ? body.productId.trim() : ""
    const purchaseToken = typeof body.purchaseToken === "string" ? body.purchaseToken.trim() : ""
    if (!productId || !purchaseToken) return json({ ok: false, error: "missing_fields" }, 400)

    // Auth user : la fonction doit être appelée avec une session (supabase-js) pour lier l’achat à l’utilisateur.
    const authHeader = req.headers.get("authorization") ?? ""
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : ""
    if (!jwt) return json({ ok: false, error: "non_authentifie" }, 401)

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })
    const { data: userRes, error: userErr } = await admin.auth.getUser(jwt)
    const userId = userRes?.user?.id
    if (userErr || !userId) return json({ ok: false, error: "non_authentifie" }, 401)

    let sa: Record<string, unknown>
    try {
      sa = JSON.parse(saJson) as Record<string, unknown>
    } catch {
      return json({ ok: false, error: "invalid_google_sa_json" }, 500)
    }

    const accessToken = await getGoogleAccessToken(sa)

    // Purchases Subscriptions v2 : GET
    const url =
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}` +
      `/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const raw = await r.text()
    if (!r.ok) return json({ ok: false, error: "google_api_error", detail: raw.slice(0, 600) }, 502)
    const sub = JSON.parse(raw) as {
      subscriptionState?: string
      lineItems?: Array<{ productId?: string; expiryTime?: string }>
    }

    const state = sub.subscriptionState ?? ""
    if (!ACTIVE_SUBSCRIPTION_STATES.has(state)) {
      return json({ ok: false, error: "abonnement_inactif", subscriptionState: state }, 400)
    }

    const match = (sub.lineItems ?? []).find((li) => (li.productId ?? "") === productId)
    if (!match) return json({ ok: false, error: "produit_incohérent" }, 400)

    const expiryIso = match.expiryTime ?? null
    const vipUntil = expiryIso ? new Date(expiryIso).toISOString() : null

    const { error: insErr } = await admin.from("purchases").insert({
      user_id: userId,
      purchase_token: purchaseToken,
      product_id: productId,
      status: "active",
      provider: "google",
      expiry_date: vipUntil,
    })

    if (insErr) {
      if (String(insErr.code) === "23505") {
        return json({ ok: true, vip_until: vipUntil, already_recorded: true }, 200)
      }
      return json({ ok: false, error: "purchase_insert_failed", detail: insErr.message }, 500)
    }

    return json({ ok: true, vip_until: vipUntil }, 200)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return json({ ok: false, error: "server_error", detail: msg.slice(0, 600) }, 500)
  }
})

