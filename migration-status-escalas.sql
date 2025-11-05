-- Migration: Adicionar Status e Justificativa às Escalas Médicas
-- Execute este script no SQL Editor do Supabase

-- Adicionar coluna 'status' com valor padrão 'Programado'
ALTER TABLE escalas_medicas
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Programado'
CHECK (status IN ('Programado', 'Aprovado', 'Reprovado'));

-- Adicionar coluna 'justificativa' (opcional, obrigatória quando status = 'Reprovado')
ALTER TABLE escalas_medicas
ADD COLUMN IF NOT EXISTS justificativa TEXT;

-- Criar índice para melhor performance nas queries por status
CREATE INDEX IF NOT EXISTS idx_escalas_medicas_status ON escalas_medicas(status);

-- Comentários explicativos
COMMENT ON COLUMN escalas_medicas.status IS 'Status da escala: Programado (padrão), Aprovado, Reprovado';
COMMENT ON COLUMN escalas_medicas.justificativa IS 'Justificativa obrigatória quando status = Reprovado';

-- Atualizar escalas existentes para status 'Programado' (caso já existam)
UPDATE escalas_medicas SET status = 'Programado' WHERE status IS NULL;
