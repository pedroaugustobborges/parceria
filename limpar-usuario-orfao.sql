-- Script to clean up orphaned auth user
-- This will delete the user from auth.users that doesn't have a corresponding record in usuarios

-- First, let's see the orphaned user
SELECT au.id, au.email, au.created_at
FROM auth.users au
LEFT JOIN usuarios u ON au.id = u.id
WHERE u.id IS NULL
  AND au.email = 'pborgesagir@gmail.com';

-- If you see the user above, run this to delete it:
-- IMPORTANT: Make sure you're deleting the right user!
DELETE FROM auth.users
WHERE email = 'pborgesagir@gmail.com'
  AND id NOT IN (SELECT id FROM usuarios);

-- Verify it's gone
SELECT au.id, au.email, au.created_at
FROM auth.users au
WHERE au.email = 'pborgesagir@gmail.com';

-- General cleanup: Delete ALL orphaned auth users (users in auth.users but not in usuarios)
-- CAUTION: Only run this if you're sure you want to delete all orphaned users
-- DELETE FROM auth.users
-- WHERE id NOT IN (SELECT id FROM usuarios);
