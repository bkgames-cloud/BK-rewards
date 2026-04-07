/** IDs produits Google Play (abonnements) — doivent correspondre à la console Play. */
export const GOOGLE_PLAY_VIP_MONTHLY_PRODUCT_ID =
  (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_GOOGLE_PLAY_VIP_MONTHLY_ID : undefined)?.trim() ||
  "vip_mensuel"

export const GOOGLE_PLAY_VIP_PLUS_MONTHLY_PRODUCT_ID =
  (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_GOOGLE_PLAY_VIP_PLUS_MONTHLY_ID : undefined)?.trim() ||
  "vip_plus_mensuel"

/** Package Android (aligné sur `capacitor.config.ts` → `appId`). */
export const ANDROID_PACKAGE_NAME = "com.bkrewards.rewards"
