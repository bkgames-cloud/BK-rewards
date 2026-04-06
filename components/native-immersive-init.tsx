"use client"

import { useEffect } from "react"
import { Capacitor } from "@capacitor/core"
import { App } from "@capacitor/app"

/**
 * @capacitor/status-bar : overlay + masquage (complète `plugins.SystemBars.hidden` + MainActivity).
 * Délai court pour passer après l’init du bridge Capacitor.
 */
export function NativeImmersiveInit() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return
    let cancelled = false
    const run = async () => {
      try {
        await App.getInfo()
      } catch {
        /* ignore */
      }
      if (cancelled) return
      await new Promise((r) => setTimeout(r, 50))
      if (cancelled) return
      try {
        const { StatusBar, Style } = await import("@capacitor/status-bar")
        await StatusBar.setOverlaysWebView({ overlay: true })
        await StatusBar.setStyle({ style: Style.Dark })
        await StatusBar.hide()
      } catch {
        /* natif / Android 16+ : options StatusBar peuvent être no-op */
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  return null
}
