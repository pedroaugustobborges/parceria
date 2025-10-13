-- Corrigir Políticas RLS que estão causando recursão infinita
-- Execute este script no SQL Editor do Supabase

-- 1. REMOVER todas as políticas antigas que causam recursão
DROP POLICY IF EXISTS "Usuários podem ver seu próprio perfil" ON usuarios;
DROP POLICY IF EXISTS "Administradores Agir podem ver todos os usuários" ON usuarios;
DROP POLICY IF EXISTS "Administradores Agir podem inserir usuários" ON usuarios;
DROP POLICY IF EXISTS "Administradores Agir podem atualizar usuários" ON usuarios;
DROP POLICY IF EXISTS "Administradores Agir podem deletar usuários" ON usuarios;
DROP POLICY IF EXISTS "Administradores podem ver contratos" ON contratos;
DROP POLICY IF EXISTS "Administradores Agir podem gerenciar contratos" ON contratos;
DROP POLICY IF EXISTS "Terceiros podem ver seus próprios acessos" ON acessos;
DROP POLICY IF EXISTS "Administradores Terceiros podem ver acessos de seus colaboradores" ON acessos;
DROP POLICY IF EXISTS "Administradores Agir podem ver todos os acessos" ON acessos;
DROP POLICY IF EXISTS "Administradores Agir podem gerenciar acessos" ON acessos;
DROP POLICY IF EXISTS "Administradores podem ver vínculos" ON usuario_contrato;
DROP POLICY IF EXISTS "Administradores Agir podem gerenciar vínculos" ON usuario_contrato;

-- 2. DESABILITAR RLS temporariamente para permitir acesso
ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE contratos DISABLE ROW LEVEL SECURITY;
ALTER TABLE acessos DISABLE ROW LEVEL SECURITY;
ALTER TABLE usuario_contrato DISABLE ROW LEVEL SECURITY;

-- 3. (OPCIONAL) Se quiser reativar RLS com políticas mais simples depois:
-- Descomente as linhas abaixo quando estiver pronto

/*
-- Reabilitar RLS
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE acessos ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuario_contrato ENABLE ROW LEVEL SECURITY;

-- Política simples: Permitir tudo para usuários autenticados
CREATE POLICY "Permitir tudo para autenticados" ON usuarios
FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Permitir tudo para autenticados" ON contratos
FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Permitir tudo para autenticados" ON acessos
FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Permitir tudo para autenticados" ON usuario_contrato
FOR ALL USING (auth.role() = 'authenticated');
*/

-- Verificar status do RLS
SELECT
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('usuarios', 'contratos', 'acessos', 'usuario_contrato');
