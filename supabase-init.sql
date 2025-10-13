-- Script de Inicialização do Banco de Dados ParcerIA
-- Execute este script no SQL Editor do Supabase

-- IMPORTANTE: Criar tabela de contratos PRIMEIRO (antes de usuarios)
CREATE TABLE IF NOT EXISTS contratos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  empresa TEXT NOT NULL,
  data_inicio TIMESTAMPTZ NOT NULL,
  data_fim TIMESTAMPTZ,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar tabela de usuários (referencia contratos)
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  cpf TEXT NOT NULL UNIQUE,
  tipo TEXT NOT NULL CHECK (tipo IN ('administrador-agir', 'administrador-terceiro', 'terceiro')),
  contrato_id UUID REFERENCES contratos(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar tabela de acessos (dados das catracas)
CREATE TABLE IF NOT EXISTS acessos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  matricula TEXT NOT NULL,
  nome TEXT NOT NULL,
  cpf TEXT NOT NULL,
  data_acesso TIMESTAMPTZ NOT NULL,
  sentido TEXT NOT NULL CHECK (sentido IN ('E', 'S')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar tabela de relacionamento usuário-contrato
CREATE TABLE IF NOT EXISTS usuario_contrato (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  contrato_id UUID REFERENCES contratos(id) ON DELETE CASCADE,
  cpf TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(usuario_id, contrato_id)
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_acessos_cpf ON acessos(cpf);
CREATE INDEX IF NOT EXISTS idx_acessos_data ON acessos(data_acesso DESC);
CREATE INDEX IF NOT EXISTS idx_acessos_sentido ON acessos(sentido);
CREATE INDEX IF NOT EXISTS idx_usuarios_cpf ON usuarios(cpf);
CREATE INDEX IF NOT EXISTS idx_usuarios_tipo ON usuarios(tipo);
CREATE INDEX IF NOT EXISTS idx_contratos_ativo ON contratos(ativo);
CREATE INDEX IF NOT EXISTS idx_usuario_contrato_cpf ON usuario_contrato(cpf);

-- Criar função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar triggers para atualizar updated_at
CREATE TRIGGER update_usuarios_updated_at
BEFORE UPDATE ON usuarios
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contratos_updated_at
BEFORE UPDATE ON contratos
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Habilitar Row Level Security (RLS)
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE acessos ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuario_contrato ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança para usuários
CREATE POLICY "Usuários podem ver seu próprio perfil"
ON usuarios FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Administradores Agir podem ver todos os usuários"
ON usuarios FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid() AND tipo = 'administrador-agir'
  )
);

CREATE POLICY "Administradores Agir podem inserir usuários"
ON usuarios FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid() AND tipo = 'administrador-agir'
  )
);

CREATE POLICY "Administradores Agir podem atualizar usuários"
ON usuarios FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid() AND tipo = 'administrador-agir'
  )
);

CREATE POLICY "Administradores Agir podem deletar usuários"
ON usuarios FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid() AND tipo = 'administrador-agir'
  )
);

-- Políticas de segurança para contratos
CREATE POLICY "Administradores podem ver contratos"
ON contratos FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid() AND tipo IN ('administrador-agir', 'administrador-terceiro')
  )
);

CREATE POLICY "Administradores Agir podem gerenciar contratos"
ON contratos FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid() AND tipo = 'administrador-agir'
  )
);

-- Políticas de segurança para acessos
CREATE POLICY "Terceiros podem ver seus próprios acessos"
ON acessos FOR SELECT
USING (
  cpf IN (
    SELECT cpf FROM usuarios WHERE id = auth.uid()
  )
);

CREATE POLICY "Administradores Terceiros podem ver acessos de seus colaboradores"
ON acessos FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM usuarios u
    JOIN usuario_contrato uc ON u.id = uc.usuario_id
    WHERE u.id = auth.uid()
    AND u.tipo = 'administrador-terceiro'
    AND uc.cpf = acessos.cpf
  )
);

CREATE POLICY "Administradores Agir podem ver todos os acessos"
ON acessos FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid() AND tipo = 'administrador-agir'
  )
);

CREATE POLICY "Administradores Agir podem gerenciar acessos"
ON acessos FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid() AND tipo = 'administrador-agir'
  )
);

-- Políticas para usuario_contrato
CREATE POLICY "Administradores podem ver vínculos"
ON usuario_contrato FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid() AND tipo IN ('administrador-agir', 'administrador-terceiro')
  )
);

CREATE POLICY "Administradores Agir podem gerenciar vínculos"
ON usuario_contrato FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid() AND tipo = 'administrador-agir'
  )
);

-- Inserir dados de exemplo (opcional)
-- Descomente as linhas abaixo se desejar dados de exemplo

-- INSERT INTO contratos (nome, empresa, data_inicio, ativo) VALUES
-- ('Contrato Limpeza 2024', 'Empresa Limpeza Ltda', NOW(), TRUE),
-- ('Contrato Segurança 2024', 'Segurança Total S.A.', NOW(), TRUE);

-- NOTA: Para criar o primeiro usuário administrador, você precisará:
-- 1. Criar o usuário no Supabase Authentication
-- 2. Inserir manualmente o registro na tabela usuarios com tipo 'administrador-agir'
-- Exemplo:
-- INSERT INTO usuarios (id, email, nome, cpf, tipo)
-- VALUES ('UUID_DO_AUTH_USER', 'admin@agir.com', 'Administrador', '00000000000', 'administrador-agir');


INSERT INTO usuarios (id, email, nome, cpf, tipo)
VALUES (
  'edd1da6d-0fb6-4cfc-8022-00f8b617264e',
  'pedro.borges@agirsaude.org.br',
  'Pedro Borges',
  '03723880193',
  'administrador-agir'
);