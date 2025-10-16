-- Criar tabela de Itens de Contrato
-- Execute este script no SQL Editor do Supabase

-- 1. Criar tabela de itens
CREATE TABLE IF NOT EXISTS itens_contrato (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  unidade_medida TEXT NOT NULL CHECK (
    unidade_medida IN (
      'horas',
      'plantão',
      'procedimento',
      'cirurgia',
      'consulta',
      'diária',
      'atendimento ambulatorial',
      'atendimento domiciliar',
      'intervenção',
      'parecer médico',
      'visita',
      'carga horária semanal',
      'carga horária mensal'
    )
  ),
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Criar tabela de relacionamento contrato-itens (junction table)
CREATE TABLE IF NOT EXISTS contrato_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id UUID NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES itens_contrato(id) ON DELETE CASCADE,
  quantidade DECIMAL(10,2) NOT NULL DEFAULT 1,
  valor_unitario DECIMAL(10,2),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contrato_id, item_id)
);

-- 3. Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_itens_contrato_ativo ON itens_contrato(ativo);
CREATE INDEX IF NOT EXISTS idx_contrato_itens_contrato ON contrato_itens(contrato_id);
CREATE INDEX IF NOT EXISTS idx_contrato_itens_item ON contrato_itens(item_id);

-- 4. Criar trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_itens_contrato_updated_at
  BEFORE UPDATE ON itens_contrato
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 5. Habilitar RLS (Row Level Security)
ALTER TABLE itens_contrato ENABLE ROW LEVEL SECURITY;
ALTER TABLE contrato_itens ENABLE ROW LEVEL SECURITY;

-- 6. Criar políticas RLS para itens_contrato
-- Administradores Agir podem ver todos os itens
CREATE POLICY "Administradores Agir podem ver itens"
ON itens_contrato FOR SELECT
USING (is_admin_agir());

-- Administradores Agir podem inserir itens
CREATE POLICY "Administradores Agir podem inserir itens"
ON itens_contrato FOR INSERT
WITH CHECK (is_admin_agir());

-- Administradores Agir podem atualizar itens
CREATE POLICY "Administradores Agir podem atualizar itens"
ON itens_contrato FOR UPDATE
USING (is_admin_agir())
WITH CHECK (is_admin_agir());

-- Administradores Agir podem deletar itens
CREATE POLICY "Administradores Agir podem deletar itens"
ON itens_contrato FOR DELETE
USING (is_admin_agir());

-- 7. Criar políticas RLS para contrato_itens
-- Administradores podem ver itens de contratos
CREATE POLICY "Administradores podem ver itens de contratos"
ON contrato_itens FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid() AND tipo IN ('administrador-agir', 'administrador-terceiro')
  )
);

-- Administradores Agir podem inserir itens em contratos
CREATE POLICY "Administradores Agir podem inserir itens em contratos"
ON contrato_itens FOR INSERT
WITH CHECK (is_admin_agir());

-- Administradores Agir podem atualizar itens de contratos
CREATE POLICY "Administradores Agir podem atualizar itens de contratos"
ON contrato_itens FOR UPDATE
USING (is_admin_agir())
WITH CHECK (is_admin_agir());

-- Administradores Agir podem deletar itens de contratos
CREATE POLICY "Administradores Agir podem deletar itens de contratos"
ON contrato_itens FOR DELETE
USING (is_admin_agir());

-- 8. Inserir alguns itens de exemplo (opcional)
INSERT INTO itens_contrato (nome, descricao, unidade_medida) VALUES
  ('Plantão Médico 12h', 'Plantão médico de 12 horas', 'plantão'),
  ('Plantão Médico 24h', 'Plantão médico de 24 horas', 'plantão'),
  ('Consulta Médica', 'Consulta médica ambulatorial', 'consulta'),
  ('Procedimento Cirúrgico Pequeno Porte', 'Cirurgia de pequeno porte', 'cirurgia'),
  ('Atendimento Domiciliar', 'Visita domiciliar', 'atendimento domiciliar'),
  ('Carga Horária Mensal - Enfermagem', 'Carga horária mensal de enfermeiro', 'carga horária mensal')
ON CONFLICT DO NOTHING;

COMMENT ON TABLE itens_contrato IS 'Itens que podem ser incluídos em contratos';
COMMENT ON TABLE contrato_itens IS 'Relacionamento entre contratos e itens com quantidade';
