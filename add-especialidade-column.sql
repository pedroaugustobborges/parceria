-- Script para adicionar a coluna especialidade na tabela usuarios
-- Execute este script no Supabase SQL Editor

-- Adicionar a coluna especialidade como array de texto (pode ser NULL para usuários existentes e não-terceiros)
ALTER TABLE usuarios
ADD COLUMN especialidade TEXT[];

-- Adicionar comentário explicativo
COMMENT ON COLUMN usuarios.especialidade IS 'Especialidades médicas do usuário - obrigatório para usuários do tipo terceiro (pode ter múltiplas especialidades)';

-- Verificar a estrutura atualizada da tabela
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'usuarios'
ORDER BY ordinal_position;
