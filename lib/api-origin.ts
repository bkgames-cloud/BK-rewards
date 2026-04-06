import { SITE_PUBLIC_ORIGIN, canonicalizeApiOrigin } from "@/lib/site-url"

/**
 * Base pour les appels API depuis l’app embarquée (Capacitor) : `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_SITE_URL`,
 * sinon en build production l’origine canonique (`SITE_PUBLIC_ORIGIN`), sinon origine du navigateur en dev.
 */
function getApiOrigin(): string {
  if (typeof process === "undefined") return ""
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    ""
  if (fromEnv) return canonicalizeApiOrigin(fromEnv)
  if (process.env.NODE_ENV === "production") return SITE_PUBLIC_ORIGIN
  return ""
}

/**
 * URL absolue vers les routes API (Vercel, ou site public pour l’APK statique).
 * Jamais de slash final sur le chemin (évite les 307 Next / Vercel).
 */
export function getApiUrl(path: string): string {
  let p = path.startsWith("/") ? path : `/${path}`
  p = p.replace(/\/+$/, "")
  if (p === "") p = "/"
  const base = getApiOrigin()
  if (typeof window !== "undefined" && window.location?.origin) {
    if (base) return `${base}${p}`
    const origin = window.location.origin.replace(/\/$/, "")
    return `${origin}${p}`
  }
  if (base) return `${base}${p}`
  return p
}
