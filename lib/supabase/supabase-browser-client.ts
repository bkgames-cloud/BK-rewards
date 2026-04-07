import { createBrowserClient } from "@supabase/ssr"

let client: ReturnType<typeof createBrowserClient> | null = null

/** Realtime (WebSockets) — désactivé par défaut (évite “Connection lost” sur mobile). */
export const ENABLE_SUPABASE_REALTIME = process.env.NEXT_PUBLIC_ENABLE_SUPABASE_REALTIME === "true"

export function createClient() {
  if (client) {
    return client
  }

  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: (input, init) =>
          fetch(input, {
            ...init,
            cache: "no-store",
          }),
      },
    },
  )

  return client
}

/**
 * Vide le stockage local et les cookies accessibles en JS, puis oublie le client singleton.
 * À utiliser après une suppression de compte côté serveur : évite `signOut()` (403 si l’utilisateur n’existe plus).
 */
export function clearClientAuthStorageAndResetClient() {
  if (typeof window === "undefined") return
  try {
    localStorage.clear()
  } catch {
    /* ignore */
  }
  try {
    document.cookie.split(";").forEach((c) => {
      const name = c.split("=")[0]?.trim()
      if (!name) return
      document.cookie = `${name}=;max-age=0;path=/`
    })
  } catch {
    /* ignore */
  }
  client = null
}

export const supabaseBrowser = createClient
