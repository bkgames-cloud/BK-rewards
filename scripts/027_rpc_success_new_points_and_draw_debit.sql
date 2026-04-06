-- Alignement RPC decrement_points sur { success, new_points } + debit admin pour tirage
-- Executer sur Supabase apres 026.

-- 1) decrement_points : format de reponse unifie
CREATE OR REPLACE FUNCTION public.decrement_points(
  p_pool_id UUID,
  p_amount INTEGER,
  p_idempotency_key UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_new INTEGER;
  v_cur INTEGER;
  v_pool_check UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_pool_id IS NULL THEN
    RAISE EXCEPTION 'invalid_pool';
  END IF;

  IF p_amount IS NULL OR p_amount < 1 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.tickets t WHERE t.idempotency_key = p_idempotency_key
    ) THEN
      SELECT points INTO v_cur FROM public.profiles WHERE id = v_uid;
      RETURN jsonb_build_object(
        'success', TRUE,
        'duplicate', TRUE,
        'new_points', COALESCE(v_cur, 0)
      );
    END IF;
  END IF;

  SELECT points INTO v_cur FROM public.profiles WHERE id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  IF v_cur < p_amount THEN
    RAISE EXCEPTION 'insufficient_points';
  END IF;

  SELECT id INTO v_pool_check FROM public.rewards_pools WHERE id = p_pool_id;
  IF v_pool_check IS NULL THEN
    RAISE EXCEPTION 'pool_not_found';
  END IF;

  UPDATE public.profiles
  SET
    points = points - p_amount,
    updated_at = NOW()
  WHERE id = v_uid AND points >= p_amount
  RETURNING points INTO v_new;

  IF v_new IS NULL THEN
    RAISE EXCEPTION 'insufficient_points';
  END IF;

  INSERT INTO public.tickets (user_id, pool_id, idempotency_key)
  VALUES (v_uid, p_pool_id, p_idempotency_key);

  UPDATE public.rewards_pools
  SET current_videos = current_videos + 1
  WHERE id = p_pool_id
  RETURNING id INTO v_pool_check;

  IF v_pool_check IS NULL THEN
    RAISE EXCEPTION 'pool_not_found';
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'duplicate', FALSE,
    'new_points', v_new
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.decrement_points(UUID, INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_points(UUID, INTEGER, UUID) TO service_role;

-- 2) Debit des points du gagnant par un admin (contourne RLS sur profiles)
CREATE OR REPLACE FUNCTION public.debit_draw_winner_points(
  p_user_id UUID,
  p_amount INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new INTEGER;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  IF p_user_id IS NULL OR p_amount IS NULL OR p_amount < 1 THEN
    RAISE EXCEPTION 'invalid_args';
  END IF;

  UPDATE public.profiles
  SET
    points = GREATEST(0, points - p_amount),
    updated_at = NOW()
  WHERE id = p_user_id AND points >= p_amount
  RETURNING points INTO v_new;

  IF v_new IS NULL THEN
    RAISE EXCEPTION 'insufficient_points';
  END IF;

  RETURN jsonb_build_object('success', TRUE, 'new_points', v_new);
END;
$$;

GRANT EXECUTE ON FUNCTION public.debit_draw_winner_points(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.debit_draw_winner_points(UUID, INTEGER) TO service_role;
