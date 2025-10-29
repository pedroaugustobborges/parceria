-- ============================================================================
-- Verify and Create itens_contrato table if needed
-- Description: Garante que a tabela itens_contrato existe e está configurada corretamente
-- Date: 2025-10-28
-- ============================================================================

-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS itens_contrato (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  unidade_medida VARCHAR(100) NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Disable RLS
ALTER TABLE itens_contrato DISABLE ROW LEVEL SECURITY;

-- Create updated_at trigger if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_itens_contrato_updated_at ON itens_contrato;

CREATE TRIGGER update_itens_contrato_updated_at
    BEFORE UPDATE ON itens_contrato
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Verify table structure
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'itens_contrato'
ORDER BY ordinal_position;
