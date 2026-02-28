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
}

export interface Profile {
  id: string
  first_name: string | null
  last_name: string | null
  points: number
  is_admin: boolean
  is_vip?: boolean
  is_vip_plus?: boolean
  vip_tier?: "vip" | "vip_plus" | null
  last_bonus_claim?: string | null
  last_claim_date?: string | null
  last_vip_plus_claim?: string | null
  vip_until?: string | null
  vip_expires_at?: string | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
  referral_code?: string | null
  referred_by?: string | null
  last_scratch_at?: string | null
  last_wheel_at?: string | null
  last_vip_slot_at?: string | null
  vip_video_bonus_toggle?: number | null
  created_at: string
  updated_at: string
}

// Ancien système "cadeaux" supprimé
