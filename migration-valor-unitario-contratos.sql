-- Migration: Adicionar Valor Unitário aos Itens de Contrato
-- Execute este script no SQL Editor do Supabase

-- Adicionar coluna 'valor_unitario' caso não exista
-- NUMERIC(10,2) permite valores até 99.999.999,99
ALTER TABLE contrato_itens
ADD COLUMN IF NOT EXISTS valor_unitario NUMERIC(10,2);

-- Atualizar todos os itens existentes com valor unitário padrão de R$ 10,00
UPDATE contrato_itens
SET valor_unitario = 10.00
WHERE valor_unitario IS NULL;

-- Tornar a coluna obrigatória (NOT NULL) após preencher os valores existentes
ALTER TABLE contrato_itens
ALTER COLUMN valor_unitario SET NOT NULL;

-- Adicionar constraint para garantir que o valor seja positivo
ALTER TABLE contrato_itens
ADD CONSTRAINT contrato_itens_valor_unitario_positivo
CHECK (valor_unitario >= 0);

-- Criar índice para melhor performance em consultas que filtram por valor
CREATE INDEX IF NOT EXISTS idx_contrato_itens_valor_unitario
ON contrato_itens(valor_unitario);

-- Comentário explicativo
COMMENT ON COLUMN contrato_itens.valor_unitario IS 'Valor unitário do item em R$ (reais)';
