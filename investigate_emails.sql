\echo '=== public.usuarios ==='
SELECT id, email, nome, tipo FROM public.usuarios
WHERE email ILIKE '%medcipego%' OR email ILIKE '%hfgoias%'
ORDER BY email;

\echo '=== auth.users ==='
SELECT id, email, encrypted_password IS NOT NULL as has_pw,
       email_confirmed_at, last_sign_in_at
FROM auth.users
WHERE email ILIKE '%medcipego%' OR email ILIKE '%hfgoias%'
ORDER BY email;

\echo '=== cross-check by UUID ==='
SELECT a.id, a.email as auth_email, u.email as public_email, u.nome
FROM auth.users a
LEFT JOIN public.usuarios u ON u.id = a.id
WHERE a.email ILIKE '%medcipego%' OR a.email ILIKE '%hfgoias%'
   OR u.email ILIKE '%medcipego%' OR u.email ILIKE '%hfgoias%';
