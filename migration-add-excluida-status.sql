-- Migration: Adicionar status 'Excluída' à constraint de escalas_medicas
-- Execute este script no SQL Editor do Supabase
--
-- Data: 2026-03-09
-- Descrição:
--   - Adiciona o status 'Excluída' para soft-delete de escalas
--   - Escalas excluídas não são deletadas do banco, apenas marcadas
--   - Apenas administradores-agir (corporativo e planta) podem visualizar escalas excluídas
--   - Escalas excluídas não causam conflitos ao criar novas escalas
--   - Escalas excluídas não podem ser editadas

-- 1. Remover a constraint antiga de status
ALTER TABLE escalas_medicas
DROP CONSTRAINT IF EXISTS escalas_medicas_status_check;

-- 2. Adicionar nova constraint com todos os 8 status (incluindo 'Excluída')
ALTER TABLE escalas_medicas
ADD CONSTRAINT escalas_medicas_status_check
CHECK (status IN ('Pré-Agendado', 'Programado', 'Pré-Aprovado', 'Aprovação Parcial', 'Atenção', 'Aprovado', 'Reprovado', 'Excluída'));

-- 3. Comentários explicativos
COMMENT ON CONSTRAINT escalas_medicas_status_check ON escalas_medicas IS
  'Status possíveis:
   - Pré-Agendado: Criado por administrador-terceiro (aguarda revisão)
   - Programado: Criado por admin-agir ou aprovado para escalas futuras
   - Pré-Aprovado: Médico cumpriu as horas estabelecidas (verificação automática)
   - Aprovação Parcial: Médico trabalhou parcialmente (menos horas que o escalado, mas compareceu)
   - Atenção: Médico NÃO TEVE NENHUM ACESSO no dia escalado (0 horas trabalhadas)
   - Aprovado: Aprovado manualmente por administrador
   - Reprovado: Reprovado manualmente por administrador
   - Excluída: Soft-delete - escala removida mas mantida no histórico (visível apenas para admin-agir)';

-- 4. Verificar status atual
SELECT status, COUNT(*) as total
FROM escalas_medicas
GROUP BY status
ORDER BY status;
