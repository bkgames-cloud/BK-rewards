-- Colonne « lu » pour le badge et le marquage à la consultation
ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS read boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS notifications_user_id_read_idx
  ON public.notifications (user_id)
  WHERE read = false;
