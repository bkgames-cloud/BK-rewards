"use client"

import { useEffect } from "react"

export function ReferralSourceCapture() {
  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const ref = params.get("ref")
    if (ref === "FLYER") {
      window.localStorage.setItem("referral_source", "FLYER")
    }
  }, [])

  return null
}

