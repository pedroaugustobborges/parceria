-- Script para Criar Colunas Faltantes na Tabela de Acessos
-- Execute este script no SQL Editor do Supabase

-- Adicionar colunas extras à tabela acessos (se não existirem)
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

-- Criar índices adicionais para performance (se não existirem)
CREATE INDEX IF NOT EXISTS idx_acessos_planta ON acessos(planta);
CREATE INDEX IF NOT EXISTS idx_acessos_cracha ON acessos(cracha);
CREATE INDEX IF NOT EXISTS idx_acessos_data_acesso ON acessos(data_acesso);
CREATE INDEX IF NOT EXISTS idx_acessos_cpf ON acessos(cpf);
CREATE INDEX IF NOT EXISTS idx_acessos_matricula ON acessos(matricula);

-- Verificar estrutura da tabela atualizada
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'acessos'
ORDER BY ordinal_position;

-- Mensagem de sucesso
SELECT 'Colunas criadas com sucesso!' AS resultado;
