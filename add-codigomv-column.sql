-- Script para adicionar a coluna codigomv na tabela usuarios
-- Execute este script no Supabase SQL Editor

-- Adicionar a coluna codigomv (pode ser NULL para usuários existentes e não-terceiros)
ALTER TABLE usuarios
ADD COLUMN codigomv TEXT;

-- Adicionar comentário explicativo
COMMENT ON COLUMN usuarios.codigomv IS 'Código do Prestador no sistema MV - obrigatório para usuários do tipo terceiro';

-- Verificar a estrutura atualizada da tabela
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'usuarios'
ORDER BY ordinal_position;
