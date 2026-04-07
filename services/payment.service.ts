import { App } from "@capacitor/app"
import { Capacitor } from "@capacitor/core"
import { ANDROID_PACKAGE_NAME, GOOGLE_PLAY_VIP_MONTHLY_PRODUCT_ID, GOOGLE_PLAY_VIP_PLUS_MONTHLY_PRODUCT_ID } from "@/lib/payment-constants"
import { createClient } from "@/lib/supabase/client"

/**
 * Paiements hybrides (Web / Android natif)
 *
 * **Web** : redirection vers les liens Stripe (`NEXT_PUBLIC_STRIPE_*_LINK`).
 *
 * **Android** : `cordova-plugin-purchase` (Google Play Billing). Prérequis côté projet :
 * - `android/app/src/main/AndroidManifest.xml` : permission `com.android.vending.BILLING` + `<queries>` Billing
 * - `android/app/build.gradle` : dépendance `billing-ktx`
 * - Produit Play Console : `vip_mensuel_bkg` (ou IDs définis dans les env)
 * - API `/api/verify-google-purchase` : valide le reçu et enregistre dans `public.purchases` (service role)
 */

export type SubscribePlan = "weekly" | "monthly"

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
  parentReceipt?: { purchaseToken?: string }
  finish: () => Promise<void>
}
type CdvError = { isError: true; code: number; message: string } | undefined

function isAndroidNative(): boolean {
  if (typeof window === "undefined") return false
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android"
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

/** Abonnement VIP mensuel : Stripe sur le Web ; Google Play (`vip_mensuel_bkg`) sur Android. Validation serveur via `/api/verify-google-purchase`. */
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
      const weeklySku = process.env.NEXT_PUBLIC_GOOGLE_PLAY_VIP_WEEKLY_ID?.trim()
      if (weeklySku) {
        await purchaseAndroidSubscription(weeklySku, accessToken)
        return
      }
      throw new Error(
        "Abonnement hebdomadaire : créez le produit dans Play Console et définissez NEXT_PUBLIC_GOOGLE_PLAY_VIP_WEEKLY_ID.",
      )
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

async function purchaseAndroidSubscription(
  productId: string,
  accessToken: string | null | undefined,
): Promise<void> {
  if (!accessToken?.trim()) {
    throw new Error("Session requise pour valider l’achat sur le serveur.")
  }

  const { store, cdv } = await getStore()
  const { ProductType, Platform, ErrorCode } = cdv

  store.register({
    id: productId,
    type: ProductType.PAID_SUBSCRIPTION,
    platform: Platform.GOOGLE_PLAY,
  })
  await store.initialize([Platform.GOOGLE_PLAY])
  await store.update()

  const product = store.get(productId, Platform.GOOGLE_PLAY)
  if (!product) {
    throw new Error(`Produit « ${productId} » introuvable dans le magasin.`)
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
        const purchaseToken = transaction.parentReceipt?.purchaseToken
        if (!purchaseToken) {
          throw new Error("Jeton d’achat Google manquant.")
        }

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
}
