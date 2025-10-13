-- Script para Ajustar Tabela de Acessos com Todas as Colunas do CSV
-- Execute este script se quiser manter TODAS as colunas do arquivo CSV

-- Adicionar colunas extras à tabela acessos
ALTER TABLE acessos ADD COLUMN IF NOT EXISTS pis TEXT;
ALTER TABLE acessos ADD COLUMN IF NOT EXISTS cracha TEXT;
ALTER TABLE acessos ADD COLUMN IF NOT EXISTS planta TEXT;
ALTER TABLE acessos ADD COLUMN IF NOT EXISTS codin TEXT;
ALTER TABLE acessos ADD COLUMN IF NOT EXISTS grupo_de_acess TEXT;
ALTER TABLE acessos ADD COLUMN IF NOT EXISTS desc_perm TEXT;
ALTER TABLE acessos ADD COLUMN IF NOT EXISTS tipo_acesso TEXT;
ALTER TABLE acessos ADD COLUMN IF NOT EXISTS descr_acesso TEXT;
ALTER TABLE acessos ADD COLUMN IF NOT EXISTS modelo TEXT;
ALTER TABLE acessos ADD COLUMN IF NOT EXISTS cod_planta TEXT;
ALTER TABLE acessos ADD COLUMN IF NOT EXISTS cod_codin TEXT;

-- Criar índices adicionais para performance
CREATE INDEX IF NOT EXISTS idx_acessos_planta ON acessos(planta);
CREATE INDEX IF NOT EXISTS idx_acessos_cracha ON acessos(cracha);

-- Verificar estrutura da tabela
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'acessos'
ORDER BY ordinal_position;
