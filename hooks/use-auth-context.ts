"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import type { Session, User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
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

      const [profileRes, seasonRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("points, grade, username, avatar_url, tap_score")
          .eq("id", user.id)
          .single(),
        supabase.from("seasons").select("*").eq("is_active", true).limit(1).maybeSingle(),
      ])

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
    }

    void init()

    return () => {
      mounted = false
    }
  }, [options?.redirectTo, options?.requireAuth, router])

  return state
}
