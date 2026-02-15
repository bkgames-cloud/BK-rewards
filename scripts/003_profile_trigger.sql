-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referred_by UUID;
  v_referral_code TEXT;
BEGIN
  -- Récupérer le referred_by depuis les metadata (si présent)
  -- Note: referred_by est passé comme UUID dans les metadata
  IF new.raw_user_meta_data ? 'referred_by' THEN
    v_referred_by := (new.raw_user_meta_data ->> 'referred_by')::UUID;
  END IF;

  -- Générer le code de parrainage
  v_referral_code := public.generate_referral_code(new.id);

  INSERT INTO public.profiles (id, first_name, last_name, referred_by, referral_code)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data ->> 'first_name', NULL),
    COALESCE(new.raw_user_meta_data ->> 'last_name', NULL),
    v_referred_by,
    v_referral_code
  )
  ON CONFLICT (id) DO UPDATE
    SET 
      first_name = COALESCE(EXCLUDED.first_name, profiles.first_name),
      last_name = COALESCE(EXCLUDED.last_name, profiles.last_name),
      referred_by = COALESCE(EXCLUDED.referred_by, profiles.referred_by),
      referral_code = COALESCE(EXCLUDED.referral_code, profiles.referral_code);

  -- Récompenser le parrain si un referred_by est présent
  IF v_referred_by IS NOT NULL THEN
    PERFORM public.reward_referrer(new.id);
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
