-- Support tickets (remplace l’API /api/send-email sur mobile).
-- Stockage en base + possibilité de notification via Edge Function ou Webhook.

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Lecture : uniquement le propriétaire (si authentifié).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'support_tickets' AND policyname = 'Support tickets are readable by owner'
  ) THEN
    CREATE POLICY "Support tickets are readable by owner" ON public.support_tickets
      FOR SELECT USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);
  END IF;
END $$;

-- Insertion : ouverte (permet support sans compte) — à durcir si besoin (captcha, rate-limit, etc.).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'support_tickets' AND policyname = 'Support tickets are insertable'
  ) THEN
    CREATE POLICY "Support tickets are insertable" ON public.support_tickets
      FOR INSERT WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS support_tickets_created_at_idx ON public.support_tickets (created_at DESC);

