-- Statut des gains (winners) + RPC atomique achat ticket (points + ticket + compteur lot)
-- A exécuter sur Supabase SQL Editor apres deploiement.

-- 1) Colonne status sur winners (Gains en attente cote admin)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'winners'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'winners' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.winners ADD COLUMN status TEXT;
    UPDATE public.winners SET status = 'sent' WHERE status IS NULL;
    ALTER TABLE public.winners ALTER COLUMN status SET DEFAULT 'pending';
    ALTER TABLE public.winners ALTER COLUMN status SET NOT NULL;
  END IF;
END $$;

-- 2) Cle d'idempotence sur tickets (evite double debit si double appel avec la meme cle)
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS idempotency_key UUID;
CREATE UNIQUE INDEX IF NOT EXISTS tickets_idempotency_key_uidx
  ON public.tickets (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 3) RPC : debit atomique depuis la valeur reelle en base + ticket + increment lot
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

  -- Deja traite avec cette cle d'idempotence : on renvoie le solde actuel sans rien debiter
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
