-- Migration: Adicionar status 'Aprovação Parcial' à constraint de escalas_medicas
-- Execute este script no SQL Editor do Supabase
--
-- Data: 2025-12-15
-- Descrição:
--   - Adiciona o status 'Aprovação Parcial' para casos onde o médico não cumpriu
--     totalmente a carga horária, mas trabalhou parcialmente
--   - Atualiza a lógica de 'Atenção' para ser usado APENAS quando não houver
--     nenhum acesso do médico no dia escalado

-- 1. Remover a constraint antiga de status
ALTER TABLE escalas_medicas
DROP CONSTRAINT IF EXISTS escalas_medicas_status_check;

-- 2. Adicionar nova constraint com todos os 7 status (incluindo 'Aprovação Parcial')
ALTER TABLE escalas_medicas
ADD CONSTRAINT escalas_medicas_status_check
CHECK (status IN ('Pré-Agendado', 'Programado', 'Pré-Aprovado', 'Aprovação Parcial', 'Atenção', 'Aprovado', 'Reprovado'));

-- 3. Comentários explicativos
COMMENT ON CONSTRAINT escalas_medicas_status_check ON escalas_medicas IS
  'Status possíveis:
   - Pré-Agendado: Criado por administrador-terceiro (aguarda revisão)
   - Programado: Criado por admin-agir ou aprovado para escalas futuras
   - Pré-Aprovado: Médico cumpriu as horas estabelecidas (verificação automática)
   - Aprovação Parcial: Médico trabalhou parcialmente (menos horas que o escalado, mas compareceu)
   - Atenção: Médico NÃO TEVE NENHUM ACESSO no dia escalado (0 horas trabalhadas)
   - Aprovado: Aprovado manualmente por administrador
   - Reprovado: Reprovado manualmente por administrador';

-- 4. Verificar status atual
SELECT status, COUNT(*) as total
FROM escalas_medicas
GROUP BY status
ORDER BY status;
