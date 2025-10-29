-- ============================================================================
-- Create: escalas_medicas table
-- Description: Tabela para registrar escalas médicas por contrato
-- Date: 2025-10-28
-- ============================================================================

-- Create table
CREATE TABLE IF NOT EXISTS escalas_medicas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id UUID NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
  data_inicio DATE NOT NULL,
  horario_entrada TIME NOT NULL,
  horario_saida TIME NOT NULL,
  medicos JSONB NOT NULL, -- Array de objetos {nome, cpf}
  observacoes TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES usuarios(id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_escalas_medicas_contrato ON escalas_medicas(contrato_id);
CREATE INDEX IF NOT EXISTS idx_escalas_medicas_data_inicio ON escalas_medicas(data_inicio);
CREATE INDEX IF NOT EXISTS idx_escalas_medicas_ativo ON escalas_medicas(ativo);

-- Create updated_at trigger
CREATE TRIGGER update_escalas_medicas_updated_at
    BEFORE UPDATE ON escalas_medicas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Disable RLS for now
ALTER TABLE escalas_medicas DISABLE ROW LEVEL SECURITY;

-- Verify table structure
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'escalas_medicas'
ORDER BY ordinal_position;
