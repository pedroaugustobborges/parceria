-- =======================================================
-- CORREÇÃO DE SEGURANÇA: Habilitar RLS em todas as tabelas
-- ParcerIA - Sistema de Gestão de Acesso Hospitalar
-- Aplicar via psql ou Supabase SQL Editor
-- =======================================================

-- -------------------------------------------------------
-- FUNÇÕES AUXILIARES (SECURITY DEFINER = bypass RLS interno)
-- -------------------------------------------------------

-- Retorna o tipo/role do usuário logado
CREATE OR REPLACE FUNCTION public.get_my_tipo()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT tipo FROM public.usuarios WHERE id = auth.uid();
$$;

-- Retorna a unidade hospitalar do usuário logado
CREATE OR REPLACE FUNCTION public.get_my_unidade_hospitalar_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT unidade_hospitalar_id FROM public.usuarios WHERE id = auth.uid();
$$;

-- Retorna array de contrato_ids vinculados ao usuário logado
CREATE OR REPLACE FUNCTION public.get_my_contrato_ids()
RETURNS uuid[]
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(ARRAY_AGG(contrato_id), '{}') FROM public.usuario_contrato WHERE usuario_id = auth.uid();
$$;

-- Retorna array de usuario_ids que compartilham os contratos do usuário logado
-- Usado para permitir que administrador-terceiro veja os médicos de seus contratos
CREATE OR REPLACE FUNCTION public.get_my_contract_member_ids()
RETURNS uuid[]
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(ARRAY_AGG(DISTINCT usuario_id), '{}')
  FROM public.usuario_contrato
  WHERE contrato_id = ANY(
    SELECT COALESCE(ARRAY_AGG(contrato_id), '{}')
    FROM public.usuario_contrato
    WHERE usuario_id = auth.uid()
  );
$$;

-- -------------------------------------------------------
-- TABLE: usuarios
-- -------------------------------------------------------
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuarios_select" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_update" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_insert" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_delete" ON public.usuarios;

-- Usuário vê seu próprio perfil; admins-agir veem todos; admin-terceiro vê membros dos seus contratos
CREATE POLICY "usuarios_select" ON public.usuarios
FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    id = auth.uid()
    OR get_my_tipo() IN ('administrador-agir-corporativo', 'administrador-agir-planta')
    OR (
      get_my_tipo() = 'administrador-terceiro'
      AND (
        id = ANY(get_my_contract_member_ids())
        OR contrato_id = ANY(get_my_contrato_ids())
      )
    )
  )
);

CREATE POLICY "usuarios_insert" ON public.usuarios
FOR INSERT WITH CHECK (
  get_my_tipo() IN ('administrador-agir-corporativo', 'administrador-agir-planta')
);

CREATE POLICY "usuarios_update" ON public.usuarios
FOR UPDATE USING (
  id = auth.uid()
  OR get_my_tipo() IN ('administrador-agir-corporativo', 'administrador-agir-planta')
);

CREATE POLICY "usuarios_delete" ON public.usuarios
FOR DELETE USING (
  get_my_tipo() = 'administrador-agir-corporativo'
);

-- -------------------------------------------------------
-- TABLE: usuario_contrato
-- -------------------------------------------------------
ALTER TABLE public.usuario_contrato ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuario_contrato_select" ON public.usuario_contrato;
DROP POLICY IF EXISTS "usuario_contrato_write" ON public.usuario_contrato;

CREATE POLICY "usuario_contrato_select" ON public.usuario_contrato
FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    usuario_id = auth.uid()
    OR get_my_tipo() IN ('administrador-agir-corporativo', 'administrador-agir-planta')
    OR (
      get_my_tipo() = 'administrador-terceiro'
      AND contrato_id = ANY(get_my_contrato_ids())
    )
  )
);

CREATE POLICY "usuario_contrato_write" ON public.usuario_contrato
FOR ALL USING (
  get_my_tipo() IN ('administrador-agir-corporativo', 'administrador-agir-planta')
);

-- -------------------------------------------------------
-- TABLE: escalas_medicas
-- -------------------------------------------------------
ALTER TABLE public.escalas_medicas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "escalas_select" ON public.escalas_medicas;
DROP POLICY IF EXISTS "escalas_insert" ON public.escalas_medicas;
DROP POLICY IF EXISTS "escalas_update" ON public.escalas_medicas;
DROP POLICY IF EXISTS "escalas_delete" ON public.escalas_medicas;

CREATE POLICY "escalas_select" ON public.escalas_medicas
FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    get_my_tipo() = 'administrador-agir-corporativo'
    OR (
      get_my_tipo() = 'administrador-agir-planta'
      AND contrato_id IN (
        SELECT id FROM public.contratos
        WHERE unidade_hospitalar_id = get_my_unidade_hospitalar_id()
      )
    )
    OR (
      get_my_tipo() IN ('administrador-terceiro', 'terceiro')
      AND contrato_id = ANY(get_my_contrato_ids())
    )
  )
);

CREATE POLICY "escalas_insert" ON public.escalas_medicas
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
  AND get_my_tipo() IN ('administrador-agir-corporativo', 'administrador-agir-planta', 'administrador-terceiro')
);

CREATE POLICY "escalas_update" ON public.escalas_medicas
FOR UPDATE USING (
  auth.uid() IS NOT NULL
  AND get_my_tipo() IN ('administrador-agir-corporativo', 'administrador-agir-planta', 'administrador-terceiro')
);

CREATE POLICY "escalas_delete" ON public.escalas_medicas
FOR DELETE USING (
  get_my_tipo() IN ('administrador-agir-corporativo', 'administrador-agir-planta')
);

-- -------------------------------------------------------
-- TABLE: contratos
-- -------------------------------------------------------
ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contratos_select" ON public.contratos;
DROP POLICY IF EXISTS "contratos_insert" ON public.contratos;
DROP POLICY IF EXISTS "contratos_update" ON public.contratos;
DROP POLICY IF EXISTS "contratos_delete" ON public.contratos;

CREATE POLICY "contratos_select" ON public.contratos
FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    get_my_tipo() = 'administrador-agir-corporativo'
    OR (
      get_my_tipo() = 'administrador-agir-planta'
      AND unidade_hospitalar_id = get_my_unidade_hospitalar_id()
    )
    OR (
      get_my_tipo() IN ('administrador-terceiro', 'terceiro')
      AND id = ANY(get_my_contrato_ids())
    )
  )
);

CREATE POLICY "contratos_insert" ON public.contratos
FOR INSERT WITH CHECK (get_my_tipo() = 'administrador-agir-corporativo');

CREATE POLICY "contratos_update" ON public.contratos
FOR UPDATE USING (get_my_tipo() = 'administrador-agir-corporativo');

CREATE POLICY "contratos_delete" ON public.contratos
FOR DELETE USING (get_my_tipo() = 'administrador-agir-corporativo');

-- -------------------------------------------------------
-- TABLE: contrato_itens
-- -------------------------------------------------------
ALTER TABLE public.contrato_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contrato_itens_select" ON public.contrato_itens;
DROP POLICY IF EXISTS "contrato_itens_write" ON public.contrato_itens;

CREATE POLICY "contrato_itens_select" ON public.contrato_itens
FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    get_my_tipo() = 'administrador-agir-corporativo'
    OR (
      get_my_tipo() = 'administrador-agir-planta'
      AND contrato_id IN (
        SELECT id FROM public.contratos
        WHERE unidade_hospitalar_id = get_my_unidade_hospitalar_id()
      )
    )
    OR (
      get_my_tipo() IN ('administrador-terceiro', 'terceiro')
      AND contrato_id = ANY(get_my_contrato_ids())
    )
  )
);

CREATE POLICY "contrato_itens_write" ON public.contrato_itens
FOR ALL USING (get_my_tipo() = 'administrador-agir-corporativo');

-- -------------------------------------------------------
-- TABLE: itens_contrato (dado de referência)
-- -------------------------------------------------------
ALTER TABLE public.itens_contrato ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "itens_contrato_select" ON public.itens_contrato;
DROP POLICY IF EXISTS "itens_contrato_write" ON public.itens_contrato;

CREATE POLICY "itens_contrato_select" ON public.itens_contrato
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "itens_contrato_write" ON public.itens_contrato
FOR ALL USING (get_my_tipo() = 'administrador-agir-corporativo');

-- -------------------------------------------------------
-- TABLE: parceiros
-- -------------------------------------------------------
ALTER TABLE public.parceiros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parceiros_select" ON public.parceiros;
DROP POLICY IF EXISTS "parceiros_write" ON public.parceiros;

CREATE POLICY "parceiros_select" ON public.parceiros
FOR SELECT USING (
  auth.uid() IS NOT NULL
  AND get_my_tipo() IN ('administrador-agir-corporativo', 'administrador-agir-planta')
);

CREATE POLICY "parceiros_write" ON public.parceiros
FOR ALL USING (get_my_tipo() = 'administrador-agir-corporativo');

-- -------------------------------------------------------
-- TABLE: acessos (CPF sensível - apenas admins AGIR)
-- -------------------------------------------------------
ALTER TABLE public.acessos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "acessos_select" ON public.acessos;
DROP POLICY IF EXISTS "acessos_insert" ON public.acessos;

CREATE POLICY "acessos_select" ON public.acessos
FOR SELECT USING (
  auth.uid() IS NOT NULL
  AND get_my_tipo() IN ('administrador-agir-corporativo', 'administrador-agir-planta')
);

-- Scripts Python usam service_role (bypass RLS), mas policy de insert existe por segurança
CREATE POLICY "acessos_insert" ON public.acessos
FOR INSERT WITH CHECK (
  get_my_tipo() IN ('administrador-agir-corporativo', 'administrador-agir-planta')
);

-- -------------------------------------------------------
-- TABLE: produtividade
-- -------------------------------------------------------
ALTER TABLE public.produtividade ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "produtividade_select" ON public.produtividade;
DROP POLICY IF EXISTS "produtividade_insert" ON public.produtividade;

CREATE POLICY "produtividade_select" ON public.produtividade
FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    get_my_tipo() = 'administrador-agir-corporativo'
    OR (
      get_my_tipo() = 'administrador-agir-planta'
      AND unidade_hospitalar_id = get_my_unidade_hospitalar_id()
    )
  )
);

-- Scripts Python usam service_role (bypass RLS)
CREATE POLICY "produtividade_insert" ON public.produtividade
FOR INSERT WITH CHECK (
  get_my_tipo() IN ('administrador-agir-corporativo', 'administrador-agir-planta')
);

-- -------------------------------------------------------
-- TABLE: unidades_hospitalares (dado de referência)
-- -------------------------------------------------------
ALTER TABLE public.unidades_hospitalares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "unidades_select" ON public.unidades_hospitalares;
DROP POLICY IF EXISTS "unidades_write" ON public.unidades_hospitalares;

CREATE POLICY "unidades_select" ON public.unidades_hospitalares
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "unidades_write" ON public.unidades_hospitalares
FOR ALL USING (get_my_tipo() = 'administrador-agir-corporativo');

-- -------------------------------------------------------
-- VERIFICAÇÃO FINAL
-- -------------------------------------------------------
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_habilitado
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'usuarios', 'usuario_contrato', 'escalas_medicas', 'contratos',
    'contrato_itens', 'itens_contrato', 'parceiros', 'acessos',
    'produtividade', 'unidades_hospitalares'
  )
ORDER BY tablename;
