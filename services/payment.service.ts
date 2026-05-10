import { Capacitor } from "@capacitor/core"
import { App } from "@capacitor/app"
import {
  ANDROID_PACKAGE_NAME,
  GOOGLE_PLAY_VIP_MONTHLY_PRODUCT_ID,
  GOOGLE_PLAY_VIP_PLUS_MONTHLY_PRODUCT_ID,
  GOOGLE_PLAY_VIP_PLUS_WEEKLY_PRODUCT_ID,
  GOOGLE_PLAY_VIP_WEEKLY_PRODUCT_ID,
} from "@/lib/payment-constants"
import { createClient } from "@/lib/supabase/client"

/**
 * Doit être invoquée avant toute lecture des variables / SDK Stripe (côté navigateur).
 * Sur Android natif : sortie immédiate — aucune clé ni `NEXT_PUBLIC_STRIPE_*` n’est consulté.
 */
export function initializeStripe(): unknown[] {
  const isAndroid =
    typeof window !== "undefined" &&
    Capacitor.isNativePlatform() &&
    Capacitor.getPlatform() === "android"
  if (isAndroid) return []
  return []
}

/**
 * WebView embarquée (Capacitor et/ou Cordova) sur Android — utile quand `isNativePlatform()` n’est pas encore fiable.
 * Permet de masquer les messages d’erreur liés à Stripe alors que le billing réel est Google Play.
 */
export function isAndroidEmbeddedPaymentShell(): boolean {
  if (typeof window === "undefined") return false
  try {
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") return true
  } catch {
    /* Capacitor pas prêt */
  }
  try {
    const p = (
      window as unknown as {
        Capacitor?: { getPlatform?: () => string }
      }
    ).Capacitor
    if (p?.getPlatform?.() === "android") return true
  } catch {
    /* ignore */
  }
  return !!(
    (window as Window & { cordova?: unknown }).cordova &&
    typeof navigator !== "undefined" &&
    /Android/i.test(navigator.userAgent)
  )
}

/** Erreurs configuration / portail Stripe (pas des erreurs Google Play). */
export function isStripeInfrastructureUserMessage(text: string): boolean {
  return (
    /NEXT_PUBLIC_STRIPE/i.test(text) ||
    /Paiement Stripe indisponible/i.test(text) ||
    /Portail Stripe indisponible/i.test(text) ||
    /Paiement VIP\+ indisponible.*STRIPE/i.test(text) ||
    /lien Stripe/i.test(text)
  )
}

/** `null` = ne rien afficher (toasts / bandeau) sur l’app Android embarquée. */
export function filterSubscriptionBannerMessage(text: string | null | undefined): string | null {
  if (!text?.trim()) return null
  const t = text.trim()
  if (isAndroidEmbeddedPaymentShell() && isStripeInfrastructureUserMessage(t)) return null
  return t
}

/**
 * Paiements hybrides (Web / Android natif Capacitor)
 *
 * **Web** : redirection vers les liens Stripe (`NEXT_PUBLIC_STRIPE_*_LINK`).
 *
 * **Android** : achats Google Play Billing via **`cordova-plugin-purchase`** (expose `window.CdvPurchase`).
 * Validation avec l’Edge `verify-google-purchase` puis `finish()` / acknowledgement côté plugin.
 */

export type SubscribePlan = "weekly" | "monthly" | "vip_plus_monthly" | "vip_plus_weekly"
export type VipBillingPeriod = "weekly" | "monthly"

export type AndroidPriceLabels = {
  weekly: string
  monthly: string
  vipPlusWeekly: string
  vipPlusMonthly: string
}

const GOOGLE_PURCHASE_TOKEN_CACHE_KEY = "bk_gp_purchase_tokens_v1"

const ALL_GOOGLE_PLAY_VIP_PRODUCT_IDS = [
  GOOGLE_PLAY_VIP_WEEKLY_PRODUCT_ID,
  GOOGLE_PLAY_VIP_MONTHLY_PRODUCT_ID,
  GOOGLE_PLAY_VIP_PLUS_WEEKLY_PRODUCT_ID,
  GOOGLE_PLAY_VIP_PLUS_MONTHLY_PRODUCT_ID,
]

function readCachedGooglePurchaseTokens(): Record<string, string> {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(GOOGLE_PURCHASE_TOKEN_CACHE_KEY) || ""
    const json = raw ? (JSON.parse(raw) as unknown) : null
    if (!json || typeof json !== "object") return {}
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(json as Record<string, unknown>)) {
      if (typeof k === "string" && typeof v === "string" && k.trim() && v.trim()) {
        out[k.trim()] = v.trim()
      }
    }
    return out
  } catch {
    return {}
  }
}

function writeCachedGooglePurchaseToken(productId: string, purchaseToken: string) {
  if (typeof window === "undefined") return
  const next = { ...readCachedGooglePurchaseTokens(), [productId]: purchaseToken }
  try {
    window.localStorage.setItem(GOOGLE_PURCHASE_TOKEN_CACHE_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

async function waitForNativePurchaseBridge(): Promise<void> {
  if (typeof window === "undefined") return
  try {
    await App.getInfo()
  } catch {
    /* Web / pas encore prêt */
  }
  await new Promise<void>((resolve) => {
    if (typeof document === "undefined") {
      resolve()
      return
    }
    const w = window as Window & { cordova?: unknown }
    if (w.cordova) {
      document.addEventListener("deviceready", () => resolve(), { once: true })
      setTimeout(resolve, 4000)
    } else {
      resolve()
    }
  })
}

type CdvWindow = Window & { CdvPurchase?: Record<string, unknown> }

function getCordovaPurchaseApi(): {
  store: CordovaStore
  ProductType: { PAID_SUBSCRIPTION: string }
  Platform: { GOOGLE_PLAY: string }
  ErrorCode: { PAYMENT_CANCELLED: number }
} {
  const Cdv = (window as CdvWindow).CdvPurchase
  const store = Cdv?.store as CordovaStore | undefined
  if (!Cdv || !store || typeof store.register !== "function") {
    throw new Error(
      "Paiement Google Play indisponible (plugin cordova-plugin-purchase non chargé dans la WebView).",
    )
  }
  return Cdv as {
    store: CordovaStore
    ProductType: { PAID_SUBSCRIPTION: string }
    Platform: { GOOGLE_PLAY: string }
    ErrorCode: { PAYMENT_CANCELLED: number }
  }
}

/** Minimiser la surface typings — API v13 `cordova-plugin-purchase`. */
type CordovaWhenChain = {
  approved: (cb: (transaction: CordovaTransaction) => void | Promise<void>, name?: string) => CordovaWhenChain
}

type CordovaStore = {
  register: (products: Array<{ id: string; type: string; platform: string }> | Record<string, unknown>) => void
  initialize: (platforms: string[]) => Promise<unknown>
  ready: (cb: () => void) => void
  readonly isReady?: boolean
  get: (productId: string, platform?: string) => CordovaProduct | undefined
  when: () => CordovaWhenChain
  off: (cb: (...args: unknown[]) => unknown) => void
  error: (cb: (err: CordovaPurchaseError) => void) => void
}

type CordovaOffer = {
  order: (additionalData?: unknown) => Promise<unknown>
}

type CordovaProduct = {
  getOffer?: (id?: string) => CordovaOffer | undefined
  offers?: Array<{ pricingPhases?: Array<{ price?: string | null; priceMicros?: number; currency?: string }> }>
}

type CordovaTransaction = {
  products?: Array<{ id?: string }>
  nativePurchase?: { purchaseToken?: string }
  finish: () => Promise<unknown>
}

type CordovaPurchaseError = { code?: number; message?: string; isError?: boolean; productId?: string | null }

let cordovaStoreInitPromise: Promise<void> | null = null

function pickCordovaFormattedPrice(product: CordovaProduct | undefined): string | null {
  const offers = product?.offers
  if (!Array.isArray(offers) || offers.length === 0) return null
  for (const offer of offers) {
    const phases = offer.pricingPhases
    if (!Array.isArray(phases)) continue
    for (let i = phases.length - 1; i >= 0; i--) {
      const price = phases[i]?.price
      if (typeof price === "string" && price.trim()) return price.trim()
    }
  }
  return null
}

async function ensureCordovaGooglePlayStoreReady(): Promise<void> {
  if (cordovaStoreInitPromise) return cordovaStoreInitPromise

  cordovaStoreInitPromise = (async () => {
    await waitForNativePurchaseBridge()
    const { store, ProductType, Platform } = getCordovaPurchaseApi()
    store.register(
      ALL_GOOGLE_PLAY_VIP_PRODUCT_IDS.map((id) => ({
        id,
        type: ProductType.PAID_SUBSCRIPTION,
        platform: Platform.GOOGLE_PLAY,
      })),
    )
    await store.initialize([Platform.GOOGLE_PLAY])
    await new Promise<void>((resolve) => {
      if (store.isReady) resolve()
      else store.ready(() => resolve())
    })
  })().catch((e) => {
    cordovaStoreInitPromise = null
    throw e
  })

  return cordovaStoreInitPromise
}

async function purchaseAndroidSubscriptionWithCordova(
  productId: string,
  accessToken: string | null | undefined,
): Promise<void> {
  try {
    if (!accessToken?.trim()) {
      throw new Error("Session requise pour valider l’achat sur le serveur.")
    }

    await ensureCordovaGooglePlayStoreReady()
    const { store, Platform, ErrorCode } = getCordovaPurchaseApi()

    const product = store.get(productId, Platform.GOOGLE_PLAY)
    const offer = product?.getOffer?.()
    if (!offer?.order || typeof offer.order !== "function") {
      throw new Error(
        "Abonnement indisponible pour le moment (produit en cours de validation sur Google Play). Réessaie plus tard.",
      )
    }

    await new Promise<void>((resolve, reject) => {
      let settled = false
      let timeoutId: ReturnType<typeof setTimeout> | undefined

      let onApproved!: (transaction: CordovaTransaction) => Promise<void>

      function cleanup() {
        store.off(onApproved as (...args: unknown[]) => unknown)
        store.off(onStoreErrorFn)
        if (timeoutId) window.clearTimeout(timeoutId)
      }

      function done(fn: () => void) {
        if (settled) return
        settled = true
        cleanup()
        fn()
      }

      const onStoreError = (err: CordovaPurchaseError) => {
        const errPid = typeof err?.productId === "string" ? err.productId : null
        if (errPid && errPid !== productId) return
        if (typeof err?.code !== "number") return
        if (ErrorCode?.PAYMENT_CANCELLED !== undefined && err.code === ErrorCode.PAYMENT_CANCELLED) {
          done(() => reject(new Error("Achat annulé.")))
          return
        }
        const msg =
          typeof err?.message === "string" && err.message.trim()
            ? err.message.trim()
            : "Erreur Google Play Billing."
        done(() => reject(new Error(msg)))
      }

      const onStoreErrorFn = onStoreError as (...args: unknown[]) => unknown

      onApproved = async (transaction: CordovaTransaction) => {
        try {
          const pid = transaction?.products?.[0]?.id
          const tok =
            typeof transaction?.nativePurchase?.purchaseToken === "string"
              ? transaction.nativePurchase.purchaseToken.trim()
              : ""
          if (pid !== productId || !tok) return

          writeCachedGooglePurchaseToken(productId, tok)

          const supabase = createClient()
          const { data: fnRes, error: fnErr } = await supabase.functions.invoke("verify-google-purchase", {
            body: {
              packageName: ANDROID_PACKAGE_NAME,
              productId,
              purchaseToken: tok,
            },
          })
          if (fnErr) throw new Error(fnErr.message || "Échec de la validation serveur.")
          if (!fnRes || (fnRes as { ok?: boolean; error?: string }).ok !== true) {
            const errMsg = (fnRes as { error?: string } | null)?.error || "Échec de la validation serveur."
            throw new Error(errMsg)
          }

          await transaction.finish()
          done(() => resolve())
        } catch (e) {
          done(() => reject(e instanceof Error ? e : new Error(String(e))))
        }
      }

      store.error(onStoreError)
      store.when().approved(onApproved, "purchaseAndroidSubscriptionWithCordova")
      timeoutId = setTimeout(() => {
        done(() => reject(new Error("Délai dépassé pour finaliser l’achat Google Play.")))
      }, 120000)

      void Promise.resolve()
        .then(() => offer.order())
        .catch((e: unknown) => {
          done(() =>
            reject(
              e instanceof Error ? e : new Error(typeof e === "string" ? e : "Impossible de lancer l’achat."),
            ),
          )
        })
    })
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e)
    if (raw.includes("introuvable") || raw.includes("Produit Google Play")) {
      throw new Error(
        "Abonnement indisponible pour le moment (produit en cours de validation sur Google Play). Réessaie plus tard.",
      )
    }
    if (
      raw.includes("Google Play") ||
      raw.includes("Billing") ||
      raw.includes("cordova-plugin-purchase") ||
      raw.includes("CdvPurchase")
    ) {
      throw new Error(raw)
    }
    throw new Error("Impossible de finaliser l’achat pour le moment. Réessaie plus tard.")
  }
}

/** Abonnements VIP Stripe (Web) ou Google Play (Android selon la période). */
export async function buyVIP(
  accessToken: string | null | undefined,
  period: VipBillingPeriod = "monthly",
): Promise<void> {
  initializeStripe()
  if (!PaymentService.isAndroidNative()) {
    const link =
      period === "weekly"
        ? process.env.NEXT_PUBLIC_STRIPE_WEEKLY_LINK
        : process.env.NEXT_PUBLIC_STRIPE_MONTHLY_LINK
    if (!link) {
      throw new Error(
        period === "weekly"
          ? "Paiement Stripe indisponible (NEXT_PUBLIC_STRIPE_WEEKLY_LINK manquant)."
          : "Paiement Stripe indisponible (NEXT_PUBLIC_STRIPE_MONTHLY_LINK manquant).",
      )
    }
    window.location.href = link
    return
  }
  const productId =
    period === "weekly" ? GOOGLE_PLAY_VIP_WEEKLY_PRODUCT_ID : GOOGLE_PLAY_VIP_MONTHLY_PRODUCT_ID
  await purchaseAndroidSubscriptionWithCordova(productId, accessToken)
}

/** Abonnements VIP+ Stripe (Web) ou Google Play (Android selon la période). */
export async function buyVIPPlus(
  accessToken: string | null | undefined,
  period: VipBillingPeriod = "monthly",
): Promise<void> {
  initializeStripe()
  if (!PaymentService.isAndroidNative()) {
    if (period === "weekly") {
      const weekly = process.env.NEXT_PUBLIC_STRIPE_VIP_PLUS_WEEKLY_LINK?.trim()
      if (weekly) {
        window.location.href = weekly
        return
      }
      throw new Error(
        "Offre VIP+ hebdomadaire indisponible ici (NEXT_PUBLIC_STRIPE_VIP_PLUS_WEEKLY_LINK manquant).",
      )
    }
    const vipPlus = process.env.NEXT_PUBLIC_STRIPE_VIP_PLUS_LINK
    if (!vipPlus) {
      throw new Error("Paiement VIP+ indisponible (NEXT_PUBLIC_STRIPE_VIP_PLUS_LINK manquant).")
    }
    window.location.href = vipPlus
    return
  }
  const productId =
    period === "weekly" ? GOOGLE_PLAY_VIP_PLUS_WEEKLY_PRODUCT_ID : GOOGLE_PLAY_VIP_PLUS_MONTHLY_PRODUCT_ID
  await purchaseAndroidSubscriptionWithCordova(productId, accessToken)
}

export class PaymentService {
  static isAndroidNative(): boolean {
    if (typeof window === "undefined") return false
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android"
  }

  static async getAndroidPriceLabels(): Promise<AndroidPriceLabels> {
    const fallback: AndroidPriceLabels = {
      weekly: "1,99€",
      monthly: "4,99€",
      vipPlusWeekly: "—",
      vipPlusMonthly: "7,99€",
    }
    if (!PaymentService.isAndroidNative()) return fallback
    try {
      await ensureCordovaGooglePlayStoreReady()
      const { store, Platform } = getCordovaPurchaseApi()
      const pick = (id: string, fb: string) =>
        pickCordovaFormattedPrice(store.get(id, Platform.GOOGLE_PLAY) as CordovaProduct | undefined) || fb
      return {
        weekly: pick(GOOGLE_PLAY_VIP_WEEKLY_PRODUCT_ID, fallback.weekly),
        monthly: pick(GOOGLE_PLAY_VIP_MONTHLY_PRODUCT_ID, fallback.monthly),
        vipPlusWeekly: pick(GOOGLE_PLAY_VIP_PLUS_WEEKLY_PRODUCT_ID, fallback.vipPlusWeekly),
        vipPlusMonthly: pick(GOOGLE_PLAY_VIP_PLUS_MONTHLY_PRODUCT_ID, fallback.vipPlusMonthly),
      }
    } catch (e) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[PaymentService] getAndroidPriceLabels:", e)
      }
      return fallback
    }
  }

  /**
   * Android only — revalide les abonnements connus via tokens en cache.
   * Cela re-synchronise `public.purchases` et donc `profiles.is_vip`/`grade` via triggers SQL.
   */
  static async verifyAndroidSubscriptionsOnLaunch(accessToken: string | null | undefined): Promise<void> {
    if (!PaymentService.isAndroidNative()) return
    if (!accessToken?.trim()) return
    const cached = readCachedGooglePurchaseTokens()
    const entries = Object.entries(cached).filter(([pid, tok]) => pid && tok)
    if (entries.length === 0) return
    const supabase = createClient()
    await Promise.all(
      entries.map(async ([productId, purchaseToken]) => {
        try {
          await supabase.functions.invoke("verify-google-purchase", {
            body: {
              packageName: ANDROID_PACKAGE_NAME,
              productId,
              purchaseToken,
            },
          })
        } catch {
          // ignore
        }
      }),
    )
  }

  static async subscribe(params: {
    plan: SubscribePlan
    accessToken: string | null | undefined
  }): Promise<void> {
    initializeStripe()
    const { plan, accessToken } = params

    if (PaymentService.isAndroidNative()) {
      const productId =
        plan === "vip_plus_monthly"
          ? GOOGLE_PLAY_VIP_PLUS_MONTHLY_PRODUCT_ID
          : plan === "vip_plus_weekly"
            ? GOOGLE_PLAY_VIP_PLUS_WEEKLY_PRODUCT_ID
            : plan === "monthly"
              ? GOOGLE_PLAY_VIP_MONTHLY_PRODUCT_ID
              : GOOGLE_PLAY_VIP_WEEKLY_PRODUCT_ID
      await purchaseAndroidSubscriptionWithCordova(productId, accessToken)
      return
    }

    const weekly = process.env.NEXT_PUBLIC_STRIPE_WEEKLY_LINK
    const monthly = process.env.NEXT_PUBLIC_STRIPE_MONTHLY_LINK
    const vipPlusMonthly = process.env.NEXT_PUBLIC_STRIPE_VIP_PLUS_LINK
    const vipPlusWeekly = process.env.NEXT_PUBLIC_STRIPE_VIP_PLUS_WEEKLY_LINK

    let checkoutUrl: string | undefined
    if (plan === "weekly") checkoutUrl = weekly
    else if (plan === "monthly") checkoutUrl = monthly
    else if (plan === "vip_plus_monthly") checkoutUrl = vipPlusMonthly
    else checkoutUrl = vipPlusWeekly ?? ""

    checkoutUrl = (checkoutUrl ?? "").trim()
    if (!checkoutUrl) {
      throw new Error("Paiement Stripe indisponible (variables NEXT_PUBLIC_STRIPE_* manquantes).")
    }
    window.location.href = checkoutUrl
  }
}
