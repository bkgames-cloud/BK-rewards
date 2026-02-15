-- Function to reset season and create a new one
-- This can be called manually or via a cron job
CREATE OR REPLACE FUNCTION reset_season()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_season_id UUID;
  current_season_name TEXT;
  new_season_number INTEGER;
BEGIN
  -- Get the current season name to extract the number
  SELECT name INTO current_season_name FROM seasons WHERE is_active = TRUE LIMIT 1;
  
  -- Extract the season number and increment
  IF current_season_name IS NOT NULL THEN
    new_season_number := COALESCE(
      NULLIF(regexp_replace(current_season_name, '[^0-9]', '', 'g'), '')::INTEGER,
      0
    ) + 1;
  ELSE
    new_season_number := 1;
  END IF;
  
  -- Mark current season as inactive
  UPDATE seasons SET is_active = FALSE WHERE is_active = TRUE;
  
  -- Create new season (15 days)
  INSERT INTO seasons (name, start_date, end_date, is_active)
  VALUES (
    'Saison ' || new_season_number,
    NOW(),
    NOW() + INTERVAL '15 days',
    TRUE
  )
  RETURNING id INTO new_season_id;
  
  -- Note: We don't delete user_progress or tickets
  -- They remain associated with the old season_id
  -- This allows users to see their history
  
  RAISE NOTICE 'New season created: Saison %', new_season_number;
END;
$$;

-- Optional: Create a scheduled function check (for manual triggering)
-- In production, you would use Supabase Edge Functions with a cron trigger
CREATE OR REPLACE FUNCTION check_and_reset_season()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_end_date TIMESTAMPTZ;
BEGIN
  -- Get the end date of the current active season
  SELECT end_date INTO current_end_date FROM seasons WHERE is_active = TRUE LIMIT 1;
  
  -- If the season has expired, reset it
  IF current_end_date IS NOT NULL AND current_end_date <= NOW() THEN
    PERFORM reset_season();
  END IF;
END;
$$;
