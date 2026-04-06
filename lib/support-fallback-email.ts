/** Alerte utilisateur si Resend échoue (variable publique optionnelle). */
export function getSupportFallbackEmail(): string {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_SUPPORT_FALLBACK_EMAIL?.trim()) {
    return process.env.NEXT_PUBLIC_SUPPORT_FALLBACK_EMAIL.trim()
  }
  return "support.bkgamers@gmail.com"
}
