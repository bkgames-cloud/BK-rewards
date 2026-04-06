"use client"

import { useEffect } from "react"
import { Capacitor } from "@capacitor/core"
import { openExternalUrl } from "@/lib/open-external-url"

/**
 * Sur Android/iOS, redirige `window.open(url)` vers @capacitor/browser (offres Monlix, partenaires, etc.).
 */
export function NativeWindowOpenShim() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const original = window.open.bind(window)
    window.open = ((url?: string | URL, target?: string, features?: string) => {
      const s = typeof url === "string" ? url : url != null ? url.toString() : ""
      if (s && /^https?:\/\//i.test(s)) {
        void openExternalUrl(s)
        return null
      }
      return original(url as never, target, features)
    }) as typeof window.open
    return () => {
      window.open = original
    }
  }, [])

  return null
}
