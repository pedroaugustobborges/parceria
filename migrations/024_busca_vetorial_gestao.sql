-- Migration 024: Funcao de Busca Vetorial Multi-Tabela
-- Busca em documento_chunks (contratos) E documento_gestao_chunks (gestao)

-- Manter funcao original para compatibilidade
-- Criar nova funcao que busca em ambas tabelas

CREATE OR REPLACE FUNCTION buscar_chunks_similares_v2(
  embedding_consulta vector(1536),
  limite_similaridade float DEFAULT 0.7,
  limite_resultados int DEFAULT 5,
  filtro_contrato_ids uuid[] DEFAULT NULL,
  filtro_unidade_id uuid DEFAULT NULL,
  incluir_gestao boolean DEFAULT false
)
RETURNS TABLE (
  id uuid,
  conteudo text,
  titulo_secao text,
  numero_pagina int,
  contrato_id uuid,
  unidade_hospitalar_id uuid,
  nome_arquivo text,
  tipo_documento text,
  similaridade float
)
LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  -- Buscar em documento_chunks (contratos)
  -- Filtra por contrato_ids OU por unidade_id quando especificado
  SELECT
    dc.id,
    dc.conteudo,
    dc.titulo_secao,
    dc.numero_pagina,
    dc.contrato_id,
    dc.unidade_hospitalar_id,
    doc.nome_arquivo,
    'contrato'::text AS tipo_documento,
    1 - (dc.embedding <=> embedding_consulta) AS similaridade
  FROM documento_chunks dc
  JOIN documentos_contrato doc ON doc.id = dc.documento_id
  WHERE
    doc.status = 'pronto'
    AND (filtro_contrato_ids IS NULL OR dc.contrato_id = ANY(filtro_contrato_ids))
    AND (filtro_unidade_id IS NULL OR dc.unidade_hospitalar_id = filtro_unidade_id)
    AND 1 - (dc.embedding <=> embedding_consulta) >= limite_similaridade

  UNION ALL

  -- Buscar em documento_gestao_chunks (gestao) - apenas se incluir_gestao = true
  SELECT
    dgc.id,
    dgc.conteudo,
    dgc.titulo_secao,
    dgc.numero_pagina,
    NULL::uuid AS contrato_id,
    dgc.unidade_hospitalar_id,
    dg.nome_arquivo,
    'gestao'::text AS tipo_documento,
    1 - (dgc.embedding <=> embedding_consulta) AS similaridade
  FROM documento_gestao_chunks dgc
  JOIN documentos_gestao dg ON dg.id = dgc.documento_id
  WHERE
    incluir_gestao = true
    AND dg.status = 'pronto'
    AND dg.ativo = true
    AND (filtro_unidade_id IS NULL OR dgc.unidade_hospitalar_id = filtro_unidade_id)
    AND 1 - (dgc.embedding <=> embedding_consulta) >= limite_similaridade

  ORDER BY similaridade DESC
  LIMIT limite_resultados;
$$;
