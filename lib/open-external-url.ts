import { Capacitor } from "@capacitor/core"

/**
 * Ouvre une URL externe : In-App Browser Capacitor sur Android/iOS natif,
 * sinon `window.open` (comportement web habituel).
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (typeof window === "undefined") return
  if (!/^https?:\/\//i.test(url)) {
    window.open(url, "_blank", "noopener,noreferrer")
    return
  }
  if (Capacitor.isNativePlatform()) {
    const { Browser } = await import("@capacitor/browser")
    await Browser.open({ url, presentationStyle: "fullscreen" })
    return
  }
  window.open(url, "_blank", "noopener,noreferrer")
}
