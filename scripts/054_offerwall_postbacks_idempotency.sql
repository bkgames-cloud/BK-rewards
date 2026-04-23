-- v6: Idempotence postbacks offerwalls (Lootably, Revlum, etc.)
-- Objectif: éviter tout double-crédit en cas de retry postback.

CREATE TABLE IF NOT EXISTS public.offerwall_postback_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  external_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  points integer NOT NULL CHECK (points > 0),
  raw jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz NULL,
  points_balance_after integer NULL
);

-- Clé idempotente: un événement (provider, external_id) ne peut être appliqué qu'une fois.
CREATE UNIQUE INDEX IF NOT EXISTS offerwall_postback_events_provider_external_id_uq
  ON public.offerwall_postback_events(provider, external_id);

-- Permet de retrouver vite les événements d'un utilisateur
CREATE INDEX IF NOT EXISTS offerwall_postback_events_user_id_idx
  ON public.offerwall_postback_events(user_id, created_at DESC);

-- RPC atomique: insert événement (idempotent) + crédit du solde en 1 transaction
CREATE OR REPLACE FUNCTION public.apply_offerwall_postback(
  p_provider text,
  p_external_id text,
  p_user_id uuid,
  p_points integer,
  p_raw jsonb DEFAULT NULL
)
RETURNS TABLE (
  applied boolean,
  already_applied boolean,
  points_balance integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row public.offerwall_postback_events%ROWTYPE;
  v_next integer;
BEGIN
  IF p_provider IS NULL OR btrim(p_provider) = '' THEN
    RAISE EXCEPTION 'missing_provider';
  END IF;
  IF p_external_id IS NULL OR btrim(p_external_id) = '' THEN
    RAISE EXCEPTION 'missing_external_id';
  END IF;
  IF p_points IS NULL OR p_points <= 0 THEN
    RAISE EXCEPTION 'invalid_points';
  END IF;

  -- 1) Tente d'insérer l'événement. Si conflit, on lit l'existant (idempotence).
  INSERT INTO public.offerwall_postback_events(provider, external_id, user_id, points, raw)
  VALUES (btrim(p_provider), btrim(p_external_id), p_user_id, p_points, p_raw)
  ON CONFLICT (provider, external_id) DO NOTHING;

  SELECT *
  INTO v_row
  FROM public.offerwall_postback_events
  WHERE provider = btrim(p_provider) AND external_id = btrim(p_external_id)
  LIMIT 1;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'event_read_failed';
  END IF;

  -- Si déjà appliqué, renvoie le solde enregistré.
  IF v_row.applied_at IS NOT NULL THEN
    RETURN QUERY SELECT false, true, COALESCE(v_row.points_balance_after, 0);
    RETURN;
  END IF;

  -- 2) Crédit du solde centralisé
  UPDATE public.profiles
  SET
    points_balance = COALESCE(points_balance, points, 0) + p_points,
    points = COALESCE(points_balance, points, 0) + p_points,
    updated_at = now()
  WHERE id = p_user_id
  RETURNING points_balance INTO v_next;

  IF v_next IS NULL THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  -- 3) Marque l'événement comme appliqué (verrouille le double-crédit)
  UPDATE public.offerwall_postback_events
  SET applied_at = now(), points_balance_after = v_next
  WHERE id = v_row.id;

  RETURN QUERY SELECT true, false, v_next;
END;
$$;

-- Important: ajuster les privilèges/RLS selon ta politique.
-- La fonction est SECURITY DEFINER et prévue pour être appelée via service role (Edge Functions).

