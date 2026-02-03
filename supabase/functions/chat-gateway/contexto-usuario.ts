// contexto-usuario.ts - Constroi contexto de tenant para o chat
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface ContextoUsuario {
  usuarioId: string;
  nome: string;
  email: string;
  tipo: string;
  unidadeHospitalarId: string | null;
  contratoIds: string[];
  cpf: string;
  nomeUnidade: string | null;
}

export async function construirContextoUsuario(
  supabase: SupabaseClient,
  usuarioId: string
): Promise<ContextoUsuario> {
  // Buscar perfil do usuario
  const { data: usuario, error: erroUsuario } = await supabase
    .from("usuarios")
    .select("*")
    .eq("id", usuarioId)
    .single();

  if (erroUsuario || !usuario) {
    throw new Error("Usuario nao encontrado");
  }

  // Buscar contrato_ids vinculados
  const { data: vinculos } = await supabase
    .from("usuario_contrato")
    .select("contrato_id")
    .eq("usuario_id", usuarioId);

  const contratoIds = vinculos?.map((v: any) => v.contrato_id) || [];

  // Buscar nome da unidade se aplicavel
  let nomeUnidade: string | null = null;
  if (usuario.unidade_hospitalar_id) {
    const { data: unidade } = await supabase
      .from("unidades_hospitalares")
      .select("nome")
      .eq("id", usuario.unidade_hospitalar_id)
      .single();
    nomeUnidade = unidade?.nome || null;
  }

  return {
    usuarioId: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    tipo: usuario.tipo,
    unidadeHospitalarId: usuario.unidade_hospitalar_id,
    contratoIds,
    cpf: usuario.cpf,
    nomeUnidade,
  };
}

// Gera restricoes SQL obrigatorias baseadas no role do usuario
export function gerarRestricoesTenant(contexto: ContextoUsuario): string {
  switch (contexto.tipo) {
    case "administrador-agir-corporativo":
      return "-- Sem restricao: acesso corporativo total";

    case "administrador-agir-planta":
      return `-- Restricao de planta: apenas dados da unidade
WHERE unidade_hospitalar_id = '${contexto.unidadeHospitalarId}'`;

    case "administrador-terceiro":
      if (contexto.contratoIds.length === 0) {
        return "-- Sem contratos vinculados: nenhum dado acessivel\nWHERE 1=0";
      }
      return `-- Restricao de admin-terceiro: apenas seus contratos
WHERE contrato_id IN (${contexto.contratoIds.map((id) => `'${id}'`).join(", ")})
-- PROIBIDO: colunas valor_unitario, valor_total, custo, preco`;

    case "terceiro":
      return `-- Restricao de terceiro: apenas dados proprios
WHERE cpf = '${contexto.cpf}'
-- PROIBIDO: colunas valor_unitario, valor_total, custo, preco
-- PROIBIDO: acesso a documentos`;

    default:
      return "WHERE 1=0"; // Seguranca: bloquear por padrao
  }
}

// Gera filtro de contrato_ids para busca vetorial RAG
export function obterFiltroContratosRAG(contexto: ContextoUsuario): string[] | null {
  switch (contexto.tipo) {
    case "administrador-agir-corporativo":
      return null; // Sem filtro: acessa todos

    case "administrador-agir-planta":
      // Sera filtrado pela RLS via unidade_hospitalar_id
      return null;

    case "administrador-terceiro":
      return contexto.contratoIds;

    case "terceiro":
      return []; // Terceiro nao tem acesso a documentos

    default:
      return [];
  }
}
