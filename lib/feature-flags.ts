// Nom de code interne (anciennement "Nexus")
export const SHOW_PROJECT_ALPHA =
  typeof process !== "undefined"
    ? String(process.env.NEXT_PUBLIC_SHOW_PROJECT_ALPHA || "false").trim().toLowerCase() === "true"
    : false

