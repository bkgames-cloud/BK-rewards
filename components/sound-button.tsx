"use client"

import { Button, ButtonProps } from "@/components/ui/button"
import { soundService } from "@/lib/sounds"
import { forwardRef } from "react"

interface SoundButtonProps extends ButtonProps {
  playSound?: boolean
  soundType?: "click" | "coin"
}

export const SoundButton = forwardRef<HTMLButtonElement, SoundButtonProps>(
  ({ playSound = true, soundType = "click", onClick, ...props }, ref) => {
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (playSound) {
        if (soundType === "coin") {
          soundService.playCoinSound()
        } else {
          soundService.playClickSound()
        }
      }
      onClick?.(e)
    }

    return <Button ref={ref} onClick={handleClick} {...props} />
  }
)

SoundButton.displayName = "SoundButton"
