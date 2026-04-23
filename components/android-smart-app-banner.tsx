"use client"

import { useEffect, useState } from "react"
import { Capacitor } from "@capacitor/core"
import { ExternalLink, X } from "lucide-react"

function isAndroidMobileBrowser(): boolean {
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent || ""
  if (!/Android/i.test(ua)) return false
  if (/\bwv\b/i.test(ua)) return false
  return true
}

const DISMISS_KEY = "bk_smart_app_banner_dismissed"

/**
 * Bandeau type Smart App Banner : Web uniquement, navigateurs mobiles Android (hors WebView app).
 */
export function AndroidSmartAppBanner() {
  const [show, setShow] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (Capacitor.isNativePlatform()) return
    if (sessionStorage.getItem(DISMISS_KEY) === "1") return
    setShow(isAndroidMobileBrowser())
  }, [])

  if (!show || dismissed) return null
  // Séparation stricte: le Web ne doit pas pousser l'achat de points via Play Store.
  // Le bandeau ne sert qu’à promouvoir l’app, pas à vendre.

  const storeUrl =
    (process.env.NEXT_PUBLIC_PLAY_STORE_URL || "").trim() ||
    "https://play.google.com/store/apps/details?id=com.bkrewards.rewards"

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1")
    } catch {
      /* */
    }
    setDismissed(true)
  }

  return (
    <div
      className="sticky top-0 z-[100] flex w-full items-center justify-between gap-2 border-b border-[#D4AF37]/25 bg-[#050505]/95 px-3 py-2 text-xs text-[#D4AF37] backdrop-blur-md supports-[padding:max(0px)]:pt-[max(0.5rem,env(safe-area-inset-top))]"
      role="region"
      aria-label="Application BKG Rewards sur Google Play"
    >
      <p className="min-w-0 flex-1 leading-snug">
        <span className="text-[#f5f0e6]/90">Ouvre l’app BKG Rewards :</span>{" "}
        <span className="text-[#D4AF37]/80">plus rapide, récompenses dédiées.</span>
      </p>
      <div className="flex shrink-0 items-center gap-1">
        <a
          href={storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md bg-[#D4AF37]/15 px-2.5 py-1.5 font-medium text-[#D4AF37] transition hover:bg-[#D4AF37]/25"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          Play Store
        </a>
        <button
          type="button"
          onClick={dismiss}
          className="rounded p-1 text-[#D4AF37]/70 hover:bg-white/5 hover:text-[#D4AF37]"
          aria-label="Fermer le bandeau"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
