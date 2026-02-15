"use client"

import { useEffect, useState } from "react"
import { Home, Gift, User, Trophy, FileText, Award, Bell } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { getUnreadCount } from "@/lib/in-app-notifications"

const navItems = [
  { href: "/", icon: Home, label: "Accueil" },
  { href: "/prizes", icon: Gift, label: "Cadeaux" },
  { href: "/tickets", icon: Trophy, label: "Tickets" },
  { href: "/notifications", icon: Bell, label: "Alertes" },
  { href: "/gagnants", icon: Award, label: "Gagnants" },
  { href: "/profile", icon: User, label: "Profil" },
  { href: "/reglement", icon: FileText, label: "Règlement" },
]

export function BottomNav() {
  const pathname = usePathname()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    const refresh = () => setUnreadCount(getUnreadCount())
    refresh()
    window.addEventListener("in-app-notifications-updated", refresh)
    window.addEventListener("storage", refresh)
    return () => {
      window.removeEventListener("in-app-notifications-updated", refresh)
      window.removeEventListener("storage", refresh)
    }
  }, [])

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-lg safe-area-pb">
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-4 py-2 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground",
              )}
            >
              <span className="relative">
                <item.icon className="h-5 w-5" />
                {item.href === "/notifications" && unreadCount > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </span>
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
