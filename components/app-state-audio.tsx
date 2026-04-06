"use client"

import { useEffect } from "react"
import { Capacitor } from "@capacitor/core"
import { CAPACITOR_APP_STATE_EVENT, type CapacitorAppStateDetail } from "@/lib/capacitor-app-state"
import { soundService } from "@/lib/sounds"

/**
 * Met en pause l’AudioContext (effets sonores) quand l’app passe en arrière-plan
 * ou est quittée ; le réactive au retour si les sons sont toujours activés.
 * Émet aussi un événement global pour la musique d’ambiance (`FloatingSoundToggle`).
 */
export function AppStateAudioHandler() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let remove: (() => void) | undefined

    const setup = async () => {
      const { App } = await import("@capacitor/app")
      const sub = await App.addListener("appStateChange", ({ isActive }) => {
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent<CapacitorAppStateDetail>(CAPACITOR_APP_STATE_EVENT, {
              detail: { isActive },
            }),
          )
        }
        if (isActive) {
          void soundService.onAppBecameActive()
        } else {
          void soundService.onAppBecameInactive()
        }
      })
      remove = () => {
        void sub.remove()
      }
    }

    void setup()

    return () => {
      remove?.()
    }
  }, [])

  return null
}
