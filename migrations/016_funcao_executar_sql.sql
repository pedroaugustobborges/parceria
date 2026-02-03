-- Migration 016: Funcao segura para execucao de consultas SQL geradas pela IA

CREATE OR REPLACE FUNCTION executar_consulta_analytics(
  texto_consulta text,
  id_usuario uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  resultado jsonb;
  consulta_limpa text;
  tempo_inicio timestamptz;
BEGIN
  -- Limpar a consulta
  consulta_limpa := trim(texto_consulta);

  -- Validar: apenas SELECT e WITH (CTE) permitidos
  IF NOT (
    consulta_limpa ~* '^\s*(SELECT|WITH)\s'
  ) THEN
    RAISE EXCEPTION 'Apenas consultas SELECT sao permitidas';
  END IF;

  -- Validar: bloquear DDL/DML
  IF consulta_limpa ~* '\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|GRANT|REVOKE|EXECUTE|COPY)\b' THEN
    RAISE EXCEPTION 'Operacoes de modificacao nao sao permitidas';
  END IF;

  -- Configurar RLS para o usuario
  PERFORM set_config('request.jwt.claim.sub', id_usuario::text, true);

  -- Timeout de 10 segundos
  PERFORM set_config('statement_timeout', '10000', true);

  -- Executar com limite de 1000 linhas
  EXECUTE format(
    'SELECT jsonb_agg(row_to_json(t)) FROM (SELECT * FROM (%s) sub LIMIT 1000) t',
    consulta_limpa
  ) INTO resultado;

  -- Resetar timeout
  PERFORM set_config('statement_timeout', '0', true);

  RETURN COALESCE(resultado, '[]'::jsonb);

EXCEPTION
  WHEN OTHERS THEN
    -- Resetar timeout em caso de erro
    PERFORM set_config('statement_timeout', '0', true);
    RAISE;
END;
$$;
