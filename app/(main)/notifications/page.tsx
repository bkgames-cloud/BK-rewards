"use client"

import { useEffect, useState } from "react"
import { Bell, Trash2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  clearInAppNotifications,
  getInAppNotifications,
  markAllNotificationsRead,
  type InAppNotification,
} from "@/lib/in-app-notifications"

export default function NotificationsPage() {
  const [items, setItems] = useState<InAppNotification[]>([])

  useEffect(() => {
    const list = getInAppNotifications()
    setItems(list)
    markAllNotificationsRead()
  }, [])

  const handleClear = () => {
    clearInAppNotifications()
    setItems([])
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
            onClick={handleClear}
            disabled={items.length === 0}
            className="text-muted-foreground"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Effacer
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune notification pour le moment.
            </p>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="rounded-lg bg-secondary/40 px-3 py-2 text-sm text-foreground"
              >
                {item.message}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
