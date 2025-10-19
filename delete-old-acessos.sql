-- Script para deletar os primeiros 61000 registros mais antigos da tabela acessos
-- Execute este script no Supabase SQL Editor

-- ATENÇÃO: Esta operação é IRREVERSÍVEL!
-- Certifique-se de fazer um backup antes de executar

-- Opção 1: Deletar com base na data de criação (created_at)
-- Esta é a opção mais segura e rápida
DELETE FROM acessos
WHERE id IN (
  SELECT id
  FROM acessos
  ORDER BY created_at ASC
  LIMIT 61000
);

-- Opção 2: Deletar com base na data do acesso (data_acesso)
-- Descomente as linhas abaixo se preferir usar data_acesso ao invés de created_at
/*
DELETE FROM acessos
WHERE id IN (
  SELECT id
  FROM acessos
  ORDER BY data_acesso ASC
  LIMIT 61000
);
*/

-- Verificar quantos registros restaram após a exclusão
SELECT COUNT(*) as total_registros_restantes FROM acessos;

-- Verificar o registro mais antigo que sobrou
SELECT
  id,
  tipo,
  nome,
  cpf,
  data_acesso,
  created_at
FROM acessos
ORDER BY created_at ASC
LIMIT 1;
