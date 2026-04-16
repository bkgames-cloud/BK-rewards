"use client"

import { useEffect } from "react"
import { Capacitor } from "@capacitor/core"
import { initializeAdMob } from "@/lib/admob-rewarded"

/** Initialise le SDK AdMob au démarrage (Android uniquement). */
export function AdMobInitializer() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    if (Capacitor.getPlatform() !== "android") return
    console.log("[AdMob] init: start", { platform: Capacitor.getPlatform() })
    void initializeAdMob()
      .then(() => {
        console.log("[AdMob] init: ready")
      })
      .catch((e) => console.warn("[AdMob] init: error", e))
  }, [])
  return null
}
