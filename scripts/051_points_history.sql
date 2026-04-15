-- Points history (pour lecture Hub)
-- Objectif : historiser chaque variation de `public.profiles.points`.

CREATE TABLE IF NOT EXISTS public.points_history (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  points_after INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 'profiles_trigger',
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS points_history_user_created_idx
  ON public.points_history (user_id, created_at DESC);

ALTER TABLE public.points_history ENABLE ROW LEVEL SECURITY;

-- L’utilisateur peut lire son historique
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'points_history'
      AND policyname = 'Users can read their points history'
  ) THEN
    CREATE POLICY "Users can read their points history"
      ON public.points_history
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Inserts : via trigger uniquement (service_role / DB). Pas d’INSERT client direct.

CREATE OR REPLACE FUNCTION public.trg_points_history_from_profiles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_points INTEGER := COALESCE(OLD.points, 0);
  new_points INTEGER := COALESCE(NEW.points, 0);
  d INTEGER := new_points - old_points;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  -- Pas d’historique si pas de changement
  IF d = 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.points_history (user_id, delta, points_after, source, meta)
  VALUES (
    NEW.id,
    d,
    new_points,
    'profiles_trigger',
    jsonb_build_object(
      'updated_at', NEW.updated_at,
      'points_balance', COALESCE(NEW.points_balance, NULL)
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_points_history_profiles ON public.profiles;
CREATE TRIGGER trg_points_history_profiles
AFTER UPDATE OF points ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.trg_points_history_from_profiles();

