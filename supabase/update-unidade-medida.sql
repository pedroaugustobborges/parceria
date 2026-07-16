-- Atualiza o CHECK constraint da coluna unidade_medida em itens_contrato
-- Adiciona 'auxílio' e reordena para fins de documentação

-- Remove o constraint antigo (nome pode variar — descubra com o comando abaixo se falhar)
-- SELECT conname FROM pg_constraint WHERE conrelid = 'public.itens_contrato'::regclass AND contype = 'c';
ALTER TABLE public.itens_contrato
  DROP CONSTRAINT IF EXISTS itens_contrato_unidade_medida_check;

ALTER TABLE public.itens_contrato
  ADD CONSTRAINT itens_contrato_unidade_medida_check
  CHECK (unidade_medida IN (
    'atendimento ambulatorial',
    'atendimento domiciliar',
    'auxílio',
    'carga horária mensal',
    'carga horária semanal',
    'cirurgia',
    'consulta',
    'diária',
    'do mensal estimado',
    'horas',
    'intervenção',
    'parecer médico',
    'período',
    'plantão',
    'procedimento',
    'sobreaviso',
    'visita'
  ));
