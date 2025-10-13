-- Políticas RLS Corrigidas (SEM recursão infinita)
-- Execute este script no SQL Editor do Supabase

-- 1. Reabilitar RLS em todas as tabelas
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE acessos ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuario_contrato ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLÍTICAS PARA TABELA: usuarios
-- ============================================

-- Permitir que usuário veja seu próprio perfil
CREATE POLICY "usuarios_select_own"
ON usuarios FOR SELECT
USING (auth.uid() = id);

-- Permitir INSERT/UPDATE/DELETE apenas pelo service role (backend)
CREATE POLICY "usuarios_insert_service"
ON usuarios FOR INSERT
WITH CHECK (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "usuarios_update_service"
ON usuarios FOR UPDATE
USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "usuarios_delete_service"
ON usuarios FOR DELETE
USING (auth.jwt()->>'role' = 'service_role');

-- ============================================
-- POLÍTICAS PARA TABELA: contratos
-- ============================================

-- Todos os autenticados podem ler contratos
CREATE POLICY "contratos_select_all"
ON contratos FOR SELECT
USING (auth.role() = 'authenticated');

-- Apenas service role pode modificar
CREATE POLICY "contratos_modify_service"
ON contratos FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

-- ============================================
-- POLÍTICAS PARA TABELA: acessos
-- ============================================

-- Todos os autenticados podem ler acessos
-- O filtro será feito no código da aplicação
CREATE POLICY "acessos_select_all"
ON acessos FOR SELECT
USING (auth.role() = 'authenticated');

-- Apenas service role pode modificar
CREATE POLICY "acessos_modify_service"
ON acessos FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

-- ============================================
-- POLÍTICAS PARA TABELA: usuario_contrato
-- ============================================

-- Todos os autenticados podem ler vínculos
CREATE POLICY "usuario_contrato_select_all"
ON usuario_contrato FOR SELECT
USING (auth.role() = 'authenticated');

-- Apenas service role pode modificar
CREATE POLICY "usuario_contrato_modify_service"
ON usuario_contrato FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

-- ============================================
-- VERIFICAÇÃO
-- ============================================

-- Verificar que RLS está ativo
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('usuarios', 'contratos', 'acessos', 'usuario_contrato')
ORDER BY tablename;

-- Listar todas as políticas criadas
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
