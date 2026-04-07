/** Style console : texte noir sur fond blanc (lisible dans Web Inspector / logcat via la WebView). */
const RESEND_LOG_STYLE =
  "background-color: #ffffff; color: #000000; font-weight: normal; font-size: 13px; line-height: 1.45; padding: 10px 12px; border: 2px solid #000000; white-space: pre-wrap; word-break: break-word; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;"

/**
 * Affiche dans la console de l’app le détail exact renvoyé par l’API (corps Resend inclus dans `detail`).
 * Utile pour diagnostiquer clé invalide, domaine non vérifié, etc.
 */
export function logSupportResendFailure(context: {
  httpStatus: number
  httpStatusText?: string
  error?: string
  detail?: string
  rawResponseBody?: string
}): void {
  const lines = [
    "========== BKG Rewards · Support · Resend ==========",
    `HTTP ${context.httpStatus}${context.httpStatusText ? ` ${context.httpStatusText}` : ""}`,
    ...(context.error ? [`error (code app): ${context.error}`] : []),
    ...(context.detail ? [`detail (réponse API / message Resend): ${context.detail}`] : []),
    ...(context.rawResponseBody
      ? [`corps brut (${context.rawResponseBody.length} car.):`, context.rawResponseBody]
      : []),
    "===================================================",
  ]
  const text = lines.join("\n")
  console.error("%c%s", RESEND_LOG_STYLE, text)
}
