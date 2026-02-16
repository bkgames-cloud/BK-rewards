import type React from "react"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "@/components/ui/toaster"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "BK'reward - Gagnez des lots gratuitement",
  description: "Rejoignez BK'reward et tentez de gagner des cadeaux gratuitement ! Regardez des publicités et gagnez des iPhone, consoles et cartes cadeaux.",
  generator: "v0.app",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BK'reward",
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
    title: "BK'reward - Gagnez des lots gratuitement",
    description: "Rejoignez BK'reward et tentez de gagner des cadeaux gratuitement ! Regardez des publicités et gagnez des iPhone, consoles et cartes cadeaux.",
    siteName: "BK'reward",
    images: [
      {
        url: "/og-image.png", // Vous devrez créer cette image
        width: 1200,
        height: 630,
        alt: "BK'reward - Gagnez des lots gratuitement",
      },
    ],
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BK'reward - Gagnez des lots gratuitement",
    description: "Rejoignez BK'reward et tentez de gagner des cadeaux gratuitement !",
    images: ["/og-image.png"],
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#1a1625",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr">
      <body className="font-sans antialiased">
        {children}
        <Toaster />
        <Analytics />
      </body>
    </html>
  )
}
