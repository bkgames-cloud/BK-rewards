-- Colonne last_draw_at + RPC finalize_draw(p_pool_id uniquement)
-- Executer sur Supabase (Dashboard SQL).

ALTER TABLE public.rewards_pools
  ADD COLUMN IF NOT EXISTS last_draw_at TIMESTAMPTZ;

DROP FUNCTION IF EXISTS public.finalize_draw(UUID, UUID);

CREATE OR REPLACE FUNCTION public.finalize_draw(p_pool_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  IF p_pool_id IS NULL THEN
    RAISE EXCEPTION 'invalid_pool';
  END IF;

  DELETE FROM public.tickets WHERE pool_id = p_pool_id;

  UPDATE public.rewards_pools
  SET
    current_videos = 0,
    last_draw_at = NOW(),
    updated_at = NOW()
  WHERE id = p_pool_id;

  RETURN jsonb_build_object('success', TRUE, 'pool_id', p_pool_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_draw(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_draw(UUID) TO service_role;
