-- Migration 031: Allow administrador-agir-planta to update contracts and manage
-- contrato_itens for contracts in their own unit.
--
-- Root causes fixed:
-- 1. contratos_update policy blocked admin-planta from saving contract edits
-- 2. contrato_itens_write policy (FOR ALL) blocked INSERT of items by admin-planta
--    → caused 403 on POST /rest/v1/contrato_itens

-- ─────────────────────────────────────────────────────────────
-- TABLE: contratos — allow admin-planta to update their unit's contracts
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "contratos_update" ON public.contratos;

CREATE POLICY "contratos_update" ON public.contratos
FOR UPDATE USING (
  get_my_tipo() = 'administrador-agir-corporativo'
  OR (
    get_my_tipo() = 'administrador-agir-planta'
    AND unidade_hospitalar_id = get_my_unidade_hospitalar_id()
  )
);

-- ─────────────────────────────────────────────────────────────
-- TABLE: contrato_itens — allow admin-planta to manage items of their unit's contracts
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "contrato_itens_write" ON public.contrato_itens;

CREATE POLICY "contrato_itens_write" ON public.contrato_itens
FOR ALL
USING (
  get_my_tipo() = 'administrador-agir-corporativo'
  OR (
    get_my_tipo() = 'administrador-agir-planta'
    AND contrato_id IN (
      SELECT id FROM public.contratos
      WHERE unidade_hospitalar_id = get_my_unidade_hospitalar_id()
    )
  )
)
WITH CHECK (
  get_my_tipo() = 'administrador-agir-corporativo'
  OR (
    get_my_tipo() = 'administrador-agir-planta'
    AND contrato_id IN (
      SELECT id FROM public.contratos
      WHERE unidade_hospitalar_id = get_my_unidade_hospitalar_id()
    )
  )
);

-- ─────────────────────────────────────────────────────────────
-- Verify
-- ─────────────────────────────────────────────────────────────
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename IN ('contratos', 'contrato_itens')
ORDER BY tablename, policyname;
