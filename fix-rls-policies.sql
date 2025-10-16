-- Fix RLS Policies for ParcerIA
-- This script fixes the circular dependency issues in RLS policies

-- Drop ALL existing policies from all tables
-- USUARIOS
DROP POLICY IF EXISTS "Usuários podem ver seu próprio perfil" ON usuarios;
DROP POLICY IF EXISTS "Administradores Agir podem ver todos os usuários" ON usuarios;
DROP POLICY IF EXISTS "Administradores Agir podem inserir usuários" ON usuarios;
DROP POLICY IF EXISTS "Administradores Agir podem atualizar usuários" ON usuarios;
DROP POLICY IF EXISTS "Administradores Agir podem deletar usuários" ON usuarios;

-- CONTRATOS
DROP POLICY IF EXISTS "Administradores podem ver contratos" ON contratos;
DROP POLICY IF EXISTS "Administradores Agir podem gerenciar contratos" ON contratos;
DROP POLICY IF EXISTS "Administradores Agir podem inserir contratos" ON contratos;
DROP POLICY IF EXISTS "Administradores Agir podem atualizar contratos" ON contratos;
DROP POLICY IF EXISTS "Administradores Agir podem deletar contratos" ON contratos;

-- USUARIO_CONTRATO
DROP POLICY IF EXISTS "Administradores podem ver vínculos" ON usuario_contrato;
DROP POLICY IF EXISTS "Administradores Agir podem gerenciar vínculos" ON usuario_contrato;
DROP POLICY IF EXISTS "Administradores Agir podem inserir vínculos" ON usuario_contrato;
DROP POLICY IF EXISTS "Administradores Agir podem atualizar vínculos" ON usuario_contrato;
DROP POLICY IF EXISTS "Administradores Agir podem deletar vínculos" ON usuario_contrato;

-- ACESSOS
DROP POLICY IF EXISTS "Terceiros podem ver seus próprios acessos" ON acessos;
DROP POLICY IF EXISTS "Administradores Terceiros podem ver acessos de seus colaboradores" ON acessos;
DROP POLICY IF EXISTS "Administradores Agir podem ver todos os acessos" ON acessos;
DROP POLICY IF EXISTS "Administradores Agir podem gerenciar acessos" ON acessos;
DROP POLICY IF EXISTS "Administradores Agir podem inserir acessos" ON acessos;
DROP POLICY IF EXISTS "Administradores Agir podem atualizar acessos" ON acessos;
DROP POLICY IF EXISTS "Administradores Agir podem deletar acessos" ON acessos;

-- Create helper function to check if current user is admin-agir
CREATE OR REPLACE FUNCTION is_admin_agir()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid() AND tipo = 'administrador-agir'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- USUARIOS TABLE POLICIES

-- Select policy: Users can see their own profile
CREATE POLICY "Usuários podem ver seu próprio perfil"
ON usuarios FOR SELECT
USING (auth.uid() = id);

-- Select policy: Admin-agir can see all users
CREATE POLICY "Administradores Agir podem ver todos os usuários"
ON usuarios FOR SELECT
USING (is_admin_agir());

-- Insert policy: Allow admin-agir to insert new users
CREATE POLICY "Administradores Agir podem inserir usuários"
ON usuarios FOR INSERT
WITH CHECK (is_admin_agir());

-- Update policy: Allow admin-agir to update users
CREATE POLICY "Administradores Agir podem atualizar usuários"
ON usuarios FOR UPDATE
USING (is_admin_agir())
WITH CHECK (is_admin_agir());

-- Delete policy: Allow admin-agir to delete users
CREATE POLICY "Administradores Agir podem deletar usuários"
ON usuarios FOR DELETE
USING (is_admin_agir());

-- CONTRATOS TABLE POLICIES

-- Select policy: Admins can see contracts
CREATE POLICY "Administradores podem ver contratos"
ON contratos FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid() AND tipo IN ('administrador-agir', 'administrador-terceiro')
  )
);

-- Insert policy: Allow admin-agir to insert contracts
CREATE POLICY "Administradores Agir podem inserir contratos"
ON contratos FOR INSERT
WITH CHECK (is_admin_agir());

-- Update policy: Allow admin-agir to update contracts
CREATE POLICY "Administradores Agir podem atualizar contratos"
ON contratos FOR UPDATE
USING (is_admin_agir())
WITH CHECK (is_admin_agir());

-- Delete policy: Allow admin-agir to delete contracts
CREATE POLICY "Administradores Agir podem deletar contratos"
ON contratos FOR DELETE
USING (is_admin_agir());

-- USUARIO_CONTRATO TABLE POLICIES

-- Select policy: Admins can see vinculos
CREATE POLICY "Administradores podem ver vínculos"
ON usuario_contrato FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid() AND tipo IN ('administrador-agir', 'administrador-terceiro')
  )
);

-- Insert policy: Allow admin-agir to create vinculos
CREATE POLICY "Administradores Agir podem inserir vínculos"
ON usuario_contrato FOR INSERT
WITH CHECK (is_admin_agir());

-- Update policy: Allow admin-agir to update vinculos
CREATE POLICY "Administradores Agir podem atualizar vínculos"
ON usuario_contrato FOR UPDATE
USING (is_admin_agir())
WITH CHECK (is_admin_agir());

-- Delete policy: Allow admin-agir to delete vinculos
CREATE POLICY "Administradores Agir podem deletar vínculos"
ON usuario_contrato FOR DELETE
USING (is_admin_agir());

-- ACESSOS TABLE POLICIES

-- Select policy: Users can see their own acessos
CREATE POLICY "Terceiros podem ver seus próprios acessos"
ON acessos FOR SELECT
USING (
  cpf IN (
    SELECT cpf FROM usuarios WHERE id = auth.uid()
  )
);

-- Select policy: Admin terceiro can see acessos of their team
CREATE POLICY "Administradores Terceiros podem ver acessos de seus colaboradores"
ON acessos FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM usuarios u
    JOIN usuario_contrato uc ON u.id = uc.usuario_id
    WHERE u.id = auth.uid()
    AND u.tipo = 'administrador-terceiro'
    AND uc.cpf = acessos.cpf
  )
);

-- Select policy: Admin-agir can see all acessos
CREATE POLICY "Administradores Agir podem ver todos os acessos"
ON acessos FOR SELECT
USING (is_admin_agir());

-- Insert policy: Allow admin-agir to insert acessos
CREATE POLICY "Administradores Agir podem inserir acessos"
ON acessos FOR INSERT
WITH CHECK (is_admin_agir());

-- Update policy: Allow admin-agir to update acessos
CREATE POLICY "Administradores Agir podem atualizar acessos"
ON acessos FOR UPDATE
USING (is_admin_agir())
WITH CHECK (is_admin_agir());

-- Delete policy: Allow admin-agir to delete acessos
CREATE POLICY "Administradores Agir podem deletar acessos"
ON acessos FOR DELETE
USING (is_admin_agir());

-- Grant execute permission on the helper function
GRANT EXECUTE ON FUNCTION is_admin_agir() TO authenticated;
