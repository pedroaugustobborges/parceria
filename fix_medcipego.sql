-- Investigate the email desync between medcipego and hfgoias
-- Step 1: Show current state in both tables
\echo '=== public.usuarios ==='
SELECT id, email, nome, tipo
FROM public.usuarios
WHERE email IN ('medcipego@hotmail.com', 'hfgoias@hotmail.com')
ORDER BY email;

\echo '=== auth.users ==='
SELECT id, email, email_confirmed_at, last_sign_in_at
FROM auth.users
WHERE email IN ('medcipego@hotmail.com', 'hfgoias@hotmail.com')
ORDER BY email;

\echo '=== cross-join: auth row where auth.email=medcipego but public.email=hfgoias ==='
SELECT a.id, a.email AS auth_email, u.email AS public_email, u.nome
FROM auth.users a
JOIN public.usuarios u ON u.id = a.id
WHERE a.email = 'medcipego@hotmail.com' AND u.email = 'hfgoias@hotmail.com';

-- Step 2: Apply the fix - sync auth.users email to match public.usuarios
-- Only fires if the UUID mismatch (medcipego in auth, hfgoias in public) is confirmed
\echo '=== APPLYING FIX ==='
UPDATE auth.users a
SET
  email = u.email,
  email_confirmed_at = COALESCE(a.email_confirmed_at, NOW()),
  updated_at = NOW()
FROM public.usuarios u
WHERE a.id = u.id
  AND a.email = 'medcipego@hotmail.com'
  AND u.email = 'hfgoias@hotmail.com'
RETURNING a.id, a.email AS new_auth_email, u.nome;

\echo '=== DONE ==='
