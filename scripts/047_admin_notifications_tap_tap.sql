-- Notifications admin : enregistrement à chaque gagnant Tap-Tap validé (INSERT dans history_leaderboard).
-- Exécuter dans Supabase → SQL Editor.

CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type TEXT NOT NULL DEFAULT 'tap_tap_weekly_winner',
  title TEXT NOT NULL,
  body TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_notifications_created_at_idx
  ON public.admin_notifications (created_at DESC);

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

-- Pas de lecture/écriture pour anon (accès via service role / dashboard admin plus tard)
-- Aucune policy = seul le rôle service_role (Edge Functions, SQL) peut insérer via bypass ou SECURITY DEFINER

CREATE OR REPLACE FUNCTION public.notify_admin_tap_tap_history_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.admin_notifications (
    notification_type,
    title,
    body,
    metadata
  )
  VALUES (
    'tap_tap_weekly_winner',
    'Gagnant Tap-Tap Arena (VIP+)',
    format(
      'Semaine %s · Score %s · %s · Lot : %s',
      NEW.week_number,
      NEW.score,
      COALESCE(NULLIF(TRIM(NEW.display_name), ''), 'Joueur'),
      NEW.prize_label
    ),
    jsonb_build_object(
      'user_id', NEW.user_id,
      'week_number', NEW.week_number,
      'score', NEW.score,
      'prize_type', NEW.prize_type,
      'prize_label', NEW.prize_label,
      'history_leaderboard_id', NEW.id
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_history_leaderboard_admin_notify ON public.history_leaderboard;

CREATE TRIGGER trg_history_leaderboard_admin_notify
  AFTER INSERT ON public.history_leaderboard
  FOR EACH ROW
  EXECUTE PROCEDURE public.notify_admin_tap_tap_history_insert();
