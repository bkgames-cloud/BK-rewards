// Service de gestion des notifications Web

export class NotificationService {
  private static instance: NotificationService
  private permission: NotificationPermission = "default"

  private constructor() {
    if (typeof window !== "undefined") {
      this.permission = Notification.permission
    }
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService()
    }
    return NotificationService.instance
  }

  /**
   * Vérifie si les notifications sont supportées
   */
  public isSupported(): boolean {
    return typeof window !== "undefined" && "Notification" in window
  }

  /**
   * Vérifie si la permission est accordée
   */
  public hasPermission(): boolean {
    return this.isSupported() && this.permission === "granted"
  }

  /**
   * Demande la permission d'envoyer des notifications
   */
  public async requestPermission(): Promise<boolean> {
    if (!this.isSupported()) {
      console.warn("Les notifications ne sont pas supportées par ce navigateur")
      return false
    }

    if (this.permission === "granted") {
      return true
    }

    if (this.permission === "denied") {
      console.warn("La permission de notification a été refusée")
      return false
    }

    try {
      const permission = await Notification.requestPermission()
      this.permission = permission
      return permission === "granted"
    } catch (error) {
      console.error("Erreur lors de la demande de permission:", error)
      return false
    }
  }

  /**
   * Envoie une notification immédiate
   */
  public async sendNotification(
    title: string,
    options?: NotificationOptions
  ): Promise<void> {
    if (!this.hasPermission()) {
      console.warn("Permission de notification non accordée")
      return
    }

    try {
      const notification = new Notification(title, {
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        ...options,
      })

      // Fermer automatiquement après 5 secondes
      setTimeout(() => {
        notification.close()
      }, 5000)

      // Gérer le clic sur la notification
      notification.onclick = () => {
        window.focus()
        notification.close()
      }
    } catch (error) {
      console.error("Erreur lors de l'envoi de la notification:", error)
    }
  }

  /**
   * Programme une notification pour plus tard (utilise localStorage pour persister)
   * Note: Les notifications programmées nécessitent un Service Worker pour fonctionner
   * en arrière-plan. Ici, on utilise une approche simplifiée avec localStorage.
   */
  public scheduleNotification(
    title: string,
    delayMs: number,
    options?: NotificationOptions
  ): void {
    if (!this.hasPermission()) {
      console.warn("Permission de notification non accordée")
      return
    }

    const scheduledTime = Date.now() + delayMs
    const notificationData = {
      title,
      options,
      scheduledTime,
    }

    // Stocker dans localStorage
    const scheduledNotifications = this.getScheduledNotifications()
    scheduledNotifications.push(notificationData)
    localStorage.setItem(
      "scheduled_notifications",
      JSON.stringify(scheduledNotifications)
    )

    // Programmer la vérification
    setTimeout(() => {
      this.checkScheduledNotifications()
    }, delayMs)
  }

  /**
   * Vérifie et envoie les notifications programmées
   */
  public checkScheduledNotifications(): void {
    if (!this.hasPermission()) {
      return
    }

    const scheduledNotifications = this.getScheduledNotifications()
    const now = Date.now()
    const notificationsToSend = scheduledNotifications.filter(
      (notification) => notification.scheduledTime <= now
    )

    notificationsToSend.forEach((notification) => {
      this.sendNotification(notification.title, notification.options)
    })

    // Retirer les notifications envoyées
    const remainingNotifications = scheduledNotifications.filter(
      (notification) => notification.scheduledTime > now
    )
    localStorage.setItem(
      "scheduled_notifications",
      JSON.stringify(remainingNotifications)
    )
  }

  /**
   * Récupère les notifications programmées depuis localStorage
   */
  private getScheduledNotifications(): Array<{
    title: string
    options?: NotificationOptions
    scheduledTime: number
  }> {
    if (typeof window === "undefined") {
      return []
    }

    try {
      const stored = localStorage.getItem("scheduled_notifications")
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error("Erreur lors de la récupération des notifications:", error)
      return []
    }
  }

  /**
   * Nettoie les notifications programmées expirées
   */
  public cleanupExpiredNotifications(): void {
    const scheduledNotifications = this.getScheduledNotifications()
    const now = Date.now()
    const validNotifications = scheduledNotifications.filter(
      (notification) => notification.scheduledTime > now
    )
    localStorage.setItem(
      "scheduled_notifications",
      JSON.stringify(validNotifications)
    )
  }
}

// Instance singleton
export const notificationService = NotificationService.getInstance()

// Vérifier périodiquement les notifications programmées (toutes les minutes)
if (typeof window !== "undefined") {
  setInterval(() => {
    notificationService.checkScheduledNotifications()
  }, 60000) // Vérifier toutes les minutes

  // Vérifier au chargement de la page
  window.addEventListener("load", () => {
    notificationService.checkScheduledNotifications()
    notificationService.cleanupExpiredNotifications()
  })
}
