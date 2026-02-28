-- VIP / VIP+ columns
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_vip_plus BOOLEAN DEFAULT FALSE;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS vip_tier TEXT;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS last_vip_plus_claim TIMESTAMPTZ;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS vip_video_bonus_toggle SMALLINT DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_profiles_is_vip_plus ON profiles(is_vip_plus) WHERE is_vip_plus = TRUE;
