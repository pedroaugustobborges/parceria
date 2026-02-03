-- Migration 021: Corrigir nomes das unidades hospitalares
-- Os nomes na migration 001 estavam incorretos

-- Corrigir HUGOL
UPDATE unidades_hospitalares
SET nome = 'Hospital Estadual de Urgências Governador Otávio Lage de Siqueira'
WHERE codigo = 'HUGOL';

-- Corrigir HECAD
UPDATE unidades_hospitalares
SET nome = 'Hospital Estadual da Criança e do Adolescente'
WHERE codigo = 'HECAD';

-- CRER ja estava correto, mas vamos garantir
UPDATE unidades_hospitalares
SET nome = 'Centro de Reabilitação e Readaptação Dr. Henrique Santillo'
WHERE codigo = 'CRER';

-- Verificar resultado
SELECT codigo, nome FROM unidades_hospitalares ORDER BY codigo;
