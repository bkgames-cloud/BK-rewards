"use client"

import { useEffect, useState } from "react"
import { CheckCircle2 } from "lucide-react"

interface SuccessAnimationProps {
  show: boolean
  onComplete?: () => void
}

export function SuccessAnimation({ show, onComplete }: SuccessAnimationProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (show) {
      setIsVisible(true)
      const timer = setTimeout(() => {
        setIsVisible(false)
        onComplete?.()
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [show, onComplete])

  if (!show || !isVisible) return null

  const confettiColors = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"]

  return (
    <div className="pointer-events-none fixed inset-0 z-[200] flex items-center justify-center animate-fade-in">
      {/* Confettis */}
      {[...Array(20)].map((_, i) => {
        const angle = (i * 18) * (Math.PI / 180)
        const distance = 150
        const x = Math.cos(angle) * distance
        const y = Math.sin(angle) * distance
        return (
          <div
            key={i}
            className="absolute h-3 w-3 rounded-full animate-confetti"
            style={{
              backgroundColor: confettiColors[i % confettiColors.length],
              left: `calc(50% + ${x}px)`,
              top: `calc(50% + ${y}px)`,
              animationDelay: `${i * 0.05}s`,
            }}
          />
        )
      })}

      {/* Checkmark animée */}
      <div className="relative z-10 animate-success-bounce">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-r from-accent to-accent/80 shadow-2xl">
          <CheckCircle2 className="h-12 w-12 text-accent-foreground" />
        </div>
      </div>
    </div>
  )
}
