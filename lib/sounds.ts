// Service de gestion des effets sonores (100% AudioContext natif - Aucun fichier externe)

class SoundService {
  private static instance: SoundService
  private soundsEnabled: boolean = true
  private audioContext: AudioContext | null = null

  private constructor() {
    if (typeof window !== "undefined") {
      // Récupérer la préférence depuis localStorage
      const stored = localStorage.getItem("sounds_enabled")
      this.soundsEnabled = stored !== null ? stored === "true" : true

      // Initialiser le contexte audio
      try {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
        if (this.audioContext.state === "suspended") {
          this.audioContext.resume().catch(() => {
            console.debug("AudioContext suspendu")
          })
        }
      } catch (error) {
        console.warn("AudioContext non supporté:", error)
      }
    }
  }

  public static getInstance(): SoundService {
    if (!SoundService.instance) {
      SoundService.instance = new SoundService()
    }
    return SoundService.instance
  }

  /**
   * Réactive le contexte audio si nécessaire
   */
  private async ensureAudioContext(): Promise<boolean> {
    if (!this.soundsEnabled || typeof window === "undefined") {
      return false
    }

    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      }

      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume()
      }

      return true
    } catch (error) {
      console.warn("Erreur AudioContext:", error)
      return false
    }
  }

  /**
   * Génère un son "Crystal" (bip court) pour les clics
   */
  private playCrystalSound(): void {
    if (!this.soundsEnabled || typeof window === "undefined") {
      return
    }

    this.ensureAudioContext().then((ready) => {
      if (!ready || !this.audioContext) return

      try {
        console.log("🔊 SON DÉCLENCHÉ: Crystal (click)")
        
        const oscillator = this.audioContext.createOscillator()
        const gainNode = this.audioContext.createGain()

        oscillator.connect(gainNode)
        gainNode.connect(this.audioContext.destination)

        oscillator.frequency.value = 1200
        oscillator.type = "sine"

        const now = this.audioContext.currentTime
        gainNode.gain.setValueAtTime(0, now)
        gainNode.gain.linearRampToValueAtTime(0.25, now + 0.01)
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05)

        oscillator.start(now)
        oscillator.stop(now + 0.05)
      } catch (error) {
        console.warn("Erreur son Crystal:", error)
      }
    })
  }

  /**
   * Génère un son "Ding" ascendant pour les gains de pièces
   */
  private playDingSound(): void {
    if (!this.soundsEnabled || typeof window === "undefined") {
      return
    }

    this.ensureAudioContext().then((ready) => {
      if (!ready || !this.audioContext) return

      try {
        console.log("🔊 SON DÉCLENCHÉ: Ding (coin)")
        
        const oscillator = this.audioContext.createOscillator()
        const gainNode = this.audioContext.createGain()

        oscillator.connect(gainNode)
        gainNode.connect(this.audioContext.destination)

        oscillator.type = "sine"

        const now = this.audioContext.currentTime
        const duration = 0.2

        oscillator.frequency.setValueAtTime(600, now)
        oscillator.frequency.linearRampToValueAtTime(1000, now + duration)

        gainNode.gain.setValueAtTime(0, now)
        gainNode.gain.linearRampToValueAtTime(0.4, now + 0.02)
        gainNode.gain.setValueAtTime(0.4, now + duration * 0.7)
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration)

        oscillator.start(now)
        oscillator.stop(now + duration)
      } catch (error) {
        console.warn("Erreur son Ding:", error)
      }
    })
  }

  /**
   * Génère un son "Success" avec deux bips oscillateurs (grave puis aigu) pour simuler un gain de pièces
   */
  private playSuccessSound(): void {
    if (!this.soundsEnabled || typeof window === "undefined") {
      return
    }

    this.ensureAudioContext().then((ready) => {
      if (!ready || !this.audioContext) return

      try {
        console.log("🔊 SON DÉCLENCHÉ: Success (bip-bip)")
        
        const now = this.audioContext.currentTime
        const beepDuration = 0.12 // 120ms par bip
        const pauseDuration = 0.06 // 60ms de pause

        // Premier bip : grave (440Hz - La)
        const oscillator1 = this.audioContext.createOscillator()
        const gainNode1 = this.audioContext.createGain()

        oscillator1.connect(gainNode1)
        gainNode1.connect(this.audioContext.destination)

        oscillator1.frequency.value = 440
        oscillator1.type = "sine"

        gainNode1.gain.setValueAtTime(0, now)
        gainNode1.gain.linearRampToValueAtTime(0.35, now + 0.01)
        gainNode1.gain.setValueAtTime(0.35, now + beepDuration - 0.01)
        gainNode1.gain.exponentialRampToValueAtTime(0.01, now + beepDuration)

        oscillator1.start(now)
        oscillator1.stop(now + beepDuration)

        // Deuxième bip : aigu (880Hz - La octave supérieur)
        const oscillator2 = this.audioContext.createOscillator()
        const gainNode2 = this.audioContext.createGain()

        oscillator2.connect(gainNode2)
        gainNode2.connect(this.audioContext.destination)

        oscillator2.frequency.value = 880
        oscillator2.type = "sine"

        const secondBeepStart = now + beepDuration + pauseDuration

        gainNode2.gain.setValueAtTime(0, secondBeepStart)
        gainNode2.gain.linearRampToValueAtTime(0.35, secondBeepStart + 0.01)
        gainNode2.gain.setValueAtTime(0.35, secondBeepStart + beepDuration - 0.01)
        gainNode2.gain.exponentialRampToValueAtTime(0.01, secondBeepStart + beepDuration)

        oscillator2.start(secondBeepStart)
        oscillator2.stop(secondBeepStart + beepDuration)
      } catch (error) {
        console.warn("Erreur son Success:", error)
      }
    })
  }

  /**
   * Joue le son de gain (pièces) - Son "Ding" ascendant
   */
  public playCoinSound(): void {
    this.playDingSound()
  }

  /**
   * Joue le son de clic (pop) - Son "Crystal"
   */
  public playClickSound(): void {
    this.playCrystalSound()
  }

  /**
   * Joue le son de succès - Deux bips (grave puis aigu)
   */
  public playSuccess(): void {
    this.playSuccessSound()
  }

  /**
   * Joue un son générique (pour compatibilité)
   */
  public playSound(soundName: string, volume: number = 0.5): void {
    if (soundName === "coin") {
      this.playCoinSound()
    } else if (soundName === "click") {
      this.playClickSound()
    } else if (soundName === "success") {
      this.playSuccess()
    } else {
      this.playCrystalSound()
    }
  }

  /**
   * Active ou désactive les sons
   */
  public setEnabled(enabled: boolean): void {
    this.soundsEnabled = enabled
    if (typeof window !== "undefined") {
      localStorage.setItem("sounds_enabled", enabled.toString())
    }
  }

  /**
   * Vérifie si les sons sont activés
   */
  public isEnabled(): boolean {
    return this.soundsEnabled
  }

  /**
   * Bascule l'état des sons
   */
  public toggle(): boolean {
    this.setEnabled(!this.soundsEnabled)
    return this.soundsEnabled
  }
}

export const soundService = SoundService.getInstance()
