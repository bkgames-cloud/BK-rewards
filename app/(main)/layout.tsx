import type React from "react"
import { Header } from "@/components/header"
import { BottomNav } from "@/components/bottom-nav"
import { PageLoader } from "@/components/page-loader"

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supportEmail = "support@bkrewards.com"

  return (
    <div className="flex min-h-svh flex-col">
      <PageLoader />
      <Header />
      <main className="flex-1 pb-20">{children}</main>
      <div className="px-4 pb-24 space-y-2 text-center text-sm text-muted-foreground">
        <a className="underline underline-offset-4" href={`mailto:${supportEmail}`}>
          Contacter le service client
        </a>
        <p className="text-xs">Propulsé par BK&apos;reward</p>
      </div>
      <BottomNav />
    </div>
  )
}
