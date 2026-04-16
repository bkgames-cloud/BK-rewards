"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export type OfferwallConfig = {
  name: string
  url: string
}

type OfferwallContextValue = {
  offerwall: OfferwallConfig | null
  loading: boolean
  /** Permet d'override dynamique (Ayet, Monlix, etc.) */
  setOfferwall: (next: OfferwallConfig | null) => void
}

const OfferwallContext = createContext<OfferwallContextValue | null>(null)

const DEFAULT_OFFERWALL: OfferwallConfig = {
  name: "Offerwall",
  url: "https://bkg-rewards.com/monlix",
}

export function OfferwallProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [offerwall, setOfferwall] = useState<OfferwallConfig | null>(null)

  useEffect(() => {
    const load = async () => {
      const enabled =
        (process.env.NEXT_PUBLIC_OFFERWALL_ENABLED || "").trim().toLowerCase() !== "false"
      if (!enabled) {
        setOfferwall(null)
        setLoading(false)
        return
      }
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("app_settings")
          .select("offerwall_name, offerwall_url")
          .eq("id", 1)
          .maybeSingle()

        if (error) {
          setOfferwall(DEFAULT_OFFERWALL)
          return
        }

        const url = typeof data?.offerwall_url === "string" ? data.offerwall_url.trim() : ""
        const name = typeof data?.offerwall_name === "string" ? data.offerwall_name.trim() : ""

        if (url) {
          setOfferwall({ name: name || DEFAULT_OFFERWALL.name, url })
        } else {
          setOfferwall(DEFAULT_OFFERWALL)
        }
      } catch {
        setOfferwall(DEFAULT_OFFERWALL)
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  const value = useMemo<OfferwallContextValue>(
    () => ({
      offerwall,
      loading,
      setOfferwall,
    }),
    [offerwall, loading],
  )

  return <OfferwallContext.Provider value={value}>{children}</OfferwallContext.Provider>
}

export function useOfferwall() {
  const ctx = useContext(OfferwallContext)
  if (!ctx) {
    return {
      offerwall: DEFAULT_OFFERWALL,
      loading: false,
      setOfferwall: () => {},
    } satisfies OfferwallContextValue
  }
  return ctx
}

