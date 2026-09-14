-- STEP 1: Safety check - see 52ff995b public record before touching anything
SELECT id, email, nome, tipo, contrato_id FROM public.usuarios
WHERE id = '52ff995b-8ae8-4241-9042-ed6f75871004';

-- STEP 2: Check if ghost user has any contrato links
SELECT usuario_id, contrato_id FROM usuario_contrato
WHERE usuario_id = '52ff995b-8ae8-4241-9042-ed6f75871004';

-- STEP 3: Delete ghost from public.usuarios (NULL email, tipo=terceiro duplicate)
DELETE FROM public.usuarios
WHERE id = '52ff995b-8ae8-4241-9042-ed6f75871004'
  AND email IS NULL
RETURNING id, nome, tipo;

-- STEP 4: Delete ghost from auth.users
DELETE FROM auth.users
WHERE id = '52ff995b-8ae8-4241-9042-ed6f75871004'
RETURNING id, email;

-- STEP 5: Fix real user - sync auth email to match public.usuarios
UPDATE auth.users
SET email = 'medcipego@hotmail.com',
    updated_at = NOW()
WHERE id = 'ef288f1b-3298-4910-9daa-3a2dda6764f0'
RETURNING id, email AS new_auth_email;

-- STEP 6: Verify final state
SELECT a.id, a.email AS auth_email, u.email AS public_email, u.nome, u.tipo
FROM auth.users a
JOIN public.usuarios u ON u.id = a.id
WHERE a.id = 'ef288f1b-3298-4910-9daa-3a2dda6764f0';
