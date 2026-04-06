-- Bonus FLYER attribue une seule fois par compte.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS flyer_bonus_granted BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_profiles_flyer_bonus_granted
  ON public.profiles(flyer_bonus_granted);

