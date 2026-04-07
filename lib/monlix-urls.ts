/** Monlix en direct (Web : bouton Actions). */
export function getMonlixDirectUrl(): string {
  const u = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_MONLIX_URL : undefined
  return typeof u === "string" && u.trim() !== "" ? u.trim() : "https://www.monlix.com"
}

/**
 * Page Monlix / offres sur le site BKG Rewards (app Android : navigateur in-app).
 * À surcharger si tu exposes une route dédiée (ex. /offres-monlix).
 */
export function getMonlixOnSiteUrl(): string {
  const u = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_MONLIX_ON_SITE_URL : undefined
  return typeof u === "string" && u.trim() !== "" ? u.trim() : "https://www.bkg-rewards.com"
}
