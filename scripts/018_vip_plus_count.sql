-- Compter les abonnés VIP+ (fonction publique en lecture)
CREATE OR REPLACE FUNCTION public.get_vip_plus_count()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER FROM profiles WHERE is_vip_plus = TRUE;
$$;
