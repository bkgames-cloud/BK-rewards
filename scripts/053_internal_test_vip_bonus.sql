-- Phase test interne : bonus VIP quotidien sans abonnement actif si `internal_test_vip_bonus = true`.
-- Production : `UPDATE public.app_settings SET internal_test_vip_bonus = FALSE WHERE id = 1;`
-- À exécuter dans Supabase → SQL Editor.

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS internal_test_vip_bonus BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.claim_vip_bonus()
RETURNS TABLE (
  success BOOLEAN,
  tickets_granted INTEGER,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_last_claim TIMESTAMPTZ;
  v_is_vip_plus BOOLEAN := FALSE;
  v_bonus INTEGER := 0;
  v_active_until TIMESTAMPTZ;
  v_active_product TEXT;
  v_internal_test BOOLEAN := FALSE;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 'not_authenticated'::TEXT;
    RETURN;
  END IF;

  SELECT COALESCE(
    (SELECT internal_test_vip_bonus FROM public.app_settings WHERE id = 1),
    FALSE
  )
  INTO v_internal_test;

  SELECT last_bonus_claim INTO v_last_claim
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_last_claim IS NOT NULL AND v_last_claim > NOW() - INTERVAL '24 hours' THEN
    RETURN QUERY SELECT FALSE, 0, 'already_claimed_today'::TEXT;
    RETURN;
  END IF;

  IF v_internal_test THEN
    v_bonus := 10;
    v_is_vip_plus := FALSE;
    UPDATE public.profiles
    SET
      points = COALESCE(points, 0) + v_bonus,
      last_bonus_claim = NOW(),
      last_claim_date = NOW(),
      is_vip = TRUE,
      is_vip_plus = FALSE,
      vip_tier = 'vip',
      grade = 'VIP',
      updated_at = NOW()
    WHERE id = v_user_id;

    RETURN QUERY SELECT TRUE, v_bonus, 'success'::TEXT;
    RETURN;
  END IF;

  SELECT p.expiry_date, p.product_id
    INTO v_active_until, v_active_product
  FROM public.purchases p
  WHERE p.user_id = v_user_id
    AND p.status = 'active'
    AND p.expiry_date IS NOT NULL
    AND p.expiry_date > NOW()
  ORDER BY p.expiry_date DESC, p.created_at DESC
  LIMIT 1;

  IF v_active_until IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 'subscription_inactive'::TEXT;
    RETURN;
  END IF;

  v_is_vip_plus := (v_active_product = 'vip_plus_mensuel_bkg');
  v_bonus := CASE WHEN v_is_vip_plus THEN 15 ELSE 10 END;

  UPDATE public.profiles
  SET
    points = COALESCE(points, 0) + v_bonus,
    last_bonus_claim = NOW(),
    last_claim_date = NOW(),
    is_vip = TRUE,
    is_vip_plus = v_is_vip_plus,
    vip_tier = CASE WHEN v_is_vip_plus THEN 'vip_plus' ELSE 'vip' END,
    vip_until = COALESCE(v_active_until, vip_until),
    grade = CASE WHEN v_is_vip_plus THEN 'VIP+' ELSE 'VIP' END,
    updated_at = NOW()
  WHERE id = v_user_id;

  RETURN QUERY SELECT TRUE, v_bonus, 'success'::TEXT;
END;
$$;
