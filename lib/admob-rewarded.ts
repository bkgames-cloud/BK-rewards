/**
 * Rewarded ads via @capacitor-community/admob (Android / iOS natif).
 *
 * ─── Mode TEST vs PRODUCTION ─────────────────────────────────────────────
 * `ADMOB_USE_TEST_IDS` : `true` = IDs Google de démonstration + mode test SDK.
 * Avant publication Play Store : `false` + `strings.xml` avec `ADMOB_PRODUCTION_APP_ID`.
 * ─────────────────────────────────────────────────────────────────────────
 */

import type { PluginListenerHandle } from "@capacitor/core"

/**
 * `true` = tests (IDs démo + SDK test). `false` = constantes PROD ci‑dessous + pas de mode test SDK.
 * Pour un test sur téléphone réel sans risque compte prod : `true` + ID app TEST dans strings.xml.
 */
export const ADMOB_USE_TEST_IDS = true

/** IDs de test Google (activés tant que ADMOB_USE_TEST_IDS === true). */
export const GOOGLE_TEST_REWARDED_AD_UNIT_ANDROID = "ca-app-pub-3940256099942544/5224354917"
export const GOOGLE_TEST_REWARDED_AD_UNIT_IOS = "ca-app-pub-3940256099942544/1712485313"

/** Production — ID application (méta Android : `strings.xml` → `admob_app_id`). Non utilisé en JS ; référence pour bascule prod. */
export const ADMOB_PRODUCTION_APP_ID = "ca-app-pub-2044584502893474~6360384667"

/** Production — unités récompensées (utilisées quand ADMOB_USE_TEST_IDS === false). */
export const ADMOB_PRODUCTION_REWARDED_AD_UNIT_ANDROID =
  "ca-app-pub-2044584502893474/9888566137"
export const ADMOB_PRODUCTION_REWARDED_AD_UNIT_IOS =
  "ca-app-pub-2044584502893474/9888566137"

let initDone = false

/** Évite les appels AdMob concurrents (trop de requêtes → erreur côté Google). */
let rewardedAdFlowInProgress = false

function getRewardedAdUnitId(platform: "ios" | "android"): string {
  if (ADMOB_USE_TEST_IDS) {
    return platform === "ios" ? GOOGLE_TEST_REWARDED_AD_UNIT_IOS : GOOGLE_TEST_REWARDED_AD_UNIT_ANDROID
  }
  return platform === "ios"
    ? ADMOB_PRODUCTION_REWARDED_AD_UNIT_IOS
    : ADMOB_PRODUCTION_REWARDED_AD_UNIT_ANDROID
}

/** Initialise le SDK une fois (ex. au lancement de l’app). */
export async function initializeAdMob(): Promise<void> {
  if (typeof window === "undefined") return
  const { Capacitor } = await import("@capacitor/core")
  if (!Capacitor.isNativePlatform()) return
  if (initDone) return
  const { AdMob } = await import("@capacitor-community/admob")
  console.log("[admob] initialize: calling AdMob.initialize", {
    testing: ADMOB_USE_TEST_IDS,
    platform: Capacitor.getPlatform(),
  })
  await AdMob.initialize({ initializeForTesting: ADMOB_USE_TEST_IDS })
  console.log("[admob] initialize: done")
  initDone = true
}

export type ShowRewardVideoResult =
  | { ok: true }
  | { ok: false; message: string }

/**
 * Charge et affiche une pub récompensée. Le callback `onRewardGranted` doit créditer les points
 * (ex. RPC `add_reward_points` → table `public.profiles`, colonne `points` — voir dashboard-client).
 */
export async function showRewardVideo(options: {
  onRewardGranted: () => void | Promise<void>
}): Promise<ShowRewardVideoResult> {
  const { Capacitor } = await import("@capacitor/core")
  if (!Capacitor.isNativePlatform()) {
    return { ok: false, message: "Pub disponible uniquement sur l’application mobile." }
  }

  if (rewardedAdFlowInProgress) {
    return {
      ok: false,
      message: "Une publicité est déjà en cours de chargement. Patiente quelques secondes.",
    }
  }
  rewardedAdFlowInProgress = true

  try {
  const { AdMob, RewardAdPluginEvents } = await import("@capacitor-community/admob")
  await initializeAdMob()

  const platform = Capacitor.getPlatform() === "ios" ? "ios" : "android"
  const adId = getRewardedAdUnitId(platform)
  console.log("[admob] rewarded: start", { platform, adId, testing: ADMOB_USE_TEST_IDS })
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("admob-ad-start"))
  }

  const handles: PluginListenerHandle[] = []
  let pointsCredited = false
  /** Verrou synchrone anti double déclenchement (Rewarded + rewardItem, ou événements du SDK). */
  let grantLock = false
  /** Message d’erreur du callback (string pour éviter les soucis d’inférence TS sur les closures async). */
  let grantErrorMessage: string | null = null

  const grantOnce = async () => {
    if (grantLock || pointsCredited) return
    grantLock = true
    pointsCredited = true
    try {
      await options.onRewardGranted()
    } catch (e: unknown) {
      pointsCredited = false
      grantLock = false
      grantErrorMessage =
        e instanceof Error ? e.message : typeof e === "string" ? e : String(e)
    }
  }

  const cleanup = async () => {
    await Promise.all(
      handles.map(async (h) => {
        try {
          await h.remove()
        } catch {
          /* */
        }
      }),
    )
    handles.length = 0
  }

  try {
    const hReward = await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
      void grantOnce()
    })
    handles.push(hReward)

    console.log("[admob] rewarded: prepareRewardVideoAd()", { adId, isTesting: ADMOB_USE_TEST_IDS })
    const prepareTimeoutMs = 10_000
    await Promise.race([
      AdMob.prepareRewardVideoAd({
        adId,
        isTesting: ADMOB_USE_TEST_IDS,
      }),
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("timeout_prepare_rewarded_10s")), prepareTimeoutMs),
      ),
    ])
    console.log("[admob] rewarded: prepared, calling showRewardVideoAd()")

    const rewardItem = await AdMob.showRewardVideoAd()
    console.log("[admob] rewarded: showRewardVideoAd() resolved", { rewardItem })
    /** Une seule récompense validée suffit (évite d’exiger 2 événements / un `amount` numérique). */
    if (!pointsCredited && rewardItem != null) {
      await grantOnce()
    }

    if (grantErrorMessage !== null) {
      await cleanup()
      return {
        ok: false,
        message: grantErrorMessage || "Impossible d’ajouter les points.",
      }
    }

    if (!pointsCredited) {
      await cleanup()
      return { ok: false, message: "Récompense non validée (vidéo non terminée)." }
    }

    await cleanup()
    return { ok: true }
  } catch (e: unknown) {
    const err =
      e instanceof Error ? e : new Error(typeof e === "string" ? e : String(e))
    console.error("[admob-rewarded] showRewardVideo:", err.message, err)
    await cleanup()
    return { ok: false, message: "Pub non disponible, réessaie plus tard." }
  }
  } finally {
    rewardedAdFlowInProgress = false
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("admob-ad-end"))
    }
  }
}

