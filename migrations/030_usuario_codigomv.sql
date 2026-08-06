-- =============================================================
-- Migration 030 — Suporte a múltiplos códigos MV por usuário
-- =============================================================
-- 1. Normaliza unidades_hospitalares.codigo para corresponder
--    exatamente aos valores de nm_unidade no banco MV/RDS.
-- 2. Cria tabela usuario_codigomv (N códigos por usuário,
--    cada código em uma unidade distinta).
-- 3. Migra dados existentes (usuarios.codigomv + 1º contrato).
-- 4. Políticas RLS.
-- =============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. Normalizar nomes de unidades para casar com MV
-- ─────────────────────────────────────────────────────────────
-- ParcerIA atual → MV / RDS
--   HRD          → HRD I
--   PA PRAIA DO SUÁ → PA PRAIA DE SUA
--   PLCGOIAS     → PLC DE GOIAS

UPDATE unidades_hospitalares SET codigo = 'HRD I'          WHERE codigo = 'HRD';
UPDATE unidades_hospitalares SET codigo = 'PA PRAIA DE SUA' WHERE codigo = 'PA PRAIA DO SUÁ';
UPDATE unidades_hospitalares SET codigo = 'PLC DE GOIAS'   WHERE codigo = 'PLCGOIAS';

-- ─────────────────────────────────────────────────────────────
-- 2. Criar tabela usuario_codigomv
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuario_codigomv (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id   UUID        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    codigomv     TEXT        NOT NULL,
    nm_unidade   TEXT        NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Um mesmo código de prestador só pode existir uma vez por unidade
    CONSTRAINT usuario_codigomv_unique UNIQUE (codigomv, nm_unidade)
);

COMMENT ON TABLE  usuario_codigomv              IS 'Códigos de prestador MV por usuário e unidade hospitalar';
COMMENT ON COLUMN usuario_codigomv.codigomv     IS 'Código do prestador no sistema MV (cd_prestador)';
COMMENT ON COLUMN usuario_codigomv.nm_unidade   IS 'Nome da unidade hospitalar conforme banco MV (ex: HUGOL, HRD I)';

CREATE INDEX IF NOT EXISTS idx_usuario_codigomv_usuario_id  ON usuario_codigomv (usuario_id);
CREATE INDEX IF NOT EXISTS idx_usuario_codigomv_codigomv    ON usuario_codigomv (codigomv);
CREATE INDEX IF NOT EXISTS idx_usuario_codigomv_nm_unidade  ON usuario_codigomv (nm_unidade);

-- ─────────────────────────────────────────────────────────────
-- 3. Migrar dados existentes
--    Estratégia: para cada usuário terceiro com codigomv,
--    usa a unidade hospitalar do contrato mais antigo vinculado.
--    Prioriza usuario_contrato (novo), depois usuarios.contrato_id (legado).
-- ─────────────────────────────────────────────────────────────

-- 3a. Via usuario_contrato (novo vínculo)
WITH primeiro_contrato AS (
    SELECT DISTINCT ON (u.id)
        u.id          AS usuario_id,
        u.codigomv,
        uh.codigo     AS nm_unidade
    FROM usuarios u
    JOIN usuario_contrato uc ON uc.usuario_id = u.id
    JOIN contratos c          ON c.id = uc.contrato_id
    JOIN unidades_hospitalares uh ON uh.id = c.unidade_hospitalar_id
    WHERE u.codigomv IS NOT NULL
      AND u.tipo = 'terceiro'
    ORDER BY u.id, uc.created_at ASC, uc.id ASC
)
INSERT INTO usuario_codigomv (usuario_id, codigomv, nm_unidade)
SELECT usuario_id, codigomv, nm_unidade
FROM primeiro_contrato
ON CONFLICT (codigomv, nm_unidade) DO NOTHING;

-- 3b. Via usuarios.contrato_id (legado) — apenas para quem ainda não foi migrado
WITH legado AS (
    SELECT DISTINCT ON (u.id)
        u.id          AS usuario_id,
        u.codigomv,
        uh.codigo     AS nm_unidade
    FROM usuarios u
    JOIN contratos c ON c.id = u.contrato_id
    JOIN unidades_hospitalares uh ON uh.id = c.unidade_hospitalar_id
    WHERE u.codigomv IS NOT NULL
      AND u.tipo = 'terceiro'
      AND NOT EXISTS (
          SELECT 1 FROM usuario_codigomv ucm WHERE ucm.usuario_id = u.id
      )
    ORDER BY u.id
)
INSERT INTO usuario_codigomv (usuario_id, codigomv, nm_unidade)
SELECT usuario_id, codigomv, nm_unidade
FROM legado
ON CONFLICT (codigomv, nm_unidade) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 4. Políticas RLS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE usuario_codigomv ENABLE ROW LEVEL SECURITY;

-- Usuários autenticados podem visualizar (necessário para service role também)
CREATE POLICY "Usuarios autenticados podem visualizar usuario_codigomv"
    ON usuario_codigomv FOR SELECT TO authenticated USING (true);

-- Apenas administradores Agir podem inserir/atualizar/excluir
CREATE POLICY "Admins podem inserir usuario_codigomv"
    ON usuario_codigomv FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
              AND usuarios.tipo IN ('administrador-agir-corporativo', 'administrador-agir-planta',
                                    'administrador-agir', 'administrador-terceiro')
        )
    );

CREATE POLICY "Admins podem atualizar usuario_codigomv"
    ON usuario_codigomv FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
              AND usuarios.tipo IN ('administrador-agir-corporativo', 'administrador-agir-planta',
                                    'administrador-agir', 'administrador-terceiro')
        )
    );

CREATE POLICY "Admins podem excluir usuario_codigomv"
    ON usuario_codigomv FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
              AND usuarios.tipo IN ('administrador-agir-corporativo', 'administrador-agir-planta',
                                    'administrador-agir', 'administrador-terceiro')
        )
    );

-- ─────────────────────────────────────────────────────────────
-- 5. Verificar resultado
-- ─────────────────────────────────────────────────────────────
SELECT 'unidades_hospitalares após normalização:' AS info;
SELECT codigo, nome FROM unidades_hospitalares ORDER BY codigo;

SELECT 'usuario_codigomv migrados:' AS info;
SELECT ucm.codigomv, ucm.nm_unidade, u.nome
FROM usuario_codigomv ucm
JOIN usuarios u ON u.id = ucm.usuario_id
ORDER BY u.nome, ucm.nm_unidade;

COMMIT;
