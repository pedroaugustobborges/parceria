-- Migration 020: Adicionar coluna valor_total na tabela contratos
-- Esta coluna armazena a soma de (quantidade * valor_unitario) de todos os itens do contrato

-- 1. Adicionar coluna valor_total
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS valor_total DECIMAL(15,2) DEFAULT 0;

-- 2. Criar funcao para recalcular valor_total de um contrato
CREATE OR REPLACE FUNCTION recalcular_valor_total_contrato(p_contrato_id UUID)
RETURNS DECIMAL(15,2)
LANGUAGE plpgsql
AS $$
DECLARE
  v_total DECIMAL(15,2);
BEGIN
  SELECT COALESCE(SUM(quantidade * COALESCE(valor_unitario, 0)), 0)
  INTO v_total
  FROM contrato_itens
  WHERE contrato_id = p_contrato_id;

  UPDATE contratos
  SET valor_total = v_total
  WHERE id = p_contrato_id;

  RETURN v_total;
END;
$$;

-- 3. Criar trigger para atualizar valor_total quando contrato_itens mudar
CREATE OR REPLACE FUNCTION trigger_atualizar_valor_total_contrato()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recalcular_valor_total_contrato(OLD.contrato_id);
    RETURN OLD;
  ELSE
    PERFORM recalcular_valor_total_contrato(NEW.contrato_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trigger_contrato_itens_valor_total ON contrato_itens;

CREATE TRIGGER trigger_contrato_itens_valor_total
AFTER INSERT OR UPDATE OR DELETE ON contrato_itens
FOR EACH ROW
EXECUTE FUNCTION trigger_atualizar_valor_total_contrato();

-- 4. Atualizar valor_total de todos os contratos existentes
UPDATE contratos c
SET valor_total = (
  SELECT COALESCE(SUM(ci.quantidade * COALESCE(ci.valor_unitario, 0)), 0)
  FROM contrato_itens ci
  WHERE ci.contrato_id = c.id
);

-- 5. Criar indice para consultas por valor
CREATE INDEX IF NOT EXISTS idx_contratos_valor_total ON contratos(valor_total);

-- 6. Adicionar comentario
COMMENT ON COLUMN contratos.valor_total IS 'Valor total do contrato calculado automaticamente a partir de contrato_itens (SUM de quantidade * valor_unitario)';
