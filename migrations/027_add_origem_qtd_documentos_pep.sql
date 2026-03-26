-- Migration: Add origem and qtd_documentos_pep columns to produtividade
-- Description:
--   - origem: Source of the productivity record (between vinculo and procedimento)
--   - qtd_documentos_pep: Number of documents signed in PEP (between evolucao_noturna_cti and created_at)

-- Add origem column
ALTER TABLE produtividade
ADD COLUMN IF NOT EXISTS origem TEXT NULL;

-- Add qtd_documentos_pep column
ALTER TABLE produtividade
ADD COLUMN IF NOT EXISTS qtd_documentos_pep INTEGER NULL DEFAULT 0;

-- Add comments explaining the columns
COMMENT ON COLUMN produtividade.origem IS 'Origem do registro de produtividade (Source of the productivity record)';
COMMENT ON COLUMN produtividade.qtd_documentos_pep IS 'Quantidade de documentos assinados no PEP (Number of documents signed in PEP)';
