/** IDs produits Google Play (abonnements) — doivent correspondre à la console Play. */
export const GOOGLE_PLAY_VIP_MONTHLY_PRODUCT_ID =
  (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_GOOGLE_PLAY_VIP_MONTHLY_ID : undefined)?.trim() ||
  "vip_mensuel_bkg"

export const GOOGLE_PLAY_VIP_PLUS_MONTHLY_PRODUCT_ID =
  (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_GOOGLE_PLAY_VIP_PLUS_MONTHLY_ID : undefined)?.trim() ||
  "vip_plus_mensuel_bkg"

export const GOOGLE_PLAY_VIP_WEEKLY_PRODUCT_ID =
  (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_GOOGLE_PLAY_VIP_WEEKLY_ID : undefined)?.trim() ||
  "vip_hebdo_bkg"

/** Package Android (aligné sur `capacitor.config.ts` → `appId`). */
export const ANDROID_PACKAGE_NAME = "com.bkrewards.rewards"
