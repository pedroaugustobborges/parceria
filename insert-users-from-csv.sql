-- Script para inserir usuários do arquivo new_users.csv
-- Execute este script no Supabase SQL Editor
-- ATENÇÃO: Este script insere registros na tabela usuarios SEM criar usuários de autenticação

-- Desabilitar temporariamente os triggers e validações se necessário
BEGIN;


INSERT INTO usuarios (id, email, nome, cpf, tipo, contrato_id, codigomv, especialidade, created_at, updated_at)
VALUES (
    'a8b9bf71-cc0f-4458-84c6-5958648ef79e',
    '75271168115@terceiro.agir.com.br',
    'AMANDA SILVEIRA NEVES',
    '75271168115',
    'terceiro',
    '5a32864e-99d0-45cc-be60-3c3f80e011de',
    '14540',
    ARRAY['Clínica Geral'],
    '2025-10-19T20:15:12.214040',
    '2025-10-19T20:15:12.214040'
);

INSERT INTO usuario_contrato (id, usuario_id, contrato_id, cpf, created_at)
VALUES (
    '9d9a67af-341d-4204-be5e-90cd12b33c23',
    'a8b9bf71-cc0f-4458-84c6-5958648ef79e',
    '5a32864e-99d0-45cc-be60-3c3f80e011de',
    '75271168115',
    '2025-10-19T20:15:12.214040'
);

INSERT INTO usuarios (id, email, nome, cpf, tipo, contrato_id, codigomv, especialidade, created_at, updated_at)
VALUES (
    'e93328ef-d61c-439d-b1c2-a47a50a92ad2',
    '4787922122@terceiro.agir.com.br',
    'ANITA ABREU DE CARVALHO',
    '4787922122',
    'terceiro',
    '5a32864e-99d0-45cc-be60-3c3f80e011de',
    '1869047',
    ARRAY['Clínica Geral'],
    '2025-10-19T20:15:12.214040',
    '2025-10-19T20:15:12.214040'
);

INSERT INTO usuario_contrato (id, usuario_id, contrato_id, cpf, created_at)
VALUES (
    '64f80f46-03ed-47fd-ac98-ebf1ae7efed4',
    'e93328ef-d61c-439d-b1c2-a47a50a92ad2',
    '5a32864e-99d0-45cc-be60-3c3f80e011de',
    '4787922122',
    '2025-10-19T20:15:12.214040'
);

INSERT INTO usuarios (id, email, nome, cpf, tipo, contrato_id, codigomv, especialidade, created_at, updated_at)
VALUES (
    'e176ddd7-5105-41d6-b0b5-b7611c686fcf',
    '3391151145@terceiro.agir.com.br',
    'CAMILA BRAGA ALVES',
    '3391151145',
    'terceiro',
    '5a32864e-99d0-45cc-be60-3c3f80e011de',
    '1873866',
    ARRAY['Clínica Geral'],
    '2025-10-19T20:15:12.214040',
    '2025-10-19T20:15:12.214040'
);

INSERT INTO usuario_contrato (id, usuario_id, contrato_id, cpf, created_at)
VALUES (
    '4c790ff8-56c8-48b2-ac70-00c6da66053f',
    'e176ddd7-5105-41d6-b0b5-b7611c686fcf',
    '5a32864e-99d0-45cc-be60-3c3f80e011de',
    '3391151145',
    '2025-10-19T20:15:12.214040'
);

INSERT INTO usuarios (id, email, nome, cpf, tipo, contrato_id, codigomv, especialidade, created_at, updated_at)
VALUES (
    'f37545fe-187f-4abb-bed1-8c4407909403',
    '93970447100@terceiro.agir.com.br',
    'CRISTINA CRUVINEL FREITAS',
    '93970447100',
    'terceiro',
    '5a32864e-99d0-45cc-be60-3c3f80e011de',
    '12110',
    ARRAY['Clínica Geral'],
    '2025-10-19T20:15:12.214040',
    '2025-10-19T20:15:12.214040'
);

INSERT INTO usuario_contrato (id, usuario_id, contrato_id, cpf, created_at)
VALUES (
    '4f84f5ff-a980-4fa9-9bcc-ddabde2d8e6a',
    'f37545fe-187f-4abb-bed1-8c4407909403',
    '5a32864e-99d0-45cc-be60-3c3f80e011de',
    '93970447100',
    '2025-10-19T20:15:12.214040'
);

INSERT INTO usuarios (id, email, nome, cpf, tipo, contrato_id, codigomv, especialidade, created_at, updated_at)
VALUES (
    'f7a9262a-b654-4a98-b49a-8deadbf29cf4',
    '5254980362@terceiro.agir.com.br',
    'DANIELA MARIA FERREIRA RODRIGUES',
    '5254980362',
    'terceiro',
    '5a32864e-99d0-45cc-be60-3c3f80e011de',
    '305790086',
    ARRAY['Clínica Geral'],
    '2025-10-19T20:15:12.214040',
    '2025-10-19T20:15:12.214040'
);

INSERT INTO usuario_contrato (id, usuario_id, contrato_id, cpf, created_at)
VALUES (
    '41412e96-30c5-4ce2-951f-11b49daf23f2',
    'f7a9262a-b654-4a98-b49a-8deadbf29cf4',
    '5a32864e-99d0-45cc-be60-3c3f80e011de',
    '5254980362',
    '2025-10-19T20:15:12.214040'
);

INSERT INTO usuarios (id, email, nome, cpf, tipo, contrato_id, codigomv, especialidade, created_at, updated_at)
VALUES (
    '224f49fd-0e57-4b5a-b526-a0528644a6c9',
    '986281190@terceiro.agir.com.br',
    'ESTEVAO DE CARVALHO AGUIAR',
    '986281190',
    'terceiro',
    '5a32864e-99d0-45cc-be60-3c3f80e011de',
    '305774594',
    ARRAY['Clínica Geral'],
    '2025-10-19T20:15:12.214040',
    '2025-10-19T20:15:12.214040'
);

INSERT INTO usuario_contrato (id, usuario_id, contrato_id, cpf, created_at)
VALUES (
    '8aff2ad3-97f8-441d-8911-d3458e8220c5',
    '224f49fd-0e57-4b5a-b526-a0528644a6c9',
    '5a32864e-99d0-45cc-be60-3c3f80e011de',
    '986281190',
    '2025-10-19T20:15:12.214040'
);


COMMIT;

-- Verificar os usuários inseridos
SELECT id, email, nome, cpf, tipo, codigomv, especialidade
FROM usuarios
WHERE email LIKE '%@terceiro.agir.com.br'
ORDER BY created_at DESC;
