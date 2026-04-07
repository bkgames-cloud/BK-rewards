-- RLS "pro" pour `public.support_messages` (Play Store / app statique).
--
-- Objectif :
-- 1) Autoriser tout le monde (anon + authenticated) à INSERT.
-- 2) Interdire SELECT/UPDATE/DELETE côté client ; réservé au service_role (Edge Functions / backoffice).
--
-- À exécuter dans Supabase → SQL Editor.

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Nettoyage policies existantes (si tu as exécuté les scripts 045/046).
DROP POLICY IF EXISTS "support_messages_insert_anon" ON public.support_messages;
DROP POLICY IF EXISTS "support_messages_insert_anon_authenticated" ON public.support_messages;
DROP POLICY IF EXISTS "support_messages_select_own_session" ON public.support_messages;

-- 1) INSERT autorisé à tous (anon + authenticated)
CREATE POLICY "support_messages_insert_public"
  ON public.support_messages
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- 2) SELECT / DELETE : uniquement service_role.
-- Supabase `service_role` bypass RLS de toute façon, mais on l'explicite.
DROP POLICY IF EXISTS "support_messages_select_service_role" ON public.support_messages;
CREATE POLICY "support_messages_select_service_role"
  ON public.support_messages
  FOR SELECT
  TO service_role
  USING (true);

DROP POLICY IF EXISTS "support_messages_delete_service_role" ON public.support_messages;
CREATE POLICY "support_messages_delete_service_role"
  ON public.support_messages
  FOR DELETE
  TO service_role
  USING (true);

-- Pas de policy UPDATE → interdit pour anon/authenticated (et autorisé via bypass service_role).

-- Grants côté table (RLS fait le filtrage logique)
GRANT INSERT ON public.support_messages TO anon, authenticated;
GRANT SELECT, DELETE ON public.support_messages TO service_role;

