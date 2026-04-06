/** Délai minimal entre deux tirages sur un même lot (affichage admin + utilisateur). */
export const DRAW_COOLDOWN_MS = 60 * 60 * 1000

/** Millisecondes restantes avant la fin du cooldown ; 0 si aucun ou expiré. */
export function remainingCooldownMs(lastDrawAt: string | null | undefined, nowMs: number): number {
  if (lastDrawAt == null || lastDrawAt === "") return 0
  const t = new Date(lastDrawAt).getTime()
  if (!Number.isFinite(t)) return 0
  const end = t + DRAW_COOLDOWN_MS
  const rem = end - nowMs
  return rem > 0 ? rem : 0
}

export function formatCooldownMmSs(remainingMs: number): string {
  const totalSec = Math.max(0, Math.floor(remainingMs / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}
