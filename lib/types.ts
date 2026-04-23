export interface Season {
  id: string
  name: string
  start_date: string
  end_date: string
  is_active: boolean
  created_at: string
}

export interface RewardPool {
  id: string
  name: string
  target_videos: number
  current_videos: number
  image_url?: string | null
  ticket_cost?: number | null
  is_active?: boolean
  /** Dernier tirage admin (cooldown 1 h avant un nouveau tirage sur ce lot). */
  last_draw_at?: string | null
}

export interface Profile {
  id: string
  first_name: string | null
  last_name: string | null
  /** Souvent vide : l’e-mail de connexion est celui de Supabase Auth (`user.email`). */
  email?: string | null
  /** Grade principal (Gratuit / VIP / VIP+). */
  grade?: string | null
  points: number
  /** Solde synchronisé (miroir de `points`). */
  points_balance?: number | null
  is_admin: boolean
  is_vip?: boolean
  is_vip_plus?: boolean
  vip_tier?: "vip" | "vip_plus" | null
  last_bonus_claim?: string | null
  last_claim_date?: string | null
  last_vip_plus_claim?: string | null
  vip_until?: string | null
  vip_expires_at?: string | null
  /** Livraison — mêmes noms que la DB ; voir `lib/profile-address.ts`. */
  adresse: string | null
  code_postal: string | null
  ville: string | null
  referral_code?: string | null
  referred_by?: string | null
  flyer_bonus_granted?: boolean
  last_scratch_at?: string | null
  last_wheel_at?: string | null
  last_vip_slot_at?: string | null
  vip_video_bonus_toggle?: number | null
  created_at: string
  updated_at: string
}

// Ancien système "cadeaux" supprimé
