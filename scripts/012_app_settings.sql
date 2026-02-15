-- App settings for grade thresholds and labels
CREATE TABLE IF NOT EXISTS public.app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  grade_debutant_label TEXT NOT NULL DEFAULT 'Débutant',
  grade_bronze_label TEXT NOT NULL DEFAULT 'Bronze',
  grade_argent_label TEXT NOT NULL DEFAULT 'Argent',
  grade_or_label TEXT NOT NULL DEFAULT 'Or',
  grade_debutant_max INTEGER NOT NULL DEFAULT 100,
  grade_bronze_max INTEGER NOT NULL DEFAULT 500,
  grade_argent_max INTEGER NOT NULL DEFAULT 1500,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure a single row exists
INSERT INTO public.app_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read app settings"
  ON public.app_settings
  FOR SELECT
  USING (TRUE);

CREATE POLICY "Admins can update app settings"
  ON public.app_settings
  FOR UPDATE
  USING (public.is_admin());
