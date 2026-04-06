/**
 * Colonnes de `rewards_pools` alignées sur les scripts 012 + 014 + 030.
 * Ne pas ajouter ici des colonnes absentes de la base : PostgREST renvoie une erreur 400.
 *
 * Si vous avez exécuté `scripts/037_rewards_pools_ticket_columns.sql` et souhaitez lire
 * aussi `target_tickets` / `current_tickets`, importez `REWARDS_POOLS_SELECT_WITH_TICKET_ALIASES`
 * à la place (ou fusionnez les deux chaînes dans votre code).
 */
export const REWARDS_POOLS_SELECT =
  "id, name, target_videos, current_videos, image_url, ticket_cost, created_at, last_draw_at" as const

/** Uniquement si la migration 037 a été appliquée (colonnes présentes en base). */
export const REWARDS_POOLS_SELECT_WITH_TICKET_ALIASES =
  "id, name, target_videos, current_videos, target_tickets, current_tickets, image_url, ticket_cost, created_at, last_draw_at" as const
