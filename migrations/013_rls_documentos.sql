-- Migration 013: RLS para documentos de contrato e chunks

-- Habilitar RLS
ALTER TABLE documentos_contrato ENABLE ROW LEVEL SECURITY;
ALTER TABLE documento_chunks ENABLE ROW LEVEL SECURITY;

-- =============================================
-- POLITICAS PARA documentos_contrato
-- =============================================

-- Corporativo: ve todos os documentos
CREATE POLICY "corporativo_ver_todos_documentos" ON documentos_contrato
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.tipo = 'administrador-agir-corporativo'
    )
  );

-- Planta: ve documentos de contratos da sua unidade
CREATE POLICY "planta_ver_documentos_unidade" ON documentos_contrato
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      JOIN contratos c ON c.id = documentos_contrato.contrato_id
      WHERE u.id = auth.uid()
        AND u.tipo = 'administrador-agir-planta'
        AND c.unidade_hospitalar_id = u.unidade_hospitalar_id
    )
  );

-- Admin-terceiro: ve documentos dos seus contratos
CREATE POLICY "admin_terceiro_ver_documentos_contrato" ON documentos_contrato
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      JOIN usuario_contrato uc ON uc.usuario_id = u.id
      WHERE u.id = auth.uid()
        AND u.tipo = 'administrador-terceiro'
        AND uc.contrato_id = documentos_contrato.contrato_id
    )
  );

-- Terceiro: SEM acesso a documentos (podem conter valores)
-- Nenhuma politica criada para tipo 'terceiro'

-- INSERT: apenas admins corporativo e planta podem enviar documentos
CREATE POLICY "admin_inserir_documentos" ON documentos_contrato
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.tipo IN ('administrador-agir-corporativo', 'administrador-agir-planta')
    )
  );

-- UPDATE: apenas admins corporativo e planta
CREATE POLICY "admin_atualizar_documentos" ON documentos_contrato
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.tipo IN ('administrador-agir-corporativo', 'administrador-agir-planta')
    )
  );

-- DELETE: apenas admin corporativo
CREATE POLICY "corporativo_excluir_documentos" ON documentos_contrato
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.tipo = 'administrador-agir-corporativo'
    )
  );

-- =============================================
-- POLITICAS PARA documento_chunks
-- =============================================

-- Corporativo: ve todos os chunks
CREATE POLICY "corporativo_ver_todos_chunks" ON documento_chunks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.tipo = 'administrador-agir-corporativo'
    )
  );

-- Planta: ve chunks de contratos da sua unidade
CREATE POLICY "planta_ver_chunks_unidade" ON documento_chunks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.tipo = 'administrador-agir-planta'
        AND usuarios.unidade_hospitalar_id = documento_chunks.unidade_hospitalar_id
    )
  );

-- Admin-terceiro: ve chunks dos seus contratos
CREATE POLICY "admin_terceiro_ver_chunks_contrato" ON documento_chunks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      JOIN usuario_contrato uc ON uc.usuario_id = u.id
      WHERE u.id = auth.uid()
        AND u.tipo = 'administrador-terceiro'
        AND uc.contrato_id = documento_chunks.contrato_id
    )
  );

-- INSERT/UPDATE/DELETE de chunks: apenas via service_role (Edge Functions)
-- Nenhuma politica INSERT/UPDATE/DELETE para usuarios normais
