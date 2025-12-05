-- ====================================================================
-- Script para criar 3 Administradores Corporativos
-- Execute este script no SQL Editor do Supabase
-- ====================================================================
-- IMPORTANTE: Após executar, você precisará enviar os convites
-- pela interface do sistema para criar as contas de autenticação
-- com a senha Agir@123
-- ====================================================================

BEGIN;

-- Usuário 1: MARYLUZA CRISTINA DOS SANTOS
INSERT INTO usuarios (
  id,
  email,
  nome,
  cpf,
  tipo,
  codigomv,
  especialidade,
  unidade_hospitalar_id,
  contrato_id,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'analistas.suadm@hugol.org.br',
  'MARYLUZA CRISTINA DOS SANTOS',
  '81247982149',
  'administrador-agir-corporativo',
  NULL,
  NULL,
  NULL,
  NULL,
  NOW(),
  NOW()
)
ON CONFLICT (cpf)
DO UPDATE SET
  email = EXCLUDED.email,
  nome = EXCLUDED.nome,
  tipo = EXCLUDED.tipo;

-- Usuário 2: HALANA ALVES LOPES DA TRINDADE
INSERT INTO usuarios (
  id,
  email,
  nome,
  cpf,
  tipo,
  codigomv,
  especialidade,
  unidade_hospitalar_id,
  contrato_id,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'halana.alves@hugol.org.br',
  'HALANA ALVES LOPES DA TRINDADE',
  '01966698127',
  'administrador-agir-corporativo',
  NULL,
  NULL,
  NULL,
  NULL,
  NOW(),
  NOW()
)
ON CONFLICT (cpf)
DO UPDATE SET
  email = EXCLUDED.email,
  nome = EXCLUDED.nome,
  tipo = EXCLUDED.tipo;

-- Usuário 3: LUANA DE SOUSA MORAIS
INSERT INTO usuarios (
  id,
  email,
  nome,
  cpf,
  tipo,
  codigomv,
  especialidade,
  unidade_hospitalar_id,
  contrato_id,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'lu.ana.de@hotmail.com',
  'LUANA DE SOUSA MORAIS',
  '02446867188',
  'administrador-agir-corporativo',
  NULL,
  NULL,
  NULL,
  NULL,
  NOW(),
  NOW()
)
ON CONFLICT (cpf)
DO UPDATE SET
  email = EXCLUDED.email,
  nome = EXCLUDED.nome,
  tipo = EXCLUDED.tipo;

COMMIT;

-- Verificar se os usuários foram criados
SELECT
  nome,
  email,
  cpf,
  tipo,
  created_at
FROM usuarios
WHERE cpf IN ('81247982149', '01966698127', '02446867188')
ORDER BY nome;

-- ====================================================================
-- PRÓXIMOS PASSOS APÓS EXECUTAR ESTE SCRIPT:
-- ====================================================================
-- 1. Abra a página "Usuários" no sistema
-- 2. Busque cada usuário pelo CPF
-- 3. Clique em "Enviar Convite" para cada um
-- 4. O sistema criará a conta com senha temporária
-- 5. OU use o script Node.js fornecido abaixo para criar com senha fixa
-- ====================================================================
