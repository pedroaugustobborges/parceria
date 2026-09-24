-- Migration: Ampliar precisão de valor_unitario em contrato_itens
-- Motivo: NUMERIC(10,2) truncava para 2 casas decimais; alguns contratos
--         usam valores com até 8 casas (e.g. R$ 0,00333333 por minuto).

ALTER TABLE contrato_itens
  ALTER COLUMN valor_unitario TYPE NUMERIC(18, 8);

COMMENT ON COLUMN contrato_itens.valor_unitario IS
  'Valor unitário do item em R$ com até 8 casas decimais';
