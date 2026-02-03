-- Migration 019: Criar bucket de storage para documentos de contratos
-- Executar no SQL Editor do Supabase Dashboard

-- Criar o bucket (sem restricao de mime_type para evitar problemas de compatibilidade)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES (
  'documentos-contratos',
  'documentos-contratos',
  false,
  20971520  -- 20MB em bytes
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 20971520;

-- =============================================
-- POLITICAS DE STORAGE (RLS)
-- =============================================

-- Dropar politicas existentes caso estejam recriando
DROP POLICY IF EXISTS "usuarios_autenticados_baixar_documentos" ON storage.objects;
DROP POLICY IF EXISTS "admins_enviar_documentos" ON storage.objects;
DROP POLICY IF EXISTS "corporativo_excluir_documentos_storage" ON storage.objects;
DROP POLICY IF EXISTS "admins_atualizar_documentos_storage" ON storage.objects;

-- SELECT: usuarios autenticados podem baixar documentos
CREATE POLICY "usuarios_autenticados_baixar_documentos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'documentos-contratos');

-- INSERT: apenas admins corporativo e planta podem enviar documentos
CREATE POLICY "admins_enviar_documentos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documentos-contratos'
    AND EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.tipo IN ('administrador-agir-corporativo', 'administrador-agir-planta')
    )
  );

-- UPDATE: necessario para que o upload com upsert funcione
CREATE POLICY "admins_atualizar_documentos_storage"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'documentos-contratos'
    AND EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.tipo IN ('administrador-agir-corporativo', 'administrador-agir-planta')
    )
  );

-- DELETE: apenas admin corporativo pode excluir documentos do storage
CREATE POLICY "corporativo_excluir_documentos_storage"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documentos-contratos'
    AND EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.tipo = 'administrador-agir-corporativo'
    )
  );
