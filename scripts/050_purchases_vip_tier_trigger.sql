-- Étend la logique VIP/VIP+ basée sur `public.purchases.product_id`.
-- À exécuter dans Supabase → SQL Editor après scripts/043_purchases.sql.
--
-- Hypothèse : les produits Google Play sont `vip_mensuel_bkg` et `vip_plus_mensuel_bkg`
-- (ou ceux définis côté app). Ajuste les IDs si besoin.

CREATE OR REPLACE FUNCTION public.handle_purchases_active_vip()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_vip_plus BOOLEAN := FALSE;
BEGIN
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  v_is_vip_plus := (NEW.product_id IN ('vip_plus_mensuel_bkg', 'vip_plus_mensuel'));

  UPDATE public.profiles
  SET
    is_vip = TRUE,
    is_vip_plus = v_is_vip_plus,
    vip_tier = CASE WHEN v_is_vip_plus THEN 'vip_plus' ELSE 'vip' END,
    vip_until = COALESCE(NEW.expiry_date, vip_until),
    grade = CASE WHEN v_is_vip_plus THEN 'VIP+' ELSE 'VIP' END,
    updated_at = NOW()
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$;

