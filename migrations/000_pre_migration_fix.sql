-- ============================================================================
-- Pre-Migration Fix: Remove old tipo constraint
-- Description: Remove a constraint antiga de tipo de usuário antes da migração
-- Date: 2025-10-28
-- ============================================================================

-- Drop the old check constraint on usuarios.tipo
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_tipo_check;

-- Create new check constraint with all allowed values
ALTER TABLE usuarios
ADD CONSTRAINT usuarios_tipo_check CHECK (
  tipo IN (
    'administrador-agir-corporativo',
    'administrador-agir-planta',
    'administrador-terceiro',
    'terceiro'
  )
);

-- Verify
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'usuarios_tipo_check';
