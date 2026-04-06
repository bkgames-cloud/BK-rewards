/**
 * Champs lots `rewards_pools` : compteurs **videos** (`target_videos`, `current_videos`)
 * et prix de participation **`ticket_cost`**.
 */

export function parsePoolNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return null
}

export function getPoolTarget(row: Record<string, unknown>): number {
  const v = parsePoolNumber(row.target_videos)
  return v !== null ? v : 0
}

export function getPoolCurrent(row: Record<string, unknown>): number {
  const v = parsePoolNumber(row.current_videos)
  return v !== null ? v : 0
}

export function getNumFromRow(
  row: Record<string, unknown>,
  keys: string[],
  fallback = 0,
): number {
  for (const key of keys) {
    const n = parsePoolNumber(row[key])
    if (n !== null) return n
  }
  return fallback
}

/** Coût en points d’une participation : colonne `ticket_cost` (entier ≥ 1). */
export function getPoolTicketCost(row: Record<string, unknown>, fallback = 10): number {
  const n = getNumFromRow(row, ["ticket_cost"], fallback)
  const v = Math.max(1, Math.floor(Number.isFinite(n) ? n : fallback))
  return v
}
