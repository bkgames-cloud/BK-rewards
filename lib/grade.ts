export type ProfileGrade = "Gratuit" | "VIP" | "VIP+"

export function normalizeGrade(input: unknown): ProfileGrade {
  const raw = typeof input === "string" ? input.trim() : ""
  if (raw === "VIP+") return "VIP+"
  if (raw === "VIP") return "VIP"
  if (raw === "Gratuit") return "Gratuit"
  return "Gratuit"
}

export function gradeToFlags(grade: ProfileGrade): { isVip: boolean; isVipPlus: boolean } {
  return { isVip: grade === "VIP" || grade === "VIP+", isVipPlus: grade === "VIP+" }
}

