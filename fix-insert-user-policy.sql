-- Fix INSERT policy for usuarios table
-- The problem: WITH CHECK runs in the context of the NEW row being inserted
-- Solution: Create a policy that checks if the person doing the insert is admin-agir

-- Drop existing insert policy
DROP POLICY IF EXISTS "Administradores Agir podem inserir usuários" ON usuarios;

-- Create new INSERT policy that properly checks the current user (not the new row)
CREATE POLICY "Administradores Agir podem inserir usuários"
ON usuarios FOR INSERT
WITH CHECK (
  -- Check if the current session user is an admin-agir
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid() AND tipo = 'administrador-agir'
  )
);

-- Alternatively, if the above doesn't work due to the chicken-egg problem,
-- we can use a more permissive approach with the SECURITY DEFINER function:

-- First, create a better helper function
CREATE OR REPLACE FUNCTION can_insert_user()
RETURNS BOOLEAN AS $$
DECLARE
  user_type TEXT;
BEGIN
  -- Get the type of the current authenticated user
  SELECT tipo INTO user_type
  FROM usuarios
  WHERE id = auth.uid();

  -- Return true if user is admin-agir
  RETURN user_type = 'administrador-agir';
EXCEPTION
  WHEN NO_DATA_FOUND THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION can_insert_user() TO authenticated;

-- Drop and recreate the policy using the new function
DROP POLICY IF EXISTS "Administradores Agir podem inserir usuários" ON usuarios;

CREATE POLICY "Administradores Agir podem inserir usuários"
ON usuarios FOR INSERT
WITH CHECK (can_insert_user());
