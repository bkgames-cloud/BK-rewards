-- Historique des gagnants Tap-Tap VIP+
CREATE TABLE IF NOT EXISTS history_leaderboard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  display_name TEXT,
  score INTEGER NOT NULL DEFAULT 0,
  week_number INTEGER NOT NULL,
  prize_type TEXT NOT NULL, -- 'points' | 'gift_card'
  prize_label TEXT NOT NULL, -- ex: '500 points' | 'Carte 10€'
  status TEXT NOT NULL DEFAULT 'attribue', -- 'attribue' | 'a_envoyer'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS history_leaderboard_week_idx ON history_leaderboard (week_number, created_at DESC);

ALTER TABLE history_leaderboard ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'history_leaderboard' AND policyname = 'Anyone can read history leaderboard'
  ) THEN
    CREATE POLICY "Anyone can read history leaderboard" ON history_leaderboard
      FOR SELECT USING (TRUE);
  END IF;
END $$;
