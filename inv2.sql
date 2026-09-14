SELECT 'PUB' as src, id, email, nome, tipo FROM public.usuarios
WHERE email IN ('medcipego@hotmail.com','hfgoias@hotmail.com')
UNION ALL
SELECT 'AUTH' as src, id, email, '' as nome, '' as tipo FROM auth.users
WHERE email IN ('medcipego@hotmail.com','hfgoias@hotmail.com')
ORDER BY src, email;
