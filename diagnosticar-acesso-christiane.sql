-- Script de diagnóstico para descobrir por que CHRISTIANE não aparece na aplicação
-- Execute este script no SQL Editor do Supabase (deve estar logado como administrador)

-- 1. Verificar se CHRISTIANE existe na tabela acessos
SELECT COUNT(*) as total_registros,
       cpf,
       nome,
       tipo
FROM acessos
WHERE nome ILIKE '%CHRISTIANE EUGENIA BARBOSA BORGES%'
GROUP BY cpf, nome, tipo;

-- 2. Verificar se o CPF de CHRISTIANE está na tabela usuarios
SELECT u.id, u.email, u.nome, u.cpf, u.tipo, u.contrato_id
FROM usuarios u
WHERE u.cpf IN (
    SELECT DISTINCT cpf
    FROM acessos
    WHERE nome ILIKE '%CHRISTIANE EUGENIA BARBOSA BORGES%'
);

-- 3. Verificar se o CPF de CHRISTIANE está vinculado a algum contrato
SELECT uc.*, c.nome as nome_contrato, c.empresa
FROM usuario_contrato uc
JOIN contratos c ON uc.contrato_id = c.id
WHERE uc.cpf IN (
    SELECT DISTINCT cpf
    FROM acessos
    WHERE nome ILIKE '%CHRISTIANE EUGENIA BARBOSA BORGES%'
);

-- 4. Verificar qual é o seu usuário atual e tipo
SELECT id, email, nome, cpf, tipo, contrato_id
FROM usuarios
WHERE id = auth.uid();

-- 5. Se você for administrador-terceiro, verificar quais CPFs você pode acessar
SELECT DISTINCT uc.cpf
FROM usuario_contrato uc
JOIN usuarios u ON u.contrato_id = uc.contrato_id
WHERE u.id = auth.uid()
AND u.tipo = 'administrador-terceiro';

-- 6. Testar a query que o Dashboard usa para carregar acessos
-- (simula o comportamento do Dashboard.tsx linha 57-75)

-- Para Terceiro:
-- SELECT * FROM acessos WHERE cpf = (SELECT cpf FROM usuarios WHERE id = auth.uid());

-- Para Administrador-Terceiro:
-- SELECT * FROM acessos
-- WHERE cpf IN (
--   SELECT cpf FROM usuario_contrato WHERE contrato_id = (SELECT contrato_id FROM usuarios WHERE id = auth.uid())
-- );

-- Para Administrador-Agir:
-- SELECT * FROM acessos;  -- Sem filtro

-- 7. Contar quantos registros você consegue ver através do RLS
SELECT COUNT(*) as total_acessos_visiveis
FROM acessos;

-- 8. Verificar se há algum registro de CHRISTIANE que você pode ver
SELECT COUNT(*) as registros_christiane_visiveis
FROM acessos
WHERE nome ILIKE '%CHRISTIANE EUGENIA BARBOSA BORGES%';
