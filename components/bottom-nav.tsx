"use client"

import { useEffect, useState } from "react"
import { Home, Gift, User, Trophy, FileText, Bell, Menu } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { getUnreadCount } from "@/lib/in-app-notifications"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose, SheetTrigger } from "@/components/ui/sheet"

const navItems = [
  { href: "/", icon: Home, label: "Accueil" },
  { href: "/prizes", icon: Gift, label: "Cadeaux" },
  { href: "/concours", icon: Trophy, label: "Concours" },
  { href: "/notifications", icon: Bell, label: "Alertes" },
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
      {/* Desktop / Tablet */}
      <div className="hidden items-center justify-around py-2 sm:flex">
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

      {/* Mobile */}
      <div className="flex items-center justify-around py-2 sm:hidden">
        {[
          navItems[0],
          navItems[1],
          navItems[2],
        ].map((item) => {
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
              <item.icon className="h-5 w-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          )
        })}

        <Sheet>
          <SheetTrigger asChild>
            <button className="flex flex-col items-center gap-1 px-4 py-2 text-muted-foreground">
              <span className="relative">
                <Menu className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </span>
              <span className="text-xs font-medium">Menu</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="bg-card">
            <SheetHeader>
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {navItems.map((item) => (
                <SheetClose asChild key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border border-border/50 px-3 py-2 text-sm",
                      pathname === item.href ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                </SheetClose>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  )
}
