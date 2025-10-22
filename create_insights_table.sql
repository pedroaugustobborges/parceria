-- Tabela para armazenar insights da IA
CREATE TABLE IF NOT EXISTS insights_ia (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  diagnostico TEXT NOT NULL,
  data_analise TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para buscar por data
CREATE INDEX idx_insights_ia_data_analise ON insights_ia(data_analise DESC);

-- Comentários
COMMENT ON TABLE insights_ia IS 'Armazena análises diárias geradas pela IA sobre produtividade e acessos';
COMMENT ON COLUMN insights_ia.diagnostico IS 'Texto completo da análise gerada pela IA';
COMMENT ON COLUMN insights_ia.data_analise IS 'Data e hora em que a análise foi realizada';

-- RLS (Row Level Security) - Apenas administradores podem ler
ALTER TABLE insights_ia ENABLE ROW LEVEL SECURITY;

-- Policy para leitura (apenas admin-agir)
CREATE POLICY "Apenas admin-agir pode ler insights"
  ON insights_ia
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.cpf = auth.jwt() ->> 'cpf'
      AND usuarios.tipo = 'administrador-agir'
    )
  );

-- Policy para inserção (apenas admin-agir)
CREATE POLICY "Apenas admin-agir pode inserir insights"
  ON insights_ia
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.cpf = auth.jwt() ->> 'cpf'
      AND usuarios.tipo = 'administrador-agir'
    )
  );
