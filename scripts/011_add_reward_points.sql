-- Secure reward points with daily x2 bonus (first ad view of the day)
CREATE OR REPLACE FUNCTION public.add_reward_points()
RETURNS TABLE (
  new_points INTEGER,
  bonus_applied BOOLEAN,
  hour_count INTEGER,
  day_count INTEGER
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_hour_count INTEGER;
  v_day_count INTEGER;
  v_points INTEGER;
  v_bonus BOOLEAN := FALSE;
  v_add INTEGER := 1;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Count views for limits
  SELECT COUNT(*) INTO v_hour_count
  FROM video_views
  WHERE user_id = v_user_id
    AND created_at >= NOW() - INTERVAL '1 hour';

  SELECT COUNT(*) INTO v_day_count
  FROM video_views
  WHERE user_id = v_user_id
    AND created_at >= DATE_TRUNC('day', NOW());

  IF v_hour_count >= 5 THEN
    RAISE EXCEPTION 'hour_limit';
  END IF;

  IF v_day_count >= 25 THEN
    RAISE EXCEPTION 'day_limit';
  END IF;

  -- First view of the day gives x2
  IF v_day_count = 0 THEN
    v_bonus := TRUE;
    v_add := 2;
  END IF;

  INSERT INTO video_views (user_id) VALUES (v_user_id);

  UPDATE profiles
  SET points = COALESCE(points, 0) + v_add,
      updated_at = NOW()
  WHERE id = v_user_id
  RETURNING points INTO v_points;

  RETURN QUERY SELECT v_points, v_bonus, v_hour_count + 1, v_day_count + 1;
END;
$$;
