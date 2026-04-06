/** Boîte opérateur : récap gagnants (tirage), etc. */
export const ADMIN_INBOX_EMAIL = "support.bkgamers@gmail.com"

/** Destinataire des alertes « Réception confirmée » uniquement (`receipt_confirmed`). Pas le formulaire Contact. */
export const RECEIPT_CONFIRMATION_TO_EMAIL = "bkgamers@icloud.com"

/** Compte autorisé pour l’admin (panel, APIs admin). `NEXT_PUBLIC_ADMIN_EMAIL` vide → boîte opérateur. */
export const ADMIN_EMAIL =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_ADMIN_EMAIL?.trim()) || ADMIN_INBOX_EMAIL

/** Comptes admin historiques (évite conflit si connexion iCloud vs Gmail). */
const ADMIN_EMAIL_EXTRA = ["bkgamers@icloud.com"] as const

/** Comparaison insensible à la casse ; `NEXT_PUBLIC_ADMIN_EMAIL` + boîte opérateur + alias connus. */
export function emailMatchesAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  const n = email.trim().toLowerCase()
  if (n === ADMIN_EMAIL.toLowerCase()) return true
  return (ADMIN_EMAIL_EXTRA as readonly string[]).includes(n)
}

/** Récap tirage Resend (e-mail admin en parallèle du mail gagnant). */
export const ADMIN_NOTIFY_EMAIL = ADMIN_INBOX_EMAIL

/** Formulaire Support — boîte dédiée (support client). */
export const SUPPORT_INBOX_EMAIL = "support.bkgamers@gmail.com"

/** E-mail de secours affiché si Resend échoue (côté client : NEXT_PUBLIC_SUPPORT_FALLBACK_EMAIL). */
export const SUPPORT_FALLBACK_EMAIL = SUPPORT_INBOX_EMAIL
