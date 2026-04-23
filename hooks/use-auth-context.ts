"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import type { Session, User } from "@supabase/supabase-js"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import { ENABLE_SUPABASE_REALTIME } from "@/lib/supabase/client"
import { fetchAuthProfileForUser } from "@/lib/fetch-auth-profile"
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
    let unsubscribeFocus: (() => void) | null = null

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

      const { data: profileData, error: profileError } = await fetchAuthProfileForUser(supabase, user.id)

      const seasonRes = await seasonPromise

      if (profileError) {
        console.error("[useAuthContext] profil introuvable ou erreur après repli colonnes", {
          code: profileError.code,
          message: profileError.message,
          details: (profileError as { details?: string }).details,
        })
      }

      if (!mounted) return

      setState({
        loading: false,
        session: session ?? null,
        user,
        isAuthenticated: true,
        profile: (profileData as Profile | null) ?? null,
        season: (seasonRes.data as Season | null) ?? null,
      })

      // Refresh léger au focus: utile quand on modifie la DB à la main (purchases / profils)
      // et qu'aucun UPDATE `profiles` n'a été émis (ou realtime désactivé).
      if (typeof window !== "undefined") {
        const onFocus = async () => {
          try {
            const { data: refreshedRow, error } = await fetchAuthProfileForUser(supabase, user.id)
            if (!mounted) return
            if (error) {
              console.warn("[useAuthContext] refresh profil (focus) — erreur", {
                code: error.code,
                message: error.message,
              })
              return
            }
            if (refreshedRow) {
              setState((prev) => ({ ...prev, profile: (refreshedRow as Profile) ?? prev.profile }))
            }
          } catch (e) {
            console.warn("[useAuthContext] refresh profil (focus) exception", e)
          }
        }
        window.addEventListener("focus", onFocus)
        unsubscribeFocus = () => window.removeEventListener("focus", onFocus)
      }

      // Realtime: garder le profil synchronisé sans redémarrage (points modifiés manuellement, etc.).
      if (ENABLE_SUPABASE_REALTIME) {
        profileChannel = supabase
          .channel(`auth-profile-${user.id}`)
          .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
            async () => {
              const { data: refreshedRow } = await fetchAuthProfileForUser(supabase, user.id)
              if (!mounted) return
              if (refreshedRow) {
                setState((prev) => ({
                  ...prev,
                  profile: (refreshedRow as Profile) ?? prev.profile,
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
      if (unsubscribeFocus) unsubscribeFocus()
      if (profileChannel) {
        const supabase = createClient()
        void supabase.removeChannel(profileChannel)
      }
    }
  }, [options?.redirectTo, options?.requireAuth, router])

  return state
}
