-- Migration: Adicionar status 'Pré-Agendado' à constraint de escalas_medicas
-- Execute este script no SQL Editor do Supabase

-- 1. Remover a constraint antiga de status
ALTER TABLE escalas_medicas
DROP CONSTRAINT IF EXISTS escalas_medicas_status_check;

-- 2. Adicionar nova constraint com todos os 6 status (incluindo 'Pré-Agendado')
ALTER TABLE escalas_medicas
ADD CONSTRAINT escalas_medicas_status_check
CHECK (status IN ('Pré-Agendado', 'Programado', 'Pré-Aprovado', 'Atenção', 'Aprovado', 'Reprovado'));

-- 3. Comentários explicativos
COMMENT ON CONSTRAINT escalas_medicas_status_check ON escalas_medicas IS
  'Status possíveis:
   - Pré-Agendado: Criado por administrador-terceiro (aguarda revisão)
   - Programado: Criado por admin-agir ou aprovado para escalas futuras
   - Pré-Aprovado: Médico cumpriu as horas estabelecidas (verificação automática)
   - Atenção: Médico não cumpriu as horas ou não compareceu
   - Aprovado: Aprovado manualmente por administrador
   - Reprovado: Reprovado manualmente por administrador';
