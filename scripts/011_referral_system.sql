-- Système de parrainage

-- 1) Ajouter les colonnes de parrainage à la table profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- 2) Créer un index sur referral_code pour des recherches rapides
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON profiles(referred_by);

-- 3) Fonction pour générer un code de parrainage unique (basé sur l'ID)
CREATE OR REPLACE FUNCTION public.generate_referral_code(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  -- Générer un code basé sur l'ID (premiers 8 caractères de l'ID en base64)
  -- On utilise les 8 premiers caractères de l'ID (sans les tirets) pour un code court
  v_code := UPPER(SUBSTRING(REPLACE(p_user_id::TEXT, '-', ''), 1, 8));
  
  -- Vérifier l'unicité (très peu probable qu'il y ait un doublon, mais on vérifie)
  SELECT EXISTS(SELECT 1 FROM profiles WHERE referral_code = v_code) INTO v_exists;
  
  -- Si le code existe déjà (très rare), ajouter un suffixe
  IF v_exists THEN
    v_code := v_code || UPPER(SUBSTRING(MD5(p_user_id::TEXT), 1, 2));
  END IF;
  
  RETURN v_code;
END;
$$;

-- 4) Fonction pour récompenser le parrain lors de l'inscription d'un filleul
CREATE OR REPLACE FUNCTION public.reward_referrer(p_new_user_id UUID)
RETURNS TABLE (
  success BOOLEAN,
  referrer_id UUID,
  referrer_code TEXT,
  tickets_added INTEGER,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referred_by UUID;
  v_referrer_id UUID;
  v_referrer_code TEXT;
  v_tickets_to_add INTEGER := 10;
BEGIN
  -- Récupérer le parrain du nouvel utilisateur
  SELECT referred_by INTO v_referred_by
  FROM profiles
  WHERE id = p_new_user_id;

  -- Si pas de parrain, retourner un succès sans action
  IF v_referred_by IS NULL THEN
    RETURN QUERY SELECT TRUE, NULL::UUID, NULL::TEXT, 0, 'no_referrer'::TEXT;
    RETURN;
  END IF;

  -- Vérifier que le parrain existe
  SELECT id, referral_code INTO v_referrer_id, v_referrer_code
  FROM profiles
  WHERE id = v_referred_by;

  IF v_referrer_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 0, 'referrer_not_found'::TEXT;
    RETURN;
  END IF;

  -- Ajouter 10 tickets au parrain
  UPDATE profiles
  SET points = points + v_tickets_to_add,
      updated_at = NOW()
  WHERE id = v_referrer_id;

  RETURN QUERY SELECT TRUE, v_referrer_id, v_referrer_code, v_tickets_to_add, 'rewarded_successfully'::TEXT;
END;
$$;

-- 5) Trigger pour générer automatiquement le code de parrainage à l'inscription
CREATE OR REPLACE FUNCTION public.set_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Si le code n'existe pas encore, le générer
  IF NEW.referral_code IS NULL OR NEW.referral_code = '' THEN
    NEW.referral_code := public.generate_referral_code(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Créer le trigger si il n'existe pas déjà
DROP TRIGGER IF EXISTS trigger_set_referral_code ON profiles;
CREATE TRIGGER trigger_set_referral_code
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  WHEN (NEW.referral_code IS NULL OR NEW.referral_code = '')
  EXECUTE FUNCTION public.set_referral_code();

-- 6) Mettre à jour les profils existants qui n'ont pas de code
UPDATE profiles
SET referral_code = public.generate_referral_code(id)
WHERE referral_code IS NULL OR referral_code = '';
