"use client"

import { useState, useEffect } from "react"
import { Play, Sparkles } from "lucide-react"
import { soundService } from "@/lib/sounds"
import { Confetti } from "@/components/confetti"

interface VideoOverlayProps {
  isOpen: boolean
  onComplete: () => void
  onClose: () => void
  contextLabel?: string
  rewardLabel?: string
}

const VIDEO_DURATION = 30 // 30 seconds

export function VideoOverlay({ isOpen, onComplete, onClose, contextLabel, rewardLabel }: VideoOverlayProps) {
  const [progress, setProgress] = useState(0)
  const [canClose, setCanClose] = useState(false)
  const [hasCompleted, setHasCompleted] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setProgress(0)
      setCanClose(false)
      setHasCompleted(false)
      setShowConfetti(false)
      return
    }

    const interval = setInterval(() => {
      setProgress((prev) => {
        const newProgress = prev + 100 / VIDEO_DURATION
        if (newProgress >= 100) {
          clearInterval(interval)
          setCanClose(true)
          setHasCompleted(true)
          return 100
        }
        return newProgress
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isOpen])

  useEffect(() => {
    if (hasCompleted) {
      soundService.playSuccess()
      setShowConfetti(true)
      const confettiTimer = setTimeout(() => setShowConfetti(false), 2000)
      const timeout = setTimeout(() => {
        onComplete()
      }, 500)
      return () => {
        clearTimeout(timeout)
        clearTimeout(confettiTimer)
      }
    }
  }, [hasCompleted, onComplete])

  if (!isOpen) return null

  const timeRemaining = Math.ceil((100 - progress) / (100 / VIDEO_DURATION))

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm">
      {showConfetti && <Confetti duration={2000} particleCount={50} className="z-[120]" />}
      <div className="flex w-full max-w-sm flex-col items-center gap-6 px-4">
        {/* Fake Video Player */}
        <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-(--color-sky-start) to-(--color-sky-end) shadow-xl">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-40"
            style={{ backgroundImage: "url('/placeholder.jpg')" }}
          />
          <div className="absolute right-3 top-3 rounded-full bg-black/40 px-3 py-1 text-xs font-medium text-white">
            Publicité finit dans : {timeRemaining}s
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <div className="mb-3 rounded-full bg-primary-foreground/20 p-4">
              <Play className="h-12 w-12 text-primary-foreground" fill="currentColor" />
            </div>
            <p className="text-lg font-bold text-primary-foreground">Publicité en cours...</p>
            <p className="text-sm text-primary-foreground/80">
              Pour : {contextLabel || "Gagner des points"}
            </p>
          </div>

          {/* Progress Bar (bottom) */}
          <div className="absolute bottom-0 left-0 right-0 h-2 bg-black/30">
            <div
              className="h-full bg-green-400 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {progress >= 100 && (
          <div className="flex flex-col items-center gap-2 text-accent">
            <div className="flex items-center gap-2 text-sm font-semibold animate-bounce">
              <Sparkles className="h-4 w-4" />
              {rewardLabel || "+1 Point BK accumulé !"}
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          disabled={!canClose}
          className={
            canClose
              ? "w-full rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-500 px-4 py-3 text-sm font-bold text-yellow-950 shadow-lg transition-transform hover:scale-[1.02] animate-pulse"
              : "w-full rounded-xl bg-muted px-4 py-3 text-sm font-medium text-muted-foreground"
          }
        >
          {canClose ? "Récupérer mon point" : "Visionnage en cours..."}
        </button>
      </div>
    </div>
  )
}
