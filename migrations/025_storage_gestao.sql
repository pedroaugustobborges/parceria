-- Migration 025: Bucket de Storage para Documentos de Gestao
-- Bucket dedicado com RLS restritivo (apenas AGIR)

-- Criar bucket dedicado para documentos de gestao
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES (
  'documentos-gestao',
  'documentos-gestao',
  false,
  20971520  -- 20MB
) ON CONFLICT (id) DO NOTHING;

-- =============================================
-- POLITICAS DE STORAGE - SELECT (download)
-- =============================================

-- Corporativo: pode baixar qualquer documento
CREATE POLICY "corporativo_download_gestao" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documentos-gestao' AND
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.tipo = 'administrador-agir-corporativo'
    )
  );

-- Planta: pode baixar documentos da propria unidade (path comeca com unidade_id)
CREATE POLICY "planta_download_gestao_propria_unidade" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documentos-gestao' AND
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.tipo = 'administrador-agir-planta'
        AND (storage.foldername(name))[1] = usuarios.unidade_hospitalar_id::text
    )
  );

-- =============================================
-- POLITICAS DE STORAGE - INSERT (upload)
-- =============================================

-- Corporativo: pode fazer upload em qualquer unidade
CREATE POLICY "corporativo_upload_gestao" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documentos-gestao' AND
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.tipo = 'administrador-agir-corporativo'
    )
  );

-- Planta: pode fazer upload apenas na propria unidade
CREATE POLICY "planta_upload_gestao_propria_unidade" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documentos-gestao' AND
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.tipo = 'administrador-agir-planta'
        AND (storage.foldername(name))[1] = usuarios.unidade_hospitalar_id::text
    )
  );

-- =============================================
-- POLITICAS DE STORAGE - DELETE
-- =============================================

-- Apenas corporativo pode deletar
CREATE POLICY "corporativo_delete_gestao" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'documentos-gestao' AND
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.tipo = 'administrador-agir-corporativo'
    )
  );
