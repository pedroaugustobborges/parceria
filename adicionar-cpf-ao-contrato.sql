-- Script para adicionar CPF de CHRISTIANE ao contrato apropriado
-- Execute este script no SQL Editor do Supabase (como administrador-agir)

-- PASSO 1: Descobrir o CPF de CHRISTIANE
-- Execute esta query primeiro e anote o CPF
SELECT DISTINCT cpf, nome
FROM acessos
WHERE nome ILIKE '%CHRISTIANE EUGENIA BARBOSA BORGES%';

-- RESULTADO ESPERADO: Um CPF será retornado, por exemplo: '12345678900'

-- PASSO 2: Verificar quais contratos existem
SELECT id, nome, empresa, ativo
FROM contratos
WHERE ativo = true
ORDER BY nome;

-- PASSO 3: Adicionar o CPF de CHRISTIANE ao contrato desejado
-- SUBSTITUA os valores abaixo:
-- - 'CPF_DE_CHRISTIANE' pelo CPF obtido no PASSO 1
-- - 'ID_DO_CONTRATO' pelo ID do contrato apropriado do PASSO 2

-- Exemplo (você precisa substituir os valores):
/*
INSERT INTO usuario_contrato (cpf, contrato_id)
VALUES ('CPF_DE_CHRISTIANE', 'ID_DO_CONTRATO')
ON CONFLICT DO NOTHING;
*/

-- PASSO 4: Verificar se a inserção funcionou
/*
SELECT uc.*, c.nome as nome_contrato
FROM usuario_contrato uc
JOIN contratos c ON uc.contrato_id = c.id
WHERE uc.cpf = 'CPF_DE_CHRISTIANE';
*/

-- ALTERNATIVA: Se você quiser adicionar TODOS os CPFs que aparecem em acessos
-- mas não estão vinculados a nenhum contrato, ao contrato padrão:

-- Primeiro, escolha um contrato padrão (anote o ID):
-- SELECT id, nome FROM contratos WHERE ativo = true LIMIT 5;

-- Depois, insira todos os CPFs não vinculados:
/*
INSERT INTO usuario_contrato (cpf, contrato_id)
SELECT DISTINCT a.cpf, 'ID_DO_CONTRATO_PADRAO'::uuid
FROM acessos a
WHERE a.cpf NOT IN (SELECT cpf FROM usuario_contrato)
AND a.cpf NOT IN (SELECT cpf FROM usuarios WHERE tipo = 'administrador-agir')
ON CONFLICT DO NOTHING;
*/
