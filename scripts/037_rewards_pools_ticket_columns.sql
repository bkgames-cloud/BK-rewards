-- Colonnes optionnelles pour paliers / compteur « tickets » (alignement avec le client).
-- À exécuter sur Supabase si la requête .select() échoue avec « column does not exist ».

ALTER TABLE public.rewards_pools ADD COLUMN IF NOT EXISTS target_tickets INTEGER;
ALTER TABLE public.rewards_pools ADD COLUMN IF NOT EXISTS current_tickets INTEGER;

UPDATE public.rewards_pools
SET target_tickets = target_videos
WHERE target_tickets IS NULL;

UPDATE public.rewards_pools
SET current_tickets = current_videos
WHERE current_tickets IS NULL;

COMMENT ON COLUMN public.rewards_pools.target_tickets IS
  'Palier global (tickets) ; le client préfère cette valeur à target_videos si les deux existent.';
COMMENT ON COLUMN public.rewards_pools.current_tickets IS
  'Compteur courant (tickets) ; les RPC du dépôt incrémentent surtout current_videos — garder les deux alignés.';
