-- ============================================================================
-- Migration: status_pagamento, horario_pagamento e Aprovado com Glosa
-- Data: 2026-05-11
-- Descrição:
--   1. Adiciona coluna status_pagamento (Sim/Não) na escalas_medicas
--   2. Adiciona colunas de horário de pagamento para Aprovado com Glosa
--   3. Atualiza constraint de status: remove 'Pago', adiciona 'Aprovado com Glosa'
--   4. Migra escalas com status='Pago' → status='Aprovado' + status_pagamento='Sim'
-- ============================================================================

-- 1. Adicionar coluna status_pagamento
ALTER TABLE escalas_medicas
ADD COLUMN IF NOT EXISTS status_pagamento TEXT NOT NULL DEFAULT 'Não'
CHECK (status_pagamento IN ('Sim', 'Não'));

COMMENT ON COLUMN escalas_medicas.status_pagamento IS
  'Indica se a escala foi paga. Somente administrador-corporativo e administrador-planta podem alterar.
   Quando "Sim", a escala fica bloqueada para edição.';

-- 2. Adicionar colunas de horário de pagamento (para Aprovado com Glosa)
ALTER TABLE escalas_medicas
ADD COLUMN IF NOT EXISTS horario_pagamento_inicio TIMESTAMPTZ NULL;

ALTER TABLE escalas_medicas
ADD COLUMN IF NOT EXISTS horario_pagamento_fim TIMESTAMPTZ NULL;

COMMENT ON COLUMN escalas_medicas.horario_pagamento_inicio IS
  'Horário de início ajustado para fins de pagamento. Usado quando status = ''Aprovado com Glosa''.
   Se nulo, usa horario_entrada + data_inicio.';

COMMENT ON COLUMN escalas_medicas.horario_pagamento_fim IS
  'Horário de fim ajustado para fins de pagamento. Usado quando status = ''Aprovado com Glosa''.
   Se nulo, usa horario_saida + data_inicio (ou data_inicio+1 para plantões noturnos).';

-- 3. Migrar escalas existentes com status='Pago'
--    → Mudar status para 'Aprovado' e marcar status_pagamento = 'Sim'
UPDATE escalas_medicas
SET
  status = 'Aprovado',
  status_pagamento = 'Sim'
WHERE status = 'Pago';

-- 4. Remover constraint antiga de status
ALTER TABLE escalas_medicas
DROP CONSTRAINT IF EXISTS escalas_medicas_status_check;

-- 5. Adicionar nova constraint com status atualizado
--    Remove: 'Pago'
--    Adiciona: 'Aprovado com Glosa'
ALTER TABLE escalas_medicas
ADD CONSTRAINT escalas_medicas_status_check
CHECK (status IN (
  'Pré-Agendado',
  'Programado',
  'Pré-Aprovado',
  'Aprovação Parcial',
  'Atenção',
  'Aprovado',
  'Aprovado com Glosa',
  'Reprovado',
  'Excluída'
));

COMMENT ON CONSTRAINT escalas_medicas_status_check ON escalas_medicas IS
  'Status possíveis:
   - Pré-Agendado: Criado por administrador-terceiro (aguarda revisão)
   - Programado: Criado por admin-agir ou aprovado para escalas futuras
   - Pré-Aprovado: Médico cumpriu as horas estabelecidas (verificação automática)
   - Aprovação Parcial: Médico trabalhou parcialmente
   - Atenção: Médico NÃO TEVE NENHUM ACESSO no dia escalado
   - Aprovado: Aprovado manualmente por administrador
   - Aprovado com Glosa: Aprovado com ajuste de horário para fins de pagamento (somente admin-agir)
   - Reprovado: Reprovado manualmente por administrador
   - Excluída: Soft-delete - escala removida mas mantida no histórico';

-- 6. Criar índices para as novas colunas
CREATE INDEX IF NOT EXISTS idx_escalas_medicas_status_pagamento
ON escalas_medicas(status_pagamento);

-- 7. Verificar resultado
SELECT status, status_pagamento, COUNT(*) as total
FROM escalas_medicas
GROUP BY status, status_pagamento
ORDER BY status, status_pagamento;
