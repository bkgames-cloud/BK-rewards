"use client"

import { useEffect, useRef, useState } from "react"
import { Music, Music2 } from "lucide-react"
import { Capacitor } from "@capacitor/core"
import { Button } from "@/components/ui/button"
import { CAPACITOR_APP_STATE_EVENT, type CapacitorAppStateDetail } from "@/lib/capacitor-app-state"
import { soundService } from "@/lib/sounds"

export function FloatingSoundToggle() {
  const [soundsEnabled, setSoundsEnabled] = useState(true)
  const [hasInteracted, setHasInteracted] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const soundsEnabledRef = useRef(soundsEnabled)
  const hasInteractedRef = useRef(hasInteracted)

  soundsEnabledRef.current = soundsEnabled
  hasInteractedRef.current = hasInteracted

  useEffect(() => {
    setSoundsEnabled(soundService.isEnabled())
    if (!audioRef.current) {
      audioRef.current = new Audio("/ambiance.mp3")
      audioRef.current.loop = true
      audioRef.current.volume = 0.1
    }

    const markInteracted = () => setHasInteracted(true)
    window.addEventListener("pointerdown", markInteracted, { once: true })
    window.addEventListener("keydown", markInteracted, { once: true })
    window.addEventListener("touchstart", markInteracted, { once: true })

    return () => {
      window.removeEventListener("pointerdown", markInteracted)
      window.removeEventListener("keydown", markInteracted)
      window.removeEventListener("touchstart", markInteracted)
    }
  }, [])

  const handleToggle = () => {
    const next = soundService.toggle()
    setSoundsEnabled(next)
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("sounds-enabled-changed", { detail: next }))
    }
    if (next) {
      soundService.playClickSound()
    }
  }

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (!soundsEnabled) {
      audio.muted = true
      if (!audio.paused) audio.pause()
      return
    }

    audio.muted = false
    if (!hasInteracted) return
    if (audio.paused) {
      audio.play().catch(() => {
        // Ignore autoplay restrictions
      })
    }
  }, [soundsEnabled, hasInteracted])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const onAppState = (e: Event) => {
      const { isActive } = (e as CustomEvent<CapacitorAppStateDetail>).detail
      const audio = audioRef.current
      if (!audio) return
      if (!isActive) {
        audio.pause()
        return
      }
      if (soundsEnabledRef.current && hasInteractedRef.current) {
        audio.play().catch(() => {
          /* autoplay / WebView */
        })
      }
    }

    window.addEventListener(CAPACITOR_APP_STATE_EVENT, onAppState)
    return () => window.removeEventListener(CAPACITOR_APP_STATE_EVENT, onAppState)
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onAdStart = () => {
      // Coupe la musique pendant les pubs AdMob.
      if (!audio.paused) audio.pause()
    }
    const onAdEnd = () => {
      // Reprend la musique si l’utilisateur l’avait activée.
      if (soundsEnabledRef.current && hasInteractedRef.current) {
        audio.play().catch(() => {
          /* autoplay / WebView */
        })
      }
    }
    window.addEventListener("admob-ad-start", onAdStart as EventListener)
    window.addEventListener("admob-ad-end", onAdEnd as EventListener)
    return () => {
      window.removeEventListener("admob-ad-start", onAdStart as EventListener)
      window.removeEventListener("admob-ad-end", onAdEnd as EventListener)
    }
  }, [])

  return (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      onClick={handleToggle}
      className="fixed bottom-24 right-4 z-50 h-10 w-10 rounded-full border border-border/60 bg-card/90 shadow-lg backdrop-blur-md"
      aria-label={soundsEnabled ? "Couper la musique" : "Activer la musique"}
      title={soundsEnabled ? "Couper la musique" : "Activer la musique"}
    >
      {soundsEnabled ? <Music className="h-5 w-5" /> : <Music2 className="h-5 w-5 text-muted-foreground" />}
    </Button>
  )
}

