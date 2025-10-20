-- Script para adicionar a coluna data na tabela produtividade
-- Execute este script no Supabase SQL Editor

-- Adicionar a coluna data (tipo DATE para armazenar apenas a data sem hora)
ALTER TABLE produtividade
ADD COLUMN data DATE;

-- Adicionar comentário explicativo
COMMENT ON COLUMN produtividade.data IS 'Data de referência para o registro de produtividade';

-- Criar índice para melhor performance em consultas por data
CREATE INDEX IF NOT EXISTS idx_produtividade_data ON produtividade(data);

-- Verificar a estrutura atualizada da tabela
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'produtividade'
ORDER BY ordinal_position;
