"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Package, Mail, MapPin, CheckCircle2, Loader2, Trophy, Sparkles, ArrowLeft, Plus, X, Trash2, Gift, Users } from "lucide-react"
import { notificationService } from "@/lib/notifications"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getPrizeFallbackImage } from "@/lib/prizes"
import { useToast } from "@/hooks/use-toast"
import { soundService } from "@/lib/sounds"
import { Confetti } from "@/components/confetti"

const ADMIN_EMAIL = "bkgamers@icloud.com"

interface CadeauComplet {
  id: string
  nom: string
  statut: string
  tickets_actuels: number
  objectif_tickets: number
  tickets_total?: number
  gagnant_id: string | null
  gagnant_email: string | null
  gagnant_first_name: string | null
  gagnant_last_name: string | null
  gagnant_adresse: string | null
  gagnant_cp: string | null
  gagnant_ville: string | null
  image_url?: string
  [key: string]: any // Permet d'accepter toutes les colonnes de la base
}

export default function AdminPage() {
  console.log("Composant Admin monté")
  
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [cadeaux, setCadeaux] = useState<any[]>([]) // État unifié pour tous les cadeaux
  const [updating, setUpdating] = useState<string | null>(null)
  const [isProcessingWinner, setIsProcessingWinner] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [isCreatingCadeau, setIsCreatingCadeau] = useState(false)
  const [showWinnerModal, setShowWinnerModal] = useState(false)
  const [winnerInfo, setWinnerInfo] = useState<{
    nom: string
    email: string
    tickets: number
    cadeauNom: string
  } | null>(null)
  const [isLaunchingDraw, setIsLaunchingDraw] = useState<string | null>(null)
  const [showTestConfetti, setShowTestConfetti] = useState(false)
  const [newCadeau, setNewCadeau] = useState({
    nom: "",
    image_url: "",
    prix_points: "",
    tickets_total: "",
  })
  const [errors, setErrors] = useState<{
    nom?: string
    prix_points?: string
    tickets_total?: string
  }>({})
  const [users, setUsers] = useState<any[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [togglingVip, setTogglingVip] = useState<string | null>(null)
  const [stats, setStats] = useState<{
    tickets_publicite: number
    tickets_vip_estime: number
  } | null>(null)
  const [gradeSettings, setGradeSettings] = useState({
    grade_debutant_label: "Débutant",
    grade_bronze_label: "Bronze",
    grade_argent_label: "Argent",
    grade_or_label: "Or",
    grade_debutant_max: "100",
    grade_bronze_max: "500",
    grade_argent_max: "1500",
  })
  const [savingGrades, setSavingGrades] = useState(false)

  useEffect(() => {
    console.log("useEffect checkAccess déclenché")
    async function checkAccess() {
      const supabase = createClient()
      
      const {
        data: { user },
      } = await supabase.auth.getUser()

      console.log("User check:", user?.email, "ADMIN_EMAIL:", ADMIN_EMAIL)

      if (!user || user.email !== ADMIN_EMAIL) {
        console.log("Accès refusé, redirection...")
        router.push("/")
        return
      }

      console.log("Accès autorisé, chargement des cadeaux...")
      // Forcer le rafraîchissement à chaque chargement de page
      await loadAllCadeaux()
      await loadGradeSettings()
    }

    checkAccess()
  }, [router])

  // Debug: Logger le state quand il change
  useEffect(() => {
    console.log("[AdminPage] State cadeaux mis à jour:", cadeaux.length, cadeaux)
  }, [cadeaux])

  async function loadAllCadeaux() {
    console.log("loadAllCadeaux appelé")
    // Réinitialiser l'état AVANT de charger pour éviter les doublons/cache
    setCadeaux([])
    setLoading(true)
    try {
      await fetchAllCadeaux()
    } finally {
      setLoading(false)
    }
  }

  async function loadGradeSettings() {
    const supabase = createClient()
    const { data } = await supabase
      .from("app_settings")
      .select(
        "grade_debutant_label, grade_bronze_label, grade_argent_label, grade_or_label, grade_debutant_max, grade_bronze_max, grade_argent_max",
      )
      .eq("id", 1)
      .single()
    if (data) {
      setGradeSettings({
        grade_debutant_label: data.grade_debutant_label,
        grade_bronze_label: data.grade_bronze_label,
        grade_argent_label: data.grade_argent_label,
        grade_or_label: data.grade_or_label,
        grade_debutant_max: String(data.grade_debutant_max),
        grade_bronze_max: String(data.grade_bronze_max),
        grade_argent_max: String(data.grade_argent_max),
      })
    }
  }

  const handleSaveGradeSettings = async () => {
    setSavingGrades(true)
    const supabase = createClient()
    await supabase
      .from("app_settings")
      .update({
        grade_debutant_label: gradeSettings.grade_debutant_label,
        grade_bronze_label: gradeSettings.grade_bronze_label,
        grade_argent_label: gradeSettings.grade_argent_label,
        grade_or_label: gradeSettings.grade_or_label,
        grade_debutant_max: Number(gradeSettings.grade_debutant_max),
        grade_bronze_max: Number(gradeSettings.grade_bronze_max),
        grade_argent_max: Number(gradeSettings.grade_argent_max),
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1)
    setSavingGrades(false)
    toast({ title: "Réglages fidélité enregistrés" })
  }

  const fetchAllCadeaux = async () => {
    console.log("Récupération de TOUS les cadeaux...")
    const supabase = createClient()
    
    // Récupérer TOUS les cadeaux sans filtre de statut
    const { data, error } = await supabase
      .from("cadeaux")
      .select("*")
      .order("points_par_ticket", { ascending: false }) // Tri par prix décroissant (du plus cher au moins cher)
    
    if (error) {
      console.error("ERREUR SUPABASE:", error)
      alert("Erreur Supabase Admin: " + error.message)
      setCadeaux([])
      return
    }
    
    console.log("DONNÉES FRAICHES (tous les cadeaux):", data)
    console.log("Nombre de cadeaux reçus de Supabase:", data?.length || 0)
    
    // Log de secours si data est vide
    if (!data || data.length === 0) {
      console.log("La table cadeaux semble vide dans Supabase")
      setCadeaux([])
      return
    }
    
    // Filtrer uniquement ceux avec un nom valide
    const filtered = (data || []).filter((c: any) => c.nom && c.nom.trim() !== "")
    console.log("Cadeaux filtrés (avec nom valide):", filtered.length)
    
    // Utiliser un Set pour garantir l'unicité par ID
    const seenIds = new Set<string>()
    const uniqueCadeaux: any[] = []
    
    // Pour chaque cadeau, enrichir avec les données du gagnant si nécessaire
    for (const cadeau of filtered) {
      // Vérifier l'unicité strictement par ID
      if (seenIds.has(cadeau.id)) {
        console.warn("Doublon détecté et ignoré:", cadeau.id, cadeau.nom)
        continue
      }
      seenIds.add(cadeau.id)
      
      const cadeauEnrichi: any = {
        id: cadeau.id,
        nom: cadeau.nom,
        statut: cadeau.statut,
        tickets_actuels: cadeau.tickets_actuels || 0,
        objectif_tickets: cadeau.objectif_tickets || cadeau.tickets_total || 0,
        tickets_total: cadeau.tickets_total || cadeau.objectif_tickets || 0,
        image_url: cadeau.image_url || null,
        points_par_ticket: cadeau.points_par_ticket || 0,
        gagnant_id: null,
        gagnant_email: null,
        gagnant_first_name: null,
        gagnant_last_name: null,
        gagnant_adresse: null,
        gagnant_cp: null,
        gagnant_ville: null,
      }
      
      // Si le cadeau est complet, récupérer le gagnant
      if (cadeau.statut === "complet" || cadeau.statut === "envoyé") {
        const { data: gagnant } = await supabase
          .from("gagnants")
          .select("user_id, email")
          .eq("cadeau_id", cadeau.id)
          .maybeSingle()
        
        if (gagnant && gagnant.user_id) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("first_name, last_name, adresse, code_postal, ville")
            .eq("id", gagnant.user_id)
            .maybeSingle()
          
          cadeauEnrichi.gagnant_id = gagnant.user_id
          cadeauEnrichi.gagnant_email = gagnant.email || null
          cadeauEnrichi.gagnant_first_name = profile?.first_name || null
          cadeauEnrichi.gagnant_last_name = profile?.last_name || null
          cadeauEnrichi.gagnant_adresse = profile?.adresse || null
          cadeauEnrichi.gagnant_cp = profile?.code_postal || null
          cadeauEnrichi.gagnant_ville = profile?.ville || null
        }
      }
      
      uniqueCadeaux.push(cadeauEnrichi)
    }
    
    console.log("Cadeaux unifiés (sans doublons):", uniqueCadeaux.length)
    console.log("IDs des cadeaux:", uniqueCadeaux.map((c: any) => c.id))
    
    // REMPLACER strictement la liste, JAMAIS de concaténation
    setCadeaux(uniqueCadeaux)
  }

  async function loadUsers() {
    setLoadingUsers(true)
    const supabase = createClient()
    
    try {
      // Utiliser la fonction RPC pour récupérer les utilisateurs avec leurs emails
      const { data, error } = await supabase.rpc("get_all_users")

      if (error) {
        console.error("Error loading users:", error)
        // Fallback : essayer de charger depuis profiles directement
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, points, is_vip, last_bonus_claim, referred_by")
          .order("created_at", { ascending: false })

        if (profilesError) {
          toast({
            title: "Erreur",
            description: "Impossible de charger les utilisateurs",
            variant: "destructive",
          })
          return
        }

        const usersWithEmail = (profiles || []).map((profile: any) => {
          return {
            ...profile,
            email: "N/A", // Email non disponible sans fonction RPC
            full_name: `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "N/A",
            tickets_count: profile.points || 0,
            referred_by: profile.referred_by || null,
          }
        })
        setUsers(usersWithEmail)
        return
      }

      // Mapper les données de la fonction RPC
      const usersWithEmail = (data || []).map((user: any) => {
        return {
          ...user,
          email: user.email || "N/A",
          full_name: `${user.first_name || ""} ${user.last_name || ""}`.trim() || "N/A",
          tickets_count: user.points || 0,
          referred_by: user.referred_by || null,
        }
      })

      setUsers(usersWithEmail)
    } catch (error: any) {
      console.error("Error loading users:", error)
      toast({
        title: "Erreur",
        description: "Erreur lors du chargement des utilisateurs",
        variant: "destructive",
      })
    } finally {
      setLoadingUsers(false)
    }
  }

  async function loadStatistics() {
    const supabase = createClient()
    
    try {
      // Appeler la fonction RPC pour obtenir les statistiques
      const { data, error } = await supabase.rpc("get_ticket_statistics")

      if (error) {
        console.error("Error loading statistics:", error)
        // Si la fonction n'existe pas encore, calculer manuellement
        await loadStatisticsManual()
        return
      }

      if (data && data.length > 0) {
        setStats({
          tickets_publicite: Number(data[0].tickets_publicite) || 0,
          tickets_vip_estime: Number(data[0].tickets_vip_estime) || 0,
        })
      }
    } catch (error: any) {
      console.error("Error loading statistics:", error)
      // Fallback vers le calcul manuel
      await loadStatisticsManual()
    }
  }

  async function loadStatisticsManual() {
    const supabase = createClient()
    
    try {
      // Compter les vues de vidéos (tickets publicité)
      const { count: pubCount } = await supabase
        .from("video_views")
        .select("*", { count: "exact", head: true })

      // Estimer les tickets VIP : compter les utilisateurs qui ont réclamé au moins une fois
      const { count: vipCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .not("last_bonus_claim", "is", null)

      setStats({
        tickets_publicite: pubCount || 0,
        tickets_vip_estime: Math.round((vipCount || 0) * 7.5), // Moyenne de 7.5 tickets par réclamation
      })
    } catch (error: any) {
      console.error("Error loading statistics manually:", error)
    }
  }

  async function toggleVipStatus(userId: string, currentVipStatus: boolean) {
    const supabase = createClient()
    setTogglingVip(userId)

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_vip: !currentVipStatus })
        .eq("id", userId)

      if (error) {
        console.error("Error toggling VIP status:", error)
        toast({
          title: "Erreur",
          description: "Impossible de modifier le statut VIP",
          variant: "destructive",
        })
      } else {
        toast({
          title: "Succès !",
          description: `Statut VIP ${!currentVipStatus ? "activé" : "désactivé"}`,
        })
        
        // Recharger les utilisateurs
        await loadUsers()
      }
    } catch (error: any) {
      console.error("Error:", error)
      toast({
        title: "Erreur",
        description: "Erreur lors de la modification du statut VIP",
        variant: "destructive",
      })
    } finally {
      setTogglingVip(null)
    }
  }

  async function markAsShipped(cadeauId: string) {
    const supabase = createClient()
    setUpdating(cadeauId)

    try {
      // Mettre à jour le statut à 'envoyé'
      const { error } = await supabase
        .from("cadeaux")
        .update({ statut: "envoyé" as any })
        .eq("id", cadeauId)

      if (error) {
        console.error("[AdminPage] Error updating statut:", error)
        toast({
          title: "Erreur",
          description: `Erreur lors de la mise à jour : ${error.message}`,
          variant: "destructive",
        })
      } else {
        // Toast de succès
        toast({
          title: "Succès !",
          description: "Le cadeau a été marqué comme expédié",
        })
        
        // Recharger immédiatement les cadeaux
        await loadAllCadeaux()
      }
    } catch (error: any) {
      console.error("[AdminPage] Error:", error)
      toast({
        title: "Erreur",
        description: "Erreur lors de la mise à jour",
        variant: "destructive",
      })
    } finally {
      setUpdating(null)
    }
  }

  async function launchFinalDraw(cadeauId: string) {
    // Récupérer les infos du cadeau pour le message de confirmation
    const cadeau = cadeaux.find((c: any) => c.id === cadeauId)
    const ticketsTotal = cadeau?.tickets_total || cadeau?.objectif_tickets || 0
    const ticketsVendus = cadeau?.tickets_actuels || 0
    
    // Double confirmation
    const confirmed = window.confirm(
      `Êtes-vous sûr de vouloir lancer le tirage au sort final ?\n\n` +
      `Cadeau : ${cadeau?.nom || "N/A"}\n` +
      `Tickets vendus : ${ticketsVendus}\n` +
      `Tickets requis : ${ticketsTotal}\n\n` +
      `Cette action est irréversible et désignera un gagnant de manière aléatoire.\n` +
      `Les tickets seront remis à 0 pour permettre un nouveau cycle.`
    )

    if (!confirmed) {
      return
    }

    const supabase = createClient()
    setIsLaunchingDraw(cadeauId)

    try {
      const { data, error } = await supabase.rpc("launch_final_draw", {
        p_cadeau_id: cadeauId,
      })

      if (error) {
        console.error("[AdminPage] Error launching final draw:", error)
        
        let errorMessage = "Erreur lors du tirage"
        if (error.message?.includes("not_admin")) {
          errorMessage = "Vous n'avez pas les droits administrateur"
        } else if (error.message?.includes("cadeau_not_found")) {
          errorMessage = "Cadeau introuvable"
        } else if (error.message?.includes("not_enough_tickets")) {
          errorMessage = "Pas assez de tickets vendus pour lancer le tirage"
        } else if (error.message?.includes("gagnant_already_exists")) {
          errorMessage = "Un gagnant a déjà été désigné pour ce cadeau"
        } else if (error.message?.includes("no_tickets")) {
          errorMessage = "Aucun ticket disponible pour ce cadeau"
        } else if (error.message) {
          errorMessage = `Erreur : ${error.message}`
        }
        
        toast({
          title: "Erreur",
          description: errorMessage,
          variant: "destructive",
        })
        setIsLaunchingDraw(null)
        return
      }

      if (data && data.length > 0 && data[0].success) {
        const result = data[0]
        
        // Afficher la modale avec les informations du gagnant
        setWinnerInfo({
          nom: result.gagnant_nom && result.gagnant_prenom 
            ? `${result.gagnant_prenom} ${result.gagnant_nom}`
            : result.gagnant_email || "Utilisateur",
          email: result.gagnant_email || "Email non disponible",
          tickets: result.tickets_count || 0,
          cadeauNom: cadeau?.nom || "Cadeau",
        })
        setShowWinnerModal(true)
        
        // Recharger les données
        await loadAllCadeaux()
      } else {
        const message = data?.[0]?.message || "Erreur inconnue"
        toast({
          title: "Erreur",
          description: message === "not_enough_tickets"
            ? "Pas assez de tickets vendus pour lancer le tirage."
            : "Impossible de lancer le tirage pour le moment.",
          variant: "destructive",
        })
      }
    } catch (error: any) {
      console.error("[AdminPage] Error:", error)
      toast({
        title: "Erreur",
        description: `Erreur lors du tirage : ${error?.message || "Erreur inconnue"}`,
        variant: "destructive",
      })
    } finally {
      setIsLaunchingDraw(null)
    }
  }

  async function pickWinner(cadeauId: string) {
    // Récupérer les infos du cadeau pour le message de confirmation
    const cadeau = cadeaux.find((c: any) => c.id === cadeauId)
    const ticketsTotal = cadeau?.tickets_total || cadeau?.objectif_tickets || 0
    const ticketsVendus = cadeau?.tickets_actuels || 0
    const tiragesPossibles = ticketsTotal > 0 ? Math.floor(ticketsVendus / ticketsTotal) : 0
    
    const confirmed = window.confirm(
      `Voulez-vous vraiment désigner un gagnant maintenant ?\n\n` +
      `Tickets disponibles : ${ticketsVendus}\n` +
      `Tickets nécessaires par tirage : ${ticketsTotal}\n` +
      `Tirages possibles : ${tiragesPossibles}\n\n` +
      `Cette action consommera ${ticketsTotal} tickets et désignera un gagnant.`
    )

    if (!confirmed) {
      return
    }

    const supabase = createClient()
    setIsProcessingWinner(cadeauId)

    try {
      const { data, error } = await supabase.rpc("pick_winner", {
        p_cadeau_id: cadeauId,
      })

      if (error) {
        console.error("[AdminPage] Error picking winner:", error)
        
        // Messages d'erreur spécifiques selon le type d'erreur
        let errorMessage = "Erreur lors du tirage"
        if (error.message?.includes("not_admin")) {
          errorMessage = "Vous n'avez pas les droits administrateur"
        } else if (error.message?.includes("cadeau_not_found")) {
          errorMessage = "Cadeau introuvable"
        } else if (error.message?.includes("cadeau_already_complete")) {
          errorMessage = "Ce cadeau est déjà complété"
        } else if (error.message?.includes("no_tickets")) {
          errorMessage = "Aucun ticket disponible pour ce cadeau"
        } else if (error.message?.includes("gagnant_already_exists")) {
          errorMessage = "Un gagnant a déjà été désigné pour ce cadeau"
        } else if (error.message?.includes("not_enough_tickets")) {
          errorMessage = "Pas assez de tickets pour effectuer un tirage"
        } else if (error.message) {
          errorMessage = `Erreur : ${error.message}`
        }
        
        toast({
          title: "Erreur",
          description: errorMessage,
          variant: "destructive",
        })
      } else {
        // La fonction retourne un tableau, récupérer le premier élément
        const result = Array.isArray(data) && data.length > 0 ? data[0] : data
        
        console.log("[AdminPage] Winner picked:", result)
        
        // Message de succès avec informations sur le gagnant
        if (result?.email) {
          toast({
            title: "Gagnant désigné !",
            description: `Email : ${result.email} - Ticket #${result.ticket_number || "N/A"}`,
          })
          
          // Envoyer une notification au gagnant (si connecté et permission accordée)
          // Note: Cette notification sera visible uniquement si l'utilisateur a la page ouverte
          // Pour une notification push en arrière-plan, il faudrait un Service Worker
          if (notificationService.hasPermission()) {
            notificationService.sendNotification(
              "🎉 Félicitations ! Vous avez gagné !",
              {
                body: `Vous avez gagné ${result.cadeau_nom || "un cadeau"} ! Nos équipes préparent l'envoi.`,
                icon: "/favicon.ico",
                badge: "/favicon.ico",
                tag: `winner_${cadeauId}`,
              }
            )
          }
        } else {
          toast({
            title: "Succès !",
            description: "Le gagnant a été désigné avec succès",
          })
        }
        
        // Recharger immédiatement toutes les données pour afficher le gagnant
        await loadAllCadeaux()
      }
    } catch (error: any) {
      console.error("[AdminPage] Error:", error)
      toast({
        title: "Erreur",
        description: `Erreur lors du tirage : ${error?.message || "Erreur inconnue"}`,
        variant: "destructive",
      })
    } finally {
      setIsProcessingWinner(null)
    }
  }

  async function handleDelete(cadeauId: string, cadeauNom: string) {
    const confirmed = window.confirm(
      `Es-tu sûr de vouloir supprimer ce cadeau ?\n\n"${cadeauNom}"\n\n⚠️ Cette action est irréversible et supprimera aussi tous les tickets associés !`
    )

    if (!confirmed) {
      return
    }

    const supabase = createClient()
    setDeleting(cadeauId)

    try {
      // La suppression en cascade est déjà configurée dans le schéma SQL
      // (ON DELETE CASCADE sur la contrainte tickets_cadeau_id_fkey)
      const { error } = await supabase
        .from("cadeaux")
        .delete()
        .eq("id", cadeauId)

      if (error) {
        console.error("[AdminPage] Error deleting cadeau:", error)
        toast({
          title: "Erreur",
          description: `Erreur lors de la suppression : ${error.message}`,
          variant: "destructive",
        })
      } else {
        // Toast de succès
        toast({
          title: "Succès !",
          description: "Le cadeau a été supprimé avec succès",
        })
        
        // Recharger immédiatement les données
        await loadAllCadeaux()
      }
    } catch (error: any) {
      console.error("[AdminPage] Error:", error)
      alert(`Erreur lors de la suppression : ${error?.message || "Erreur inconnue"}`)
    } finally {
      setDeleting(null)
    }
  }

  const handleCreateCadeau = async () => {
    // Réinitialiser les erreurs
    setErrors({})
    
    // Validation des champs
    const newErrors: typeof errors = {}
    
    if (!newCadeau.nom || !newCadeau.nom.trim()) {
      newErrors.nom = "Le titre est obligatoire"
    }
    
    if (!newCadeau.prix_points || !newCadeau.prix_points.trim()) {
      newErrors.prix_points = "Le prix en points est obligatoire"
    } else {
      const prixPoints = Number(newCadeau.prix_points)
      if (isNaN(prixPoints) || prixPoints <= 0) {
        newErrors.prix_points = "Le prix en points doit être un nombre positif"
      }
    }
    
    if (!newCadeau.tickets_total || !newCadeau.tickets_total.trim()) {
      newErrors.tickets_total = "Le nombre de tickets total est obligatoire"
    } else {
      const ticketsTotal = Number(newCadeau.tickets_total)
      if (isNaN(ticketsTotal) || ticketsTotal <= 0) {
        newErrors.tickets_total = "Le nombre de tickets total doit être un nombre positif"
      }
    }
    
    // Si des erreurs existent, les afficher et arrêter
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      toast({
        title: "Erreur de validation",
        description: "Veuillez corriger les erreurs dans le formulaire",
        variant: "destructive",
      })
      return
    }

    // Conversion des nombres
    const prixPoints = Number(newCadeau.prix_points)
    const ticketsTotal = Number(newCadeau.tickets_total)

    const supabase = createClient()
    setIsCreatingCadeau(true)

    // Préparer l'objet avec les clés exactes de la base de données
    // Colonnes : nom (text), points_par_ticket (int), objectif_tickets (int), image_url (text)
    const dataToInsert = {
      nom: newCadeau.nom.trim(),
      image_url: newCadeau.image_url?.trim() || null,
      points_par_ticket: prixPoints, // int : nombre de vidéos par ticket
      objectif_tickets: ticketsTotal, // int : seuil de tirage
      tickets_actuels: 0,
      statut: "en_cours",
    }

    // Debug : afficher les données avant l'envoi
    console.log("Données envoyées:", dataToInsert)

    try {
      const { error } = await supabase.from("cadeaux").insert(dataToInsert)

      if (error) {
        console.error("[AdminPage] Error creating cadeau:", error)
        toast({
          title: "Erreur",
          description: `Erreur lors de la création : ${error.message}`,
          variant: "destructive",
        })
      } else {
        // Réinitialiser le formulaire et les erreurs
        setNewCadeau({
          nom: "",
          image_url: "",
          prix_points: "",
          tickets_total: "",
        })
        setErrors({})
        setShowAddForm(false)
        
        // Toast de succès
        toast({
          title: "Succès !",
          description: "Le cadeau a été créé avec succès",
        })
        
        // Recharger immédiatement les données pour afficher le nouveau cadeau
        await loadAllCadeaux()
      }
    } catch (error: any) {
      console.error("[AdminPage] Error:", error)
      toast({
        title: "Erreur",
        description: "Erreur lors de la création du cadeau",
        variant: "destructive",
      })
    } finally {
      setIsCreatingCadeau(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <h2 className="text-xl font-semibold text-foreground">Administration</h2>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Administration</h2>
          <p className="text-sm text-muted-foreground">Gestion des cadeaux et expéditions</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowAddForm(!showAddForm)}
            variant="outline"
            className="border-border/50 bg-[#1a1a1a]/80 backdrop-blur-sm"
          >
            {showAddForm ? (
              <>
                <X className="mr-2 h-4 w-4" />
                Annuler
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Ajouter un cadeau
              </>
            )}
          </Button>
          <Button
            asChild
            variant="outline"
            className="border-border/50 bg-[#1a1a1a]/80 backdrop-blur-sm"
          >
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour au site
            </Link>
          </Button>
          <Button
            onClick={() => {
              soundService.playCoinSound()
              setShowTestConfetti(true)
              setTimeout(() => {
                setShowTestConfetti(false)
              }, 2000)
            }}
            variant="outline"
            className="border-border/50 bg-[#1a1a1a]/80 backdrop-blur-sm"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Test Animation
          </Button>
        </div>
      </div>
      
      {showTestConfetti && <Confetti duration={2000} particleCount={60} />}

      {/* Statistiques de Rentabilité */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border border-border/50 bg-[#1a1a1a]/80 backdrop-blur-sm shadow-lg">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Package className="h-5 w-5" />
                Tickets Publicité
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                {stats.tickets_publicite.toLocaleString("fr-FR")}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Total des tickets générés via les vidéos publicitaires
              </p>
            </CardContent>
          </Card>

          <Card className="border border-border/50 bg-[#1a1a1a]/80 backdrop-blur-sm shadow-lg">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Tickets VIP
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                {stats.tickets_vip_estime.toLocaleString("fr-FR")}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Estimation basée sur les réclamations de bonus quotidiens
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Onglet Fidélité */}
      <Card className="border border-border/50 bg-[#1a1a1a]/80 backdrop-blur-sm shadow-lg">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Fidélité
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Nom Débutant</Label>
              <Input
                value={gradeSettings.grade_debutant_label}
                onChange={(e) =>
                  setGradeSettings((prev) => ({ ...prev, grade_debutant_label: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Max Débutant (vues)</Label>
              <Input
                type="number"
                value={gradeSettings.grade_debutant_max}
                onChange={(e) =>
                  setGradeSettings((prev) => ({ ...prev, grade_debutant_max: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Nom Bronze</Label>
              <Input
                value={gradeSettings.grade_bronze_label}
                onChange={(e) =>
                  setGradeSettings((prev) => ({ ...prev, grade_bronze_label: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Max Bronze (vues)</Label>
              <Input
                type="number"
                value={gradeSettings.grade_bronze_max}
                onChange={(e) =>
                  setGradeSettings((prev) => ({ ...prev, grade_bronze_max: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Nom Argent</Label>
              <Input
                value={gradeSettings.grade_argent_label}
                onChange={(e) =>
                  setGradeSettings((prev) => ({ ...prev, grade_argent_label: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Max Argent (vues)</Label>
              <Input
                type="number"
                value={gradeSettings.grade_argent_max}
                onChange={(e) =>
                  setGradeSettings((prev) => ({ ...prev, grade_argent_max: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Nom Or</Label>
              <Input
                value={gradeSettings.grade_or_label}
                onChange={(e) =>
                  setGradeSettings((prev) => ({ ...prev, grade_or_label: e.target.value }))
                }
              />
            </div>
          </div>
          <Button onClick={handleSaveGradeSettings} disabled={savingGrades}>
            {savingGrades ? "Enregistrement..." : "Enregistrer les réglages"}
          </Button>
        </CardContent>
      </Card>

      {/* Section Utilisateurs */}
      <Card className="border border-border/50 bg-[#1a1a1a]/80 backdrop-blur-sm shadow-lg">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Users className="h-5 w-5" />
            Liste des Utilisateurs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingUsers ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Aucun utilisateur trouvé</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left p-3 text-sm font-semibold text-foreground">Nom</th>
                    <th className="text-left p-3 text-sm font-semibold text-foreground">Email</th>
                    <th className="text-left p-3 text-sm font-semibold text-foreground">Tickets</th>
                    <th className="text-left p-3 text-sm font-semibold text-foreground">Source</th>
                    <th className="text-left p-3 text-sm font-semibold text-foreground">Statut</th>
                    <th className="text-left p-3 text-sm font-semibold text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user: any) => (
                    <tr key={user.id} className="border-b border-border/30 hover:bg-secondary/20">
                      <td className="p-3 text-sm text-foreground">{user.full_name}</td>
                      <td className="p-3 text-sm text-foreground">{user.email}</td>
                      <td className="p-3 text-sm text-foreground">{user.tickets_count}</td>
                      <td className="p-3">
                        {user.is_vip ? (
                          <Badge className="bg-yellow-500 text-yellow-950">VIP</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Standard</span>
                        )}
                      </td>
                      <td className="p-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleVipStatus(user.id, user.is_vip)}
                          disabled={togglingVip === user.id}
                        >
                          {togglingVip === user.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            user.is_vip ? "Retirer VIP" : "Donner VIP"
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Formulaire d'ajout de cadeau */}
      {showAddForm && (
        <Card className="border border-border/50 bg-[#1a1a1a]/80 backdrop-blur-sm shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg text-foreground">Nouveau cadeau</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="nom" className="text-foreground">
                Titre <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nom"
                type="text"
                value={newCadeau.nom}
                onChange={(e) => {
                  setNewCadeau({ ...newCadeau, nom: e.target.value })
                  if (errors.nom) setErrors({ ...errors, nom: undefined })
                }}
                placeholder="Ex: iPhone"
                className={`bg-input text-foreground ${errors.nom ? "border-destructive" : ""}`}
              />
              {errors.nom && (
                <p className="text-sm text-destructive">{errors.nom}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="image_url" className="text-foreground">
                Image URL (optionnel)
              </Label>
              <Input
                id="image_url"
                type="url"
                value={newCadeau.image_url}
                onChange={(e) => setNewCadeau({ ...newCadeau, image_url: e.target.value })}
                placeholder="https://example.com/image.jpg"
                className="bg-input text-foreground"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="prix_points" className="text-foreground">
                  Prix en points <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="prix_points"
                  type="number"
                  min="1"
                  value={newCadeau.prix_points}
                  onChange={(e) => {
                    setNewCadeau({ ...newCadeau, prix_points: e.target.value })
                    if (errors.prix_points) setErrors({ ...errors, prix_points: undefined })
                  }}
                  placeholder="50"
                  className={`bg-input text-foreground ${errors.prix_points ? "border-destructive" : ""}`}
                />
                {errors.prix_points && (
                  <p className="text-sm text-destructive">{errors.prix_points}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tickets_total" className="text-foreground">
                  Nombre de tickets total <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="tickets_total"
                  type="number"
                  min="1"
                  value={newCadeau.tickets_total}
                  onChange={(e) => {
                    setNewCadeau({ ...newCadeau, tickets_total: e.target.value })
                    if (errors.tickets_total) setErrors({ ...errors, tickets_total: undefined })
                  }}
                  placeholder="500"
                  className={`bg-input text-foreground ${errors.tickets_total ? "border-destructive" : ""}`}
                />
                {errors.tickets_total && (
                  <p className="text-sm text-destructive">{errors.tickets_total}</p>
                )}
              </div>
            </div>

            <Button
              onClick={handleCreateCadeau}
              disabled={isCreatingCadeau}
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {isCreatingCadeau ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Création...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Créer le cadeau
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Section Gestion des Cadeaux - UNIFIÉE */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-accent" />
          <h3 className="text-lg font-semibold text-foreground">Gestion des Cadeaux</h3>
          <span className="text-xs text-muted-foreground">({cadeaux.length} cadeaux)</span>
        </div>

        {cadeaux.length === 0 ? (
          <Card className="border border-border/50 bg-[#1a1a1a]/80 backdrop-blur-sm shadow-lg">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Trophy className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-center text-muted-foreground">Aucun cadeau pour le moment.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {cadeaux.map((cadeau: any) => {
              // Utiliser getPrizeFallbackImage si image_url est vide, null, ou invalide
              const imageUrl = (cadeau.image_url && cadeau.image_url.trim() !== "" && !cadeau.image_url.includes("unsplash"))
                ? cadeau.image_url
                : getPrizeFallbackImage(cadeau.nom)
              const isEnCours = cadeau.statut === "en_cours" || cadeau.statut === "actif"
              const isComplet = cadeau.statut === "complet"
              const isEnvoye = cadeau.statut === "envoyé"
              
              // Couleur basée sur la première lettre pour le fallback
              const firstLetter = (cadeau.nom || "?").charAt(0).toUpperCase()
              const colors = [
                "bg-blue-500", "bg-purple-500", "bg-pink-500", "bg-red-500",
                "bg-orange-500", "bg-yellow-500", "bg-green-500", "bg-teal-500",
                "bg-cyan-500", "bg-indigo-500"
              ]
              const colorIndex = firstLetter.charCodeAt(0) % colors.length
              const fallbackColor = colors[colorIndex]
              
              return (
                <CadeauCardWithImage
                  key={cadeau.id}
                  cadeau={cadeau}
                  imageUrl={imageUrl}
                  firstLetter={firstLetter}
                  fallbackColor={fallbackColor}
                  isEnCours={isEnCours}
                  isComplet={isComplet}
                  isEnvoye={isEnvoye}
                  deleting={deleting}
                  isProcessingWinner={isProcessingWinner}
                  updating={updating}
                  onDelete={handleDelete}
                  onPickWinner={pickWinner}
                  onMarkShipped={markAsShipped}
                  onLaunchFinalDraw={launchFinalDraw}
                  isLaunchingDraw={isLaunchingDraw}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* Modale de confirmation du gagnant */}
      <Dialog open={showWinnerModal} onOpenChange={setShowWinnerModal}>
        <DialogContent className="border border-border/50 bg-[#1a1a1a]/95 backdrop-blur-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Gagnant désigné !
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Le tirage au sort a été effectué avec succès.
            </DialogDescription>
          </DialogHeader>
          {winnerInfo && (
            <div className="space-y-4 py-4">
              <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-4 space-y-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Cadeau gagné</p>
                  <p className="text-lg font-bold text-foreground">{winnerInfo.cadeauNom}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Gagnant</p>
                  <p className="text-lg font-semibold text-foreground">{winnerInfo.nom}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Email</p>
                  <p className="text-base text-foreground flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    {winnerInfo.email}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Nombre de tickets</p>
                  <p className="text-base text-foreground">{winnerInfo.tickets} ticket{winnerInfo.tickets > 1 ? "s" : ""}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Le gagnant a été notifié et recevra un message à sa prochaine connexion.
                Les tickets ont été remis à 0 pour permettre un nouveau cycle (Tirage n°2).
              </p>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowWinnerModal(false)} className="w-full">
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Composant séparé pour gérer l'état de l'image
function CadeauCardWithImage({
  cadeau,
  imageUrl,
  firstLetter,
  fallbackColor,
  isEnCours,
  isComplet,
  isEnvoye,
  deleting,
  isProcessingWinner,
  updating,
  onDelete,
  onPickWinner,
  onMarkShipped,
  onLaunchFinalDraw,
  isLaunchingDraw,
}: {
  cadeau: any
  imageUrl: string
  firstLetter: string
  fallbackColor: string
  isEnCours: boolean
  isComplet: boolean
  isEnvoye: boolean
  deleting: string | null
  isProcessingWinner: string | null
  updating: string | null
  onDelete: (id: string, nom: string) => void
  onPickWinner: (id: string) => void
  onMarkShipped: (id: string) => void
  onLaunchFinalDraw?: (id: string) => void
  isLaunchingDraw?: string | null
}) {
  const [imageError, setImageError] = useState(false)
  
  return (
    <Card
      className="border border-border/50 bg-[#1a1a1a]/80 backdrop-blur-sm shadow-lg"
    >
      <CardHeader>
        <div className="flex items-center gap-4">
          {/* Image du cadeau avec fallback */}
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-secondary">
            {imageUrl && !imageError ? (
              <Image
                src={imageUrl}
                alt={cadeau.nom || "Cadeau"}
                fill
                className="object-cover"
                unoptimized
                onError={() => {
                  setImageError(true)
                }}
              />
            ) : (
              <div className={`flex h-full w-full items-center justify-center ${fallbackColor} text-white`}>
                <span className="text-2xl font-bold">{firstLetter}</span>
              </div>
            )}
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg text-foreground">{cadeau.nom || "Sans nom"}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {isEnvoye && (
              <div className="flex items-center gap-1 rounded-full bg-accent px-2 py-1">
                <CheckCircle2 className="h-3 w-3 text-accent-foreground" />
                <span className="text-xs font-bold text-accent-foreground">Expédié</span>
              </div>
            )}
            {isComplet && !isEnvoye && (
              <div className="flex items-center gap-1 rounded-full bg-green-500/20 px-2 py-1">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                <span className="text-xs font-bold text-green-500">Complet</span>
              </div>
            )}
            <Button
              onClick={() => onDelete(cadeau.id, cadeau.nom)}
              disabled={deleting === cadeau.id}
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
              title="Supprimer ce cadeau"
            >
              {deleting === cadeau.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Informations sur les tickets */}
        <div className="space-y-2 rounded-lg bg-secondary/30 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Tickets vendus</span>
            <span className="text-lg font-bold text-foreground">
              {cadeau.tickets_actuels || 0} / {cadeau.tickets_total || cadeau.objectif_tickets || 0}
            </span>
          </div>
          {(() => {
            const ticketsTotal = cadeau.tickets_total || cadeau.objectif_tickets || 0
            const ticketsVendus = cadeau.tickets_actuels || 0
            const tiragesPossibles = ticketsTotal > 0 ? Math.floor(ticketsVendus / ticketsTotal) : 0
            const ticketsRestants = ticketsVendus % ticketsTotal
            
            if (tiragesPossibles > 0) {
              return (
                <div className="flex items-center justify-between border-t border-border/50 pt-2">
                  <span className="text-sm text-green-500 font-medium">Tirages disponibles</span>
                  <span className="text-lg font-bold text-green-500">
                    {tiragesPossibles} {tiragesPossibles > 1 ? "tirages" : "tirage"}
                  </span>
                </div>
              )
            }
            return null
          })()}
        </div>

        {/* Actions selon le statut */}
        {(() => {
          const ticketsTotal = cadeau.tickets_total || cadeau.objectif_tickets || 0
          const ticketsVendus = cadeau.tickets_actuels || 0
          const tiragesPossibles = ticketsTotal > 0 ? Math.floor(ticketsVendus / ticketsTotal) : 0
          const peutTirer = tiragesPossibles > 0 && !isEnvoye
          const peutLancerTirageFinal = ticketsVendus >= ticketsTotal && ticketsTotal > 0 && !isComplet && !isEnvoye
          
          return (
            <div className="space-y-2">
              {/* Bouton Tirage Final */}
              {peutLancerTirageFinal && onLaunchFinalDraw && (
                <Button
                  onClick={() => onLaunchFinalDraw(cadeau.id)}
                  disabled={isLaunchingDraw === cadeau.id || deleting === cadeau.id}
                  className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white hover:from-green-700 hover:to-green-800"
                >
                  {isLaunchingDraw === cadeau.id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Tirage en cours...
                    </>
                  ) : (
                    <>
                      <Trophy className="mr-2 h-4 w-4" />
                      Lancer le tirage
                    </>
                  )}
                </Button>
              )}
              
              {/* Bouton Tirage Intermédiaire (ancien système) */}
              {peutTirer && !peutLancerTirageFinal && (
                <Button
                  onClick={() => onPickWinner(cadeau.id)}
                  disabled={isProcessingWinner === cadeau.id || deleting === cadeau.id}
                  className="w-full bg-gradient-to-r from-accent to-accent/80 text-accent-foreground hover:bg-accent/90"
                >
                  {isProcessingWinner === cadeau.id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Tirage en cours...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Tirer au sort {tiragesPossibles > 1 && `(${tiragesPossibles} disponibles)`}
                    </>
                  )}
                </Button>
              )}
            </div>
          )
        })()}

        {/* Informations du gagnant pour les cadeaux complétés */}
        {isComplet && cadeau.gagnant_id && (
          <>
            <div className="space-y-2 rounded-lg bg-secondary/30 p-3">
              <div className="flex items-start gap-2">
                <Mail className="h-4 w-4 text-accent mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm text-foreground">
                    {cadeau.gagnant_email || "Non renseigné"}
                  </p>
                </div>
              </div>

              {(cadeau.gagnant_first_name || cadeau.gagnant_last_name) && (
                <div className="flex items-start gap-2">
                  <Package className="h-4 w-4 text-accent mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Nom</p>
                    <p className="text-sm text-foreground">
                      {[cadeau.gagnant_first_name, cadeau.gagnant_last_name]
                        .filter(Boolean)
                        .join(" ")}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-accent mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Adresse de livraison</p>
                  <p className="text-sm text-foreground">
                    {cadeau.gagnant_adresse && cadeau.gagnant_cp && cadeau.gagnant_ville
                      ? `${cadeau.gagnant_adresse}, ${cadeau.gagnant_cp} ${cadeau.gagnant_ville}`
                      : "Non renseignée"}
                  </p>
                </div>
              </div>
            </div>

            {!isEnvoye && (
              <Button
                onClick={() => onMarkShipped(cadeau.id)}
                disabled={updating === cadeau.id}
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
              >
                {updating === cadeau.id ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Mise à jour...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Marquer comme expédié
                  </>
                )}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
