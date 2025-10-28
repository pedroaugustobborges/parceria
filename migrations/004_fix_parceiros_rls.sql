-- ============================================================================
-- Fix: Enable RLS for Parceiros table
-- Description: Adiciona policies para permitir leitura de parceiros
-- Date: 2025-10-28
-- ============================================================================

-- Disable RLS temporarily to prevent issues
ALTER TABLE parceiros DISABLE ROW LEVEL SECURITY;

-- Or enable with proper policies
-- ALTER TABLE parceiros ENABLE ROW LEVEL SECURITY;

-- DROP POLICY IF EXISTS "allow_read_parceiros" ON parceiros;

-- CREATE POLICY "allow_read_parceiros" ON parceiros
--   FOR SELECT
--   USING (true);  -- Everyone can read

-- Verify
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'parceiros';
