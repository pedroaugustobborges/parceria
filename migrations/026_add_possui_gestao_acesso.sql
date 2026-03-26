-- Migration: Add possui_gestao_acesso column to unidades_hospitalares
-- Description: Adds a boolean field to indicate if the hospital has facial recognition turnstile access management
-- This determines how schedule status validation is performed:
--   - TRUE: Validate using access records (catracas) AND productivity
--   - FALSE: Validate using only productivity records

-- Add the new column with default value TRUE (assumes existing hospitals have access management)
ALTER TABLE unidades_hospitalares
ADD COLUMN IF NOT EXISTS possui_gestao_acesso BOOLEAN DEFAULT TRUE;

-- Add a comment explaining the column
COMMENT ON COLUMN unidades_hospitalares.possui_gestao_acesso IS
'Indicates if the hospital has access management via facial recognition turnstiles.
TRUE = validate schedules using access records and productivity.
FALSE = validate schedules using only productivity records.';

-- Update existing hospitals to have TRUE as default (they presumably have access management since the system was built for that)
UPDATE unidades_hospitalares
SET possui_gestao_acesso = TRUE
WHERE possui_gestao_acesso IS NULL;
