-- Notifications internes (admin) : remplace l’envoi d’e-mail direct depuis le mobile.

CREATE TABLE IF NOT EXISTS public.notifications_admin (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  target_email TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ NULL
);

ALTER TABLE public.notifications_admin ENABLE ROW LEVEL SECURITY;

-- Lecture/écriture : uniquement service_role (ou un admin via SQL/dashboard).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications_admin' AND policyname = 'notifications_admin service_role only'
  ) THEN
    CREATE POLICY "notifications_admin service_role only" ON public.notifications_admin
      FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS notifications_admin_created_at_idx ON public.notifications_admin (created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_admin_type_idx ON public.notifications_admin (type, created_at DESC);

