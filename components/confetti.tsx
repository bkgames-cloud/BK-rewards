"use client"

import { useEffect, useState } from "react"
import { Ticket } from "lucide-react"

interface ConfettiParticle {
  id: number
  x: number
  y: number
  rotation: number
  rotationSpeed: number
  fallSpeed: number
  size: number
}

interface ConfettiProps {
  duration?: number
  particleCount?: number
  className?: string
}

export function Confetti({ duration = 2000, particleCount = 50, className }: ConfettiProps) {
  const [particles, setParticles] = useState<ConfettiParticle[]>([])
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    // Générer les particules
    const newParticles: ConfettiParticle[] = []
    for (let i = 0; i < particleCount; i++) {
      newParticles.push({
        id: i,
        x: Math.random() * 100, // Pourcentage de largeur
        y: -10 - Math.random() * 20, // Commence au-dessus de l'écran
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        fallSpeed: 2 + Math.random() * 4,
        size: 16 + Math.random() * 12,
      })
    }
    setParticles(newParticles)

    // Animer les particules avec requestAnimationFrame pour une animation plus fluide
    const startTime = Date.now()
    let animationFrameId: number

    const animate = () => {
      const elapsed = Date.now() - startTime
      
      setParticles((prev) =>
        prev.map((particle) => ({
          ...particle,
          y: particle.y + particle.fallSpeed,
          rotation: particle.rotation + particle.rotationSpeed,
          x: particle.x + (Math.random() - 0.5) * 0.5, // Légère dérive horizontale
        }))
      )

      if (elapsed < duration) {
        animationFrameId = requestAnimationFrame(animate)
      } else {
        setIsVisible(false)
      }
    }

    animationFrameId = requestAnimationFrame(animate)

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }
    }
  }, [duration, particleCount])

  if (!isVisible) return null

  return (
    <div className={`fixed inset-0 pointer-events-none z-50 overflow-hidden ${className || ""}`}>
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            transform: `rotate(${particle.rotation}deg)`,
            transition: "none",
          }}
        >
          <Ticket
            className="text-yellow-500 drop-shadow-lg"
            style={{
              width: `${particle.size}px`,
              height: `${particle.size}px`,
            }}
          />
        </div>
      ))}
    </div>
  )
}
