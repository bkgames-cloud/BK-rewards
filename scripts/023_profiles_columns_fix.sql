-- Colonnes attendues par l'app pour VIP et notifications.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_vip BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_vip_plus BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS notification_message TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_is_vip ON profiles (is_vip) WHERE is_vip = TRUE;
CREATE INDEX IF NOT EXISTS idx_profiles_is_vip_plus ON profiles (is_vip_plus) WHERE is_vip_plus = TRUE;
