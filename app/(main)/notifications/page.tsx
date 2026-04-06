"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell, Trash2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  DB_NOTIFICATIONS_CHANGED_EVENT,
  markAllNotificationsRead,
  type DbNotificationRow,
} from "@/lib/db-notifications"
import { createClient, ENABLE_SUPABASE_REALTIME } from "@/lib/supabase/client"
import type { RealtimeChannel } from "@supabase/supabase-js"

export default function NotificationsPage() {
  const router = useRouter()
  const [items, setItems] = useState<DbNotificationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let channel: RealtimeChannel | null = null
    let cancelled = false

    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user?.id) {
        if (!cancelled) {
          setUserId(null)
          setItems([])
          setLoading(false)
        }
        return
      }
      if (cancelled) return
      setUserId(user.id)

      const { data, error } = await supabase
        .from("notifications")
        .select("id, user_id, title, message, created_at, read")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (cancelled) return

      if (error) {
        console.error("[notifications]", error)
        setItems([])
      } else {
        setItems((data as DbNotificationRow[]) ?? [])
      }

      await markAllNotificationsRead(supabase, user.id)
      window.dispatchEvent(new Event(DB_NOTIFICATIONS_CHANGED_EVENT))
      router.refresh()
      setLoading(false)

      if (cancelled) return

      if (ENABLE_SUPABASE_REALTIME) {
        channel = supabase
          .channel(`notifications-page-${user.id}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "notifications",
              filter: `user_id=eq.${user.id}`,
            },
            (payload: { new: Record<string, unknown> }) => {
              const row = payload.new as DbNotificationRow
              setItems((prev) => {
                if (prev.some((p) => p.id === row.id)) return prev
                return [row, ...prev]
              })
              void (async () => {
                await markAllNotificationsRead(supabase, user.id)
                window.dispatchEvent(new Event(DB_NOTIFICATIONS_CHANGED_EVENT))
                router.refresh()
              })()
            },
          )
          .subscribe()
      }
    }

    void load()

    return () => {
      cancelled = true
      if (channel) void supabase.removeChannel(channel)
    }
  }, [router])

  const handleClear = async () => {
    if (!userId) return
    const supabase = createClient()
    const { error } = await supabase.from("notifications").delete().eq("user_id", userId)
    if (error) {
      console.error("[notifications] delete", error)
      return
    }
    setItems([])
    window.dispatchEvent(new Event(DB_NOTIFICATIONS_CHANGED_EVENT))
    router.refresh()
  }

  const formatDate = (iso: string | null | undefined) => {
    if (!iso) return ""
    try {
      return new Date(iso).toLocaleString("fr-FR", {
        dateStyle: "short",
        timeStyle: "short",
      })
    } catch {
      return iso
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <Card className="border border-border/50 bg-[#1a1a1a]/80 backdrop-blur-sm shadow-lg">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg text-foreground">
            <Bell className="h-5 w-5 text-accent" />
            Notifications
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void handleClear()}
            disabled={items.length === 0 || !userId}
            className="text-muted-foreground"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Tout effacer
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : !userId ? (
            <p className="text-sm text-muted-foreground">Connecte-toi pour voir tes alertes.</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune notification pour le moment.</p>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="rounded-lg bg-secondary/40 px-3 py-2 text-sm text-foreground"
              >
                {item.title && (
                  <p className="font-semibold text-primary">{item.title}</p>
                )}
                {item.message && <p className="text-foreground/90">{item.message}</p>}
                <p className="mt-1 text-xs text-muted-foreground">{formatDate(item.created_at)}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
