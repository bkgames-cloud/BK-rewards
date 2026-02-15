-- Ajouter les colonnes VIP à la table profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_vip BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_bonus_claim TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS vip_expires_at TIMESTAMP WITH TIME ZONE;

-- Index pour optimiser les requêtes VIP
CREATE INDEX IF NOT EXISTS idx_profiles_is_vip ON profiles(is_vip) WHERE is_vip = TRUE;
CREATE INDEX IF NOT EXISTS idx_profiles_vip_expires_at ON profiles(vip_expires_at) WHERE is_vip = TRUE;

-- Fonction pour réclamer le bonus quotidien VIP
CREATE OR REPLACE FUNCTION public.claim_vip_bonus()
RETURNS TABLE (
  success BOOLEAN,
  tickets_granted INTEGER,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_is_vip BOOLEAN;
  v_last_claim TIMESTAMP WITH TIME ZONE;
  v_tickets_granted INTEGER;
  v_random_tickets INTEGER;
BEGIN
  -- Récupérer l'utilisateur actuel
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 'not_authenticated'::TEXT;
    RETURN;
  END IF;

  -- Vérifier si l'utilisateur est VIP
  SELECT is_vip, last_bonus_claim
  INTO v_is_vip, v_last_claim
  FROM profiles
  WHERE id = v_user_id;

  IF NOT v_is_vip THEN
    RETURN QUERY SELECT FALSE, 0, 'not_vip'::TEXT;
    RETURN;
  END IF;

  -- Vérifier si le bonus a déjà été réclamé aujourd'hui
  IF v_last_claim IS NOT NULL AND v_last_claim > NOW() - INTERVAL '24 hours' THEN
    RETURN QUERY SELECT FALSE, 0, 'already_claimed_today'::TEXT;
    RETURN;
  END IF;

  -- Générer un nombre aléatoire de tickets entre 5 et 10
  v_random_tickets := 5 + FLOOR(RANDOM() * 6)::INTEGER; -- 5 à 10 inclus

  -- Ajouter les tickets directement au solde de points (1 ticket = 1 point pour simplifier)
  -- Ou créer des tickets directement pour un cadeau spécifique
  -- Pour l'instant, on ajoute les points équivalents
  UPDATE profiles
  SET points = points + v_random_tickets,
      last_bonus_claim = NOW()
  WHERE id = v_user_id;

  v_tickets_granted := v_random_tickets;

  RETURN QUERY SELECT TRUE, v_tickets_granted, 'success'::TEXT;
END;
$$;

-- RLS pour permettre aux utilisateurs de voir leur propre statut VIP
-- (déjà géré par les politiques existantes sur profiles)
