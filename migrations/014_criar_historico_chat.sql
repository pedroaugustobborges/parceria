-- Migration 014: Historico de conversas do chat

CREATE TABLE conversas_chat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE mensagens_chat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id UUID NOT NULL REFERENCES conversas_chat(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  conteudo TEXT NOT NULL,
  rota TEXT CHECK (rota IN ('sql', 'rag', 'hibrido')),
  citacoes JSONB,
  sql_executado TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_conversas_usuario ON conversas_chat(usuario_id);
CREATE INDEX idx_mensagens_conversa ON mensagens_chat(conversa_id);
CREATE INDEX idx_conversas_created ON conversas_chat(created_at DESC);

-- RLS: usuario ve apenas suas proprias conversas e mensagens
ALTER TABLE conversas_chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensagens_chat ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuario_ver_proprias_conversas" ON conversas_chat
  FOR ALL
  TO authenticated
  USING (usuario_id = auth.uid());

CREATE POLICY "usuario_ver_proprias_mensagens" ON mensagens_chat
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversas_chat
      WHERE conversas_chat.id = mensagens_chat.conversa_id
        AND conversas_chat.usuario_id = auth.uid()
    )
  );
