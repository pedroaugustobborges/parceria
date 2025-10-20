-- Script para criar a tabela produtividade
-- Execute este script no Supabase SQL Editor

-- Criar a tabela produtividade
CREATE TABLE IF NOT EXISTS produtividade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_mv TEXT NOT NULL,
  nome TEXT NOT NULL,
  especialidade TEXT,
  vinculo TEXT,
  procedimento INTEGER DEFAULT 0,
  parecer_solicitado INTEGER DEFAULT 0,
  parecer_realizado INTEGER DEFAULT 0,
  cirurgia_realizada INTEGER DEFAULT 0,
  prescricao INTEGER DEFAULT 0,
  evolucao INTEGER DEFAULT 0,
  urgencia INTEGER DEFAULT 0,
  ambulatorio INTEGER DEFAULT 0,
  auxiliar INTEGER DEFAULT 0,
  encaminhamento INTEGER DEFAULT 0,
  folha_objetivo_diario INTEGER DEFAULT 0,
  evolucao_diurna_cti INTEGER DEFAULT 0,
  evolucao_noturna_cti INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Adicionar comentários explicativos
COMMENT ON TABLE produtividade IS 'Tabela para registrar a produtividade dos profissionais de saúde';
COMMENT ON COLUMN produtividade.codigo_mv IS 'Código do prestador no sistema MV';
COMMENT ON COLUMN produtividade.nome IS 'Nome do profissional';
COMMENT ON COLUMN produtividade.especialidade IS 'Especialidade médica do profissional';
COMMENT ON COLUMN produtividade.vinculo IS 'Tipo de vínculo do profissional';
COMMENT ON COLUMN produtividade.procedimento IS 'Quantidade de procedimentos realizados';
COMMENT ON COLUMN produtividade.parecer_solicitado IS 'Quantidade de pareceres solicitados';
COMMENT ON COLUMN produtividade.parecer_realizado IS 'Quantidade de pareceres realizados';
COMMENT ON COLUMN produtividade.cirurgia_realizada IS 'Quantidade de cirurgias realizadas';
COMMENT ON COLUMN produtividade.prescricao IS 'Quantidade de prescrições realizadas';
COMMENT ON COLUMN produtividade.evolucao IS 'Quantidade de evoluções registradas';
COMMENT ON COLUMN produtividade.urgencia IS 'Quantidade de atendimentos de urgência';
COMMENT ON COLUMN produtividade.ambulatorio IS 'Quantidade de atendimentos ambulatoriais';
COMMENT ON COLUMN produtividade.auxiliar IS 'Quantidade de participações como auxiliar';
COMMENT ON COLUMN produtividade.encaminhamento IS 'Quantidade de encaminhamentos realizados';
COMMENT ON COLUMN produtividade.folha_objetivo_diario IS 'Quantidade de folhas de objetivo diário preenchidas';
COMMENT ON COLUMN produtividade.evolucao_diurna_cti IS 'Quantidade de evoluções diurnas no Centro de Terapia Intensiva';
COMMENT ON COLUMN produtividade.evolucao_noturna_cti IS 'Quantidade de evoluções noturnas no Centro de Terapia Intensiva';

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_produtividade_codigo_mv ON produtividade(codigo_mv);
CREATE INDEX IF NOT EXISTS idx_produtividade_nome ON produtividade(nome);
CREATE INDEX IF NOT EXISTS idx_produtividade_especialidade ON produtividade(especialidade);
CREATE INDEX IF NOT EXISTS idx_produtividade_created_at ON produtividade(created_at);

-- Criar trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_produtividade_updated_at
    BEFORE UPDATE ON produtividade
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Habilitar Row Level Security (RLS)
ALTER TABLE produtividade ENABLE ROW LEVEL SECURITY;

-- Criar políticas de acesso
-- Política para leitura: todos os usuários autenticados podem ler
CREATE POLICY "Usuários autenticados podem visualizar produtividade"
    ON produtividade FOR SELECT
    TO authenticated
    USING (true);

-- Política para inserção: apenas administradores podem inserir
CREATE POLICY "Apenas administradores podem inserir produtividade"
    ON produtividade FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.tipo IN ('administrador-agir', 'administrador-terceiro')
        )
    );

-- Política para atualização: apenas administradores podem atualizar
CREATE POLICY "Apenas administradores podem atualizar produtividade"
    ON produtividade FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.tipo IN ('administrador-agir', 'administrador-terceiro')
        )
    );

-- Política para exclusão: apenas administradores podem excluir
CREATE POLICY "Apenas administradores podem excluir produtividade"
    ON produtividade FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.tipo IN ('administrador-agir', 'administrador-terceiro')
        )
    );

-- Verificar a estrutura da tabela criada
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'produtividade'
ORDER BY ordinal_position;
