export const LEGAL_IDENTITY = {
  companyName:
    (process.env.NEXT_PUBLIC_COMPANY_NAME || "").trim() ||
    "BKG",
  siren:
    (process.env.NEXT_PUBLIC_COMPANY_SIREN || "").trim() ||
    "103613618",
  rcs:
    (process.env.NEXT_PUBLIC_COMPANY_RCS || "").trim() ||
    "DIEPPE (76370)",
} as const

