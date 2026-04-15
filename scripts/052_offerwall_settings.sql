-- Ajout offerwall dynamique (Monlix, Ayet, etc.) dans app_settings

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS offerwall_name TEXT NOT NULL DEFAULT 'Monlix',
  ADD COLUMN IF NOT EXISTS offerwall_url TEXT NOT NULL DEFAULT 'https://bkg-rewards.com/monlix';

UPDATE public.app_settings
SET
  offerwall_name = COALESCE(NULLIF(offerwall_name, ''), 'Monlix'),
  offerwall_url = COALESCE(NULLIF(offerwall_url, ''), 'https://bkg-rewards.com/monlix'),
  updated_at = NOW()
WHERE id = 1;

