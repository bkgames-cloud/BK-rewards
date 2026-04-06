/**
 * URL canonique du site en production (app Android / liens / API si pas d’override `.env`).
 * Doit correspondre au domaine principal dans Vercel (avec ou sans `www`, mais une seule variante)
 * pour éviter les 307 sur les appels `fetch` / préflight CORS.
 */
export const SITE_PUBLIC_URL = "https://bkg-rewards.com"

/** Même hôte que `SITE_PUBLIC_URL`, sans slash final — pour comparaisons. */
export const SITE_PUBLIC_ORIGIN = SITE_PUBLIC_URL.replace(/\/$/, "")

/**
 * Si `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_SITE_URL` pointent vers le même site sous une autre forme
 * (ex. `https://www.bkg-rewards.com` alors que Vercel redirige vers l’apex), on ramène à `SITE_PUBLIC_URL`.
 */
export function canonicalizeApiOrigin(origin: string): string {
  const trimmed = origin.trim().replace(/\/+$/, "")
  try {
    const u = new URL(trimmed)
    const canon = new URL(SITE_PUBLIC_URL)
    const norm = (h: string) => h.toLowerCase().replace(/^www\./, "")
    if (norm(u.hostname) === norm(canon.hostname)) {
      return canon.origin
    }
  } catch {
    /* ignore */
  }
  return trimmed
}
