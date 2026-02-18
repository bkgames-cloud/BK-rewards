"use client"

import type { ReactNode } from "react"
import { Suspense } from "react"

interface SafePageProps {
  children: ReactNode
}

export function SafePage({ children }: SafePageProps) {
  return <Suspense fallback={<div className="min-h-svh w-full" />}>{children}</Suspense>
}
