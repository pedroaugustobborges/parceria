-- Diagnostic script to check for existing users and potential conflicts

-- 1. List all users in the usuarios table
SELECT id, email, cpf, nome, tipo, created_at
FROM usuarios
ORDER BY created_at DESC;

-- 2. Check for specific email or CPF (replace with the one you're trying to create)
-- Uncomment and replace the values below:
-- SELECT * FROM usuarios WHERE email = 'user@example.com';
-- SELECT * FROM usuarios WHERE cpf = '12345678901';

-- 3. Check for users in auth.users that might not have a record in usuarios
SELECT au.id, au.email, au.created_at as auth_created_at, u.id as usuario_id
FROM auth.users au
LEFT JOIN usuarios u ON au.id = u.id
WHERE u.id IS NULL;

-- 4. If you need to clean up a specific orphaned auth user (BE CAREFUL!)
-- Uncomment and replace the UUID below:
-- DELETE FROM auth.users WHERE id = 'uuid-here';
