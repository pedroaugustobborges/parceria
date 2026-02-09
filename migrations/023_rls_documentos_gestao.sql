-- Migration 023: Politicas RLS para Documentos de Gestao
-- Acesso: corporativo (tudo), planta (propria unidade), terceiro/admin-terceiro (nada)

-- =============================================
-- DOCUMENTOS_GESTAO - SELECT
-- =============================================

-- Corporativo: ver todos documentos gestao
CREATE POLICY "corporativo_ver_todos_docs_gestao" ON documentos_gestao
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.tipo = 'administrador-agir-corporativo'
    )
  );

-- Planta: ver documentos gestao APENAS da propria unidade
CREATE POLICY "planta_ver_docs_gestao_propria_unidade" ON documentos_gestao
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.tipo = 'administrador-agir-planta'
        AND usuarios.unidade_hospitalar_id = documentos_gestao.unidade_hospitalar_id
    )
  );

-- NOTA: admin-terceiro e terceiro NAO tem acesso (nenhuma policy)

-- =============================================
-- DOCUMENTOS_GESTAO - INSERT
-- =============================================

-- Corporativo: inserir em qualquer unidade
CREATE POLICY "corporativo_inserir_docs_gestao" ON documentos_gestao
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.tipo = 'administrador-agir-corporativo'
    )
  );

-- Planta: inserir apenas na propria unidade
CREATE POLICY "planta_inserir_docs_gestao_propria_unidade" ON documentos_gestao
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.tipo = 'administrador-agir-planta'
        AND usuarios.unidade_hospitalar_id = documentos_gestao.unidade_hospitalar_id
    )
  );

-- =============================================
-- DOCUMENTOS_GESTAO - UPDATE
-- =============================================

-- Corporativo: atualizar qualquer documento
CREATE POLICY "corporativo_atualizar_docs_gestao" ON documentos_gestao
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.tipo = 'administrador-agir-corporativo'
    )
  );

-- Planta: atualizar apenas da propria unidade
CREATE POLICY "planta_atualizar_docs_gestao_propria_unidade" ON documentos_gestao
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.tipo = 'administrador-agir-planta'
        AND usuarios.unidade_hospitalar_id = documentos_gestao.unidade_hospitalar_id
    )
  );

-- =============================================
-- DOCUMENTOS_GESTAO - DELETE
-- =============================================

-- Apenas corporativo pode deletar
CREATE POLICY "corporativo_deletar_docs_gestao" ON documentos_gestao
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.tipo = 'administrador-agir-corporativo'
    )
  );

-- =============================================
-- DOCUMENTO_GESTAO_CHUNKS - SELECT
-- =============================================

-- Corporativo: ver todos chunks
CREATE POLICY "corporativo_ver_todos_chunks_gestao" ON documento_gestao_chunks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.tipo = 'administrador-agir-corporativo'
    )
  );

-- Planta: ver chunks APENAS da propria unidade
CREATE POLICY "planta_ver_chunks_gestao_propria_unidade" ON documento_gestao_chunks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.tipo = 'administrador-agir-planta'
        AND usuarios.unidade_hospitalar_id = documento_gestao_chunks.unidade_hospitalar_id
    )
  );

-- =============================================
-- DOCUMENTO_GESTAO_CHUNKS - INSERT/UPDATE/DELETE
-- =============================================

-- Apenas service role pode inserir/atualizar/deletar chunks (via Edge Functions)
-- Nao criar policies de INSERT/UPDATE/DELETE para usuarios normais
