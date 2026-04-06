/** URL directe APK / page de téléchargement Android (définir dans `.env` : `NEXT_PUBLIC_ANDROID_APK_URL`). */
export function getAndroidApkDownloadUrl(): string {
  if (typeof process === "undefined") return ""
  return process.env.NEXT_PUBLIC_ANDROID_APK_URL?.trim() ?? ""
}

/** Navigateur mobile (hors app Capacitor) — pour différencier desktop web / mobile web. */
export function isMobileWebBrowser(): boolean {
  if (typeof navigator === "undefined") return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}
