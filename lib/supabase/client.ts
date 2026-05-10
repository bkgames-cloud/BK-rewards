import { createBrowserClient } from "@supabase/ssr"

let client: ReturnType<typeof createBrowserClient> | null = null

/** Realtime (WebSockets) — désactivé par défaut (évite “Connection lost” sur mobile). */
export const ENABLE_SUPABASE_REALTIME =
  typeof process !== "undefined" ? process.env.NEXT_PUBLIC_ENABLE_SUPABASE_REALTIME === "true" : false

function getSupabasePublicConfig(): { url: string; anonKey: string } {
  return {
    url: "https://zfoamfyyllmjxmiwcyzr.supabase.co",
    anonKey:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmb2FtZnl5bGxtanhtaXdjeXpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxMjMzMjUsImV4cCI6MjA4MzY5OTMyNX0.CsOTU_NU4drP3xNUI__rodveTa1iHQwOHUXoyBJ8VuQ",
  }
}

export function createClient() {
  if (client) {
    return client
  }

  const { url, anonKey } = getSupabasePublicConfig()
  client = createBrowserClient(
    url,
    anonKey,
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
