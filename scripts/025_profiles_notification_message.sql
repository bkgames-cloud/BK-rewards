-- Corrige l'erreur 400 liee a notification_message manquante.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notification_message TEXT;
