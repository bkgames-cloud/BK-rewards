-- Seed initial season (15 days from now)
INSERT INTO seasons (name, start_date, end_date, is_active)
VALUES ('Saison 1', NOW(), NOW() + INTERVAL '15 days', TRUE)
ON CONFLICT DO NOTHING;

-- Ancien système "prizes/cadeaux" supprimé
