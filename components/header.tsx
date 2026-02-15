"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Sparkles, Volume2, VolumeX } from "lucide-react"
import { soundService } from "@/lib/sounds"
import { Button } from "@/components/ui/button"

export function Header() {
  const [soundsEnabled, setSoundsEnabled] = useState(true)

  useEffect(() => {
    // Synchroniser l'état avec le service
    setSoundsEnabled(soundService.isEnabled())
  }, [])

  const handleToggleSounds = () => {
    const newState = soundService.toggle()
    setSoundsEnabled(newState)
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("sounds-enabled-changed", { detail: newState }))
    }
    // Jouer un son de clic pour confirmer l'action (mais seulement si on vient de l'activer)
    if (newState) {
      soundService.playClickSound()
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-lg safe-area-pt">
      <div className="flex items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="rounded-full bg-gradient-to-r from-(--color-sky-start) to-(--color-sky-end) p-2">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold text-foreground tracking-tight" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            BK&apos;reward
          </h1>
        </Link>
        <Link href="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          À propos
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleToggleSounds}
          className="h-9 w-9"
          aria-label={soundsEnabled ? "Désactiver les sons" : "Activer les sons"}
        >
          {soundsEnabled ? (
            <Volume2 className="h-5 w-5 text-foreground" />
          ) : (
            <VolumeX className="h-5 w-5 text-muted-foreground" />
          )}
        </Button>
      </div>
    </header>
  )
}
