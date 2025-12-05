-- ====================================================================
-- Verificar status do contrato UTI ADULTO
-- Execute este script no SQL Editor do Supabase
-- ====================================================================

-- Buscar contrato específico
SELECT
  id,
  nome,
  empresa,
  ativo,
  created_at,
  updated_at
FROM contratos
WHERE nome ILIKE '%UTI%ADULTO%'
   OR nome ILIKE '%TERAPIA INTENSIVA%ADULTO%'
ORDER BY nome;

-- Ver todos os contratos inativos
SELECT
  id,
  nome,
  empresa,
  ativo,
  created_at
FROM contratos
WHERE ativo = false
ORDER BY nome;

-- Contar contratos ativos vs inativos
SELECT
  ativo,
  COUNT(*) as quantidade
FROM contratos
GROUP BY ativo;

-- ====================================================================
-- Se quiser ATIVAR o contrato UTI ADULTO, use este comando:
-- ====================================================================
/*
UPDATE contratos
SET ativo = true
WHERE nome ILIKE '%SERVIÇOS MÉDICOS ESPECIALIZADOS EM UNIDADE DE TERAPIA INTENSIVA UTI ADULTO%';
*/

-- Verificar se foi ativado
-- SELECT nome, ativo FROM contratos WHERE nome ILIKE '%UTI%ADULTO%';
