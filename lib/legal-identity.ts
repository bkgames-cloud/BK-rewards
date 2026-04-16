export const LEGAL_IDENTITY = {
  companyName:
    (process.env.NEXT_PUBLIC_COMPANY_NAME || "").trim() ||
    "BKG",
  siren:
    (process.env.NEXT_PUBLIC_COMPANY_SIREN || "").trim() ||
    "103613618",
  siret:
    (process.env.NEXT_PUBLIC_COMPANY_SIRET || "").trim() ||
    "10361361800018",
  rcs:
    (process.env.NEXT_PUBLIC_COMPANY_RCS || "").trim() ||
    "DIEPPE",
} as const

