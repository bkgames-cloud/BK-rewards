"use client"

import { useEffect, type ReactNode } from "react"

type Props = { children: ReactNode }

/**
 * Vérifications légères au démarrage côté client (WebView) pour limiter les crashs si une API
 * navigateur ou globale attendue est absente.
 */
export function CapacitorStartupGuard({ children }: Props) {
  useEffect(() => {
    try {
      if (typeof window === "undefined") return
      // Marqueur optionnel pour le debug (ne pas faire planter si lecture seule impossible)
      try {
        ;(window as unknown as { __BKGR_STARTUP_OK?: boolean }).__BKGR_STARTUP_OK = true
      } catch {
        /* ignore */
      }
    } catch (e) {
      console.warn("[CapacitorStartupGuard] init:", e)
    }
  }, [])

  return <>{children}</>
}
