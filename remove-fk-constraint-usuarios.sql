-- Script para remover a constraint de foreign key da tabela usuarios
-- Execute este script no Supabase SQL Editor

-- ATENÇÃO: Este script remove a constraint que vincula usuarios.id ao auth.users
-- Isso permite inserir usuários na tabela sem criar registros de autenticação

-- 1. Primeiro, vamos verificar o nome exato da constraint
SELECT
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
WHERE conrelid = 'usuarios'::regclass
AND contype = 'f';  -- 'f' significa foreign key

-- 2. Remover a constraint de foreign key
-- Substitua 'usuarios_id_fkey' pelo nome real da constraint se for diferente
ALTER TABLE usuarios
DROP CONSTRAINT IF EXISTS usuarios_id_fkey;

-- 3. Verificar se a constraint foi removida
SELECT
    conname AS constraint_name,
    contype AS constraint_type
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
WHERE conrelid = 'usuarios'::regclass
AND contype = 'f';

-- Agora você pode executar o script insert-users-from-csv.sql
