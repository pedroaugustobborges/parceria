-- ============================================================================
-- Migration: Multi-Tenancy por Unidade Hospitalar
-- Description: Implementa sistema de multi-tenancy baseado em unidades
--              hospitalares com diferentes níveis de acesso administrativo
-- Date: 2025-10-28
-- ============================================================================

-- ============================================================================
-- PART 0: FIX EXISTING CONSTRAINTS
-- ============================================================================

-- Drop the old check constraint on usuarios.tipo (if exists)
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_tipo_check;

-- Create new check constraint with all allowed values
ALTER TABLE usuarios
ADD CONSTRAINT usuarios_tipo_check CHECK (
  tipo IN (
    'administrador-agir',
    'administrador-agir-corporativo',
    'administrador-agir-planta',
    'administrador-terceiro',
    'terceiro'
  )
);

-- ============================================================================
-- PART 1: CREATE NEW TABLES
-- ============================================================================

-- Create unidades_hospitalares table
CREATE TABLE IF NOT EXISTS unidades_hospitalares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(50) UNIQUE NOT NULL,
  nome VARCHAR(255) NOT NULL,
  endereco TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE unidades_hospitalares IS 'Unidades hospitalares (hospitais) do sistema';
COMMENT ON COLUMN unidades_hospitalares.codigo IS 'Código único da planta/unidade (ex: H1, H2)';
COMMENT ON COLUMN unidades_hospitalares.nome IS 'Nome completo da unidade hospitalar';

-- ============================================================================
-- PART 2: ALTER EXISTING TABLES
-- ============================================================================

-- Add unidade_hospitalar_id to contratos
ALTER TABLE contratos
ADD COLUMN IF NOT EXISTS unidade_hospitalar_id UUID REFERENCES unidades_hospitalares(id) ON DELETE SET NULL;

COMMENT ON COLUMN contratos.unidade_hospitalar_id IS 'Unidade hospitalar à qual este contrato pertence';

-- Add unidade_hospitalar_id to usuarios
ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS unidade_hospitalar_id UUID REFERENCES unidades_hospitalares(id) ON DELETE SET NULL;

COMMENT ON COLUMN usuarios.unidade_hospitalar_id IS 'Unidade hospitalar do administrador de planta (apenas para tipo administrador-agir-planta)';

-- Add unidade_hospitalar_id to produtividade
ALTER TABLE produtividade
ADD COLUMN IF NOT EXISTS unidade_hospitalar_id UUID REFERENCES unidades_hospitalares(id) ON DELETE SET NULL;

COMMENT ON COLUMN produtividade.unidade_hospitalar_id IS 'Unidade hospitalar onde a produtividade foi registrada';

-- ============================================================================
-- PART 3: CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_unidades_codigo ON unidades_hospitalares(codigo);
CREATE INDEX IF NOT EXISTS idx_unidades_ativo ON unidades_hospitalares(ativo);
CREATE INDEX IF NOT EXISTS idx_contratos_unidade ON contratos(unidade_hospitalar_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_unidade ON usuarios(unidade_hospitalar_id);
CREATE INDEX IF NOT EXISTS idx_produtividade_unidade ON produtividade(unidade_hospitalar_id);

-- ============================================================================
-- PART 4: CREATE TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for unidades_hospitalares
DROP TRIGGER IF EXISTS update_unidades_hospitalares_updated_at ON unidades_hospitalares;
CREATE TRIGGER update_unidades_hospitalares_updated_at
  BEFORE UPDATE ON unidades_hospitalares
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PART 5: DATA MIGRATION
-- ============================================================================

-- Create the three hospital units: HUGOL, HECAD, CRER
INSERT INTO unidades_hospitalares (codigo, nome, endereco, ativo)
VALUES
  ('HUGOL', 'Hospital de Urgências de Goiânia - HUGOL', NULL, true),
  ('HECAD', 'Hospital Estadual de Aparecida de Goiânia - HECAD', NULL, true),
  ('CRER', 'Centro de Reabilitação e Readaptação Dr. Henrique Santillo - CRER', NULL, true)
ON CONFLICT (codigo) DO NOTHING;

-- Get HUGOL unit ID for later use (stored in a variable)
DO $$
DECLARE
  hugol_id UUID;
BEGIN
  -- Get HUGOL ID
  SELECT id INTO hugol_id FROM unidades_hospitalares WHERE codigo = 'HUGOL';

  -- Link all existing contratos to HUGOL
  UPDATE contratos
  SET unidade_hospitalar_id = hugol_id
  WHERE unidade_hospitalar_id IS NULL;

  -- Link all existing produtividade to HUGOL
  UPDATE produtividade
  SET unidade_hospitalar_id = hugol_id
  WHERE unidade_hospitalar_id IS NULL;
END $$;

-- Migrate existing 'administrador-agir' to 'administrador-agir-corporativo'
UPDATE usuarios
SET tipo = 'administrador-agir-corporativo'
WHERE tipo = 'administrador-agir';

-- ============================================================================
-- PART 6: ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on unidades_hospitalares
ALTER TABLE unidades_hospitalares ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can view active units (for dropdowns)
DROP POLICY IF EXISTS "view_active_units" ON unidades_hospitalares;
CREATE POLICY "view_active_units" ON unidades_hospitalares
  FOR SELECT
  USING (ativo = true);

-- Policy: Only corporativo can manage units
DROP POLICY IF EXISTS "corporativo_manage_units" ON unidades_hospitalares;
CREATE POLICY "corporativo_manage_units" ON unidades_hospitalares
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo = 'administrador-agir-corporativo'
    )
  );

-- ============================================================================
-- RLS for CONTRATOS
-- ============================================================================

ALTER TABLE contratos ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "corporativo_all_contratos" ON contratos;
DROP POLICY IF EXISTS "planta_own_unit_contratos" ON contratos;
DROP POLICY IF EXISTS "terceiro_admin_contratos" ON contratos;
DROP POLICY IF EXISTS "terceiro_view_own_contrato" ON contratos;

-- Policy: Corporativo sees all contracts
CREATE POLICY "corporativo_all_contratos" ON contratos
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo = 'administrador-agir-corporativo'
    )
  );

-- Policy: Admin de planta sees only their unit's contracts
CREATE POLICY "planta_own_unit_contratos" ON contratos
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo = 'administrador-agir-planta'
      AND usuarios.unidade_hospitalar_id = contratos.unidade_hospitalar_id
    )
  );

-- Policy: Admin terceiro sees their own contracts
CREATE POLICY "terceiro_admin_contratos" ON contratos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo = 'administrador-terceiro'
      AND usuarios.contrato_id = contratos.id
    )
  );

-- Policy: Terceiro sees their own contract
CREATE POLICY "terceiro_view_own_contrato" ON contratos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo = 'terceiro'
      AND usuarios.contrato_id = contratos.id
    )
  );

-- ============================================================================
-- RLS for ACESSOS
-- ============================================================================

ALTER TABLE acessos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "corporativo_all_acessos" ON acessos;
DROP POLICY IF EXISTS "planta_own_unit_acessos" ON acessos;
DROP POLICY IF EXISTS "admin_terceiro_acessos" ON acessos;
DROP POLICY IF EXISTS "terceiro_own_acessos" ON acessos;

-- Policy: Corporativo sees all access records
CREATE POLICY "corporativo_all_acessos" ON acessos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo = 'administrador-agir-corporativo'
    )
  );

-- Policy: Admin de planta sees only their unit's access records
CREATE POLICY "planta_own_unit_acessos" ON acessos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      JOIN unidades_hospitalares uh ON uh.id = usuarios.unidade_hospitalar_id
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo = 'administrador-agir-planta'
      AND acessos.planta = uh.codigo
    )
  );

-- Policy: Admin terceiro sees access from their contract's users
CREATE POLICY "admin_terceiro_acessos" ON acessos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u1
      JOIN usuarios u2 ON u2.contrato_id = u1.contrato_id
      WHERE u1.id = auth.uid()
      AND u1.tipo = 'administrador-terceiro'
      AND acessos.cpf = u2.cpf
    )
  );

-- Policy: Terceiro sees their own access records
CREATE POLICY "terceiro_own_acessos" ON acessos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo = 'terceiro'
      AND acessos.cpf = usuarios.cpf
    )
  );

-- ============================================================================
-- RLS for PRODUTIVIDADE
-- ============================================================================

ALTER TABLE produtividade ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "corporativo_all_produtividade" ON produtividade;
DROP POLICY IF EXISTS "planta_own_unit_produtividade" ON produtividade;
DROP POLICY IF EXISTS "admin_terceiro_produtividade" ON produtividade;
DROP POLICY IF EXISTS "terceiro_own_produtividade" ON produtividade;

-- Policy: Corporativo sees all productivity records
CREATE POLICY "corporativo_all_produtividade" ON produtividade
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo = 'administrador-agir-corporativo'
    )
  );

-- Policy: Admin de planta sees only their unit's productivity
CREATE POLICY "planta_own_unit_produtividade" ON produtividade
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo = 'administrador-agir-planta'
      AND usuarios.unidade_hospitalar_id = produtividade.unidade_hospitalar_id
    )
  );

-- Policy: Admin terceiro sees productivity from their contract's users
CREATE POLICY "admin_terceiro_produtividade" ON produtividade
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u1
      JOIN usuarios u2 ON u2.contrato_id = u1.contrato_id
      WHERE u1.id = auth.uid()
      AND u1.tipo = 'administrador-terceiro'
      AND produtividade.codigo_mv = u2.codigomv
    )
  );

-- Policy: Terceiro sees their own productivity
CREATE POLICY "terceiro_own_produtividade" ON produtividade
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo = 'terceiro'
      AND produtividade.codigo_mv = usuarios.codigomv
    )
  );

-- ============================================================================
-- RLS for USUARIOS
-- ============================================================================

ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "corporativo_all_usuarios" ON usuarios;
DROP POLICY IF EXISTS "planta_own_unit_usuarios" ON usuarios;
DROP POLICY IF EXISTS "admin_terceiro_usuarios" ON usuarios;
DROP POLICY IF EXISTS "users_view_own_profile" ON usuarios;

-- Policy: Corporativo manages all users
CREATE POLICY "corporativo_all_usuarios" ON usuarios
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.tipo = 'administrador-agir-corporativo'
    )
  );

-- Policy: Admin de planta manages users in their unit (terceiros only)
CREATE POLICY "planta_own_unit_usuarios" ON usuarios
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u1
      JOIN contratos c ON c.id = usuarios.contrato_id
      WHERE u1.id = auth.uid()
      AND u1.tipo = 'administrador-agir-planta'
      AND (
        usuarios.tipo IN ('terceiro', 'administrador-terceiro')
        AND c.unidade_hospitalar_id = u1.unidade_hospitalar_id
      )
    )
  );

-- Policy: Admin terceiro manages users in their contract
CREATE POLICY "admin_terceiro_usuarios" ON usuarios
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u1
      WHERE u1.id = auth.uid()
      AND u1.tipo = 'administrador-terceiro'
      AND (
        usuarios.contrato_id = u1.contrato_id
        OR usuarios.id = auth.uid()
      )
    )
  );

-- Policy: All users can view their own profile
CREATE POLICY "users_view_own_profile" ON usuarios
  FOR SELECT
  USING (id = auth.uid());

-- ============================================================================
-- PART 7: VALIDATION CONSTRAINTS
-- ============================================================================

-- Constraint: administrador-agir-planta MUST have unidade_hospitalar_id
ALTER TABLE usuarios
DROP CONSTRAINT IF EXISTS check_planta_admin_has_unit;

ALTER TABLE usuarios
ADD CONSTRAINT check_planta_admin_has_unit
CHECK (
  tipo != 'administrador-agir-planta' OR unidade_hospitalar_id IS NOT NULL
);

-- ============================================================================
-- PART 8: GRANT PERMISSIONS
-- ============================================================================

-- Grant permissions for authenticated users
GRANT SELECT ON unidades_hospitalares TO authenticated;
GRANT ALL ON contratos TO authenticated;
GRANT SELECT ON acessos TO authenticated;
GRANT SELECT ON produtividade TO authenticated;
GRANT ALL ON usuarios TO authenticated;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check created units
-- SELECT * FROM unidades_hospitalares ORDER BY codigo;

-- Check migrated user types
-- SELECT tipo, COUNT(*) FROM usuarios GROUP BY tipo;

-- Verify RLS is enabled
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- ============================================================================
-- ROLLBACK SCRIPT (if needed)
-- ============================================================================

/*
-- To rollback this migration:

-- Drop policies
DROP POLICY IF EXISTS "view_active_units" ON unidades_hospitalares;
DROP POLICY IF EXISTS "corporativo_manage_units" ON unidades_hospitalares;
DROP POLICY IF EXISTS "corporativo_all_contratos" ON contratos;
DROP POLICY IF EXISTS "planta_own_unit_contratos" ON contratos;
DROP POLICY IF EXISTS "terceiro_admin_contratos" ON contratos;
DROP POLICY IF EXISTS "terceiro_view_own_contrato" ON contratos;
DROP POLICY IF EXISTS "corporativo_all_acessos" ON acessos;
DROP POLICY IF EXISTS "planta_own_unit_acessos" ON acessos;
DROP POLICY IF EXISTS "admin_terceiro_acessos" ON acessos;
DROP POLICY IF EXISTS "terceiro_own_acessos" ON acessos;
DROP POLICY IF EXISTS "corporativo_all_produtividade" ON produtividade;
DROP POLICY IF EXISTS "planta_own_unit_produtividade" ON produtividade;
DROP POLICY IF EXISTS "admin_terceiro_produtividade" ON produtividade;
DROP POLICY IF EXISTS "terceiro_own_produtividade" ON produtividade;
DROP POLICY IF EXISTS "corporativo_all_usuarios" ON usuarios;
DROP POLICY IF EXISTS "planta_own_unit_usuarios" ON usuarios;
DROP POLICY IF EXISTS "admin_terceiro_usuarios" ON usuarios;
DROP POLICY IF EXISTS "users_view_own_profile" ON usuarios;

-- Disable RLS
ALTER TABLE unidades_hospitalares DISABLE ROW LEVEL SECURITY;
ALTER TABLE contratos DISABLE ROW LEVEL SECURITY;
ALTER TABLE acessos DISABLE ROW LEVEL SECURITY;
ALTER TABLE produtividade DISABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;

-- Drop constraints
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS check_planta_admin_has_unit;

-- Revert user type migration
UPDATE usuarios SET tipo = 'administrador-agir' WHERE tipo = 'administrador-agir-corporativo';

-- Drop indexes
DROP INDEX IF EXISTS idx_unidades_codigo;
DROP INDEX IF EXISTS idx_unidades_ativo;
DROP INDEX IF EXISTS idx_contratos_unidade;
DROP INDEX IF EXISTS idx_usuarios_unidade;
DROP INDEX IF EXISTS idx_produtividade_unidade;

-- Drop columns
ALTER TABLE produtividade DROP COLUMN IF EXISTS unidade_hospitalar_id;
ALTER TABLE usuarios DROP COLUMN IF EXISTS unidade_hospitalar_id;
ALTER TABLE contratos DROP COLUMN IF EXISTS unidade_hospitalar_id;

-- Drop table
DROP TABLE IF EXISTS unidades_hospitalares CASCADE;
*/
