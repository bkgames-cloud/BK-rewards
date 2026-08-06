/**
 * Flag simple pour activer/désactiver l’écran Offres (Lootably/Revlum).
 * - Par défaut: activé
 * - Désactiver: `NEXT_PUBLIC_OFFERS_ENABLED=false`
 */
export const OFFERS_ENABLED =
  typeof process !== "undefined" ? String(process.env.NEXT_PUBLIC_OFFERS_ENABLED || "true") !== "false" : true

/**
 * Monlix : UI visible mais désactivée (opacité + badge « Prochainement »).
 * - Par défaut: activé (coming soon)
 * - Réactiver Monlix: `NEXT_PUBLIC_OFFERWALL_MONLIX_COMING_SOON=false`
 */
export const OFFERWALL_MONLIX_COMING_SOON =
  typeof process !== "undefined"
    ? String(process.env.NEXT_PUBLIC_OFFERWALL_MONLIX_COMING_SOON || "true") !== "false"
    : true
