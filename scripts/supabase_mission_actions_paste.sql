-- =============================================================================
-- À copier-coller dans Supabase → SQL Editor → Run
-- Table + RLS + RPC sécurisées (points +5 / +3 uniquement côté serveur)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.mission_action_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  points_awarded INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mission_action_claims_user_id
  ON public.mission_action_claims (user_id);

ALTER TABLE public.mission_action_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own mission_action_claims" ON public.mission_action_claims;
CREATE POLICY "Users read own mission_action_claims"
  ON public.mission_action_claims FOR SELECT
  USING (auth.uid() = user_id);

-- Empêcher l’insertion directe depuis le client (anti-triche) : seule la RPC définit les points.
REVOKE INSERT, UPDATE, DELETE ON public.mission_action_claims FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON public.mission_action_claims FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.mission_action_claims FROM anon;
GRANT SELECT ON public.mission_action_claims TO authenticated;

-- Compteur pour l’UI / vérif « 1ère action » (optionnel, lecture seule)
CREATE OR REPLACE FUNCTION public.get_mission_action_claims_count()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.mission_action_claims
  WHERE user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_mission_action_claims_count() TO authenticated;

-- Attribution des points : 1ère ligne = +5, suivantes = +3 (logique exclusivement ici)
CREATE OR REPLACE FUNCTION public.add_mission_action_points()
RETURNS TABLE (new_points INTEGER, first_action BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_prior INTEGER;
  v_add INTEGER;
  v_points INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('mission_action:' || v_user_id::text));

  SELECT COUNT(*)::INTEGER INTO v_prior
  FROM public.mission_action_claims
  WHERE user_id = v_user_id;

  IF v_prior = 0 THEN
    v_add := 5;
  ELSE
    v_add := 3;
  END IF;

  INSERT INTO public.mission_action_claims (user_id, points_awarded)
  VALUES (v_user_id, v_add);

  UPDATE public.profiles
  SET points = COALESCE(points, 0) + v_add,
      updated_at = NOW()
  WHERE id = v_user_id
  RETURNING points INTO v_points;

  RETURN QUERY SELECT v_points, (v_prior = 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_mission_action_points() TO authenticated;
