-- Restaure / réactive le lot iPhone.
-- Ajuste target_videos si besoin.
INSERT INTO rewards_pools (name, target_videos, current_videos, image_url, ticket_cost)
VALUES (
  'iPhone',
  100000,
  0,
  'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=500',
  40
)
ON CONFLICT (name) DO UPDATE
SET
  target_videos = EXCLUDED.target_videos,
  current_videos = 0,
  image_url = EXCLUDED.image_url,
  ticket_cost = EXCLUDED.ticket_cost;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'rewards_pools'
      AND column_name = 'is_active'
  ) THEN
    UPDATE rewards_pools
    SET is_active = TRUE
    WHERE name = 'iPhone';
  END IF;
END $$;
