-- Ajouter le coût des tickets aux cagnottes
ALTER TABLE rewards_pools
ADD COLUMN IF NOT EXISTS ticket_cost INTEGER NOT NULL DEFAULT 10;

-- Prix ultra-accessibles
UPDATE rewards_pools
SET ticket_cost = CASE
  WHEN name ILIKE '%iphone%' OR name ILIKE '%ps5%' OR name ILIKE '%nintendo%' OR name ILIKE '%switch%' OR name ILIKE '%samsung%' THEN 40
  WHEN name ILIKE '%amazon%' OR name ILIKE '%google%' OR name ILIKE '%psn%' THEN 10
  ELSE ticket_cost
END;
