-- Migration 022: Tabelas para Documentos de Gestao
-- Contratos de Gestao entre governo e organizacao (dominio separado de documentos_contrato)

-- Tabela de documentos de gestao
CREATE TABLE documentos_gestao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_hospitalar_id UUID NOT NULL REFERENCES unidades_hospitalares(id) ON DELETE CASCADE,
  nome_arquivo TEXT NOT NULL,
  caminho_storage TEXT NOT NULL,
  tamanho_bytes BIGINT,
  mime_type TEXT DEFAULT 'application/pdf',
  enviado_por UUID REFERENCES usuarios(id),
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'processando', 'pronto', 'erro')),
  mensagem_erro TEXT,
  versao INTEGER DEFAULT 1,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger para updated_at
CREATE TRIGGER update_documentos_gestao_updated_at
  BEFORE UPDATE ON documentos_gestao
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Indices para documentos_gestao
CREATE INDEX idx_docs_gestao_unidade ON documentos_gestao(unidade_hospitalar_id);
CREATE INDEX idx_docs_gestao_status ON documentos_gestao(status);
CREATE INDEX idx_docs_gestao_ativo ON documentos_gestao(ativo);

-- Tabela de chunks de documentos gestao (separada de documento_chunks)
CREATE TABLE documento_gestao_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id UUID NOT NULL REFERENCES documentos_gestao(id) ON DELETE CASCADE,
  unidade_hospitalar_id UUID NOT NULL REFERENCES unidades_hospitalares(id),
  indice_chunk INTEGER NOT NULL,
  conteudo TEXT NOT NULL,
  titulo_secao TEXT,
  numero_pagina INTEGER,
  contagem_tokens INTEGER,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indice vetorial para busca por similaridade (IVFFlat com 100 listas)
CREATE INDEX idx_gestao_chunks_embedding ON documento_gestao_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Indices auxiliares para documento_gestao_chunks
CREATE INDEX idx_gestao_chunks_documento ON documento_gestao_chunks(documento_id);
CREATE INDEX idx_gestao_chunks_unidade ON documento_gestao_chunks(unidade_hospitalar_id);

-- Habilitar RLS em ambas tabelas
ALTER TABLE documentos_gestao ENABLE ROW LEVEL SECURITY;
ALTER TABLE documento_gestao_chunks ENABLE ROW LEVEL SECURITY;
