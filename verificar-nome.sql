-- Verificar se o nome CHRISTIANE EUGENIA BARBOSA BORGES existe na tabela acessos
-- Execute este script no SQL Editor do Supabase

-- 1. Buscar o nome exato
SELECT COUNT(*) as total_registros
FROM acessos
WHERE nome = 'CHRISTIANE EUGENIA BARBOSA BORGES';

-- 2. Buscar com LIKE (case insensitive)
SELECT COUNT(*) as total_registros
FROM acessos
WHERE nome ILIKE '%CHRISTIANE EUGENIA%';

-- 3. Buscar qualquer nome com CHRISTIANE
SELECT DISTINCT nome, cpf, tipo, matricula
FROM acessos
WHERE nome ILIKE '%CHRISTIANE%'
ORDER BY nome;

-- 4. Verificar total de registros na tabela acessos
SELECT COUNT(*) as total_acessos FROM acessos;

-- 5. Verificar os últimos 10 nomes únicos importados
SELECT DISTINCT nome, cpf, MAX(data_acesso) as ultimo_acesso
FROM acessos
GROUP BY nome, cpf
ORDER BY ultimo_acesso DESC
LIMIT 10;
