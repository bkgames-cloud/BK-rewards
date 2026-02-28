-- Table contributions (suivi des participations)
CREATE TABLE IF NOT EXISTS contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pool_id UUID NOT NULL REFERENCES rewards_pools(id) ON DELETE CASCADE,
  tickets_earned INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS contributions_user_idx ON contributions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS contributions_pool_idx ON contributions (pool_id, created_at DESC);

ALTER TABLE contributions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'contributions' AND policyname = 'Users can read own contributions'
  ) THEN
    CREATE POLICY "Users can read own contributions" ON contributions
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'contributions' AND policyname = 'Users can insert own contributions'
  ) THEN
    CREATE POLICY "Users can insert own contributions" ON contributions
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
