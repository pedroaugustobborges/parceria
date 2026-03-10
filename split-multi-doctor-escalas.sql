-- ============================================
-- SQL Script to Split Multi-Doctor Escalas
-- Each escala should have exactly ONE doctor
--
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Check how many records will be affected (run this first to see the impact)
SELECT
    COUNT(*) AS escalas_with_multiple_doctors,
    SUM(jsonb_array_length(medicos)) AS total_new_records_after_split
FROM escalas_medicas
WHERE jsonb_array_length(medicos) > 1;

-- Step 2: Create a temporary table with split records
CREATE TEMP TABLE escalas_split AS
SELECT
    gen_random_uuid() AS new_id,
    e.id AS original_id,
    e.contrato_id,
    e.item_contrato_id,
    e.data_inicio,
    e.horario_entrada,
    e.horario_saida,
    jsonb_build_array(medico) AS medicos,
    e.observacoes,
    e.ativo,
    e.status,
    e.justificativa,
    e.status_alterado_por,
    e.status_alterado_em,
    e.created_at,
    e.updated_at,
    e.created_by
FROM escalas_medicas e,
LATERAL jsonb_array_elements(e.medicos) AS medico
WHERE jsonb_array_length(e.medicos) > 1;

-- Step 3: Preview what will be created (optional - to verify before inserting)
SELECT
    original_id,
    data_inicio,
    horario_entrada,
    horario_saida,
    medicos->0->>'nome' AS medico_nome,
    medicos->0->>'cpf' AS medico_cpf,
    status
FROM escalas_split
ORDER BY original_id, medico_nome
LIMIT 50;

-- Step 4: Insert the new split records (keeping original created_at)
INSERT INTO escalas_medicas (
    id,
    contrato_id,
    item_contrato_id,
    data_inicio,
    horario_entrada,
    horario_saida,
    medicos,
    observacoes,
    ativo,
    status,
    justificativa,
    status_alterado_por,
    status_alterado_em,
    created_at,
    updated_at,
    created_by
)
SELECT
    new_id,
    contrato_id,
    item_contrato_id,
    data_inicio,
    horario_entrada,
    horario_saida,
    medicos,
    observacoes,
    ativo,
    status,
    justificativa,
    status_alterado_por,
    status_alterado_em,
    created_at,
    NOW(),
    created_by
FROM escalas_split;

-- Step 5: Delete the original multi-doctor records
DELETE FROM escalas_medicas
WHERE id IN (SELECT DISTINCT original_id FROM escalas_split);

-- Step 6: Verify the fix - should return 0
SELECT COUNT(*) AS multi_doctor_escalas_remaining
FROM escalas_medicas
WHERE jsonb_array_length(medicos) > 1;

-- Clean up
DROP TABLE IF EXISTS escalas_split;

-- ============================================
-- Summary of changes
-- ============================================
-- This script:
-- 1. Finds all escalas with more than one doctor
-- 2. Creates new individual records (one per doctor)
-- 3. Preserves all original data (dates, times, status, etc.)
-- 4. Deletes the original multi-doctor records
-- ============================================
