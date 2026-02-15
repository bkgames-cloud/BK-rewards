"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"

export function PageLoader() {
  const [isLoading, setIsLoading] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setIsLoading(true)
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 500) // Afficher pendant 500ms

    return () => clearTimeout(timer)
  }, [pathname])

  if (!isLoading) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="relative">
        {/* Initiales BK avec effet de brillance */}
        <div className="relative">
          <div className="text-6xl font-bold text-foreground tracking-tighter" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            BK
          </div>
          {/* Effet de brillance animé */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer-bk" />
        </div>
        {/* Spinner autour */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-20 w-20 animate-spin rounded-full border-4 border-transparent border-t-primary border-r-primary/50" />
        </div>
      </div>
    </div>
  )
}
