-- Migration: Create contrato_itens table
-- Description: Creates the junction table to link contracts with contract items

-- Create the contrato_itens table
CREATE TABLE IF NOT EXISTS contrato_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id UUID NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES itens_contrato(id) ON DELETE CASCADE,
  quantidade NUMERIC(10, 2) NOT NULL DEFAULT 1,
  valor_unitario NUMERIC(10, 2),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate items in the same contract
  UNIQUE(contrato_id, item_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_contrato_itens_contrato
ON contrato_itens(contrato_id);

CREATE INDEX IF NOT EXISTS idx_contrato_itens_item
ON contrato_itens(item_id);

-- Add comments
COMMENT ON TABLE contrato_itens IS 'Junction table linking contracts with their items';
COMMENT ON COLUMN contrato_itens.contrato_id IS 'Foreign key to contratos table';
COMMENT ON COLUMN contrato_itens.item_id IS 'Foreign key to itens_contrato table';
COMMENT ON COLUMN contrato_itens.quantidade IS 'Quantity of the item in the contract';
COMMENT ON COLUMN contrato_itens.valor_unitario IS 'Unit price of the item (optional)';
COMMENT ON COLUMN contrato_itens.observacoes IS 'Additional notes about this item in the contract';

-- Disable RLS (since this is a junction table and access is controlled by parent tables)
ALTER TABLE contrato_itens DISABLE ROW LEVEL SECURITY;
