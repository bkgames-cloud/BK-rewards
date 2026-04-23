import { App } from "@capacitor/app"
import { Capacitor } from "@capacitor/core"
import {
  ANDROID_PACKAGE_NAME,
  GOOGLE_PLAY_RSA_PUBLIC_KEY_BASE64,
  GOOGLE_PLAY_VIP_MONTHLY_PRODUCT_ID,
  GOOGLE_PLAY_VIP_PLUS_MONTHLY_PRODUCT_ID,
  GOOGLE_PLAY_VIP_WEEKLY_PRODUCT_ID,
} from "@/lib/payment-constants"
import { createClient } from "@/lib/supabase/client"
import { verifyGooglePlayReceiptSignature } from "@/lib/google-play-signature"

/**
 * Paiements hybrides (Web / Android natif)
 *
 * **Web** : redirection vers les liens Stripe (`NEXT_PUBLIC_STRIPE_*_LINK`).
 *
 * **Android** : `cordova-plugin-purchase` (Google Play Billing). Prérequis côté projet :
 * - `android/app/src/main/AndroidManifest.xml` : permission `com.android.vending.BILLING` + `<queries>` Billing
 * - `android/app/build.gradle` : dépendance `billing-ktx`
 * - Produits Play Console : `vip-hebdo-bkg`, `vip-mensuel-bkg`, `vip_plus_mensuel_bkg`
 *   — alignés sur `lib/payment-constants.ts` / `NEXT_PUBLIC_GOOGLE_PLAY_*_ID`
 * - API `/api/verify-google-purchase` : valide le reçu et enregistre dans `public.purchases` (service role)
 */

export type SubscribePlan = "weekly" | "monthly"
export type AndroidPriceLabels = {
  weekly: string
  monthly: string
  vipPlusMonthly: string
}

type CdvWindow = Window & {
  CdvPurchase?: {
    store: CdvStore
    ProductType: { PAID_SUBSCRIPTION: string }
    Platform: { GOOGLE_PLAY: string }
    ErrorCode: { PAYMENT_CANCELLED: number }
  }
}

type CdvStore = {
  register: (p: { id: string; type: string; platform: string }) => void
  initialize: (platforms: string[]) => Promise<unknown[]>
  update: () => Promise<void>
  get: (id: string, platform?: string) => CdvProduct | undefined
  when: () => { approved: (cb: (t: CdvTransaction) => void) => unknown }
  order: (offer: CdvOffer) => Promise<CdvError | undefined>
  off: (cb: (t: CdvTransaction) => void) => void
}

type CdvProduct = { getOffer: () => CdvOffer | undefined }
type CdvOffer = object
type CdvTransaction = {
  products?: { id: string }[]
  parentReceipt?: { purchaseToken?: string; receipt?: unknown; signature?: unknown }
  finish: () => Promise<void>
}
type CdvError = { isError: true; code: number; message: string } | undefined

function isAndroidNative(): boolean {
  if (typeof window === "undefined") return false
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android"
}

const GOOGLE_PURCHASE_TOKEN_CACHE_KEY = "bk_gp_purchase_tokens_v1"

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
    // ignore (stockage plein / privé)
  }
}

/** Attend le bridge natif Capacitor + éventuel `deviceready` Cordova (plugin IAP). */
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

/** Abonnement VIP mensuel : Stripe sur le Web ; Google Play (`vip-mensuel-bkg`) sur Android. Validation via Edge `verify-google-purchase`. */
export async function buyVIP(accessToken: string | null | undefined): Promise<void> {
  if (!isAndroidNative()) {
    const monthly = process.env.NEXT_PUBLIC_STRIPE_MONTHLY_LINK
    if (!monthly) {
      throw new Error("Paiement Stripe indisponible (NEXT_PUBLIC_STRIPE_MONTHLY_LINK manquant).")
    }
    window.location.href = monthly
    return
  }
  await purchaseAndroidSubscription(GOOGLE_PLAY_VIP_MONTHLY_PRODUCT_ID, accessToken)
}

/** Abonnement VIP+ mensuel : Google Play sur Android ; Stripe sur le Web (si configuré). */
export async function buyVIPPlus(accessToken: string | null | undefined): Promise<void> {
  if (!isAndroidNative()) {
    const vipPlus = process.env.NEXT_PUBLIC_STRIPE_VIP_PLUS_LINK
    if (!vipPlus) {
      throw new Error("Paiement VIP+ indisponible (NEXT_PUBLIC_STRIPE_VIP_PLUS_LINK manquant).")
    }
    window.location.href = vipPlus
    return
  }
  await purchaseAndroidSubscription(GOOGLE_PLAY_VIP_PLUS_MONTHLY_PRODUCT_ID, accessToken)
}

export class PaymentService {
  static isAndroidNative(): boolean {
    return isAndroidNative()
  }

  static async getAndroidPriceLabels(): Promise<AndroidPriceLabels> {
    const fallback: AndroidPriceLabels = {
      weekly: "1,99€",
      monthly: "4,99€",
      vipPlusMonthly: "7,99€",
    }
    if (!isAndroidNative()) return fallback
    try {
      const { store, cdv } = await getStoreSafe()
      const { ProductType, Platform } = cdv
      const ids = [
        GOOGLE_PLAY_VIP_WEEKLY_PRODUCT_ID,
        GOOGLE_PLAY_VIP_MONTHLY_PRODUCT_ID,
        GOOGLE_PLAY_VIP_PLUS_MONTHLY_PRODUCT_ID,
      ].filter(Boolean)

      for (const id of ids) {
        store.register({ id, type: ProductType.PAID_SUBSCRIPTION, platform: Platform.GOOGLE_PLAY })
      }
      try {
        await store.initialize([Platform.GOOGLE_PLAY])
        await store.update()
      } catch (e) {
        console.error("[IAP] store init/update failed (price labels)", e)
        throw e
      }

      const getPretty = (id: string): string | null => {
        const product = store.get(id, Platform.GOOGLE_PLAY) as any
        if (!product) {
          console.warn("[IAP] product missing after update (price labels)", { id })
        }
        if (!product) return null
        const direct =
          (typeof product?.price === "string" && product.price) ||
          (typeof product?.pricing === "string" && product.pricing) ||
          (typeof product?.pricing?.price === "string" && product.pricing.price) ||
          null
        if (direct) return direct
        const offer = (product.getOffer?.() as any) || null
        const offerPrice =
          (typeof offer?.pricingPhases?.[0]?.price === "string" && offer.pricingPhases[0].price) ||
          (typeof offer?.pricingPhases?.[0]?.formattedPrice === "string" && offer.pricingPhases[0].formattedPrice) ||
          null
        return offerPrice
      }

      return {
        weekly: getPretty(GOOGLE_PLAY_VIP_WEEKLY_PRODUCT_ID) || fallback.weekly,
        monthly: getPretty(GOOGLE_PLAY_VIP_MONTHLY_PRODUCT_ID) || fallback.monthly,
        vipPlusMonthly: getPretty(GOOGLE_PLAY_VIP_PLUS_MONTHLY_PRODUCT_ID) || fallback.vipPlusMonthly,
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
    if (!isAndroidNative()) return
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
    plan: SubscribePlan | "vip_plus_monthly"
    accessToken: string | null | undefined
  }): Promise<void> {
    const { plan, accessToken } = params

    if (isAndroidNative()) {
      if (plan === "vip_plus_monthly") {
        await buyVIPPlus(accessToken)
        return
      }
      if (plan === "monthly") {
        await buyVIP(accessToken)
        return
      }
      await purchaseAndroidSubscription(GOOGLE_PLAY_VIP_WEEKLY_PRODUCT_ID, accessToken)
      return
    }

    const weekly = process.env.NEXT_PUBLIC_STRIPE_WEEKLY_LINK
    const monthly = process.env.NEXT_PUBLIC_STRIPE_MONTHLY_LINK
    const checkoutUrl = plan === "weekly" ? weekly : monthly
    if (!checkoutUrl) {
      throw new Error("Paiement Stripe indisponible (variables NEXT_PUBLIC_STRIPE_*_LINK manquantes).")
    }
    window.location.href = checkoutUrl
  }
}

async function loadCordovaPurchase(): Promise<void> {
  if (typeof window === "undefined") return
  await import("cordova-plugin-purchase")
}

async function getStore(): Promise<{ store: CdvStore; cdv: NonNullable<CdvWindow["CdvPurchase"]> }> {
  await loadCordovaPurchase()
  await waitForNativePurchaseBridge()
  const cdv = (window as CdvWindow).CdvPurchase
  if (!cdv?.store) {
    throw new Error("Magasin intégré indisponible (plugin IAP non chargé — lancez `npx cap sync android`).")
  }
  return { store: cdv.store, cdv }
}

/** Comme `getStore` mais ne propage pas d’erreur technique brute (évite crash UI si Billing lent ou plugin absent). */
async function getStoreSafe(): Promise<{ store: CdvStore; cdv: NonNullable<CdvWindow["CdvPurchase"]> }> {
  try {
    return await getStore()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(
      msg.includes("IAP") || msg.includes("plugin")
        ? "Magasin Google Play indisponible. Vérifie l’installation (sync Capacitor) ou réessaie plus tard."
        : "Magasin intégré momentanément indisponible. Réessaie plus tard.",
    )
  }
}

async function purchaseAndroidSubscription(
  productId: string,
  accessToken: string | null | undefined,
): Promise<void> {
  try {
    if (!accessToken?.trim()) {
      throw new Error("Session requise pour valider l’achat sur le serveur.")
    }

    const { store, cdv } = await getStoreSafe()
    const { ProductType, Platform, ErrorCode } = cdv

    store.register({
      id: productId,
      type: ProductType.PAID_SUBSCRIPTION,
      platform: Platform.GOOGLE_PLAY,
    })
    try {
      await store.initialize([Platform.GOOGLE_PLAY])
      await store.update()
      console.log("[IAP] store initialized/updated", { productId })
    } catch (e) {
      console.error("[IAP] store init/update failed", {
        productId,
        error: e instanceof Error ? e.message : String(e),
        raw: e,
      })
      throw e
    }

    const product = store.get(productId, Platform.GOOGLE_PLAY)
    if (!product) {
      console.warn("[IAP] product not found — store list empty or ERR_LOAD?", { productId })
      throw new Error(
        `Produit Google Play « ${productId} » introuvable (en attente côté Play Console ou ID incorrect).`,
      )
    }
    const offer = product.getOffer()
    if (!offer) {
      throw new Error("Aucune offre disponible pour ce produit.")
    }

    await new Promise<void>((resolve, reject) => {
      let settled = false

      const done = (fn: () => void) => {
        if (settled) return
        settled = true
        try {
          store.off(approvedHandler)
        } catch {
          /* ignore */
        }
        fn()
      }

      const approvedHandler = async (transaction: CdvTransaction) => {
        const pid = transaction.products?.[0]?.id
        if (pid !== productId) return

        try {
          const signedDataRaw =
            (transaction as unknown as { parentReceipt?: { receipt?: unknown; purchaseData?: unknown } }).parentReceipt
              ?.receipt ??
            (transaction as unknown as { parentReceipt?: { receipt?: unknown; purchaseData?: unknown } }).parentReceipt
              ?.purchaseData ??
            (transaction as unknown as { receipt?: unknown }).receipt ??
            null
          const signatureRaw =
            (transaction as unknown as { parentReceipt?: { signature?: unknown } }).parentReceipt?.signature ??
            (transaction as unknown as { signature?: unknown }).signature ??
            null

          if (typeof signedDataRaw === "string" && typeof signatureRaw === "string") {
            try {
              const res = await verifyGooglePlayReceiptSignature({
                signedData: signedDataRaw,
                signatureBase64: signatureRaw,
                publicKeyBase64: GOOGLE_PLAY_RSA_PUBLIC_KEY_BASE64,
              })
              console.log("[gp-receipt] verification signature", {
                ok: res.ok,
                algorithm: res.algorithm,
                error: res.error,
                productId,
              })
            } catch (e) {
              console.warn("[gp-receipt] verification exception", e)
            }
          } else {
            console.log("[gp-receipt] signature/receipt non fournis par le plugin (skip)", {
              hasSignedData: typeof signedDataRaw === "string",
              hasSignature: typeof signatureRaw === "string",
              productId,
            })
          }

          const purchaseToken = transaction.parentReceipt?.purchaseToken
          if (!purchaseToken) {
            throw new Error("Jeton d’achat Google manquant.")
          }
          writeCachedGooglePurchaseToken(productId, purchaseToken)

          const supabase = createClient()
          const { data: fnRes, error: fnErr } = await supabase.functions.invoke("verify-google-purchase", {
            body: {
              packageName: ANDROID_PACKAGE_NAME,
              productId,
              purchaseToken,
            },
          })
          if (fnErr) {
            throw new Error(fnErr.message || "Échec de la validation serveur.")
          }
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

      store.when().approved(approvedHandler)

      void store.order(offer).then((err: CdvError) => {
        if (err?.isError) {
          if (err.code === ErrorCode.PAYMENT_CANCELLED) {
            done(() => reject(new Error("Achat annulé.")))
          } else {
            done(() => reject(new Error(err.message || "Erreur magasin")))
          }
        }
      })
    })
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e)
    if (raw.includes("introuvable") || raw.includes("Produit Google Play")) {
      throw new Error(
        "Abonnement indisponible pour le moment (produit en cours de validation sur Google Play). Réessaie plus tard.",
      )
    }
    if (raw.includes("Magasin") || raw.includes("plugin") || raw.includes("IAP")) {
      throw new Error(raw)
    }
    throw new Error("Impossible de finaliser l’achat pour le moment. Réessaie plus tard.")
  }
}
