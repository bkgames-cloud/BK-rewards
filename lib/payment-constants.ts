/** IDs produits Google Play (abonnements) — doivent correspondre à la console Play. */
export const GOOGLE_PLAY_VIP_MONTHLY_PRODUCT_ID =
  (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_GOOGLE_PLAY_VIP_MONTHLY_ID : undefined)?.trim() ||
  "vip-mensuel-bkg"

export const GOOGLE_PLAY_VIP_PLUS_MONTHLY_PRODUCT_ID =
  (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_GOOGLE_PLAY_VIP_PLUS_MONTHLY_ID : undefined)?.trim() ||
  "vip_plus_mensuel_bkg"

export const GOOGLE_PLAY_VIP_WEEKLY_PRODUCT_ID =
  (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_GOOGLE_PLAY_VIP_WEEKLY_ID : undefined)?.trim() ||
  "vip-hebdo-bkg"

/** Package Android (aligné sur `capacitor.config.ts` → `appId`). */
export const ANDROID_PACKAGE_NAME = "com.bkrewards.rewards"

/**
 * Clé publique RSA Google Play (Base64 SPKI) — utilisée pour vérifier localement la signature
 * des reçus quand disponible (défense en profondeur ; la validation serveur reste la source de vérité).
 */
export const GOOGLE_PLAY_RSA_PUBLIC_KEY_BASE64 =
  "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqRQS7b/ofRaoBu9cCpUM71FK+RUJydhO2HwVu5b7UwmlGkrQRd0LhfGBUCEb2e/wQxE4goy20Ao9ZmlfSmwTUAM9hFzHcUoqZFrETkvPZEnAnjXllAPCwG/hCg303cNNW4UtQZC9jVxpzAAytRRNw1nVBgNm9AlRRKX/hIUPhlvFGfjDG9MWonboIxLWcGMSk4TySwj4XCi/l7stDRttt5OAhlQtymdQlaoCetSmHndJYuqoHXxOGFaQrGx5QK5sIK+cm0jHNWwEAladc0EQxZ9PrazpcBRR0fz2WjBhJiFqSw727wf1nnmFilC0oS/RZMA76Vz//oZ8/y3WpDCoXwIDAQAB"
