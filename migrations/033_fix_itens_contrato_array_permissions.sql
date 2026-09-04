-- Migration 033: Fix itens_contrato permissions and ensure text[] column type
--
-- Problems solved:
-- 1. INSERT with multiple unidade_medida values returns 403 RLS error
-- 2. UPDATE with multiple unidade_medida values silently saves nothing
--
-- Root causes:
-- a) Migration 028 (unidade_medida text→text[]) may not have been applied on production
-- b) RLS may be re-enabled with leftover policies that block write operations
-- c) Missing GRANT for authenticated role on itens_contrato

-- ─────────────────────────────────────────────────────────────
-- Passo 1: Converter unidade_medida de text para text[] (idempotente)
-- Se já for text[], o bloco não faz nada.
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  col_type text;
BEGIN
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'itens_contrato'
    AND column_name  = 'unidade_medida';

  IF col_type = 'text' THEN
    -- Remove constraints de CHECK que limitam os valores aceitos
    ALTER TABLE itens_contrato DROP CONSTRAINT IF EXISTS itens_contrato_unidade_medida_check;
    ALTER TABLE itens_contrato DROP CONSTRAINT IF EXISTS chk_unidade_medida;

    -- Converte text → text[] preservando o valor existente como array de 1 elemento
    ALTER TABLE itens_contrato
      ALTER COLUMN unidade_medida TYPE text[]
      USING ARRAY[unidade_medida::text];

    ALTER TABLE itens_contrato
      ALTER COLUMN unidade_medida SET NOT NULL;

    RAISE NOTICE 'Coluna unidade_medida convertida de text para text[]';
  ELSE
    RAISE NOTICE 'Coluna unidade_medida já é % — nenhuma conversão necessária', col_type;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- Passo 2: Remover TODOS os policies de itens_contrato e desabilitar RLS
-- itens_contrato é um catálogo global (não scoped por unidade),
-- então RLS não faz sentido aqui — acesso controlado pela role.
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'itens_contrato'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.itens_contrato', pol.policyname);
    RAISE NOTICE 'Policy removida: %', pol.policyname;
  END LOOP;
END $$;

ALTER TABLE public.itens_contrato DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- Passo 3: Garantir que a role authenticated tem permissão total
-- ─────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.itens_contrato TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- Verificação
-- ─────────────────────────────────────────────────────────────
SELECT
  c.column_name,
  c.data_type,
  c.udt_name,
  t.rowsecurity AS rls_enabled
FROM information_schema.columns c
JOIN pg_tables t ON t.tablename = c.table_name
WHERE c.table_schema = 'public'
  AND c.table_name   = 'itens_contrato'
  AND c.column_name  = 'unidade_medida';

SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'itens_contrato'
  AND grantee = 'authenticated';
