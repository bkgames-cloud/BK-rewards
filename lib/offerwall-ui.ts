/**
 * Flag simple pour activer/désactiver l’écran Offres (Lootably/Revlum).
 * - Par défaut: activé
 * - Désactiver: `NEXT_PUBLIC_OFFERS_ENABLED=false`
 */
export const OFFERS_ENABLED =
  typeof process !== "undefined" ? String(process.env.NEXT_PUBLIC_OFFERS_ENABLED || "true") !== "false" : true
