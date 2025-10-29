-- Migration: Fix RLS for contrato_itens table
-- Description: Disables Row Level Security on contrato_itens to allow proper access

-- The contrato_itens table is a junction table that should not have RLS enabled
-- Access control is managed by the parent tables (contratos and itens_contrato)

-- Disable RLS on contrato_itens
ALTER TABLE contrato_itens DISABLE ROW LEVEL SECURITY;

-- Drop any existing policies (if any)
DROP POLICY IF EXISTS contrato_itens_select_policy ON contrato_itens;
DROP POLICY IF EXISTS contrato_itens_insert_policy ON contrato_itens;
DROP POLICY IF EXISTS contrato_itens_update_policy ON contrato_itens;
DROP POLICY IF EXISTS contrato_itens_delete_policy ON contrato_itens;

-- Verify RLS is disabled
DO $$
BEGIN
  IF (SELECT relrowsecurity FROM pg_class WHERE relname = 'contrato_itens') THEN
    RAISE EXCEPTION 'RLS is still enabled on contrato_itens!';
  ELSE
    RAISE NOTICE 'RLS successfully disabled on contrato_itens';
  END IF;
END $$;
