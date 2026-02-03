-- Migration 012: Tabelas de documentos de contrato e chunks com embeddings

-- Documentos de contratos (PDFs)
CREATE TABLE documentos_contrato (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id UUID NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
  nome_arquivo TEXT NOT NULL,
  caminho_storage TEXT NOT NULL,
  tamanho_bytes BIGINT,
  mime_type TEXT DEFAULT 'application/pdf',
  enviado_por UUID REFERENCES usuarios(id),
  status TEXT DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'processando', 'pronto', 'erro')),
  mensagem_erro TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chunks de documentos com embeddings vetoriais
CREATE TABLE documento_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id UUID NOT NULL REFERENCES documentos_contrato(id) ON DELETE CASCADE,
  contrato_id UUID NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
  unidade_hospitalar_id UUID REFERENCES unidades_hospitalares(id),
  indice_chunk INTEGER NOT NULL,
  conteudo TEXT NOT NULL,
  titulo_secao TEXT,
  numero_pagina INTEGER,
  contagem_tokens INTEGER,
  embedding vector(1536),  -- text-embedding-3-small dimensao
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes para performance
CREATE INDEX idx_chunks_embedding ON documento_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_chunks_contrato ON documento_chunks(contrato_id);
CREATE INDEX idx_chunks_unidade ON documento_chunks(unidade_hospitalar_id);
CREATE INDEX idx_chunks_documento ON documento_chunks(documento_id);
CREATE INDEX idx_docs_contrato ON documentos_contrato(contrato_id);
CREATE INDEX idx_docs_status ON documentos_contrato(status);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION atualizar_updated_at_documentos()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_updated_at_documentos
  BEFORE UPDATE ON documentos_contrato
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_updated_at_documentos();
