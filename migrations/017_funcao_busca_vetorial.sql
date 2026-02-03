-- Migration 017: Funcao de busca vetorial para RAG

CREATE OR REPLACE FUNCTION buscar_chunks_similares(
  embedding_consulta vector(1536),
  limite_similaridade float DEFAULT 0.7,
  limite_resultados int DEFAULT 5,
  filtro_contrato_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  conteudo text,
  titulo_secao text,
  numero_pagina int,
  contrato_id uuid,
  nome_arquivo text,
  similaridade float
)
LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  SELECT
    dc.id,
    dc.conteudo,
    dc.titulo_secao,
    dc.numero_pagina,
    dc.contrato_id,
    doc.nome_arquivo,
    1 - (dc.embedding <=> embedding_consulta) AS similaridade
  FROM documento_chunks dc
  JOIN documentos_contrato doc ON doc.id = dc.documento_id
  WHERE
    doc.status = 'pronto'
    AND (filtro_contrato_ids IS NULL OR dc.contrato_id = ANY(filtro_contrato_ids))
    AND 1 - (dc.embedding <=> embedding_consulta) >= limite_similaridade
  ORDER BY dc.embedding <=> embedding_consulta
  LIMIT limite_resultados;
$$;
