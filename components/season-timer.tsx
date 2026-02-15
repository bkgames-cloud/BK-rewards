"use client"

import { useState, useEffect } from "react"
import { Clock } from "lucide-react"
import type { Season } from "@/lib/types"

interface SeasonTimerProps {
  season: Season | null
}

export function SeasonTimer({ season }: SeasonTimerProps) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number
    hours: number
    minutes: number
    seconds: number
  } | null>(null)

  useEffect(() => {
    const calculateTimeLeft = () => {
      const fallbackEndDate = new Date("2026-03-31T23:59:59Z")
      const parsedEndDate = season?.end_date ? new Date(season.end_date) : null
      const endDate =
        parsedEndDate && !Number.isNaN(parsedEndDate.getTime()) && parsedEndDate > new Date()
          ? parsedEndDate
          : fallbackEndDate
      const now = new Date()
      const diff = endDate.getTime() - now.getTime()

      if (diff <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0 }
      }

      return {
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      }
    }

    setTimeLeft(calculateTimeLeft())

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft())
    }, 1000)

    return () => clearInterval(timer)
  }, [season])

  if (!timeLeft) {
    return (
      <div className="rounded-2xl bg-gradient-to-r from-(--color-sky-start) to-(--color-sky-end) p-4">
        <div className="flex items-center gap-2 text-primary-foreground">
          <Clock className="h-5 w-5" />
          <span className="font-medium">Chargement...</span>
        </div>
      </div>
    )
  }

  const isExpired = timeLeft.days === 0 && timeLeft.hours === 0 && timeLeft.minutes === 0 && timeLeft.seconds === 0
  const seasonName = season?.name || "Saison 1"

  return (
    <div className="rounded-2xl bg-gradient-to-r from-(--color-sky-start) to-(--color-sky-end) p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-primary-foreground">
          <Clock className="h-5 w-5" />
          <span className="font-medium">{seasonName}</span>
        </div>
        {isExpired ? (
          <span className="text-sm font-bold text-primary-foreground">Saison terminée</span>
        ) : (
          <div className="flex gap-2">
            <TimeBlock value={timeLeft.days} label="J" />
            <TimeBlock value={timeLeft.hours} label="H" />
            <TimeBlock value={timeLeft.minutes} label="M" />
            <TimeBlock value={timeLeft.seconds} label="S" />
          </div>
        )}
      </div>
    </div>
  )
}

function TimeBlock({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg bg-primary-foreground/20 px-2 py-1 backdrop-blur-sm">
      <span className="text-lg font-bold text-primary-foreground">{value.toString().padStart(2, "0")}</span>
      <span className="text-xs text-primary-foreground/80">{label}</span>
    </div>
  )
}
