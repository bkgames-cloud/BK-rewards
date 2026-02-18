-- Cagnottes Communautaires (Rewards Pools)

-- Table des cagnottes globales
CREATE TABLE IF NOT EXISTS rewards_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  target_videos INTEGER NOT NULL,
  current_videos INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vues personnelles par lot (pour calculer les tickets)
CREATE TABLE IF NOT EXISTS rewards_pool_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES rewards_pools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tickets cumulés par utilisateur et par lot
CREATE TABLE IF NOT EXISTS rewards_pool_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES rewards_pools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  views_count INTEGER NOT NULL DEFAULT 0,
  tickets_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, pool_id)
);

CREATE INDEX IF NOT EXISTS rewards_pool_views_user_idx ON rewards_pool_views (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS rewards_pool_views_pool_idx ON rewards_pool_views (pool_id, created_at DESC);
CREATE INDEX IF NOT EXISTS rewards_pool_tickets_user_idx ON rewards_pool_tickets (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS rewards_pool_tickets_pool_idx ON rewards_pool_tickets (pool_id, updated_at DESC);

ALTER TABLE rewards_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards_pool_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards_pool_tickets ENABLE ROW LEVEL SECURITY;

-- Lecture publique des cagnottes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rewards_pools' AND policyname = 'Rewards pools are readable'
  ) THEN
    CREATE POLICY "Rewards pools are readable" ON rewards_pools
      FOR SELECT USING (true);
  END IF;
END $$;

-- Vues personnelles : lecture/insert pour l'utilisateur
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rewards_pool_views' AND policyname = 'Users can read own pool views'
  ) THEN
    CREATE POLICY "Users can read own pool views" ON rewards_pool_views
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rewards_pool_views' AND policyname = 'Users can insert own pool views'
  ) THEN
    CREATE POLICY "Users can insert own pool views" ON rewards_pool_views
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rewards_pool_tickets' AND policyname = 'Users can read own pool tickets'
  ) THEN
    CREATE POLICY "Users can read own pool tickets" ON rewards_pool_tickets
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- Seed des lots
INSERT INTO rewards_pools (name, target_videos, image_url)
VALUES
  ('iPhone 15', 100000, NULL),
  ('Samsung S24', 90000, NULL),
  ('PS5', 45000, NULL),
  ('Nintendo Switch', 25000, NULL),
  ('Carte Amazon 20€', 2000, NULL),
  ('Carte Google Play 10€', 1000, NULL),
  ('Carte PSN 5€', 500, NULL)
ON CONFLICT (name) DO UPDATE
SET target_videos = EXCLUDED.target_videos,
    image_url = EXCLUDED.image_url;
