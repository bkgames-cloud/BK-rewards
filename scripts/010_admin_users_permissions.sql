-- Permissions admin pour gérer les utilisateurs et voir les statistiques

-- 1) Politique RLS pour que les admins puissent lire tous les profils
CREATE POLICY "Admins can read all profiles" ON profiles FOR SELECT 
  USING (public.is_admin());

-- 2) Politique RLS pour que les admins puissent mettre à jour is_vip
CREATE POLICY "Admins can update vip status" ON profiles FOR UPDATE 
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 3) Politique RLS pour que les admins puissent lire toutes les vues de vidéos (pour statistiques)
CREATE POLICY "Admins can read all video views" ON video_views FOR SELECT 
  USING (public.is_admin());

-- 4) Fonction pour obtenir les statistiques de tickets
CREATE OR REPLACE FUNCTION public.get_ticket_statistics()
RETURNS TABLE (
  tickets_publicite BIGINT,
  tickets_vip_estime BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tickets_pub BIGINT;
  v_tickets_vip BIGINT;
BEGIN
  -- Vérifier que l'utilisateur est admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  -- Compter les tickets publicité (chaque vue de vidéo = 1 point = 1 ticket potentiel)
  SELECT COUNT(*) INTO v_tickets_pub
  FROM video_views;

  -- Estimer les tickets VIP : compter les réclamations (last_bonus_claim non null)
  -- et multiplier par 7.5 (moyenne entre 5 et 10 tickets par réclamation)
  -- On compte le nombre d'utilisateurs qui ont réclamé au moins une fois
  SELECT COALESCE(COUNT(*) * 7.5, 0)::BIGINT INTO v_tickets_vip
  FROM profiles
  WHERE last_bonus_claim IS NOT NULL;

  RETURN QUERY SELECT v_tickets_pub, v_tickets_vip;
END;
$$;

-- 5) Fonction pour obtenir la liste des utilisateurs avec leurs emails (pour les admins)
CREATE OR REPLACE FUNCTION public.get_all_users()
RETURNS TABLE (
  id UUID,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  points INTEGER,
  is_vip BOOLEAN,
  last_bonus_claim TIMESTAMP WITH TIME ZONE,
  referred_by UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Vérifier que l'utilisateur est admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    p.first_name,
    p.last_name,
    u.email,
    COALESCE(p.points, 0)::INTEGER as points,
    COALESCE(p.is_vip, FALSE) as is_vip,
    p.last_bonus_claim,
    p.referred_by
  FROM profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  ORDER BY p.created_at DESC;
END;
$$;
