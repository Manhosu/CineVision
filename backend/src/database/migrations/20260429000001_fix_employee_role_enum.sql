-- ============================================================================
-- Fix employee role enum
-- ============================================================================
-- Earlier migration (20260424000001) tried to ALTER TYPE user_role ADD VALUE
-- 'employee', but the actual enum in this project is named user_role_enum.
-- The DO block silently no-op'd when the type lookup failed, so employee
-- INSERTs may have succeeded (Supabase coerces) or the deployment may already
-- have a manual patch — this migration handles both possible enum names so
-- the schema converges deterministically.
-- ============================================================================
DO $$
BEGIN
  -- Variant 1: user_role_enum (original schema in 001-CreateInitialTables.ts)
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role_enum') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'user_role_enum' AND e.enumlabel = 'employee'
    ) THEN
      ALTER TYPE user_role_enum ADD VALUE 'employee';
    END IF;
  END IF;

  -- Variant 2: user_role (newer/alternate naming)
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'user_role' AND e.enumlabel = 'employee'
    ) THEN
      ALTER TYPE user_role ADD VALUE 'employee';
    END IF;
  END IF;
END $$;
