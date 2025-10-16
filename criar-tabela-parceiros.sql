-- Criar tabela de Parceiros (Empresas Contratadas)
-- Execute este script no SQL Editor do Supabase

-- 1. Criar tabela de parceiros
CREATE TABLE IF NOT EXISTS parceiros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cnpj TEXT NOT NULL UNIQUE,
  telefone TEXT,
  email TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_parceiros_ativo ON parceiros(ativo);
CREATE INDEX IF NOT EXISTS idx_parceiros_nome ON parceiros(nome);
CREATE INDEX IF NOT EXISTS idx_parceiros_cnpj ON parceiros(cnpj);

-- 3. Adicionar trigger para atualizar updated_at
CREATE TRIGGER update_parceiros_updated_at
  BEFORE UPDATE ON parceiros
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 4. Habilitar RLS (Row Level Security)
ALTER TABLE parceiros ENABLE ROW LEVEL SECURITY;

-- 5. Criar políticas RLS para parceiros
-- Administradores Agir podem ver todos os parceiros
CREATE POLICY "Administradores Agir podem ver parceiros"
ON parceiros FOR SELECT
USING (is_admin_agir());

-- Administradores Agir podem inserir parceiros
CREATE POLICY "Administradores Agir podem inserir parceiros"
ON parceiros FOR INSERT
WITH CHECK (is_admin_agir());

-- Administradores Agir podem atualizar parceiros
CREATE POLICY "Administradores Agir podem atualizar parceiros"
ON parceiros FOR UPDATE
USING (is_admin_agir())
WITH CHECK (is_admin_agir());

-- Administradores Agir podem deletar parceiros
CREATE POLICY "Administradores Agir podem deletar parceiros"
ON parceiros FOR DELETE
USING (is_admin_agir());

-- 6. Adicionar coluna parceiro_id na tabela contratos (opcional - se quiser relacionamento)
-- ALTER TABLE contratos ADD COLUMN IF NOT EXISTS parceiro_id UUID REFERENCES parceiros(id);
-- CREATE INDEX IF NOT EXISTS idx_contratos_parceiro ON contratos(parceiro_id);

-- 7. Inserir alguns parceiros de exemplo (opcional)
INSERT INTO parceiros (nome, cnpj, telefone, email) VALUES
  ('Hospital Santa Maria', '12.345.678/0001-90', '(62) 3234-5678', 'contato@hospitalsantamaria.com.br'),
  ('Clínica Saúde Total', '98.765.432/0001-10', '(62) 3345-6789', 'comercial@saudetotal.com.br'),
  ('Laboratório Análises Clínicas', '11.222.333/0001-44', '(62) 3456-7890', 'lab@analisesclinicas.com.br')
ON CONFLICT (cnpj) DO NOTHING;

COMMENT ON TABLE parceiros IS 'Empresas parceiras/contratadas que podem ser vinculadas a contratos';
COMMENT ON COLUMN parceiros.cnpj IS 'CNPJ da empresa (único)';
