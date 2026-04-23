/**
 * Ouverture d’URLs pour l’app Expo (remplace @capacitor/browser sur l’écran natif).
 * Ne pas utiliser depuis les pages Next.js Vercel.
 */
import * as WebBrowser from "expo-web-browser"
import { SITE_PUBLIC_ORIGIN } from "@/lib/site-url"

export async function openInExpoBrowser(url: string): Promise<WebBrowser.WebBrowserResult> {
  const trimmed = url.trim()
  if (!trimmed) {
    return { type: "cancel" }
  }
  return WebBrowser.openBrowserAsync(trimmed, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
    toolbarColor: "#0a0a0a",
    controlsColor: "#d4af37",
  })
}

export function getPremiumUrl(): string {
  return `${SITE_PUBLIC_ORIGIN}/premium`
}

export function getHomeUrl(): string {
  return `${SITE_PUBLIC_ORIGIN}/`
}

export function getWebExclusiveOffersUrl(): string {
  return SITE_PUBLIC_ORIGIN
}
