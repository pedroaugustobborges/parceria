-- Migration 034: Fix contratos RLS timeout for administrador-terceiro
--
-- Root causes:
-- 1. Stale policies from supabase-init.sql ("Administradores podem ver contratos",
--    "Administradores Agir podem gerenciar contratos") were never dropped,
--    causing 5+ OR-combined policies to be evaluated per row.
-- 2. The correlated subquery in "terceiro_admin_contratos" runs without a
--    composite index, causing a sequential scan on usuarios for every contratos row.
-- 3. Policies don't use get_my_tipo() short-circuit, so all EXISTS subqueries
--    run even when the role doesn't match.

-- ─── Step 1: Add missing indexes ────────────────────────────────────────────

-- Speeds up the correlated subquery: WHERE u.id = auth.uid() AND u.tipo = '...' AND u.contrato_id = contratos.id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usuarios_id_tipo_contrato
  ON usuarios(id, tipo, contrato_id);

-- Speeds up the usuario_contrato join used for multi-contract admins
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usuario_contrato_usuario_contrato
  ON usuario_contrato(usuario_id, contrato_id);

-- ─── Step 2: Drop ALL existing contratos SELECT/ALL policies ────────────────
-- (including stale ones from supabase-init.sql)

DROP POLICY IF EXISTS "Administradores podem ver contratos"           ON contratos;
DROP POLICY IF EXISTS "Administradores Agir podem gerenciar contratos" ON contratos;
DROP POLICY IF EXISTS "corporativo_all_contratos"                      ON contratos;
DROP POLICY IF EXISTS "planta_own_unit_contratos"                      ON contratos;
DROP POLICY IF EXISTS "terceiro_admin_contratos"                       ON contratos;
DROP POLICY IF EXISTS "terceiro_view_own_contrato"                     ON contratos;
DROP POLICY IF EXISTS "contratos_update"                               ON contratos;

-- ─── Step 3: Recreate lean, indexed-backed policies ─────────────────────────
-- get_my_tipo() is STABLE + SECURITY DEFINER → evaluated once per query,
-- result cached → short-circuits the EXISTS subqueries for non-matching roles.

-- Corporativo: sees all contracts
CREATE POLICY "contratos_select_corporativo" ON contratos
  FOR SELECT
  USING (get_my_tipo() = 'administrador-agir-corporativo');

-- Admin de planta: sees only their unit's contracts
CREATE POLICY "contratos_select_planta" ON contratos
  FOR SELECT
  USING (
    get_my_tipo() = 'administrador-agir-planta'
    AND unidade_hospitalar_id = get_my_unidade_hospitalar_id()
  );

-- Admin terceiro: sees contracts linked via usuario_contrato (multi-contract)
-- OR via the legacy usuarios.contrato_id field (backward compat).
-- The get_my_tipo() guard ensures the EXISTS is only evaluated for this role.
CREATE POLICY "contratos_select_admin_terceiro" ON contratos
  FOR SELECT
  USING (
    get_my_tipo() = 'administrador-terceiro'
    AND (
      EXISTS (
        SELECT 1 FROM usuario_contrato uc
        WHERE uc.usuario_id = auth.uid()
          AND uc.contrato_id = contratos.id
      )
      OR EXISTS (
        SELECT 1 FROM usuarios u
        WHERE u.id = auth.uid()
          AND u.contrato_id = contratos.id
      )
    )
  );

-- Terceiro (non-admin): sees only their own contract via legacy field
CREATE POLICY "contratos_select_terceiro" ON contratos
  FOR SELECT
  USING (
    get_my_tipo() = 'terceiro'
    AND EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
        AND u.contrato_id = contratos.id
    )
  );

-- ─── Step 4: Recreate write policies ────────────────────────────────────────

-- Only corporativo can INSERT/DELETE contracts
CREATE POLICY "contratos_insert" ON contratos
  FOR INSERT
  WITH CHECK (get_my_tipo() = 'administrador-agir-corporativo');

CREATE POLICY "contratos_delete" ON contratos
  FOR DELETE
  USING (get_my_tipo() = 'administrador-agir-corporativo');

-- Corporativo or admin-planta (own unit) can UPDATE
CREATE POLICY "contratos_update" ON contratos
  FOR UPDATE
  USING (
    get_my_tipo() = 'administrador-agir-corporativo'
    OR (
      get_my_tipo() = 'administrador-agir-planta'
      AND unidade_hospitalar_id = get_my_unidade_hospitalar_id()
    )
  )
  WITH CHECK (
    get_my_tipo() = 'administrador-agir-corporativo'
    OR (
      get_my_tipo() = 'administrador-agir-planta'
      AND unidade_hospitalar_id = get_my_unidade_hospitalar_id()
    )
  );
