"use client"

import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react"
import { Home, Gift, User, Trophy, FileText, Bell, Menu, Mail } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Capacitor } from "@capacitor/core"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { cn } from "@/lib/utils"
import {
  DB_NOTIFICATIONS_CHANGED_EVENT,
  fetchUnreadNotificationsCount,
  markAllNotificationsRead,
} from "@/lib/db-notifications"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { createClient } from "@/lib/supabase/client"
import { ENABLE_SUPABASE_REALTIME } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { soundService } from "@/lib/sounds"
import { SUPPORT_INBOX_EMAIL } from "@/lib/admin-config"

function pathMatches(pathname: string, href: string) {
  const p = pathname.replace(/\/$/, "") || "/"
  const h = href.replace(/\/$/, "") || "/"
  return p === h
}

/** Chemins avec `/` final — alignés sur `trailingSlash: true` (dossiers `out/.../index.html` sous Capacitor). */
const navItems = [
  { href: "/", icon: Home, label: "Accueil" },
  { href: "/prizes/", icon: Gift, label: "Cadeaux" },
  { href: "/concours/", icon: Trophy, label: "Concours" },
  { href: "/notifications/", icon: Bell, label: "Alertes" },
  { href: "/profile/", icon: User, label: "Profil" },
  { href: "/reglement/", icon: FileText, label: "Règlement" },
]

/** Normalise vers le format `trailingSlash` (ex. `/profile/`). */
function withTrailingSlashHref(href: string): string {
  if (href === "/") return "/"
  return href.endsWith("/") ? href : `${href}/`
}

/**
 * Barre du bas : toujours `<Link href="/…/">` + sur Android, `router.push` (évite `assign` qui peut retomber sur l’accueil dans le WebView).
 */
function BottomNavLink({
  href,
  className,
  children,
  onClick,
}: {
  href: string
  className?: string
  children: ReactNode
  onClick?: () => void
}) {
  const router = useRouter()
  const linkHref = withTrailingSlashHref(href)

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.()
    if (!Capacitor.isNativePlatform()) return
    e.preventDefault()
    console.debug("[BottomNav] Capacitor router.push", linkHref)
    void router.push(linkHref)
  }

  return (
    <Link href={linkHref} prefetch={false} className={className} onClick={handleClick}>
      {children}
    </Link>
  )
}

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { toast } = useToast()
  const [unreadCount, setUnreadCount] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const notificationsChannelRef = useRef<RealtimeChannel | null>(null)

  const markAllReadAndSync = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) return
    setUnreadCount(0)
    await markAllNotificationsRead(supabase, user.id)
    window.dispatchEvent(new Event(DB_NOTIFICATIONS_CHANGED_EVENT))
    router.refresh()
  }, [router])

  useEffect(() => {
    const supabase = createClient()

    const refreshFromDb = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user?.id) {
        setUnreadCount(0)
        return
      }
      const n = await fetchUnreadNotificationsCount(supabase, user.id)
      setUnreadCount(n)
    }

    void refreshFromDb()
    window.addEventListener(DB_NOTIFICATIONS_CHANGED_EVENT, refreshFromDb)
    return () => {
      window.removeEventListener(DB_NOTIFICATIONS_CHANGED_EVENT, refreshFromDb)
    }
  }, [])

  // Évite de déclencher une écriture DB + setState via useEffect (lint: set-state-in-effect).
  // Le marquage "lu" est géré via les handlers onClick sur l’onglet Notifications.

  useEffect(() => {
    const supabase = createClient()

    const teardownChannel = async () => {
      if (notificationsChannelRef.current) {
        await supabase.removeChannel(notificationsChannelRef.current)
        notificationsChannelRef.current = null
      }
    }

    const bindNotificationsRealtime = async () => {
      await teardownChannel()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user?.id) {
        setUnreadCount(0)
        return
      }

      void fetchUnreadNotificationsCount(supabase, user.id).then(setUnreadCount)

      const channel = supabase
        .channel(`db-notifications-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload: { new: Record<string, unknown> }) => {
            const row = payload.new as { title?: string | null; message?: string | null }
            toast({
              title: row.title?.trim() || "Nouvelle alerte",
              description: row.message?.trim() || "",
            })
            soundService.playCoinSound()
            void fetchUnreadNotificationsCount(supabase, user.id).then(setUnreadCount)
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            void fetchUnreadNotificationsCount(supabase, user.id).then(setUnreadCount)
          },
        )
        .subscribe()

      notificationsChannelRef.current = channel
    }

    if (ENABLE_SUPABASE_REALTIME) {
      void bindNotificationsRealtime()
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      if (ENABLE_SUPABASE_REALTIME) {
        void bindNotificationsRealtime()
      }
    })

    return () => {
      subscription.unsubscribe()
      void teardownChannel()
    }
  }, [toast])

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-lg safe-area-pb shadow-[0_-4px_24px_rgba(0,0,0,0.15)]">
      {/* Desktop / Tablet */}
      <div className="hidden items-center justify-around px-1 py-2 sm:flex">
        {navItems.map((item) => {
          const isActive = pathMatches(pathname, item.href)
          const isPrimary = item.href === "/" || item.href === "/prizes/"
          return (
            <BottomNavLink
              key={item.href}
              href={item.href}
              onClick={
                item.href === "/notifications/"
                  ? () => {
                      void markAllReadAndSync()
                    }
                  : undefined
              }
              className={cn(
                "flex flex-col items-center gap-1 px-4 py-2 transition-colors rounded-md",
                isActive ? "text-primary bg-primary/10" : "text-muted-foreground",
                isPrimary && "font-semibold",
              )}
            >
              <span className="relative">
                <item.icon className="h-5 w-5" />
                {item.href === "/notifications/" && unreadCount > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </span>
              <span className="text-xs font-medium">{item.label}</span>
            </BottomNavLink>
          )
        })}
      </div>

      {/* Mobile : pt/pb un peu plus généreux pour remonter les cibles au-dessus de la barre système */}
      <div className="flex items-center justify-around px-1 pt-2 pb-3 sm:hidden">
        {[
          navItems[0],
          navItems[1],
          navItems[2],
        ].map((item) => {
          const isActive = pathMatches(pathname, item.href)
          const isPrimary = item.href === "/" || item.href === "/prizes/"
          return (
            <BottomNavLink
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-4 py-2 transition-colors rounded-md",
                isActive ? "text-primary bg-primary/10" : "text-muted-foreground",
                isPrimary && "font-semibold",
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </BottomNavLink>
          )
        })}

        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
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
          <SheetContent
            side="bottom"
            className="bg-card max-h-[min(85dvh,calc(100dvh-4rem))] overflow-y-auto safe-area-pb pt-2"
          >
            <SheetHeader>
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <div className="mt-4 grid grid-cols-2 gap-2 pb-2">
              {navItems.map((item) => (
                <BottomNavLink
                  key={item.href}
                  href={item.href}
                  onClick={() => {
                    if (item.href === "/notifications/") void markAllReadAndSync()
                    setMenuOpen(false)
                  }}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border border-border/50 px-3 py-2 text-sm",
                    pathMatches(pathname, item.href) ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </BottomNavLink>
              ))}
              <a
                href={`mailto:${SUPPORT_INBOX_EMAIL}?subject=${encodeURIComponent("Support BKG Rewards")}`}
                className="col-span-2 flex items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-3 text-sm font-medium text-primary"
                onClick={() => setMenuOpen(false)}
              >
                <Mail className="h-4 w-4 shrink-0" />
                Support
              </a>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  )
}
