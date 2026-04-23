import { Capacitor } from "@capacitor/core"

/**
 * Ouvre une URL dans le navigateur intégré (@capacitor/browser) sur Android/iOS
 * pour que l’utilisateur reste dans l’app et puisse fermer pour revenir au WebView.
 * Sur le Web, ouverture d’un nouvel onglet.
 */
export async function openInAppBrowser(url: string): Promise<void> {
  if (typeof window === "undefined") return
  if (Capacitor.isNativePlatform()) {
    throw new Error("Navigation externe désactivée dans l’app mobile.")
  }
  if (!/^https?:\/\//i.test(url)) {
    window.open(url, "_blank", "noopener,noreferrer")
    return
  }
  window.open(url, "_blank", "noopener,noreferrer")
}
