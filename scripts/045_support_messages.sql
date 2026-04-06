-- Messages support (double sauvegarde avec Resend côté API).
-- Exécuter sur Supabase après déploiement de la route /api/send-email.

CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  resend_sent BOOLEAN NOT NULL DEFAULT FALSE,
  resend_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'support_messages' AND policyname = 'support_messages_insert_anon'
  ) THEN
    CREATE POLICY "support_messages_insert_anon" ON public.support_messages
      FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS support_messages_created_at_idx ON public.support_messages (created_at DESC);

GRANT INSERT ON public.support_messages TO anon, authenticated;
