import type React from "react"
import { Suspense } from "react"
import { Header } from "@/components/header"
import { BottomNav } from "@/components/bottom-nav"
import { PageLoader } from "@/components/page-loader"
import { LEGAL_IDENTITY } from "@/lib/legal-identity"

export default function ConcoursLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supportEmail = "support.bkgamers@gmail.com"

  return (
    <div className="flex min-h-svh min-h-[100dvh] flex-col">
      <PageLoader />
      <Suspense fallback={<div className="h-14 w-full" />}>
        <Header />
      </Suspense>
      <main className="flex-1 w-full px-4 pb-4">{children}</main>
      <div className="app-scroll-bottom-pad px-4 space-y-2 text-center text-sm text-muted-foreground">
        <a className="underline underline-offset-4" href={`mailto:${supportEmail}`}>
          Contacter le service client
        </a>
        <p className="text-xs">Propulsé par BKG Rewards</p>
        <div className="mx-auto w-full max-w-md pb-2">
          <p className="text-center text-[11px] text-muted-foreground/40">
            Société {LEGAL_IDENTITY.companyName} • SIREN {LEGAL_IDENTITY.siren} • SIRET {LEGAL_IDENTITY.siret} • RCS {LEGAL_IDENTITY.rcs}
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
