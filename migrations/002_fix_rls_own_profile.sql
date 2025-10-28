-- ============================================================================
-- Fix: Allow users to read their own profile
-- Description: Adiciona policy para usuários lerem seu próprio perfil
-- Date: 2025-10-28
-- ============================================================================

-- Ensure the policy exists for users to view their own profile
DROP POLICY IF EXISTS "users_view_own_profile" ON usuarios;

CREATE POLICY "users_view_own_profile" ON usuarios
  FOR SELECT
  USING (id = auth.uid());

-- Verify
SELECT policyname, tablename
FROM pg_policies
WHERE tablename = 'usuarios'
ORDER BY policyname;
