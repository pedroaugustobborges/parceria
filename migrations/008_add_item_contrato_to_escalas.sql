-- Migration: Add item_contrato_id to escalas_medicas table
-- Description: Adds a foreign key reference to itens_contrato in escalas_medicas

-- Add the item_contrato_id column (NOT NULL)
ALTER TABLE escalas_medicas
ADD COLUMN IF NOT EXISTS item_contrato_id UUID NOT NULL;

-- Add foreign key constraint
ALTER TABLE escalas_medicas
ADD CONSTRAINT fk_escalas_item_contrato
FOREIGN KEY (item_contrato_id)
REFERENCES itens_contrato(id)
ON DELETE RESTRICT;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_escalas_item_contrato
ON escalas_medicas(item_contrato_id);

-- Comment on column
COMMENT ON COLUMN escalas_medicas.item_contrato_id IS 'Item de contrato relacionado a esta escala médica (obrigatório)';
