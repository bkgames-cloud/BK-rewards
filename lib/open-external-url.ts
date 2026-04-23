import { Capacitor } from "@capacitor/core"

/**
 * Ouvre une URL externe : In-App Browser Capacitor sur Android/iOS natif,
 * sinon `window.open` (comportement web habituel).
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (typeof window === "undefined") return
  // Contrainte mobile: aucun flux ne doit sortir de l'app via navigateur externe.
  if (Capacitor.isNativePlatform()) {
    throw new Error("Navigation externe désactivée dans l’app mobile.")
  }
  if (!/^https?:\/\//i.test(url)) {
    window.open(url, "_blank", "noopener,noreferrer")
    return
  }
  window.open(url, "_blank", "noopener,noreferrer")
}
