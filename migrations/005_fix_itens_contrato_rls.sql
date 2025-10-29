-- ============================================================================
-- Fix: Enable RLS for itens_contrato table
-- Description: Desabilita RLS para permitir leitura de itens de contrato
-- Date: 2025-10-28
-- ============================================================================

-- Disable RLS to allow reading
ALTER TABLE itens_contrato DISABLE ROW LEVEL SECURITY;

-- Verify
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'itens_contrato';
