"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { CadeauCard } from "@/components/prize-card"
import { VideoOverlay } from "@/components/video-overlay"
import { SeasonTimer } from "@/components/season-timer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { createClient } from "@/lib/supabase/client"
import type { Cadeau, Profile, Season } from "@/lib/types"
import { Trophy, Sparkles, Crown } from "lucide-react"
import { notificationService } from "@/lib/notifications"
import { soundService } from "@/lib/sounds"
import { AnimatedCounter } from "@/components/animated-counter"
import { Confetti } from "@/components/confetti"
import { addTicket, participateToGift } from "@/lib/rewards"
import { addInAppNotification } from "@/lib/in-app-notifications"
import { RewardPoolsGrid } from "@/components/reward-pools-grid"

const backgroundAudio =
  typeof Audio !== "undefined" ? new Audio("/ambiance.mp3") : null

interface DashboardClientProps {
  cadeaux: Cadeau[]
  isAuthenticated: boolean
  userId?: string
  profile?: Profile | null
  season?: Season | null
  showWallet?: boolean
  showWelcome?: boolean
}

export function DashboardClient({
  cadeaux: initialCadeaux,
  isAuthenticated,
  userId,
  profile,
  season,
  showWallet = true,
  showWelcome = true,
}: DashboardClientProps) {
  const [cadeaux, setCadeaux] = useState<Cadeau[]>([])
  const [points, setPoints] = useState(profile?.points ?? 0)
  const [winningCadeau, setWinningCadeau] = useState<{ nom: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [isVip, setIsVip] = useState(false)
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [userTicketCounts, setUserTicketCounts] = useState<Record<string, number>>({})
  const [hasInteracted, setHasInteracted] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [dailyBoostAvailable, setDailyBoostAvailable] = useState(false)
  const [showAddressModal, setShowAddressModal] = useState(false)

  
  // Charger les cadeaux depuis Supabase (comme l'admin) et vérifier le statut VIP
  useEffect(() => {
    async function fetchCadeaux() {
      const supabase = createClient()
      
      try {
        const { data, error } = await supabase
          .from("cadeaux")
          .select("*")
          .order("points_par_ticket", { ascending: false }) // Tri par prix décroissant comme l'admin
        
        if (error) {
          console.error("[DashboardClient] Erreur lors de la récupération des cadeaux:", error)
          setCadeaux([])
          return
        }
        
        // Filtrer uniquement ceux avec un nom valide
        const filtered = (data || []).filter((c: any) => c.nom && c.nom.trim() !== "")
        setCadeaux(filtered as Cadeau[])
      } catch (error) {
        console.error("[DashboardClient] Erreur critique:", error)
        setCadeaux([])
      } finally {
        setLoading(false)
      }
    }
    
    async function checkVipStatus() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.id) return;
      
      // Protection 400 : vérifier userId ET user au tout début
      if (!userId) {
        setIsVip(false)
        return
      }
      
      // Protection 400 : empêcher l'appel si user.id ne correspond pas à userId
      if (user.id !== userId) {
        setIsVip(false)
        return
      }
      
      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("is_vip, notification_message")
        .eq("id", userId)
        .single()
      
      // Ne pas logger l'erreur si c'est juste que le profil n'existe pas encore
      if (error && error.code !== "PGRST116") {
        // Erreur silencieuse pour éviter les erreurs 400
      } else if (profileData) {
        setIsVip(profileData.is_vip || false)
        if (profileData.notification_message) {
          setNotificationMessage(profileData.notification_message)
        }
      }
    }
    
    fetchCadeaux()
    
    async function loadVipStatus() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return;
      checkVipStatus()
    }
    
    loadVipStatus()
  }, [userId]) // Recharger si userId change
  
  // Mettre à jour les points quand le profil change
  useEffect(() => {
    if (profile?.points !== undefined) {
      setPoints(profile.points)
    }
  }, [profile])

  // Daily Boost: première pub du jour (fuseau local) = x2
  useEffect(() => {
    async function fetchDailyBoostStatus() {
      if (!userId || !isAuthenticated) {
        setDailyBoostAvailable(false)
        return
      }
      const supabase = createClient()
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const { count } = await supabase
        .from("video_views")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", todayStart.toISOString())
      setDailyBoostAvailable((count || 0) === 0)
    }
    fetchDailyBoostStatus()
  }, [userId, isAuthenticated])

  // Musique de fond liée au bouton haut-parleur
  useEffect(() => {
    if (!backgroundAudio || typeof window === "undefined") return

    backgroundAudio.loop = true
    backgroundAudio.volume = 0.1
    setIsMuted(
      localStorage.getItem("sounds_enabled") === "false" ||
        Boolean(backgroundAudio.paused),
    )

    const markInteracted = () => setHasInteracted(true)
    window.addEventListener("pointerdown", markInteracted, { once: true })
    window.addEventListener("keydown", markInteracted, { once: true })
    window.addEventListener("touchstart", markInteracted, { once: true })

    return () => {
      window.removeEventListener("pointerdown", markInteracted)
      window.removeEventListener("keydown", markInteracted)
      window.removeEventListener("touchstart", markInteracted)
    }
  }, [])

  useEffect(() => {
    if (!backgroundAudio || typeof window === "undefined") return

    const handleToggle = (event?: Event) => {
      const enabled =
        (event as CustomEvent<boolean> | undefined)?.detail ??
        localStorage.getItem("sounds_enabled") !== "false"

      setIsMuted(!enabled)
      if (!enabled) {
        if (!backgroundAudio.paused) backgroundAudio.pause()
        return
      }

      if (!hasInteracted) return

      if (backgroundAudio.paused) {
        backgroundAudio.play().catch(() => {
          // Ignore autoplay restrictions
        })
      }
    }

    handleToggle()
    window.addEventListener("sounds-enabled-changed", handleToggle)
    window.addEventListener("storage", handleToggle)

    return () => {
      window.removeEventListener("sounds-enabled-changed", handleToggle)
      window.removeEventListener("storage", handleToggle)
    }
  }, [hasInteracted])

  useEffect(() => {
    if (!backgroundAudio) return
    if (isMuted) {
      if (!backgroundAudio.paused) backgroundAudio.pause()
      return
    }
    if (!hasInteracted) return
    if (backgroundAudio.paused) {
      backgroundAudio.play().catch(() => {
        // Ignore autoplay restrictions
      })
    }
  }, [isMuted, hasInteracted])


  // Charger le nombre de tickets par cadeau pour l'utilisateur
  useEffect(() => {
    async function fetchUserTickets() {
      if (!userId || !isAuthenticated) {
        setUserTicketCounts({})
        return
      }

      const supabase = createClient()
      const { data, error } = await supabase
        .from("tickets")
        .select("cadeau_id")
        .eq("user_id", userId)

      if (error) {
        console.error("[DashboardClient] Error loading user tickets:", error)
        setUserTicketCounts({})
        return
      }

      const counts: Record<string, number> = {}
      for (const row of data || []) {
        const cadeauId = (row as { cadeau_id?: string }).cadeau_id
        if (!cadeauId) continue
        counts[cadeauId] = (counts[cadeauId] || 0) + 1
      }

      setUserTicketCounts(counts)
    }

    fetchUserTickets()
  }, [userId, isAuthenticated])

  // Vérifier si l'utilisateur est gagnant d'un cadeau avec statut 'complet'
  useEffect(() => {
    async function checkWinning() {
      if (!userId || !isAuthenticated) {
        setWinningCadeau(null)
        return
      }

      const supabase = createClient()

      try {
        // Requête directe sur cadeaux avec gagnant_id (la colonne doit exister dans la base)
        const { data: cadeaux, error: cadeauxError } = await supabase
          .from("cadeaux")
          .select("id, nom, statut")
          .eq("gagnant_id", userId)
          .eq("statut", "complet")
          .limit(1)

        if (cadeauxError) {
          // Si l'erreur indique que la colonne n'existe pas, utiliser le fallback via gagnants
          const errorMessage = JSON.stringify(cadeauxError, null, 2)
          console.error("[DashboardClient] Détails de l'erreur cadeaux (gagnant_id):", errorMessage)
          
          // Fallback : Via la table gagnants
          const { data: gagnants, error: gagnantsError } = await supabase
            .from("gagnants")
            .select("cadeau_id")
            .eq("user_id", userId)

          if (gagnantsError) {
            console.error("[DashboardClient] Détails de l'erreur gagnants (fallback):", JSON.stringify(gagnantsError, null, 2))
            setWinningCadeau(null)
            return
          }

          // Si pas de gagnants trouvés, pas de cadeau gagné (pas d'erreur, juste null)
          if (!gagnants || gagnants.length === 0) {
            setWinningCadeau(null)
            return
          }

          // Récupérer les cadeaux correspondants avec statut 'complet' et nom
          const cadeauIds = gagnants
            .map((g: { cadeau_id: string }) => g.cadeau_id)
            .filter(Boolean) as string[]
          
          if (cadeauIds.length === 0) {
            setWinningCadeau(null)
            return
          }

          // Récupérer les cadeaux avec nom (pas titre)
          const { data: cadeauxFallback, error: cadeauxFallbackError } = await supabase
            .from("cadeaux")
            .select("id, nom, statut")
            .in("id", cadeauIds)
            .eq("statut", "complet")
            .limit(1)

          if (cadeauxFallbackError) {
            console.error("[DashboardClient] Détails de l'erreur cadeaux (fallback):", JSON.stringify(cadeauxFallbackError, null, 2))
            setWinningCadeau(null)
            return
          }

          // Vérifier que le cadeau a un nom valide
          if (cadeauxFallback && cadeauxFallback.length > 0 && cadeauxFallback[0].nom && cadeauxFallback[0].nom.trim() !== "") {
            setWinningCadeau({ nom: cadeauxFallback[0].nom })
          } else {
            setWinningCadeau(null)
          }
          return
        }

        // Vérifier que le cadeau a un nom valide (requête directe réussie)
        if (cadeaux && cadeaux.length > 0 && cadeaux[0].nom && cadeaux[0].nom.trim() !== "") {
          const wonCadeau = { nom: cadeaux[0].nom }
          setWinningCadeau(wonCadeau)
          
          // Envoyer une notification si la permission est accordée
          if (notificationService.hasPermission()) {
            notificationService.sendNotification(
              "🎉 Félicitations ! Vous avez gagné !",
              {
                body: `Vous avez gagné ${wonCadeau.nom} ! Nos équipes préparent l'envoi.`,
                icon: "/favicon.ico",
                badge: "/favicon.ico",
                tag: `winner_${cadeaux[0].id}`,
              }
            )
          }
        } else {
          // Pas d'erreur, juste pas de cadeau gagné
          setWinningCadeau(null)
        }
      } catch (error) {
        console.error("[DashboardClient] Détails de l'erreur (catch):", JSON.stringify(error, null, 2))
        setWinningCadeau(null)
      }
    }

    checkWinning()
  }, [userId, isAuthenticated])

  const [isWatching, setIsWatching] = useState(false)
  const [isRewarding, setIsRewarding] = useState(false)
  const [participatingId, setParticipatingId] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [statusType, setStatusType] = useState<"success" | "error" | null>(null)
  const router = useRouter()

  // Baisser la musique pendant la pub, puis restaurer ensuite
  useEffect(() => {
    if (!backgroundAudio) return
    if (isWatching) {
      if (!backgroundAudio.paused) {
        backgroundAudio.pause()
      }
    } else {
      if (!isMuted && hasInteracted && backgroundAudio.paused) {
        backgroundAudio.play().catch(() => {})
      }
      backgroundAudio.volume = 0.3
    }
  }, [isWatching, isMuted, hasInteracted])

  const handleOpenAd = useCallback(() => {
    setStatusMessage(null)
    setStatusType(null)

    if (!isAuthenticated) {
      router.push("/auth/login")
      return
    }

    setIsWatching(true)
  }, [isAuthenticated, router])

  const handleAdComplete = useCallback(async () => {
    if (!userId) return

    setIsRewarding(true)
    setStatusMessage(null)
    setStatusType(null)

    const supabase = createClient()

    // Vérifier que l'utilisateur est bien authentifié
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) {
      setStatusMessage("Vous devez être connecté pour gagner des points.")
      setStatusType("error")
      setIsRewarding(false)
      setIsWatching(false)
      return
    }

    const { data, error } = await supabase.rpc("add_reward_points").single()

    if (error) {
      console.error("[DashboardClient] reward_ad_view error:", error)
      console.error("[DashboardClient] Error details:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      })
      const message =
        error.message?.includes("hour_limit") || error.code === "P0001"
          ? "Limite atteinte : 5 vidéos par heure."
          : error.message?.includes("day_limit")
            ? "Limite atteinte : 25 vidéos par jour."
            : error.message?.includes("not_authenticated")
              ? "Vous devez être connecté pour gagner des points."
              : `Erreur : ${error.message || error.code || "Impossible d'ajouter des points pour le moment."}`
      setStatusMessage(message)
      setStatusType("error")
    } else if (data) {
      setPoints(data.new_points)
      setStatusMessage(
        data.bonus_applied ? "+2 points (Bonus quotidien)" : "+1 point ajouté au wallet.",
      )
      setStatusType("success")
      if (data.bonus_applied) {
        setDailyBoostAvailable(false)
      }
      addInAppNotification("Point reçu !")
      // Jouer le son de gain de pièces
      soundService.playCoinSound()
    } else {
      setStatusMessage("Aucune donnée retournée par la fonction.")
      setStatusType("error")
    }

    setIsRewarding(false)
    setIsWatching(false)
    router.refresh()
  }, [userId, router])

  const handleCloseVideo = useCallback(() => {
    if (isRewarding) return
    setIsWatching(false)
  }, [isRewarding])

  const handleWatchVideo = useCallback(
    async (cadeauId: string) => {
      if (!userId) return

      setIsRewarding(true)
      setStatusMessage(null)
      setStatusType(null)

      const supabase = createClient()
      
      // Vérifier que l'utilisateur est bien authentifié
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) {
        setStatusMessage("Vous devez être connecté pour regarder des vidéos.")
        setStatusType("error")
        setIsRewarding(false)
        return
      }

      // Appeler addTicket pour ajouter 1 point
      try {
        const result = await addTicket()
        if (result) {
          setPoints(result.new_points)
          setStatusMessage("+1 point ajouté au wallet.")
          setStatusType("success")
          // Jouer le son de gain de pièces
          soundService.playCoinSound()
          
          // Afficher les confettis
          setShowConfetti(true)
          setTimeout(() => {
            setShowConfetti(false)
          }, 2000)
        } else {
          setStatusMessage("Aucune donnée retournée par la fonction.")
          setStatusType("error")
        }
      } catch (error: any) {
        setStatusMessage(error.message || "Erreur lors de l'ajout de points.")
        setStatusType("error")
      }

      setIsRewarding(false)
      router.refresh()
    },
    [userId, router],
  )

  const handleParticipate = useCallback(
    async (cadeauId: string, pointsParTicket?: number) => {
      if (!userId) return

      setParticipatingId(cadeauId)
      setStatusMessage(null)
      setStatusType(null)

      const supabase = createClient()
      
      // Vérifier que l'utilisateur est bien authentifié (protection 400)
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser || !currentUser.id) {
        setStatusMessage("Vous devez être connecté pour participer.")
        setStatusType("error")
        setParticipatingId(null)
        return
      }

      // Vérifier que userId correspond bien à currentUser.id
      if (userId !== currentUser.id) {
        console.error("[DashboardClient] ID mismatch:", { userId, currentUserId: currentUser.id })
        setStatusMessage("Erreur d'authentification.")
        setStatusType("error")
        setParticipatingId(null)
        return
      }

      // Trouver le cadeau pour récupérer son prix
      const cadeau = cadeaux.find((c) => c.id === cadeauId)
      if (!cadeau) {
        setStatusMessage("Cadeau introuvable.")
        setStatusType("error")
        setParticipatingId(null)
        return
      }

      // Double vérification : vérifier que l'utilisateur a assez de tickets AVANT la transaction
      if (points < cadeau.points_par_ticket) {
        setStatusMessage(`Vous n'avez pas assez de tickets. Il vous faut ${cadeau.points_par_ticket} tickets pour participer.`)
        setStatusType("error")
        setParticipatingId(null)
        return
      }

      // Récupérer les points actuels depuis la base pour vérification
      const { data: userProfile, error: profileError } = await supabase
        .from("profiles")
        .select("adresse, code_postal, ville, points")
        .eq("id", currentUser.id) // Utiliser currentUser.id directement
        .single()

      if (profileError || !userProfile) {
        setStatusMessage("Erreur lors de la vérification du profil.")
        setStatusType("error")
        setParticipatingId(null)
        return
      }

      // Vérification finale des points depuis la base (double sécurité)
      const currentTickets = userProfile.points || 0
      const requiredTickets = pointsParTicket ?? cadeau.points_par_ticket
      
      // Correction Participation (-10) : Pour l'iPhone, soustraire 10 tickets
      const isIphone = cadeau.nom.toLowerCase().includes("iphone") || requiredTickets === 10
      const ticketsToDeduct = isIphone ? 10 : requiredTickets
      
      // Sécurité : vérifier que l'utilisateur a assez de tickets AVANT l'appel Supabase
      if (currentTickets < ticketsToDeduct) {
        setStatusMessage(`Vous n'avez pas assez de tickets. Il vous faut ${ticketsToDeduct} tickets pour participer.`)
        setStatusType("error")
        setParticipatingId(null)
        return
      }
      
      // Log pour vérification visuelle

      // Adresse de livraison requise : afficher une fenêtre élégante
      if (!userProfile.adresse || !userProfile.code_postal || !userProfile.ville) {
        setShowAddressModal(true)
        setParticipatingId(null)
        return
      }

      // Correction : Mise à jour directe avec soustraction de 10 tickets pour l'iPhone
      if (isIphone) {
        if (currentTickets < 10) {
          setStatusMessage("Vous n'avez pas assez de tickets. Il vous faut 10 tickets pour participer.")
          setStatusType("error")
          setParticipatingId(null)
          return
        }
        const user = currentUser
        // Vérifier et débiter les points côté serveur (sécurité)
        const newPoints = currentTickets - ticketsToDeduct
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ points: newPoints })
          .eq("id", user.id)

        if (updateError) {
          setStatusMessage("Erreur lors du débit des points.")
          setStatusType("error")
          setParticipatingId(null)
          return
        }

        // Mettre à jour l'affichage local après succès serveur
        setPoints(newPoints)
        
        // Créer le ticket
        const { error: ticketError } = await supabase
          .from("tickets")
          .insert({
            user_id: currentUser.id,
            cadeau_id: cadeauId,
          })
        
        if (ticketError) {
          // Annuler la mise à jour locale si la création du ticket échoue
          setPoints(currentTickets)
          setStatusMessage("Erreur lors de la création du ticket.")
          setStatusType("error")
          setParticipatingId(null)
          return
        }
        
        // Incrémenter le compteur local pour ce cadeau
        setUserTicketCounts((prev) => ({
          ...prev,
          [cadeauId]: (prev[cadeauId] || 0) + 1,
        }))
        
        // Mettre à jour le compteur de tickets du cadeau
        const { data: cadeauData } = await supabase
          .from("cadeaux")
          .select("tickets_actuels, objectif_tickets, statut")
          .eq("id", cadeauId)
          .single()
        
        if (cadeauData) {
          const newTicketsActuels = (cadeauData.tickets_actuels || 0) - 10
          const newStatut = newTicketsActuels >= (cadeauData.objectif_tickets || 0) ? "complet" : cadeauData.statut
          
          await supabase
            .from("cadeaux")
            .update({ 
              tickets_actuels: newTicketsActuels,
              statut: newStatut as any
            })
            .eq("id", cadeauId)
        }
        
        // Recharger les cadeaux
        const { data: reloadedData } = await supabase
          .from("cadeaux")
          .select("*")
          .order("points_par_ticket", { ascending: false })
        
        const updatedCadeaux = reloadedData
          ? (reloadedData || []).filter((c: any) => c.nom && c.nom.trim() !== "") as Cadeau[]
          : []
        
        if (updatedCadeaux.length > 0) {
          setCadeaux(updatedCadeaux)
        }
        
        soundService.playSuccess()
        setShowConfetti(true)
        setTimeout(() => {
          setShowConfetti(false)
        }, 2000)
        
        setStatusMessage("Participation enregistrée, ticket généré.")
        setStatusType("success")
        addInAppNotification(`Ticket validé pour ${cadeau.nom} !`)
        router.refresh()
        setParticipatingId(null)
        return
      }

      // Utiliser la fonction extraite participateToGift pour les autres cadeaux
      try {
        const result = await participateToGift(cadeauId, requiredTickets, currentTickets)
        // Mise à jour visuelle immédiate pour que l'utilisateur voie les tickets baisser
        setPoints(result.newPoints)
        
        // Mettre à jour les cadeaux
        if (result.updatedCadeaux.length > 0) {
          setCadeaux(result.updatedCadeaux)
        } else {
          // Fallback : mettre à jour localement
          setCadeaux((prev) =>
            prev.map((c) =>
              c.id === cadeauId
                ? {
                    ...c,
                    tickets_actuels: (c.tickets_actuels || 0) + 1,
                    statut: (c.tickets_actuels || 0) + 1 >= (c.objectif_tickets || 0) ? "complet" : c.statut,
                  }
                : c,
            ),
          )
        }
        
        // Jouer le son de succès immédiatement après la mise à jour
        soundService.playSuccess()
        
        // Incrémenter le compteur local pour ce cadeau
        setUserTicketCounts((prev) => ({
          ...prev,
          [cadeauId]: (prev[cadeauId] || 0) + 1,
        }))
        
        // Afficher les confettis
        setShowConfetti(true)
        setTimeout(() => {
          setShowConfetti(false)
        }, 2000)
        
        setStatusMessage("Participation enregistrée, ticket généré.")
        setStatusType("success")
        addInAppNotification(`Ticket validé pour ${cadeau.nom} !`)
        
        // Vérifier si l'utilisateur est maintenant gagnant
        if (result.wonCadeau) {
          setWinningCadeau(result.wonCadeau)
          
          // Envoyer une notification si la permission est accordée
          if (notificationService.hasPermission()) {
            notificationService.sendNotification(
              "🎉 Félicitations ! Vous avez gagné !",
              {
                body: `Vous avez gagné ${result.wonCadeau.nom} ! Nos équipes préparent l'envoi.`,
                icon: "/favicon.ico",
                badge: "/favicon.ico",
                tag: `winner_${cadeauId}`,
              }
            )
          }
        }
      } catch (error: any) {
        console.error("[DashboardClient] Participation error:", error)
        setStatusMessage(error.message || "Erreur lors de la participation.")
        setStatusType("error")
        setParticipatingId(null)
        return
      }
        
      // Recharger les données serveur (sans recharger toute la page)
      router.refresh()
      setParticipatingId(null)
    },
    [userId, router, cadeaux, points],
  )

  return (
    <div className="flex flex-col gap-4 p-4">
      {showAddressModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 px-6">
          <Card className="w-full max-w-sm border border-border/50 bg-[#1a1a1a]/95 backdrop-blur-sm shadow-xl">
            <CardContent className="space-y-4 p-6">
              <h3 className="text-lg font-semibold text-foreground">Oups !</h3>
              <p className="text-sm text-muted-foreground">
                Nous avons besoin de votre adresse pour vous envoyer vos gains.
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setShowAddressModal(false)
                    router.push("/profile")
                  }}
                  className="flex-1"
                >
                  Aller au profil
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowAddressModal(false)}
                  className="flex-1"
                >
                  Plus tard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      {showConfetti && <Confetti duration={2000} particleCount={50} />}
      {/* Season Timer */}
      <SeasonTimer season={season ?? { name: "Saison 1", end_date: null } as any} />

      {/* Notification Message (depuis notification_message) */}
      {notificationMessage && (
        <Card className="relative overflow-hidden border-2 border-green-500 bg-gradient-to-br from-green-500/30 via-green-500/20 to-green-500/10 shadow-2xl backdrop-blur-sm">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
          <CardContent className="relative p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-green-500 via-green-600 to-green-700 shadow-xl ring-4 ring-green-500/30">
                <Trophy className="h-7 w-7 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-foreground mb-2">Félicitations !</h3>
                <p className="text-base text-foreground/90">{notificationMessage}</p>
                <Button
                  onClick={async () => {
                    // Effacer la notification
                    if (!userId) return
                    
                    const supabase = createClient()
                    // Vérifier que l'utilisateur est bien authentifié avant la requête (protection 400)
                    const { data: { user: authUserNotify } } = await supabase.auth.getUser()
                    if (!authUserNotify || !authUserNotify.id || authUserNotify.id !== userId) return
                    
                    await supabase
                      .from("profiles")
                      .update({ notification_message: null })
                      .eq("id", userId)
                    setNotificationMessage(null)
                  }}
                  variant="outline"
                  size="sm"
                  className="mt-4"
                >
                  Fermer
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notification Gagnant */}
      {winningCadeau && (
        <Card className="relative overflow-hidden border-2 border-accent bg-gradient-to-br from-accent/30 via-accent/20 to-accent/10 shadow-2xl backdrop-blur-sm">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
          <CardContent className="relative p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent via-accent/90 to-accent/80 shadow-xl ring-4 ring-accent/30">
                <Trophy className="h-7 w-7 text-accent-foreground" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-6 w-6 text-accent animate-pulse" />
                  <h3 className="text-xl font-bold text-foreground">
                    🎉 Félicitations !
                  </h3>
                </div>
                <p className="text-lg text-foreground mb-2">
                  Vous avez gagné <span className="font-bold text-accent text-xl">{winningCadeau.nom}</span> !
                </p>
                <p className="text-sm text-muted-foreground">
                  Nos équipes préparent l&apos;envoi.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Welcome Message */}
      {showWelcome && (
      <div className="rounded-2xl bg-card p-4">
        <h2 className="text-lg font-semibold text-foreground">
          {isAuthenticated
            ? `Bienvenue${profile?.first_name ? `, ${profile.first_name}` : ""} !`
            : "Bienvenue sur Bk'Rewards !"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {isAuthenticated
              ? "Regardez des publicités pour gagner des points et participer aux tirages."
              : "Connectez-vous pour participer et gagner des cadeaux."}
          </p>
        </div>
      )}

      {showWallet && (
        <Card className="border-border bg-card">
          <CardContent className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Votre solde</p>
                <p className="text-2xl font-bold text-foreground">
                  <AnimatedCounter value={points} duration={500} /> points
        </p>
      </div>
              {!isVip && (
                <Button
                  onClick={handleOpenAd}
                  disabled={!isAuthenticated || isWatching || isRewarding}
                  className="bg-gradient-to-r from-(--color-sky-start) to-(--color-sky-end) text-primary-foreground"
                >
                  +1 point (pub)
                  {dailyBoostAvailable && (
                    <span className="ml-2 rounded-full bg-yellow-400/30 px-2 py-0.5 text-[10px] font-semibold text-yellow-900">
                      Bonus Quotidien x2
                    </span>
                  )}
                </Button>
              )}
              {isVip && (
                <div className="flex items-center gap-2 rounded-lg bg-yellow-500/20 px-3 py-2">
                  <Crown className="h-4 w-4 text-yellow-500" />
                  <span className="text-xs font-medium text-yellow-500">VIP</span>
                </div>
              )}
            </div>
            {statusMessage && (
              <p className={`text-sm ${statusType === "error" ? "text-destructive" : "text-accent"}`}>
                {statusMessage}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {!showWallet && statusMessage && (
        <p className={`text-sm ${statusType === "error" ? "text-destructive" : "text-accent"}`}>{statusMessage}</p>
      )}

      {/* Cagnottes Communautaires */}
      <RewardPoolsGrid userId={userId} />

      {/* Cadeaux Grid */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Cadeaux disponibles</h3>
        {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="border border-border/50 bg-[#1a1a1a]/80 backdrop-blur-sm shadow-lg">
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    <Skeleton className="h-24 w-24 rounded-xl" />
                    <div className="flex flex-1 flex-col justify-between gap-2">
                      <div className="space-y-2">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                      <Skeleton className="h-2 w-full" />
                    </div>
                  </div>
                  <Skeleton className="mt-4 h-10 w-full" />
                </CardContent>
              </Card>
          ))}
        </div>
        ) : cadeaux.length === 0 ? (
          <Card className="border border-border/50 bg-[#1a1a1a]/80 backdrop-blur-sm shadow-lg">
            <CardContent className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Aucun cadeau disponible pour le moment.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cadeaux.map((cadeau) => {
              const canParticipate = points >= cadeau.points_par_ticket
              return (
                <CadeauCard
                  key={cadeau.id}
                  cadeau={cadeau}
                  onParticipate={handleParticipate}
                  isParticipating={participatingId === cadeau.id}
                  isAuthenticated={isAuthenticated}
                  canParticipate={canParticipate}
                  userTickets={userTicketCounts[cadeau.id] || 0}
                  isVip={isVip}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* Video Overlay - Caché si VIP */}
      {!isVip && (
      <VideoOverlay
        isOpen={isWatching}
          onComplete={handleAdComplete}
        onClose={handleCloseVideo}
          contextLabel="Gagner 1 point"
          rewardLabel="+1 point ajouté !"
      />
      )}
      <p className="pt-6 text-center text-xs text-muted-foreground">
        Musique par Pixabay
      </p>
    </div>
  )
}
