export type InAppNotification = {
  id: string
  message: string
  createdAt: string
  read: boolean
}

const STORAGE_KEY = "in_app_notifications"

function readNotifications(): InAppNotification[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as InAppNotification[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeNotifications(items: InAppNotification[]) {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export function addInAppNotification(message: string) {
  const items = readNotifications()
  const next: InAppNotification = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    message,
    createdAt: new Date().toISOString(),
    read: false,
  }
  writeNotifications([next, ...items].slice(0, 50))
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("in-app-notifications-updated"))
  }
}

export function getInAppNotifications(): InAppNotification[] {
  return readNotifications()
}

export function markAllNotificationsRead() {
  const items = readNotifications().map((item) => ({ ...item, read: true }))
  writeNotifications(items)
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("in-app-notifications-updated"))
  }
}

export function getUnreadCount(): number {
  return readNotifications().filter((item) => !item.read).length
}

export function clearInAppNotifications() {
  writeNotifications([])
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("in-app-notifications-updated"))
  }
}
