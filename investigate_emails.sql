SELECT id, email, tipo FROM public.usuarios WHERE email LIKE '%medcipego%' OR email LIKE '%hfgoias%';
SELECT id, email FROM auth.users WHERE email LIKE '%medcipego%' OR email LIKE '%hfgoias%';
SELECT a.id, a.email AS auth_email, u.email AS public_email, u.nome, u.tipo FROM auth.users a JOIN public.usuarios u ON u.id = a.id WHERE a.email LIKE '%medcipego%' OR a.email LIKE '%hfgoias%' OR u.email LIKE '%medcipego%' OR u.email LIKE '%hfgoias%';
