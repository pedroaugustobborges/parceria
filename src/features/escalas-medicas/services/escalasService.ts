/**
 * Escalas Service
 *
 * Handles all Supabase CRUD operations for escalas_medicas table.
 * Also includes auxiliary data fetching (contratos, usuarios, unidades, etc.)
 */

import { format } from 'date-fns';
import { supabase } from '../../../lib/supabase';
import type {
  EscalaMedica,
  Usuario,
  ItemContrato,
  StatusEscala,
  MedicoEscala,
  CreateEscalaInput,
  AuxiliaryData,
  Acesso,
  Produtividade,
} from '../types/escalas.types';

// ============================================
// Fetch Escalas
// ============================================

export interface FetchEscalasParams {
  dataInicio: Date;
  dataFim: Date;
  userContratoIds?: string[];
  userCpf?: string;
  isAdminTerceiro?: boolean;
  isTerceiro?: boolean;
}

/**
 * Fetch escalas within a date range.
 * Applies role-based filtering automatically.
 */
export async function fetchEscalas(params: FetchEscalasParams): Promise<EscalaMedica[]> {
  const { dataInicio, dataFim, userContratoIds, userCpf, isAdminTerceiro, isTerceiro } = params;

  const dataInicioFormatada = format(dataInicio, 'yyyy-MM-dd');
  const dataFimFormatada = format(dataFim, 'yyyy-MM-dd');

  const { data: escalas, error } = await supabase
    .from('escalas_medicas')
    .select('*')
    .gte('data_inicio', dataInicioFormatada)
    .lte('data_inicio', dataFimFormatada)
    .order('data_inicio', { ascending: true })
    .limit(5000);

  if (error) throw error;

  let filteredEscalas = escalas || [];

  // Apply role-based filtering
  if (isAdminTerceiro && userContratoIds && userContratoIds.length > 0) {
    // Admin-terceiro: only show escalas from linked contracts
    filteredEscalas = filteredEscalas.filter((escala) =>
      userContratoIds.includes(escala.contrato_id)
    );
  } else if (isTerceiro && userCpf) {
    // Terceiro: only show escalas where their CPF is in the doctors list
    filteredEscalas = filteredEscalas.filter((escala) =>
      escala.medicos.some((medico: MedicoEscala) => medico.cpf === userCpf)
    );
  }

  return filteredEscalas;
}

// ============================================
// Create Escalas
// ============================================

/**
 * Create multiple escalas in a single batch.
 */
export async function createEscalas(escalas: CreateEscalaInput[]): Promise<void> {
  const { error } = await supabase
    .from('escalas_medicas')
    .insert(escalas);

  if (error) throw error;
}

/**
 * Create a single escala.
 */
export async function createEscala(escala: CreateEscalaInput): Promise<void> {
  await createEscalas([escala]);
}

// ============================================
// Update Escala
// ============================================

export interface UpdateEscalaParams {
  id: string;
  contrato_id?: string;
  item_contrato_id?: string;
  data_inicio?: string;
  horario_entrada?: string;
  horario_saida?: string;
  medicos?: MedicoEscala[];
  observacoes?: string | null;
  status?: StatusEscala;
}

/**
 * Update an escala.
 */
export async function updateEscala(params: UpdateEscalaParams): Promise<void> {
  const { id, ...updates } = params;

  const { error } = await supabase
    .from('escalas_medicas')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
}

// ============================================
// Update Status
// ============================================

export interface UpdateStatusParams {
  id: string;
  status: StatusEscala;
  justificativa: string | null;
  userId: string | null;
}

/**
 * Update the status of an escala.
 */
export async function updateEscalaStatus(params: UpdateStatusParams): Promise<void> {
  const { id, status, justificativa, userId } = params;

  const { error } = await supabase
    .from('escalas_medicas')
    .update({
      status,
      justificativa,
      status_alterado_por: userId,
      status_alterado_em: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
}

/**
 * Bulk update status for multiple escalas.
 */
export async function bulkUpdateStatus(
  ids: string[],
  status: StatusEscala,
  justificativa: string | null,
  userId: string | null
): Promise<number> {
  const { error } = await supabase
    .from('escalas_medicas')
    .update({
      status,
      justificativa,
      status_alterado_por: userId,
      status_alterado_em: new Date().toISOString(),
    })
    .in('id', ids);

  if (error) throw error;

  return ids.length;
}

// ============================================
// Delete Escala
// ============================================

/**
 * Delete an escala.
 */
export async function deleteEscala(id: string): Promise<void> {
  const { error } = await supabase
    .from('escalas_medicas')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============================================
// Auxiliary Data
// ============================================

/**
 * Load all auxiliary data (contratos, unidades, itens).
 */
export async function loadAuxiliaryData(
  userContratoIds?: string[],
  isAdminTerceiro?: boolean
): Promise<AuxiliaryData> {
  const [
    { data: contratos },
    { data: unidades },
    { data: itens },
    { data: contratoItens },
  ] = await Promise.all([
    supabase.from('contratos').select('*').eq('ativo', true),
    supabase
      .from('unidades_hospitalares')
      .select('*')
      .eq('ativo', true)
      .order('codigo'),
    supabase.from('itens_contrato').select('*').eq('ativo', true),
    supabase.from('contrato_itens').select('*'),
  ]);

  // Filter contracts for admin-terceiro
  let filteredContratos = contratos || [];
  if (isAdminTerceiro && userContratoIds && userContratoIds.length > 0) {
    filteredContratos = filteredContratos.filter((contrato) =>
      userContratoIds.includes(contrato.id)
    );
  }

  return {
    contratos: filteredContratos,
    usuarios: [], // Loaded separately per contract
    unidades: unidades || [],
    itensContrato: [], // Loaded separately per contract
    todosItensContrato: itens || [],
    contratoItens: contratoItens || [],
  };
}

// ============================================
// Users by Contract
// ============================================

/**
 * Load users linked to a specific contract.
 */
export async function loadUsuariosByContrato(contratoId: string): Promise<Usuario[]> {
  // First, get user IDs from the usuario_contrato linking table
  const { data: usuarioContratos, error: linkError } = await supabase
    .from('usuario_contrato')
    .select('usuario_id')
    .eq('contrato_id', contratoId);

  if (linkError) {
    console.error('Erro ao buscar vínculos usuario_contrato:', linkError);
  }

  const usuarioIdsFromLink = usuarioContratos?.map((uc) => uc.usuario_id) || [];

  let usuariosData: Usuario[] = [];

  // Get users linked via usuario_contrato table
  if (usuarioIdsFromLink.length > 0) {
    const { data: usuariosFromLink, error: usersLinkError } = await supabase
      .from('usuarios')
      .select('*')
      .in('id', usuarioIdsFromLink)
      .eq('tipo', 'terceiro');

    if (usersLinkError) {
      console.error('Erro ao buscar usuários via link:', usersLinkError);
    } else if (usuariosFromLink) {
      usuariosData = [...usuariosFromLink];
    }
  }

  // Also get users directly linked via contrato_id field (legacy support)
  const { data: usuariosDiretos, error: usersDirectError } = await supabase
    .from('usuarios')
    .select('*')
    .eq('contrato_id', contratoId)
    .eq('tipo', 'terceiro');

  if (usersDirectError) {
    console.error('Erro ao buscar usuários diretos:', usersDirectError);
  } else if (usuariosDiretos) {
    // Merge and deduplicate users
    usuariosDiretos.forEach((usuario) => {
      if (!usuariosData.some((u) => u.id === usuario.id)) {
        usuariosData.push(usuario);
      }
    });
  }

  // Sort users by name
  usuariosData.sort((a, b) => a.nome.localeCompare(b.nome));

  return usuariosData;
}

// ============================================
// Items by Contract
// ============================================

/**
 * Load contract items for a specific contract.
 */
export async function loadItensContrato(contratoId: string): Promise<ItemContrato[]> {
  const { data: contratoItens, error } = await supabase
    .from('contrato_itens')
    .select('*, item:itens_contrato(*)')
    .eq('contrato_id', contratoId);

  if (error) {
    console.error('Erro ao carregar itens do contrato:', error);
    return [];
  }

  if (!contratoItens || contratoItens.length === 0) {
    return [];
  }

  return contratoItens.map((ci: any) => ci.item);
}

// ============================================
// Details Dialog Data
// ============================================

/**
 * Load user who changed the status.
 */
export async function loadUsuarioById(userId: string): Promise<Usuario | null> {
  const { data: usuario, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Erro ao carregar usuário:', error);
    return null;
  }

  return usuario;
}

/**
 * Load doctor's access logs for a specific date.
 */
export async function loadAcessosMedico(
  cpf: string,
  dataEscala: string,
  atravessaMeiaNoite: boolean
): Promise<Acesso[]> {
  if (atravessaMeiaNoite) {
    // Fetch accesses for two days
    const diaSeguinte = new Date(dataEscala);
    diaSeguinte.setDate(diaSeguinte.getDate() + 1);
    const diaSeguinteFormatado = format(diaSeguinte, 'yyyy-MM-dd');

    const [{ data: acessosDia1 }, { data: acessosDia2 }] = await Promise.all([
      supabase
        .from('acessos')
        .select('*')
        .eq('cpf', cpf)
        .gte('data_acesso', `${dataEscala}T00:00:00`)
        .lte('data_acesso', `${dataEscala}T23:59:59`)
        .order('data_acesso', { ascending: true }),
      supabase
        .from('acessos')
        .select('*')
        .eq('cpf', cpf)
        .gte('data_acesso', `${diaSeguinteFormatado}T00:00:00`)
        .lte('data_acesso', `${diaSeguinteFormatado}T23:59:59`)
        .order('data_acesso', { ascending: true }),
    ]);

    return [...(acessosDia1 || []), ...(acessosDia2 || [])];
  } else {
    // Fetch accesses for a single day
    const { data: acessos } = await supabase
      .from('acessos')
      .select('*')
      .eq('cpf', cpf)
      .gte('data_acesso', `${dataEscala}T00:00:00`)
      .lte('data_acesso', `${dataEscala}T23:59:59`)
      .order('data_acesso', { ascending: true });

    return acessos || [];
  }
}

/**
 * Load doctor's productivity for a specific date.
 */
export async function loadProdutividadeMedico(
  dataEscala: string,
  nomeMedico: string
): Promise<Produtividade | null> {
  const { data: produtividade } = await supabase
    .from('produtividade')
    .select('*')
    .eq('data', dataEscala)
    .ilike('nome', `%${nomeMedico}%`)
    .maybeSingle();

  return produtividade;
}

// ============================================
// User Lookup by CPF
// ============================================

/**
 * Look up a user by CPF.
 */
export async function findUsuarioByCpf(cpf: string): Promise<Usuario | null> {
  const { data: usuario, error } = await supabase
    .from('usuarios')
    .select('nome, cpf')
    .eq('cpf', cpf)
    .single();

  if (error || !usuario) {
    return null;
  }

  return usuario as Usuario;
}

// ============================================
// Contract Item Value Lookup
// ============================================

/**
 * Get the value for a contract item.
 */
export async function getContratoItemValue(
  contratoId: string,
  itemId: string
): Promise<{ valor_unitario: number | null; quantidade: number } | null> {
  const { data } = await supabase
    .from('contrato_itens')
    .select('valor_unitario, quantidade')
    .eq('contrato_id', contratoId)
    .eq('item_id', itemId)
    .single();

  return data;
}
