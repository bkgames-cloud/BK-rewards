-- Wallet + cadeaux + tickets + gagnants + limites de visionnage

-- 1) Profil: points + rôle admin
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS points INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- 2) Statut cadeau
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cadeau_statut') THEN
    CREATE TYPE cadeau_statut AS ENUM ('en_cours', 'complet');
  END IF;
END $$;

-- 3) Table cadeaux
CREATE TABLE IF NOT EXISTS cadeaux (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  image_url TEXT,
  points_par_ticket INTEGER NOT NULL,
  objectif_tickets INTEGER NOT NULL,
  tickets_actuels INTEGER NOT NULL DEFAULT 0,
  statut cadeau_statut NOT NULL DEFAULT 'en_cours',
  date_fin TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4) Table tickets (adapter l'existant si besoin)
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS cadeau_id UUID;

ALTER TABLE tickets
  DROP COLUMN IF EXISTS prize_id,
  DROP COLUMN IF EXISTS season_id;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_user_id_prize_id_season_id_key') THEN
    ALTER TABLE tickets DROP CONSTRAINT tickets_user_id_prize_id_season_id_key;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_user_id_cadeau_id_key') THEN
    ALTER TABLE tickets DROP CONSTRAINT tickets_user_id_cadeau_id_key;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_cadeau_id_fkey') THEN
    ALTER TABLE tickets
      ADD CONSTRAINT tickets_cadeau_id_fkey
        FOREIGN KEY (cadeau_id) REFERENCES cadeaux(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 5) Table des vues de pubs (limiteurs)
CREATE TABLE IF NOT EXISTS video_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS video_views_user_created_idx ON video_views (user_id, created_at DESC);

-- 6) Table gagnants
CREATE TABLE IF NOT EXISTS gagnants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cadeau_id UUID NOT NULL REFERENCES cadeaux(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7) RLS
ALTER TABLE cadeaux ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE gagnants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read cadeaux" ON cadeaux FOR SELECT USING (TRUE);
-- Permettre aux utilisateurs authentifiés d'incrémenter tickets_actuels lors de la participation
CREATE POLICY "Authenticated users can update cadeaux tickets" ON cadeaux FOR UPDATE 
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can read own tickets" ON tickets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tickets" ON tickets FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own views" ON video_views FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own views" ON video_views FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own winnings" ON gagnants FOR SELECT USING (auth.uid() = user_id);

-- 8) Fonction admin + politiques admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE
  );
$$;

CREATE POLICY "Admins can read all winners" ON gagnants FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can insert winners" ON gagnants FOR INSERT WITH CHECK (public.is_admin());

-- 9) Récompense pub (+1 point) avec limites 5/h et 25/jour
-- Fonction respectant la RLS (sans SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.reward_ad_view()
RETURNS TABLE (
  new_points INTEGER,
  hour_count INTEGER,
  day_count INTEGER
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_hour_count INTEGER;
  v_day_count INTEGER;
  v_points INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Compter les vues de l'utilisateur authentifié (respecte la RLS)
  SELECT COUNT(*) INTO v_hour_count
  FROM video_views
  WHERE user_id = v_user_id
    AND created_at >= NOW() - INTERVAL '1 hour';

  SELECT COUNT(*) INTO v_day_count
  FROM video_views
  WHERE user_id = v_user_id
    AND created_at >= DATE_TRUNC('day', NOW());

  IF v_hour_count >= 5 THEN
    RAISE EXCEPTION 'hour_limit';
  END IF;

  IF v_day_count >= 25 THEN
    RAISE EXCEPTION 'day_limit';
  END IF;

  -- INSERT respecte la RLS : auth.uid() = user_id (vérifié par la politique)
  INSERT INTO video_views (user_id) VALUES (v_user_id);

  -- UPDATE respecte la RLS : WHERE id = v_user_id avec v_user_id = auth.uid()
  -- La politique "Users can update own profile" vérifie auth.uid() = id
  UPDATE profiles
  SET points = COALESCE(points, 0) + 1,
      updated_at = NOW()
  WHERE id = v_user_id
  RETURNING points INTO v_points;

  RETURN QUERY SELECT v_points, v_hour_count + 1, v_day_count + 1;
END;
$$;

-- 10) Participation (débit points, ticket, incrément collectif)
-- Fonction respectant la RLS (sans SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.participate_in_cadeau(p_cadeau_id UUID)
RETURNS TABLE (
  ticket_id UUID,
  ticket_number BIGINT,
  points_restants INTEGER,
  tickets_actuels INTEGER,
  statut cadeau_statut
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_points INTEGER;
  v_cost INTEGER;
  v_obj INTEGER;
  v_current INTEGER;
  v_statut cadeau_statut;
  v_date_fin TIMESTAMPTZ;
  v_ticket_id UUID;
  v_ticket_number BIGINT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- SELECT respecte la RLS : la politique "Anyone can read cadeaux" permet la lecture
  SELECT points_par_ticket, objectif_tickets, tickets_actuels, statut, date_fin
  INTO v_cost, v_obj, v_current, v_statut, v_date_fin
  FROM cadeaux
  WHERE id = p_cadeau_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'cadeau_not_found';
  END IF;

  IF v_statut = 'complet' THEN
    RAISE EXCEPTION 'cadeau_complet';
  END IF;

  IF v_date_fin IS NOT NULL AND v_date_fin <= NOW() THEN
    RAISE EXCEPTION 'cadeau_expire';
  END IF;

  -- SELECT respecte la RLS : WHERE id = v_user_id avec v_user_id = auth.uid()
  -- La politique "Users can read own profile" vérifie auth.uid() = id
  SELECT points INTO v_points FROM profiles WHERE id = v_user_id FOR UPDATE;
  v_points := COALESCE(v_points, 0);

  IF v_points < v_cost THEN
    RAISE EXCEPTION 'points_insuffisants';
  END IF;

  -- UPDATE respecte la RLS : WHERE id = v_user_id avec v_user_id = auth.uid()
  -- La politique "Users can update own profile" vérifie auth.uid() = id
  UPDATE profiles
  SET points = v_points - v_cost,
      updated_at = NOW()
  WHERE id = v_user_id;

  -- INSERT respecte la RLS : auth.uid() = user_id (vérifié par la politique)
  INSERT INTO tickets (user_id, cadeau_id)
  VALUES (v_user_id, p_cadeau_id)
  RETURNING id, ticket_number INTO v_ticket_id, v_ticket_number;

  -- UPDATE respecte la RLS : la politique "Authenticated users can update cadeaux tickets" 
  -- permet aux utilisateurs authentifiés d'incrémenter tickets_actuels
  UPDATE cadeaux
  SET tickets_actuels = tickets_actuels + 1,
      statut = CASE
        WHEN tickets_actuels + 1 >= objectif_tickets THEN 'complet'
        ELSE statut
      END
  WHERE id = p_cadeau_id
  RETURNING tickets_actuels, statut INTO v_current, v_statut;

  RETURN QUERY SELECT v_ticket_id, v_ticket_number, v_points - v_cost, v_current, v_statut;
END;
$$;
