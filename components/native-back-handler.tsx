"use client"

import { useEffect, useRef } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Capacitor } from "@capacitor/core"

/**
 * Sur Android, intercepte le bouton retour physique pour naviguer dans l'historique
 * Next.js au lieu de fermer l'activité (comportement par défaut du WebView).
 */
export function NativeBackButtonHandler() {
  const router = useRouter()
  const pathname = usePathname()
  const pathnameRef = useRef(pathname)

  pathnameRef.current = pathname

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let remove: (() => void) | undefined

    const setup = async () => {
      const { App } = await import("@capacitor/app")
      const handle = await App.addListener("backButton", ({ canGoBack }) => {
        const path = pathnameRef.current || "/"
        if (canGoBack) {
          router.back()
          return
        }
        if (path !== "/" && path !== "") {
          router.replace("/")
          return
        }
      })
      remove = () => {
        void handle.remove()
      }
    }

    void setup()

    return () => {
      remove?.()
    }
  }, [router])

  return null
}
