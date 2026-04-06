-- =============================================================================
-- Table public.purchases — abonnements Google Play / Stripe
-- Exécuter dans Supabase → SQL Editor (une fois les migrations existantes appliquées).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  purchase_token TEXT,
  product_id TEXT NOT NULL,
  status TEXT NOT NULL,
  provider TEXT NOT NULL,
  expiry_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT purchases_status_check CHECK (
    status = ANY (
      ARRAY['active'::text, 'cancelled'::text, 'expired'::text, 'pending'::text]
    )
  ),
  CONSTRAINT purchases_provider_check CHECK (provider = ANY (ARRAY['google'::text, 'stripe'::text]))
);

-- Reçu Google unique (plusieurs NULL autorisés pour Stripe sans token)
CREATE UNIQUE INDEX IF NOT EXISTS purchases_purchase_token_unique
  ON public.purchases (purchase_token)
  WHERE purchase_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS purchases_user_id_created_at_idx
  ON public.purchases (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS purchases_user_id_status_idx
  ON public.purchases (user_id, status);

COMMENT ON TABLE public.purchases IS 'Achats et abonnements. Écriture : service_role / API / webhooks uniquement.';

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

-- Lecture : uniquement ses propres lignes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'purchases'
      AND policyname = 'Users can read own purchases'
  ) THEN
    CREATE POLICY "Users can read own purchases" ON public.purchases
      FOR SELECT
      USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);
  END IF;
END $$;

-- Admins : lecture globale (si public.is_admin() existe)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_admin'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'purchases'
        AND policyname = 'Admins can read all purchases'
    ) THEN
      CREATE POLICY "Admins can read all purchases" ON public.purchases
        FOR SELECT
        USING (public.is_admin());
    END IF;
  END IF;
END $$;

-- Pas de politique INSERT/UPDATE/DELETE pour les clients (service_role bypass RLS)

-- -----------------------------------------------------------------------------
-- Trigger : achat actif → profiles.is_vip = true (+ dates / grade cohérents VIP)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_purchases_active_vip()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'active' THEN
    UPDATE public.profiles
    SET
      is_vip = true,
      is_vip_plus = false,
      vip_until = COALESCE(NEW.expiry_date, vip_until),
      grade = 'VIP',
      updated_at = NOW()
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_purchases_active_vip_insert ON public.purchases;

CREATE TRIGGER trg_purchases_active_vip_insert
  AFTER INSERT ON public.purchases
  FOR EACH ROW
  WHEN (NEW.status = 'active')
  EXECUTE PROCEDURE public.handle_purchases_active_vip();

DROP TRIGGER IF EXISTS trg_purchases_active_vip_update ON public.purchases;

CREATE TRIGGER trg_purchases_active_vip_update
  AFTER UPDATE OF status, expiry_date ON public.purchases
  FOR EACH ROW
  WHEN (
    NEW.status = 'active'
    AND (
      OLD.status IS DISTINCT FROM NEW.status
      OR OLD.expiry_date IS DISTINCT FROM NEW.expiry_date
    )
  )
  EXECUTE PROCEDURE public.handle_purchases_active_vip();
