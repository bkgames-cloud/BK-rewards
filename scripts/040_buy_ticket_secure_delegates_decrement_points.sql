-- Si une ancienne version de `buy_ticket_secure` incrémentait `current_tickets` au lieu de
-- `current_videos`, les achats ne persistaient pas pour l’UI qui lit `current_videos`.
-- Cette définition délègue à `public.decrement_points` (scripts 026 / 027) qui fait bien :
--   UPDATE public.rewards_pools SET current_videos = current_videos + 1 WHERE id = p_pool_id;
--
-- À exécuter dans le SQL Editor Supabase après 026 / 027.

CREATE OR REPLACE FUNCTION public.buy_ticket_secure(
  p_user_id UUID,
  p_pool_id UUID,
  p_cost INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key UUID := gen_random_uuid();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN public.decrement_points(p_pool_id, p_cost, v_key);
END;
$$;

GRANT EXECUTE ON FUNCTION public.buy_ticket_secure(UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buy_ticket_secure(UUID, UUID, INTEGER) TO service_role;
