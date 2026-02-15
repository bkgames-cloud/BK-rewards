-- Ajouter le statut 'envoyé' à l'enum cadeau_statut
-- PostgreSQL permet d'ajouter une valeur à un ENUM existant avec ALTER TYPE ... ADD VALUE

-- 1) Ajouter 'envoyé' à l'enum (si pas déjà présent)
DO $$
BEGIN
  -- Vérifier si 'envoyé' existe déjà dans l'enum
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'envoyé' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'cadeau_statut')
  ) THEN
    ALTER TYPE cadeau_statut ADD VALUE IF NOT EXISTS 'envoyé';
  END IF;
END $$;

-- 2) Ajouter les colonnes d'adresse de livraison à profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS adresse TEXT,
  ADD COLUMN IF NOT EXISTS code_postal TEXT,
  ADD COLUMN IF NOT EXISTS ville TEXT;
