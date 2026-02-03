-- Migration 015: Views materializadas para analytics do chat SQL

-- Resumo mensal de escalas
CREATE MATERIALIZED VIEW vm_escalas_mensal AS
SELECT
  date_trunc('month', em.data_inicio::date) AS mes,
  em.contrato_id,
  c.unidade_hospitalar_id,
  c.empresa,
  ic.nome AS especialidade,
  COUNT(*) AS total_escalas,
  COUNT(*) FILTER (WHERE em.status = 'Aprovado') AS aprovadas,
  COUNT(*) FILTER (WHERE em.status = 'Reprovado') AS reprovadas,
  COUNT(*) FILTER (WHERE em.status = 'Programado') AS programadas,
  COUNT(*) FILTER (WHERE em.status = 'Pré-Agendado') AS pre_agendadas,
  SUM(jsonb_array_length(em.medicos)) AS total_medicos
FROM escalas_medicas em
JOIN contratos c ON c.id = em.contrato_id
LEFT JOIN itens_contrato ic ON ic.id = em.item_contrato_id
WHERE em.ativo = true
GROUP BY 1, 2, 3, 4, 5;

CREATE UNIQUE INDEX idx_vm_escalas_mensal ON vm_escalas_mensal(mes, contrato_id, especialidade);

-- Resumo mensal de produtividade
CREATE MATERIALIZED VIEW vm_produtividade_mensal AS
SELECT
  date_trunc('month', p.data::date) AS mes,
  p.unidade_hospitalar_id,
  p.especialidade,
  COUNT(DISTINCT p.codigo_mv) AS profissionais_ativos,
  SUM(p.procedimento) AS total_procedimentos,
  SUM(p.parecer_solicitado) AS total_pareceres_solicitados,
  SUM(p.parecer_realizado) AS total_pareceres_realizados,
  SUM(p.cirurgia_realizada) AS total_cirurgias,
  SUM(p.prescricao) AS total_prescricoes,
  SUM(p.evolucao) AS total_evolucoes,
  SUM(p.urgencia) AS total_urgencias,
  SUM(p.ambulatorio) AS total_ambulatorios
FROM produtividade p
WHERE p.data IS NOT NULL
GROUP BY 1, 2, 3;

CREATE UNIQUE INDEX idx_vm_produtividade_mensal ON vm_produtividade_mensal(mes, unidade_hospitalar_id, especialidade);

-- Resumo mensal de acessos
CREATE MATERIALIZED VIEW vm_acessos_mensal AS
SELECT
  date_trunc('month', a.data_acesso::date) AS mes,
  a.planta,
  a.tipo,
  COUNT(*) AS total_registros,
  COUNT(*) FILTER (WHERE a.sentido = 'E') AS entradas,
  COUNT(*) FILTER (WHERE a.sentido = 'S') AS saidas,
  COUNT(DISTINCT a.cpf) AS pessoas_unicas
FROM acessos a
GROUP BY 1, 2, 3;

CREATE UNIQUE INDEX idx_vm_acessos_mensal ON vm_acessos_mensal(mes, planta, tipo);

-- Funcao para atualizar todas as views materializadas
CREATE OR REPLACE FUNCTION atualizar_views_analytics()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY vm_escalas_mensal;
  REFRESH MATERIALIZED VIEW CONCURRENTLY vm_produtividade_mensal;
  REFRESH MATERIALIZED VIEW CONCURRENTLY vm_acessos_mensal;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
