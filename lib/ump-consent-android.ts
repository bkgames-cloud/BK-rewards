import { Capacitor } from "@capacitor/core"
import { AdmobConsentDebugGeography } from "@capacitor-community/admob"

let umpSessionComplete = false

function buildUmpRequestOptions():
  | { debugGeography: AdmobConsentDebugGeography; testDeviceIdentifiers?: string[] }
  | undefined {
  const geo = (process.env.NEXT_PUBLIC_UMP_DEBUG_GEOGRAPHY || "").trim().toUpperCase()
  if (geo !== "EEA") return undefined
  const ids = (process.env.NEXT_PUBLIC_UMP_TEST_DEVICE_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  return {
    debugGeography: AdmobConsentDebugGeography.EEA,
    ...(ids.length > 0 ? { testDeviceIdentifiers: ids } : {}),
  }
}

/**
 * UMP (User Messaging Platform) — à exécuter avant `AdMob.initialize` sur Android.
 * Utilise le SDK intégré au plugin `@capacitor-community/admob`.
 *
 * Debug (simulateur EEA) : `NEXT_PUBLIC_UMP_DEBUG_GEOGRAPHY=EEA` (+ optionnel `NEXT_PUBLIC_UMP_TEST_DEVICE_IDS`).
 */
export async function ensureUmpConsentBeforeAndroidAds(): Promise<void> {
  if (typeof window === "undefined") return
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return
  if (umpSessionComplete) return

  try {
    const { AdMob } = await import("@capacitor-community/admob")
    const opts = buildUmpRequestOptions()
    await AdMob.requestConsentInfo(opts)
    await AdMob.showConsentForm()
  } catch (e) {
    console.warn("[UMP] flux de consentement", e)
  } finally {
    umpSessionComplete = true
  }
}
