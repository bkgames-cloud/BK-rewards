export interface Season {
  id: string
  name: string
  start_date: string
  end_date: string
  is_active: boolean
  created_at: string
}

export interface Ticket {
  id: string
  ticket_number: number
  user_id: string
  cadeau_id: string
  created_at: string
}

export interface Profile {
  id: string
  first_name: string | null
  last_name: string | null
  points: number
  is_admin: boolean
  is_vip?: boolean
  last_bonus_claim?: string | null
  last_claim_date?: string | null
  vip_expires_at?: string | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
  referral_code?: string | null
  referred_by?: string | null
  created_at: string
  updated_at: string
}

export interface Cadeau {
  id: string
  nom: string
  image_url: string | null
  points_par_ticket: number
  objectif_tickets: number
  tickets_total?: number // Support des deux noms de colonnes
  tickets_actuels: number
  statut: "en_cours" | "complet" | "envoyé"
  date_fin: string | null
  created_at: string
}

export interface Gagnant {
  id: string
  user_id: string
  cadeau_id: string
  ticket_id: string | null
  email: string | null
  created_at: string
}
