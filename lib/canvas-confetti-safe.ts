/**
 * Chargement dynamique + interop ESM/CJS pour éviter que le bundle WebView
 * (export statique Capacitor) référence `exports` / `module` au niveau racine.
 */
import type confetti from "canvas-confetti"

type ConfettiFn = typeof confetti

function resolveConfetti(mod: unknown): ConfettiFn | null {
  if (typeof mod === "function") {
    return mod as ConfettiFn
  }
  if (mod && typeof mod === "object" && "default" in mod) {
    const d = (mod as { default: unknown }).default
    if (typeof d === "function") {
      return d as ConfettiFn
    }
  }
  return null
}

export async function getConfetti(): Promise<ConfettiFn> {
  const mod = await import("canvas-confetti")
  const fn = resolveConfetti(mod)
  if (fn) {
    return fn
  }
  const noop: ConfettiFn = (() => null) as unknown as ConfettiFn
  return noop
}
