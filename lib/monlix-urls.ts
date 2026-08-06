/**
 * Helpers Monlix (offerwall).
 *
 * Le SDK / l’ouverture native Monlix sont volontairement désactivés côté UI
 * (`OFFERWALL_MONLIX_COMING_SOON`) tant que la régie n’est pas validée —
 * éviter tout appel natif au démarrage qui ferait planter l’app.
 */

/** Monlix en direct (URL offerwall). */
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

/**
 * Ouverture Monlix — stub non exécuté tant que `OFFERWALL_MONLIX_COMING_SOON` est actif.
 * Ne pas brancher un SDK natif ici sans garde-fou UI.
 */
export async function openMonlixOfferwall(_userId?: string): Promise<void> {
  // Désactivé : pas d’appel natif Monlix (crash si SDK absent / non validé).
  // Exemple futur :
  // const { Monlix } = await import("@monlix/sdk")
  // await Monlix.open({ userId: _userId, url: getMonlixOnSiteUrl() })
  void _userId
  throw new Error("Monlix est temporairement indisponible (Prochainement).")
}
