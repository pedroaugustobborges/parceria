-- =============================================================
-- Migration 029 — Reestruturar tabela produtividade
-- =============================================================
-- Remove colunas do webscraper antigo, adiciona nm_unidade e
-- as 9 novas colunas baseadas em CD_TIPO_DOCUMENTO do MV/RDS.
-- Chave de upsert passa a ser (codigo_mv, data, nm_unidade).
-- ATENÇÃO: executa TRUNCATE antes de alterar — backup obrigatório.
-- =============================================================

BEGIN;

-- 1. Limpar dados antigos (webscraper)
TRUNCATE TABLE produtividade;

-- 2. Remover colunas antigas
ALTER TABLE produtividade
    DROP COLUMN IF EXISTS vinculo,
    DROP COLUMN IF EXISTS procedimento,
    DROP COLUMN IF EXISTS parecer_solicitado,
    DROP COLUMN IF EXISTS parecer_realizado,
    DROP COLUMN IF EXISTS cirurgia_realizada,
    DROP COLUMN IF EXISTS urgencia,
    DROP COLUMN IF EXISTS ambulatorio,
    DROP COLUMN IF EXISTS auxiliar,
    DROP COLUMN IF EXISTS folha_objetivo_diario,
    DROP COLUMN IF EXISTS evolucao_diurna_cti,
    DROP COLUMN IF EXISTS evolucao_noturna_cti,
    DROP COLUMN IF EXISTS qtd_documentos_pep,
    DROP COLUMN IF EXISTS origem,
    DROP COLUMN IF EXISTS unidade_hospitalar_id;

-- 3. Adicionar nm_unidade e as 9 novas colunas de produtividade
ALTER TABLE produtividade
    ADD COLUMN IF NOT EXISTS nm_unidade          TEXT,
    ADD COLUMN IF NOT EXISTS prescricao          INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS diagnostico         INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS encaminhamento      INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS parecer             INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS anotacao            INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS avaliacao           INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS documento_eletronico INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS evolucao            INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS alta_medica         INTEGER NOT NULL DEFAULT 0;

-- 4. Comentários
COMMENT ON COLUMN produtividade.nm_unidade           IS 'Nome da unidade hospitalar (ex: HUGOL, HRD I)';
COMMENT ON COLUMN produtividade.prescricao           IS 'CD_TIPO_DOCUMENTO 3, 17, 50, 53';
COMMENT ON COLUMN produtividade.diagnostico          IS 'CD_TIPO_DOCUMENTO 4, 25';
COMMENT ON COLUMN produtividade.encaminhamento       IS 'CD_TIPO_DOCUMENTO 11';
COMMENT ON COLUMN produtividade.parecer              IS 'CD_TIPO_DOCUMENTO 21';
COMMENT ON COLUMN produtividade.anotacao             IS 'CD_TIPO_DOCUMENTO 27';
COMMENT ON COLUMN produtividade.avaliacao            IS 'CD_TIPO_DOCUMENTO 30, 63';
COMMENT ON COLUMN produtividade.documento_eletronico IS 'CD_TIPO_DOCUMENTO 31';
COMMENT ON COLUMN produtividade.evolucao             IS 'CD_TIPO_DOCUMENTO 36';
COMMENT ON COLUMN produtividade.alta_medica          IS 'CD_TIPO_DOCUMENTO 51';

-- 5. Índices
DROP INDEX IF EXISTS idx_produtividade_codigo_mv;
DROP INDEX IF EXISTS idx_produtividade_nome;
DROP INDEX IF EXISTS idx_produtividade_especialidade;
DROP INDEX IF EXISTS idx_produtividade_created_at;
DROP INDEX IF EXISTS idx_produtividade_data;

CREATE INDEX idx_produtividade_codigo_mv   ON produtividade (codigo_mv);
CREATE INDEX idx_produtividade_data        ON produtividade (data);
CREATE INDEX idx_produtividade_nm_unidade  ON produtividade (nm_unidade);
CREATE UNIQUE INDEX idx_produtividade_upsert
    ON produtividade (codigo_mv, data, nm_unidade);

-- 6. Atualizar trigger de updated_at (recria para garantir)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_produtividade_updated_at ON produtividade;
CREATE TRIGGER update_produtividade_updated_at
    BEFORE UPDATE ON produtividade
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. Atualizar políticas RLS
DROP POLICY IF EXISTS "Usuários autenticados podem visualizar produtividade" ON produtividade;
DROP POLICY IF EXISTS "Apenas administradores podem inserir produtividade"   ON produtividade;
DROP POLICY IF EXISTS "Apenas administradores podem atualizar produtividade" ON produtividade;
DROP POLICY IF EXISTS "Apenas administradores podem excluir produtividade"   ON produtividade;

CREATE POLICY "Usuários autenticados podem visualizar produtividade"
    ON produtividade FOR SELECT TO authenticated USING (true);

CREATE POLICY "Apenas administradores podem inserir produtividade"
    ON produtividade FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.tipo IN ('administrador-agir', 'administrador-terceiro')
        )
    );

CREATE POLICY "Apenas administradores podem atualizar produtividade"
    ON produtividade FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.tipo IN ('administrador-agir', 'administrador-terceiro')
        )
    );

CREATE POLICY "Apenas administradores podem excluir produtividade"
    ON produtividade FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.tipo IN ('administrador-agir', 'administrador-terceiro')
        )
    );

-- 8. Verificar estrutura final
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'produtividade'
ORDER BY ordinal_position;

COMMIT;
