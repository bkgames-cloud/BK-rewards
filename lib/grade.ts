export type ProfileGrade = "Gratuit" | "VIP" | "VIP+"

/**
 * Normalise le grade (insensible à la casse / espaces) pour éviter les écarts DB vs code
 * (ex. `vip+`, `Vip +`, `VIPPLUS`).
 */
export function normalizeGrade(input: unknown): ProfileGrade {
  const raw = typeof input === "string" ? input.trim() : ""
  if (!raw) return "Gratuit"
  const compact = raw.replace(/\s+/g, "").toUpperCase()
  if (compact === "VIP+" || compact === "VIPPLUS") return "VIP+"
  if (compact === "VIP") return "VIP"
  if (compact === "GRATUIT" || compact === "FREE") return "Gratuit"
  return "Gratuit"
}

export function gradeToFlags(grade: ProfileGrade): { isVip: boolean; isVipPlus: boolean } {
  return { isVip: grade === "VIP" || grade === "VIP+", isVipPlus: grade === "VIP+" }
}

