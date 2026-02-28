-- Table Tap-Tap Arena leaderboard
CREATE TABLE IF NOT EXISTS tap_tap_leaderboard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0,
  week_number INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tap_tap_leaderboard_week_idx ON tap_tap_leaderboard (week_number, created_at DESC);
CREATE INDEX IF NOT EXISTS tap_tap_leaderboard_user_idx ON tap_tap_leaderboard (user_id, created_at DESC);

ALTER TABLE tap_tap_leaderboard ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tap_tap_leaderboard' AND policyname = 'Anyone can read leaderboard'
  ) THEN
    CREATE POLICY "Anyone can read leaderboard" ON tap_tap_leaderboard
      FOR SELECT USING (TRUE);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tap_tap_leaderboard' AND policyname = 'Users can insert own scores'
  ) THEN
    CREATE POLICY "Users can insert own scores" ON tap_tap_leaderboard
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Submit score (VIP+ only)
CREATE OR REPLACE FUNCTION public.submit_tap_tap_score(p_score INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_is_vip_plus BOOLEAN := FALSE;
  v_week_number INTEGER := EXTRACT(WEEK FROM DATE_TRUNC('week', NOW()))::INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT COALESCE(is_vip_plus, FALSE)
  INTO v_is_vip_plus
  FROM profiles
  WHERE id = v_user_id;

  IF NOT v_is_vip_plus THEN
    RAISE EXCEPTION 'not_vip_plus';
  END IF;

  INSERT INTO tap_tap_leaderboard (user_id, score, week_number)
  VALUES (v_user_id, GREATEST(p_score, 0), v_week_number);
END;
$$;

-- Winner of previous week
CREATE OR REPLACE FUNCTION public.get_tap_tap_previous_week_winner()
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  score INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_week_start TIMESTAMPTZ := DATE_TRUNC('week', NOW()) - INTERVAL '1 week';
  v_week_end TIMESTAMPTZ := DATE_TRUNC('week', NOW());
BEGIN
  RETURN QUERY
  SELECT l.user_id,
         COALESCE(NULLIF(TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), ''), 'VIP+') AS display_name,
         l.score
  FROM tap_tap_leaderboard l
  LEFT JOIN profiles p ON p.id = l.user_id
  WHERE l.created_at >= v_week_start
    AND l.created_at < v_week_end
  ORDER BY l.score DESC, l.created_at ASC
  LIMIT 1;
END;
$$;
