-- ============================================
-- Script to find and soft-delete conflicting schedules
-- Run this in Supabase SQL Editor
-- ============================================

-- First, let's see which schedules have conflicts (preview only, no changes)
-- This query finds pairs of conflicting schedules

WITH expanded_schedules AS (
  -- Expand medicos array to get one row per doctor per schedule
  SELECT
    e.id,
    e.data_inicio,
    e.horario_entrada,
    e.horario_saida,
    e.status,
    e.created_at,
    e.contrato_id,
    (medico->>'cpf') AS cpf,
    (medico->>'nome') AS nome
  FROM escalas_medicas e,
       jsonb_array_elements(e.medicos) AS medico
  WHERE e.status != 'Excluída'
),
conflicts AS (
  -- Find pairs where same doctor has overlapping times on same date
  SELECT
    a.id AS schedule_a_id,
    b.id AS schedule_b_id,
    a.cpf,
    a.nome,
    a.data_inicio,
    a.horario_entrada AS entrada_a,
    a.horario_saida AS saida_a,
    b.horario_entrada AS entrada_b,
    b.horario_saida AS saida_b,
    a.created_at AS created_a,
    b.created_at AS created_b,
    a.contrato_id
  FROM expanded_schedules a
  JOIN expanded_schedules b ON
    a.cpf = b.cpf
    AND a.data_inicio = b.data_inicio
    AND a.id < b.id  -- Avoid duplicates and self-joins
    -- Check time overlap (considering midnight crossing)
    AND (
      -- Both shifts don't cross midnight
      (
        a.horario_entrada < a.horario_saida
        AND b.horario_entrada < b.horario_saida
        AND a.horario_entrada < b.horario_saida
        AND a.horario_saida > b.horario_entrada
      )
      -- Shift A crosses midnight
      OR (
        a.horario_entrada > a.horario_saida
        AND (
          b.horario_entrada >= a.horario_entrada
          OR b.horario_saida <= a.horario_saida
          OR b.horario_entrada < a.horario_saida
        )
      )
      -- Shift B crosses midnight
      OR (
        b.horario_entrada > b.horario_saida
        AND (
          a.horario_entrada >= b.horario_entrada
          OR a.horario_saida <= b.horario_saida
          OR a.horario_entrada < b.horario_saida
        )
      )
      -- Both cross midnight (always overlap)
      OR (
        a.horario_entrada > a.horario_saida
        AND b.horario_entrada > b.horario_saida
      )
    )
)
-- Preview: Show all conflicts found
SELECT
  schedule_a_id,
  schedule_b_id,
  nome,
  cpf,
  data_inicio,
  entrada_a || ' - ' || saida_a AS horario_a,
  entrada_b || ' - ' || saida_b AS horario_b,
  created_a,
  created_b,
  CASE WHEN created_a > created_b THEN schedule_a_id ELSE schedule_b_id END AS to_delete_id
FROM conflicts
ORDER BY data_inicio DESC, nome;


-- ============================================
-- STEP 2: Soft-delete the conflicting schedules (keep the older one)
-- UNCOMMENT AND RUN THIS AFTER REVIEWING THE PREVIEW ABOVE
-- ============================================

/*
WITH expanded_schedules AS (
  SELECT
    e.id,
    e.data_inicio,
    e.horario_entrada,
    e.horario_saida,
    e.status,
    e.created_at,
    (medico->>'cpf') AS cpf
  FROM escalas_medicas e,
       jsonb_array_elements(e.medicos) AS medico
  WHERE e.status != 'Excluída'
),
conflicts AS (
  SELECT
    a.id AS schedule_a_id,
    b.id AS schedule_b_id,
    a.created_at AS created_a,
    b.created_at AS created_b
  FROM expanded_schedules a
  JOIN expanded_schedules b ON
    a.cpf = b.cpf
    AND a.data_inicio = b.data_inicio
    AND a.id < b.id
    AND (
      (
        a.horario_entrada < a.horario_saida
        AND b.horario_entrada < b.horario_saida
        AND a.horario_entrada < b.horario_saida
        AND a.horario_saida > b.horario_entrada
      )
      OR (
        a.horario_entrada > a.horario_saida
        AND (
          b.horario_entrada >= a.horario_entrada
          OR b.horario_saida <= a.horario_saida
          OR b.horario_entrada < a.horario_saida
        )
      )
      OR (
        b.horario_entrada > b.horario_saida
        AND (
          a.horario_entrada >= b.horario_entrada
          OR a.horario_saida <= b.horario_saida
          OR a.horario_entrada < b.horario_saida
        )
      )
      OR (
        a.horario_entrada > a.horario_saida
        AND b.horario_entrada > b.horario_saida
      )
    )
),
ids_to_delete AS (
  -- Select the newer schedule from each conflict pair
  SELECT DISTINCT
    CASE WHEN created_a > created_b THEN schedule_a_id ELSE schedule_b_id END AS id
  FROM conflicts
)
UPDATE escalas_medicas
SET
  status = 'Excluída',
  justificativa = 'Excluído automaticamente: conflito de horário detectado com outra escala existente',
  status_alterado_em = NOW(),
  updated_at = NOW()
WHERE id IN (SELECT id FROM ids_to_delete);
*/


-- ============================================
-- STEP 3: Verify the cleanup (run after step 2)
-- This should return 0 rows if all conflicts were resolved
-- ============================================

/*
WITH expanded_schedules AS (
  SELECT
    e.id,
    e.data_inicio,
    e.horario_entrada,
    e.horario_saida,
    e.status,
    (medico->>'cpf') AS cpf,
    (medico->>'nome') AS nome
  FROM escalas_medicas e,
       jsonb_array_elements(e.medicos) AS medico
  WHERE e.status != 'Excluída'
)
SELECT
  a.id AS schedule_a_id,
  b.id AS schedule_b_id,
  a.nome,
  a.cpf,
  a.data_inicio
FROM expanded_schedules a
JOIN expanded_schedules b ON
  a.cpf = b.cpf
  AND a.data_inicio = b.data_inicio
  AND a.id < b.id
  AND (
    (
      a.horario_entrada < a.horario_saida
      AND b.horario_entrada < b.horario_saida
      AND a.horario_entrada < b.horario_saida
      AND a.horario_saida > b.horario_entrada
    )
    OR (a.horario_entrada > a.horario_saida)
    OR (b.horario_entrada > b.horario_saida)
  );
*/
