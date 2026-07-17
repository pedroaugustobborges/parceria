-- Migration 028: Permitir múltiplas unidades de medida por item de contrato
--
-- Mudanças:
-- 1. Converte itens_contrato.unidade_medida de text para text[] (array)
-- 2. Adiciona coluna unidade_medida em contrato_itens para registrar
--    qual unidade foi escolhida ao vincular o item ao contrato

-- ─────────────────────────────────────────────────────────────
-- Passo 1: Remover constraint CHECK em itens_contrato.unidade_medida
-- ─────────────────────────────────────────────────────────────
ALTER TABLE itens_contrato
  DROP CONSTRAINT IF EXISTS itens_contrato_unidade_medida_check;

ALTER TABLE itens_contrato
  DROP CONSTRAINT IF EXISTS chk_unidade_medida;

-- ─────────────────────────────────────────────────────────────
-- Passo 2: Converter coluna unidade_medida de text para text[]
-- Os valores existentes são migrados automaticamente para arrays de 1 elemento
-- ─────────────────────────────────────────────────────────────
ALTER TABLE itens_contrato
  ALTER COLUMN unidade_medida TYPE text[]
  USING ARRAY[unidade_medida::text];

-- Garantir que o array não seja nulo nem vazio
ALTER TABLE itens_contrato
  ALTER COLUMN unidade_medida SET NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- Passo 3: Adicionar coluna unidade_medida em contrato_itens
-- Registra qual unidade de medida foi escolhida para este item neste contrato
-- ─────────────────────────────────────────────────────────────
ALTER TABLE contrato_itens
  ADD COLUMN IF NOT EXISTS unidade_medida text;

-- ─────────────────────────────────────────────────────────────
-- Passo 4: Popular registros existentes com a primeira unidade do item
-- ─────────────────────────────────────────────────────────────
UPDATE contrato_itens ci
SET unidade_medida = (
  SELECT ic.unidade_medida[1]
  FROM itens_contrato ic
  WHERE ic.id = ci.item_id
)
WHERE ci.unidade_medida IS NULL;
