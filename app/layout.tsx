import type React from "react"
import { Suspense } from "react"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "@/components/ui/toaster"
import { FloatingSoundToggle } from "@/components/floating-sound-toggle"
import { AdMobInitializer } from "@/components/admob-initializer"
import { AppStateAudioHandler } from "@/components/app-state-audio"
import { NativeBackButtonHandler } from "@/components/native-back-handler"
import { NativeImmersiveInit } from "@/components/native-immersive-init"
import { NativeWindowOpenShim } from "@/components/native-window-open-shim"
import { OfferwallProvider } from "@/components/offerwall-provider"
import "./globals.css"
import { SITE_PUBLIC_URL } from "@/lib/site-url"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const dynamic = "force-static"

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || SITE_PUBLIC_URL,
  ),
  title: "BKG Rewards - Gagnez des récompenses",
  description: "Rejoignez BKG Rewards et tentez de gagner des cadeaux gratuitement ! Regardez des publicités et gagnez des iPhone, consoles et cartes cadeaux.",
  generator: "v0.app",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BKG Rewards",
  },
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "BKG Rewards - Gagnez des récompenses",
    description: "Rejoignez BKG Rewards et tentez de gagner des cadeaux gratuitement ! Regardez des publicités et gagnez des iPhone, consoles et cartes cadeaux.",
    siteName: "BKG Rewards",
    images: [
      {
        url: "/og-image.png", // Vous devrez créer cette image
        width: 1200,
        height: 630,
        alt: "BKG Rewards - Gagnez des lots gratuitement",
      },
    ],
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BKG Rewards - Gagnez des récompenses",
    description: "Rejoignez BKG Rewards et tentez de gagner des cadeaux gratuitement !",
    images: ["/og-image.png"],
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#050505",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="font-sans antialiased min-h-svh overflow-x-hidden">
        <NativeBackButtonHandler />
        <NativeImmersiveInit />
        <NativeWindowOpenShim />
        <AdMobInitializer />
        <AppStateAudioHandler />
        <Suspense fallback={<div className="min-h-svh w-full" />}>
          <OfferwallProvider>{children}</OfferwallProvider>
        </Suspense>
        <FloatingSoundToggle />
        <Suspense fallback={null}>
          <Toaster />
        </Suspense>
        <Suspense fallback={null}>
          <Analytics />
        </Suspense>
      </body>
    </html>
  )
}
