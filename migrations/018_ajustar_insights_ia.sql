-- Migration 018: Ajustar tabela insights_ia para multi-tenant

-- Adicionar colunas de contexto do usuario
ALTER TABLE insights_ia ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES usuarios(id);
ALTER TABLE insights_ia ADD COLUMN IF NOT EXISTS unidade_hospitalar_id UUID REFERENCES unidades_hospitalares(id);
ALTER TABLE insights_ia ADD COLUMN IF NOT EXISTS role_tipo TEXT;

-- Index para busca por usuario
CREATE INDEX IF NOT EXISTS idx_insights_usuario ON insights_ia(usuario_id);
CREATE INDEX IF NOT EXISTS idx_insights_unidade ON insights_ia(unidade_hospitalar_id);

-- Habilitar RLS
ALTER TABLE insights_ia ENABLE ROW LEVEL SECURITY;

-- Usuario ve apenas seus proprios insights
CREATE POLICY "usuario_ver_proprios_insights" ON insights_ia
  FOR SELECT
  TO authenticated
  USING (
    usuario_id = auth.uid()
    OR usuario_id IS NULL  -- insights antigos sem usuario_id
  );

-- Apenas Edge Functions (service_role) podem inserir
CREATE POLICY "service_inserir_insights" ON insights_ia
  FOR INSERT
  TO authenticated
  WITH CHECK (usuario_id = auth.uid());
