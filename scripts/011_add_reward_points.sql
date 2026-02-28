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
  v_is_vip BOOLEAN := FALSE;
  v_is_vip_plus BOOLEAN := FALSE;
  v_toggle SMALLINT := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Check VIP tiers
  SELECT COALESCE(is_vip, FALSE), COALESCE(is_vip_plus, FALSE), COALESCE(vip_video_bonus_toggle, 0)
  INTO v_is_vip, v_is_vip_plus, v_toggle
  FROM profiles
  WHERE id = v_user_id;

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

  -- VIP/VIP+ multiplier (x1.5 sur la durée)
  IF v_is_vip OR v_is_vip_plus THEN
    IF v_toggle = 0 THEN
      v_add := v_add + 1;
      v_toggle := 1;
    ELSE
      v_toggle := 0;
    END IF;
  END IF;

  INSERT INTO video_views (user_id) VALUES (v_user_id);

  UPDATE profiles
  SET points = COALESCE(points, 0) + v_add,
      vip_video_bonus_toggle = v_toggle,
      updated_at = NOW()
  WHERE id = v_user_id
  RETURNING points INTO v_points;

  RETURN QUERY SELECT v_points, v_bonus, v_hour_count + 1, v_day_count + 1;
END;
$$;
