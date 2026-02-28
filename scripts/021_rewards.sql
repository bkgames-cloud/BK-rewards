-- Table rewards: gains à distribuer
CREATE TABLE IF NOT EXISTS rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reward_type TEXT NOT NULL, -- ex: 'points_500', 'gift_card_10'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'sent'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rewards_status_idx ON rewards (status, created_at DESC);
CREATE INDEX IF NOT EXISTS rewards_user_idx ON rewards (user_id, created_at DESC);

ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rewards' AND policyname = 'Admins can read all rewards'
  ) THEN
    CREATE POLICY "Admins can read all rewards" ON rewards
      FOR SELECT USING (public.is_admin());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rewards' AND policyname = 'Admins can update rewards'
  ) THEN
    CREATE POLICY "Admins can update rewards" ON rewards
      FOR UPDATE USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;
END $$;
