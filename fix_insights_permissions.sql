-- 1. Desabilitar RLS temporariamente para teste
ALTER TABLE insights_ia DISABLE ROW LEVEL SECURITY;

-- 2. Remover políticas antigas (se existirem)
DROP POLICY IF EXISTS "Apenas admin-agir pode ler insights" ON insights_ia;
DROP POLICY IF EXISTS "Apenas admin-agir pode inserir insights" ON insights_ia;

-- 3. Habilitar RLS novamente
ALTER TABLE insights_ia ENABLE ROW LEVEL SECURITY;

-- 4. Criar política de leitura permissiva (permitir todos usuários autenticados)
CREATE POLICY "Permitir leitura para usuários autenticados"
  ON insights_ia
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- 5. Criar política de inserção permissiva (permitir todos usuários autenticados)
CREATE POLICY "Permitir inserção para usuários autenticados"
  ON insights_ia
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- 6. Garantir que a tabela está acessível
GRANT ALL ON TABLE insights_ia TO authenticated;
GRANT ALL ON TABLE insights_ia TO service_role;
