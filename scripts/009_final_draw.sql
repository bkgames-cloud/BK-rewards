-- Ajouter le champ notification_message à la table profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notification_message TEXT;

-- Fonction pour lancer le tirage au sort final avec sélection pondérée
-- Plus un utilisateur a de tickets, plus il a de chances de gagner
CREATE OR REPLACE FUNCTION public.launch_final_draw(p_cadeau_id UUID)
RETURNS TABLE (
  success BOOLEAN,
  gagnant_id UUID,
  gagnant_email TEXT,
  gagnant_nom TEXT,
  gagnant_prenom TEXT,
  tickets_count BIGINT,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_cadeau_statut cadeau_statut;
  v_tickets_total INTEGER;
  v_tickets_vendus INTEGER;
  v_gagnant_id UUID;
  v_gagnant_email TEXT;
  v_gagnant_nom TEXT;
  v_gagnant_prenom TEXT;
  v_tickets_count BIGINT;
  v_random_value NUMERIC;
  v_cumulative_prob NUMERIC := 0;
  v_total_tickets BIGINT;
BEGIN
  -- Vérifier que l'utilisateur est admin
  IF NOT public.is_admin() THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::BIGINT, 'not_admin'::TEXT;
    RETURN;
  END IF;

  -- Vérifier que le cadeau existe et récupérer ses informations
  SELECT statut, tickets_total, tickets_actuels
  INTO v_cadeau_statut, v_tickets_total, v_tickets_vendus
  FROM cadeaux
  WHERE id = p_cadeau_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::BIGINT, 'cadeau_not_found'::TEXT;
    RETURN;
  END IF;

  -- Utiliser tickets_total si disponible, sinon objectif_tickets
  IF v_tickets_total IS NULL THEN
    SELECT objectif_tickets INTO v_tickets_total FROM cadeaux WHERE id = p_cadeau_id;
  END IF;

  -- Vérifier qu'il y a assez de tickets vendus
  IF v_tickets_vendus < v_tickets_total THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::BIGINT, 'not_enough_tickets'::TEXT;
    RETURN;
  END IF;

  -- Vérifier qu'il n'y a pas déjà un gagnant pour ce cadeau
  IF EXISTS (SELECT 1 FROM gagnants WHERE cadeau_id = p_cadeau_id) THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::BIGINT, 'gagnant_already_exists'::TEXT;
    RETURN;
  END IF;

  -- Calculer le nombre total de tickets pour ce cadeau
  SELECT COUNT(*) INTO v_total_tickets
  FROM tickets
  WHERE cadeau_id = p_cadeau_id;

  IF v_total_tickets = 0 THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::BIGINT, 'no_tickets'::TEXT;
    RETURN;
  END IF;

  -- Algorithme de sélection pondérée : plus un utilisateur a de tickets, plus il a de chances
  -- On génère un nombre aléatoire entre 0 et le nombre total de tickets
  v_random_value := RANDOM() * v_total_tickets;

  -- Algorithme de sélection pondérée
  -- On utilise une approche basée sur le nombre de tickets par utilisateur
  -- Chaque ticket a une chance égale, donc plus un utilisateur a de tickets, plus il a de chances
  WITH user_tickets AS (
    SELECT 
      t.user_id,
      COUNT(*)::BIGINT as ticket_count
    FROM tickets t
    WHERE t.cadeau_id = p_cadeau_id
    GROUP BY t.user_id
  ),
  weighted_selection AS (
    SELECT 
      ut.user_id,
      ut.ticket_count,
      SUM(ut.ticket_count) OVER (ORDER BY ut.user_id) as cumulative,
      SUM(ut.ticket_count) OVER () as total
    FROM user_tickets ut
  )
  SELECT 
    ws.user_id,
    ws.ticket_count,
    u.email,
    p.first_name,
    p.last_name
  INTO 
    v_gagnant_id,
    v_tickets_count,
    v_gagnant_email,
    v_gagnant_prenom,
    v_gagnant_nom
  FROM weighted_selection ws
  JOIN auth.users u ON u.id = ws.user_id
  LEFT JOIN profiles p ON p.id = ws.user_id
  WHERE (ws.cumulative - ws.ticket_count)::NUMERIC <= v_random_value AND ws.cumulative::NUMERIC > v_random_value
  LIMIT 1;

  -- Si aucun gagnant trouvé avec l'algorithme pondéré, prendre le premier utilisateur avec le plus de tickets
  IF v_gagnant_id IS NULL THEN
    SELECT 
      t.user_id,
      COUNT(*)::BIGINT,
      u.email,
      p.first_name,
      p.last_name
    INTO 
      v_gagnant_id,
      v_tickets_count,
      v_gagnant_email,
      v_gagnant_prenom,
      v_gagnant_nom
    FROM tickets t
    JOIN auth.users u ON u.id = t.user_id
    LEFT JOIN profiles p ON p.id = t.user_id
    WHERE t.cadeau_id = p_cadeau_id
    GROUP BY t.user_id, u.email, p.first_name, p.last_name
    ORDER BY COUNT(*) DESC
    LIMIT 1;
  END IF;

  IF v_gagnant_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::BIGINT, 'no_winner_found'::TEXT;
    RETURN;
  END IF;

  -- Créer l'entrée dans la table gagnants
  INSERT INTO gagnants (user_id, cadeau_id, ticket_id, email)
  VALUES (
    v_gagnant_id,
    p_cadeau_id,
    (SELECT id FROM tickets WHERE cadeau_id = p_cadeau_id AND user_id = v_gagnant_id LIMIT 1),
    v_gagnant_email
  )
  ON CONFLICT DO NOTHING;

  -- Mettre à jour le statut du cadeau à 'complet'
  UPDATE cadeaux
  SET statut = 'complet'
  WHERE id = p_cadeau_id;

  -- Remettre tickets_actuels à 0 pour permettre un nouveau cycle (Tirage n°2)
  UPDATE cadeaux
  SET tickets_actuels = 0
  WHERE id = p_cadeau_id;

  -- Ajouter la notification dans le profil du gagnant
  UPDATE profiles
  SET notification_message = 'Félicitations ! Vous avez gagné ' || (SELECT nom FROM cadeaux WHERE id = p_cadeau_id) || ' !'
  WHERE id = v_gagnant_id;

  RETURN QUERY SELECT TRUE, v_gagnant_id, v_gagnant_email, v_gagnant_nom, v_gagnant_prenom, v_tickets_count, 'success'::TEXT;
END;
$$;
