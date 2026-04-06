"use client"

import type { SVGProps } from "react"
import { Instagram } from "lucide-react"
import { openExternalUrl } from "@/lib/open-external-url"

function TikTokIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.42V2h-3.21v12.26a2.89 2.89 0 1 1-2-2.75V8.24a6.11 6.11 0 1 0 5.2 6.02V8.05a8 8 0 0 0 4.8 1.6V6.69z" />
    </svg>
  )
}

const socialClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/30 text-muted-foreground transition-colors hover:text-foreground"

export function FooterSocialLinks() {
  return (
    <div className="flex items-center justify-center gap-4">
      <button
        type="button"
        aria-label="Instagram BKG Rewards"
        className={socialClass}
        onClick={() => void openExternalUrl("https://www.instagram.com/bkg_rewards/")}
      >
        <Instagram className="h-5 w-5" />
      </button>
      <button
        type="button"
        aria-label="TikTok BKG Rewards"
        className={socialClass}
        onClick={() => void openExternalUrl("https://www.tiktok.com/@bkg_rewards")}
      >
        <TikTokIcon className="h-5 w-5" />
      </button>
    </div>
  )
}
