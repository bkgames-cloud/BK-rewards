"use client"

import { Suspense } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { Header } from "@/components/header"
import { BottomNav } from "@/components/bottom-nav"
import { PageLoader } from "@/components/page-loader"
import { FooterSocialLinks } from "@/components/footer-social-links"
import { LEGAL_IDENTITY } from "@/lib/legal-identity"

function shouldUseShell(pathname: string): boolean {
  // Routes qui n'utilisaient pas l'ancien layout (main)
  const p = pathname || "/"
  if (p.startsWith("/auth")) return false
  if (p === "/signup") return false
  if (p.startsWith("/concours")) return false
  if (p === "/privacy" || p === "/terms" || p === "/cgu") return false
  return true
}

export function AppShell(props: { children: React.ReactNode }) {
  const pathname = usePathname() || "/"
  const useShell = shouldUseShell(pathname)

  if (!useShell) return <>{props.children}</>

  const supportEmail = "support.bkgamers@gmail.com"

  return (
    <div className="flex min-h-svh min-h-[100dvh] flex-col">
      <PageLoader />
      <Suspense fallback={<div className="h-14 w-full" />}>
        <Header />
      </Suspense>
      <main className="flex-1 w-full px-4 pb-4">{props.children}</main>
      <div className="app-scroll-bottom-pad px-4 space-y-2 text-center text-sm text-muted-foreground">
        <FooterSocialLinks />
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <Link href="/support" className="underline underline-offset-4">
            Support
          </Link>
          <a className="underline underline-offset-4" href={`mailto:${supportEmail}`}>
            Contacter le service client
          </a>
          <Link href="/privacy" className="underline underline-offset-4">
            Confidentialité
          </Link>
          <Link href="/terms" className="underline underline-offset-4">
            Conditions d’utilisation
          </Link>
        </div>
        <p className="text-xs">Propulsé par BKG Rewards</p>
        <div className="mx-auto w-full max-w-md pb-2">
          <p className="text-center text-[11px] text-muted-foreground/40">
            Société {LEGAL_IDENTITY.companyName} • SIREN {LEGAL_IDENTITY.siren} • SIRET {LEGAL_IDENTITY.siret} • RCS{" "}
            {LEGAL_IDENTITY.rcs}
          </p>
        </div>
        <p className="text-xs">
          BKG Rewards est une plateforme indépendante. Les marques citées appartiennent à leurs propriétaires
          respectifs et ne sont pas affiliées à ce service.
        </p>
      </div>
      <Suspense fallback={<div className="h-14 w-full" />}>
        <BottomNav />
      </Suspense>
    </div>
  )
}

