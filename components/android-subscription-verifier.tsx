"use client"

import { useEffect } from "react"
import { Capacitor } from "@capacitor/core"
import { createClient } from "@/lib/supabase/client"
import { PaymentService } from "@/lib/payment-service"

/**
 * Android only — revalide au démarrage les abonnements Google Play connus.
 * (Ne déclenche aucun achat, ne montre aucune UI.)
 */
export function AndroidSubscriptionVerifier() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    if (Capacitor.getPlatform() !== "android") return
    const run = async () => {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      await PaymentService.verifyAndroidSubscriptionsOnLaunch(session?.access_token)
    }
    void run()
  }, [])

  return null
}

