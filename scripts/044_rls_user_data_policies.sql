-- =============================================================================
-- RLS : données utilisateur — lecture / modification limitées à auth.uid()
-- Exécuter dans Supabase → SQL Editor (après les migrations existantes).
-- Prérequis : fonction public.is_admin() (voir scripts/010_admin_users_permissions.sql).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- public.profiles (id = auth.users.id)
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Users can read own profile'
  ) THEN
    CREATE POLICY "Users can read own profile" ON public.profiles
      FOR SELECT
      USING (auth.uid() IS NOT NULL AND auth.uid() = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Users can update own profile'
  ) THEN
    CREATE POLICY "Users can update own profile" ON public.profiles
      FOR UPDATE
      USING (auth.uid() IS NOT NULL AND auth.uid() = id)
      WITH CHECK (
        auth.uid() = id
        AND (
          public.is_admin()
          OR COALESCE(is_admin, false) = false
        )
      );
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- public.tickets (insertions via RPC SECURITY DEFINER uniquement)
-- -----------------------------------------------------------------------------
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tickets' AND policyname = 'Users can read own tickets'
  ) THEN
    CREATE POLICY "Users can read own tickets" ON public.tickets
      FOR SELECT
      USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- public.winners
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'winners'
  ) THEN
    ALTER TABLE public.winners ENABLE ROW LEVEL SECURITY;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'winners' AND policyname = 'Users can read own winners'
    ) THEN
      CREATE POLICY "Users can read own winners" ON public.winners
        FOR SELECT
        USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'winners' AND policyname = 'Users can update own winners'
    ) THEN
      CREATE POLICY "Users can update own winners" ON public.winners
        FOR UPDATE
        USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'winners' AND policyname = 'Admins can manage all winners'
    ) THEN
      CREATE POLICY "Admins can manage all winners" ON public.winners
        FOR ALL
        USING (public.is_admin())
        WITH CHECK (public.is_admin());
    END IF;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- public.notifications
-- -----------------------------------------------------------------------------
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'Users can read own notifications'
  ) THEN
    CREATE POLICY "Users can read own notifications" ON public.notifications
      FOR SELECT
      USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'Users can insert own notifications'
  ) THEN
    CREATE POLICY "Users can insert own notifications" ON public.notifications
      FOR INSERT
      WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'Users can update own notifications'
  ) THEN
    CREATE POLICY "Users can update own notifications" ON public.notifications
      FOR UPDATE
      USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- public.video_views
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'video_views'
  ) THEN
    ALTER TABLE public.video_views ENABLE ROW LEVEL SECURITY;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'video_views' AND policyname = 'Users can read own video views'
    ) THEN
      CREATE POLICY "Users can read own video views" ON public.video_views
        FOR SELECT
        USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'video_views' AND policyname = 'Users can insert own video views'
    ) THEN
      CREATE POLICY "Users can insert own video views" ON public.video_views
        FOR INSERT
        WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);
    END IF;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- public.rewards
-- -----------------------------------------------------------------------------
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'rewards' AND policyname = 'Users can read own rewards'
  ) THEN
    CREATE POLICY "Users can read own rewards" ON public.rewards
      FOR SELECT
      USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- public.seasons (données globales, pas de colonne user)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'seasons'
  ) THEN
    ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'seasons' AND policyname = 'Anyone can read seasons'
    ) THEN
      CREATE POLICY "Anyone can read seasons" ON public.seasons
        FOR SELECT
        USING (true);
    END IF;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- public.support_tickets — option user_id pour rattachement compte ; formulaire anonyme conservé
-- -----------------------------------------------------------------------------
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL;

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Support tickets are readable by owner" ON public.support_tickets;
DROP POLICY IF EXISTS "Support tickets are insertable" ON public.support_tickets;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'support_tickets'
      AND policyname = 'Support tickets select own or admin'
  ) THEN
    CREATE POLICY "Support tickets select own or admin" ON public.support_tickets
      FOR SELECT
      USING (
        (auth.uid() IS NOT NULL AND user_id IS NOT NULL AND auth.uid() = user_id)
        OR public.is_admin()
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'support_tickets'
      AND policyname = 'Support tickets insert anon or own'
  ) THEN
    CREATE POLICY "Support tickets insert anon or own" ON public.support_tickets
      FOR INSERT
      WITH CHECK (
        user_id IS NULL
        OR (auth.uid() IS NOT NULL AND auth.uid() = user_id)
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS support_tickets_user_id_idx ON public.support_tickets (user_id);
