-- Ajoute la colonne tickets.pool_id et la relie a rewards_pools(id)
-- puis backfill depuis les anciennes colonnes eventuelles.

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS pool_id UUID;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'lot_id'
  ) THEN
    UPDATE tickets
    SET pool_id = lot_id
    WHERE pool_id IS NULL AND lot_id IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'gift_id'
  ) THEN
    UPDATE tickets
    SET pool_id = gift_id
    WHERE pool_id IS NULL AND gift_id IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'prize_id'
  ) THEN
    UPDATE tickets
    SET pool_id = prize_id
    WHERE pool_id IS NULL AND prize_id IS NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tickets_pool_id_fkey'
  ) THEN
    ALTER TABLE tickets
      ADD CONSTRAINT tickets_pool_id_fkey
      FOREIGN KEY (pool_id)
      REFERENCES rewards_pools(id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS tickets_pool_id_idx ON tickets (pool_id, created_at DESC);
