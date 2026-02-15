-- Fonction pour tirer au sort un gagnant pour un cadeau
CREATE OR REPLACE FUNCTION public.pick_winner(p_cadeau_id UUID)
RETURNS TABLE (
  gagnant_id UUID,
  ticket_id UUID,
  ticket_number BIGINT,
  email TEXT,
  statut cadeau_statut
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cadeau_statut cadeau_statut;
  v_ticket_id UUID;
  v_ticket_number BIGINT;
  v_user_id UUID;
  v_email TEXT;
  v_obj INTEGER;
  v_current INTEGER;
  v_tickets_total INTEGER;
BEGIN
  -- Vérifier que l'utilisateur est admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  -- Vérifier que le cadeau existe et récupérer les valeurs
  SELECT statut, objectif_tickets, tickets_total, tickets_actuels
  INTO v_cadeau_statut, v_obj, v_tickets_total, v_current
  FROM cadeaux
  WHERE id = p_cadeau_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'cadeau_not_found';
  END IF;

  -- Utiliser tickets_total si disponible, sinon objectif_tickets
  v_obj := COALESCE(v_tickets_total, v_obj);

  -- Vérifier qu'il y a assez de tickets pour au moins un tirage
  IF v_current < v_obj THEN
    RAISE EXCEPTION 'not_enough_tickets';
  END IF;

  -- Sélectionner un ticket au hasard pour ce cadeau
  SELECT t.id, t.ticket_number, t.user_id
  INTO v_ticket_id, v_ticket_number, v_user_id
  FROM tickets t
  WHERE t.cadeau_id = p_cadeau_id
  ORDER BY RANDOM()
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_tickets';
  END IF;

  -- Récupérer l'email de l'utilisateur depuis auth.users
  SELECT email INTO v_email
  FROM auth.users
  WHERE id = v_user_id;

  -- Créer l'entrée dans la table gagnants
  INSERT INTO gagnants (user_id, cadeau_id, ticket_id, email)
  VALUES (v_user_id, p_cadeau_id, v_ticket_id, v_email);

  -- Consommer les tickets : soustraire tickets_total (ou objectif_tickets) de tickets_actuels
  UPDATE cadeaux
  SET tickets_actuels = GREATEST(0, tickets_actuels - v_obj)
  WHERE id = p_cadeau_id;

  -- Vérifier si on peut encore faire un tirage après consommation
  SELECT tickets_actuels INTO v_current FROM cadeaux WHERE id = p_cadeau_id;
  
  -- Si plus assez de tickets pour un autre tirage, marquer comme 'complet'
  IF v_current < v_obj THEN
    UPDATE cadeaux
    SET statut = 'complet'
    WHERE id = p_cadeau_id
    RETURNING statut INTO v_cadeau_statut;
  ELSE
    -- Sinon, garder le statut 'en_cours' pour permettre d'autres tirages
    SELECT statut INTO v_cadeau_statut FROM cadeaux WHERE id = p_cadeau_id;
  END IF;

  RETURN QUERY SELECT v_user_id, v_ticket_id, v_ticket_number, v_email, v_cadeau_statut;
END;
$$;
