/**
 * Schéma personnalisé aligné sur AndroidManifest (intent com.bkrewards.rewards).
 * Host optionnel pour cibler l’écran « gagner des points ».
 */
export const ANDROID_APP_EARN_POINTS_DEEP_LINK = "com.bkrewards.rewards://earn-points"

export type AndroidDeepLinkOutcome = "likely_opened_app" | "likely_not_installed"

/**
 * Tente d’ouvrir l’app Android via le schéma personnalisé (Web uniquement).
 * Si la page reste visible après un court délai, on considère que l’app n’est probablement pas installée.
 */
export function tryOpenAndroidAppEarnPoints(): Promise<AndroidDeepLinkOutcome> {
  if (typeof window === "undefined") {
    return Promise.resolve("likely_not_installed")
  }

  return new Promise((resolve) => {
    let settled = false
    const done = (o: AndroidDeepLinkOutcome) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      window.removeEventListener("blur", onBlur)
      document.removeEventListener("visibilitychange", onVis)
      resolve(o)
    }

    const onBlur = () => done("likely_opened_app")
    const onVis = () => {
      if (document.visibilityState === "hidden") done("likely_opened_app")
    }

    window.addEventListener("blur", onBlur, { once: true })
    document.addEventListener("visibilitychange", onVis, { once: true })

    const timer = window.setTimeout(() => {
      done("likely_not_installed")
    }, 2200)

    try {
      window.location.href = ANDROID_APP_EARN_POINTS_DEEP_LINK
    } catch {
      done("likely_not_installed")
    }
  })
}
