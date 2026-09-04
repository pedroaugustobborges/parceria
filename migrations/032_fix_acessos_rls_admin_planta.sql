-- Migration 032: Restrict acessos SELECT for administrador-agir-planta to their own unit.
--
-- Root cause: the "acessos_select" policy from rls-security-fix.sql allowed
-- administrador-agir-planta to SELECT all rows in acessos, regardless of planta.
-- The original migration 001 had a correct "planta_own_unit_acessos" policy
-- (acessos.planta = uh.codigo) that was overridden.
-- This migration restores the correct scoping.

DROP POLICY IF EXISTS "acessos_select" ON public.acessos;

CREATE POLICY "acessos_select" ON public.acessos
FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    -- Corporativo sees all
    get_my_tipo() = 'administrador-agir-corporativo'
    OR (
      -- Planta sees only accesses for their unit (acessos.planta = unidades_hospitalares.codigo)
      get_my_tipo() = 'administrador-agir-planta'
      AND planta = (
        SELECT uh.codigo
        FROM public.unidades_hospitalares uh
        JOIN public.usuarios u ON u.unidade_hospitalar_id = uh.id
        WHERE u.id = auth.uid()
        LIMIT 1
      )
    )
  )
);

-- Verify
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'acessos'
ORDER BY policyname;
