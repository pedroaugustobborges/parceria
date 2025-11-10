-- Migration: Adicionar Novos Status às Escalas Médicas
-- Execute este script no SQL Editor do Supabase

-- 1. Remover a constraint antiga de status
ALTER TABLE escalas_medicas
DROP CONSTRAINT IF EXISTS escalas_medicas_status_check;

-- 2. Adicionar nova constraint com os 5 status
ALTER TABLE escalas_medicas
ADD CONSTRAINT escalas_medicas_status_check
CHECK (status IN ('Programado', 'Pré-Aprovado', 'Atenção', 'Aprovado', 'Reprovado'));

-- 3. Atualizar escalas futuras para "Programado"
UPDATE escalas_medicas
SET status = 'Programado'
WHERE data_inicio > CURRENT_DATE
  AND status NOT IN ('Aprovado', 'Reprovado');

-- 4. Atualizar escalas passadas que estavam como "Programado" para "Atenção" (temporário)
-- Essas serão reanalisadas pela aplicação com base nos acessos
UPDATE escalas_medicas
SET status = 'Atenção'
WHERE data_inicio <= CURRENT_DATE
  AND status = 'Programado';

-- 5. Comentários explicativos
COMMENT ON CONSTRAINT escalas_medicas_status_check ON escalas_medicas IS
  'Status possíveis:
   - Programado: Escalas futuras (data_inicio > hoje)
   - Pré-Aprovado: Médico cumpriu as horas estabelecidas
   - Atenção: Médico não cumpriu as horas ou não compareceu
   - Aprovado: Aprovado manualmente por administrador
   - Reprovado: Reprovado manualmente por administrador';

-- 6. Criar índice para melhorar performance em queries por data
CREATE INDEX IF NOT EXISTS idx_escalas_medicas_data_inicio
ON escalas_medicas(data_inicio);

-- 7. Criar índice composto para análise de status
CREATE INDEX IF NOT EXISTS idx_escalas_medicas_status_data
ON escalas_medicas(status, data_inicio);
