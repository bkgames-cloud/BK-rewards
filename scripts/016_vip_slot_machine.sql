-- Ajouter le cooldown du spin VIP
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS last_vip_slot_at TIMESTAMPTZ;
