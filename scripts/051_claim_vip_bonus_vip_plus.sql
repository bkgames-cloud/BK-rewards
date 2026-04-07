-- Bonus quotidien VIP/VIP+ (manuel) — sécurisé côté DB.
-- Règles :
-- - Pas automatique : uniquement via appel RPC `claim_vip_bonus()`.
-- - VIP : +10 points / 24h
-- - VIP+ : +15 points / 24h
-- - Accorder le bonus uniquement si abonnement ACTIF (purchases.status='active' et expiry_date > now()).
--
-- À exécuter dans Supabase → SQL Editor.

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
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 'not_authenticated'::TEXT;
    RETURN;
  END IF;

  SELECT last_bonus_claim INTO v_last_claim
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_last_claim IS NOT NULL AND v_last_claim > NOW() - INTERVAL '24 hours' THEN
    RETURN QUERY SELECT FALSE, 0, 'already_claimed_today'::TEXT;
    RETURN;
  END IF;

  -- Vérifier l'abonnement actif (source de vérité : purchases)
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

  v_is_vip_plus := (v_active_product = 'vip_plus_mensuel');
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

