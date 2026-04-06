-- Correction RLS support_messages (insert depuis l’app avec clé anon ou session utilisateur).
-- Exécuter dans Supabase → SQL Editor.
--
-- Erreur typique : « new row violates row-level security policy for table support_messages »
-- → politique INSERT manquante ou rôle non couvert.
--
-- Ne pas utiliser .insert().select() pour les visiteurs anonymes : sans politique SELECT,
-- PostgREST ne peut pas renvoyer la ligne (préférer insert sans select, voir page Support).

DROP POLICY IF EXISTS "support_messages_insert_anon" ON public.support_messages;
DROP POLICY IF EXISTS "support_messages_insert_anon_authenticated" ON public.support_messages;

CREATE POLICY "support_messages_insert_anon_authenticated"
  ON public.support_messages
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

GRANT INSERT ON public.support_messages TO anon, authenticated;
