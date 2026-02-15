"use client"

import { useEffect, useState } from "react"

interface PointAnimationProps {
  show: boolean
}

export function PointAnimation({ show }: PointAnimationProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (show) {
      setIsVisible(true)
      const timer = setTimeout(() => setIsVisible(false), 1500)
      return () => clearTimeout(timer)
    }
  }, [show])

  if (!show || !isVisible) return null

  return (
    <div className="pointer-events-none fixed left-1/2 top-1/2 z-[200] -translate-x-1/2 -translate-y-1/2 animate-point-pop">
      <div className="rounded-full bg-gradient-to-r from-accent to-accent/80 px-6 py-3 shadow-2xl animate-spin-slow">
        <span className="text-2xl font-bold text-accent-foreground">+1</span>
      </div>
    </div>
  )
}
