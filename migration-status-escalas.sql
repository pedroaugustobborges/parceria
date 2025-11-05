-- Migration: Adicionar Status e Justificativa às Escalas Médicas
-- Execute este script no SQL Editor do Supabase

-- Adicionar coluna 'status' com valor padrão 'Programado'
ALTER TABLE escalas_medicas
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Programado'
CHECK (status IN ('Programado', 'Aprovado', 'Reprovado'));

-- Adicionar coluna 'justificativa' (opcional, obrigatória quando status = 'Reprovado')
ALTER TABLE escalas_medicas
ADD COLUMN IF NOT EXISTS justificativa TEXT;

-- Adicionar coluna para registrar quem alterou o status
ALTER TABLE escalas_medicas
ADD COLUMN IF NOT EXISTS status_alterado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL;

-- Adicionar coluna para registrar quando o status foi alterado
ALTER TABLE escalas_medicas
ADD COLUMN IF NOT EXISTS status_alterado_em TIMESTAMPTZ;

-- Criar índice para melhor performance nas queries por status
CREATE INDEX IF NOT EXISTS idx_escalas_medicas_status ON escalas_medicas(status);

-- Criar índice para consultas por usuário que alterou
CREATE INDEX IF NOT EXISTS idx_escalas_medicas_status_alterado_por ON escalas_medicas(status_alterado_por);

-- Comentários explicativos
COMMENT ON COLUMN escalas_medicas.status IS 'Status da escala: Programado (padrão), Aprovado, Reprovado';
COMMENT ON COLUMN escalas_medicas.justificativa IS 'Justificativa obrigatória quando status = Reprovado';
COMMENT ON COLUMN escalas_medicas.status_alterado_por IS 'ID do usuário que alterou o status';
COMMENT ON COLUMN escalas_medicas.status_alterado_em IS 'Data e hora da última alteração de status';

-- Atualizar escalas existentes para status 'Programado' (caso já existam)
UPDATE escalas_medicas SET status = 'Programado' WHERE status IS NULL;
