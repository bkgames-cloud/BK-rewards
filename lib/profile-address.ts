/**
 * Adresse de livraison : colonnes `public.profiles` (voir `scripts/006_admin_shipping.sql`).
 * Ne pas utiliser d’autres noms (address, zip_code, city, address_street, etc.) côté app ou API.
 */
export type ProfileAddressColumns = {
  adresse: string | null
  code_postal: string | null
  ville: string | null
}
