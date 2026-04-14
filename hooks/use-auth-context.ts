"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import type { Session, User } from "@supabase/supabase-js"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import { ENABLE_SUPABASE_REALTIME } from "@/lib/supabase/client"
import type { Profile, Season } from "@/lib/types"

type AuthContextState = {
  loading: boolean
  session: Session | null
  user: User | null
  isAuthenticated: boolean
  profile: Profile | null
  season: Season | null
}

export function useAuthContext(options?: { requireAuth?: boolean; redirectTo?: string }) {
  const router = useRouter()
  const [state, setState] = useState<AuthContextState>({
    loading: true,
    session: null,
    user: null,
    isAuthenticated: false,
    profile: null,
    season: null,
  })

  useEffect(() => {
    let mounted = true
    let profileChannel: RealtimeChannel | null = null

    const init = async () => {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const user = session?.user ?? null

      if (!mounted) return

      if (!user?.id) {
        if (options?.requireAuth && typeof window !== "undefined") {
          const target = options.redirectTo || "/auth/login/"
          console.debug("[useAuthContext] session absente, router.replace →", target)
          void router.replace(target)
          return
        }
        setState({
          loading: false,
          session: session ?? null,
          user: null,
          isAuthenticated: false,
          profile: null,
          season: null,
        })
        return
      }

      const seasonPromise = supabase
        .from("seasons")
        .select("*")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle()

      const primaryProfile = await supabase
        .from("profiles")
        // `points_balance` est optionnel (migration Nexus) : fallback si colonne absente.
        .select("points, points_balance, grade, username, avatar_url, tap_score")
        .eq("id", user.id)
        .single()

      const profileRes =
        primaryProfile.error &&
        (primaryProfile.error.message || "").toLowerCase().includes("points_balance")
          ? await supabase
              .from("profiles")
              .select("points, grade, username, avatar_url, tap_score")
              .eq("id", user.id)
              .single()
          : primaryProfile

      const seasonRes = await seasonPromise

      if (profileRes.error) {
        console.error(
          "ERREUR SQL PROFILE :",
          profileRes.error.message,
          profileRes.error.details,
          profileRes.error.hint,
        )
      }

      if (!mounted) return

      setState({
        loading: false,
        session: session ?? null,
        user,
        isAuthenticated: true,
        profile: (profileRes.data as Profile | null) ?? null,
        season: (seasonRes.data as Season | null) ?? null,
      })

      // Realtime: garder le profil synchronisé sans redémarrage (points modifiés manuellement, etc.).
      if (ENABLE_SUPABASE_REALTIME) {
        profileChannel = supabase
          .channel(`auth-profile-${user.id}`)
          .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
            async () => {
              const refreshedPrimary = await supabase
                .from("profiles")
                .select("points, points_balance, grade, username, avatar_url, tap_score")
                .eq("id", user.id)
                .maybeSingle()
              const refreshed =
                refreshedPrimary.error &&
                (refreshedPrimary.error.message || "").toLowerCase().includes("points_balance")
                  ? await supabase
                      .from("profiles")
                      .select("points, grade, username, avatar_url, tap_score")
                      .eq("id", user.id)
                      .maybeSingle()
                  : refreshedPrimary
              if (!mounted) return
              if (refreshed.data) {
                setState((prev) => ({
                  ...prev,
                  profile: (refreshed.data as Profile) ?? prev.profile,
                }))
              }
            },
          )
          .subscribe()
      }
    }

    void init()

    return () => {
      mounted = false
      if (profileChannel) {
        const supabase = createClient()
        void supabase.removeChannel(profileChannel)
      }
    }
  }, [options?.redirectTo, options?.requireAuth, router])

  return state
}
