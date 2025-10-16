-- Add numero_contrato column to contratos table
ALTER TABLE contratos
ADD COLUMN IF NOT EXISTS numero_contrato TEXT;

-- Add index for faster searches
CREATE INDEX IF NOT EXISTS idx_contratos_numero_contrato ON contratos(numero_contrato);

-- Update existing contracts with a placeholder if needed (optional)
-- UPDATE contratos SET numero_contrato = 'N/A' WHERE numero_contrato IS NULL;

COMMENT ON COLUMN contratos.numero_contrato IS 'Número do contrato (pode conter números, letras, pontos, etc)';
