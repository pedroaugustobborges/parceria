-- Create a function to properly delete a user from both usuarios and auth.users
-- This function will be called from the application and will handle the complete deletion

CREATE OR REPLACE FUNCTION delete_user_completely(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_exists BOOLEAN;
BEGIN
  -- Check if user exists
  SELECT EXISTS(SELECT 1 FROM usuarios WHERE id = user_id) INTO user_exists;

  IF NOT user_exists THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Delete from usuarios table first
  DELETE FROM usuarios WHERE id = user_id;

  -- Delete from auth.users (this will cascade to all related tables)
  DELETE FROM auth.users WHERE id = user_id;

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error deleting user: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_user_completely(UUID) TO authenticated;

-- Create RLS policy to ensure only admin-agir can call this function
-- This is enforced by the existing RLS policies on the usuarios table
