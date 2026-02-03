-- SQL de diagnostico para investigar o problema de contratos/valor no HUGOL
-- Execute este script no Supabase SQL Editor para identificar o problema
-- IMPORTANTE: Execute PRIMEIRO a migration 021_corrigir_nomes_unidades.sql para corrigir os nomes

-- 1. Verificar unidades hospitalares existentes
-- Nomes corretos:
-- HUGOL = Hospital Estadual de Urgências Governador Otávio Lage de Siqueira
-- HECAD = Hospital Estadual da Criança e do Adolescente
-- CRER = Centro de Reabilitação e Readaptação Dr. Henrique Santillo
SELECT 'UNIDADES HOSPITALARES' as tabela;
SELECT id, codigo, nome, ativo FROM unidades_hospitalares;

-- 2. Verificar contratos e se estao vinculados a unidades
SELECT 'CONTRATOS E VINCULO COM UNIDADES' as tabela;
SELECT
  c.id,
  c.nome,
  c.empresa,
  c.ativo,
  c.unidade_hospitalar_id,
  c.valor_total,
  u.codigo as unidade_codigo,
  u.nome as unidade_nome
FROM contratos c
LEFT JOIN unidades_hospitalares u ON u.id = c.unidade_hospitalar_id
LIMIT 20;

-- 3. Contar contratos por situacao de vinculo
SELECT 'CONTRATOS POR SITUACAO' as tabela;
SELECT
  CASE
    WHEN c.unidade_hospitalar_id IS NULL THEN 'SEM UNIDADE'
    ELSE u.codigo
  END as unidade,
  COUNT(*) as total_contratos,
  COUNT(*) FILTER (WHERE c.ativo = true) as contratos_ativos,
  SUM(c.valor_total) as soma_valor_total
FROM contratos c
LEFT JOIN unidades_hospitalares u ON u.id = c.unidade_hospitalar_id
GROUP BY
  CASE
    WHEN c.unidade_hospitalar_id IS NULL THEN 'SEM UNIDADE'
    ELSE u.codigo
  END;

-- 4. Verificar se contrato_itens tem dados
SELECT 'CONTRATO_ITENS (amostra)' as tabela;
SELECT
  ci.id,
  ci.contrato_id,
  c.nome as contrato_nome,
  ci.item_id,
  ic.nome as item_nome,
  ci.quantidade,
  ci.valor_unitario,
  (ci.quantidade * COALESCE(ci.valor_unitario, 0)) as valor_calculado
FROM contrato_itens ci
JOIN contratos c ON c.id = ci.contrato_id
LEFT JOIN itens_contrato ic ON ic.id = ci.item_id
LIMIT 20;

-- 5. Recalcular valor_total para todos os contratos (caso migration 020 nao tenha funcionado)
SELECT 'VALORES RECALCULADOS' as tabela;
SELECT
  c.id,
  c.nome,
  c.valor_total as valor_atual,
  COALESCE(SUM(ci.quantidade * COALESCE(ci.valor_unitario, 0)), 0) as valor_calculado
FROM contratos c
LEFT JOIN contrato_itens ci ON ci.contrato_id = c.id
GROUP BY c.id, c.nome, c.valor_total
ORDER BY c.nome
LIMIT 20;

-- 6. Query exata que o chatbot deveria gerar
SELECT 'QUERY DO CHATBOT' as tabela;
SELECT c.nome AS contrato, c.empresa, c.valor_total
FROM contratos c
JOIN unidades_hospitalares u ON u.id = c.unidade_hospitalar_id
WHERE c.ativo = true AND u.nome ILIKE '%HUGOL%';

-- 7. Verificar se o ILIKE funciona
SELECT 'TESTE ILIKE HUGOL' as tabela;
SELECT id, nome FROM unidades_hospitalares WHERE nome ILIKE '%HUGOL%';
