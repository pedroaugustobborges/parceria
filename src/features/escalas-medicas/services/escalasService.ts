/**
 * Escalas Service
 *
 * Handles all Supabase CRUD operations for escalas_medicas table.
 * Also includes auxiliary data fetching (contratos, usuarios, unidades, etc.)
 */

import { format, addDays, parseISO } from 'date-fns';
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
  isAdminAgirCorporativo?: boolean;
  isAdminAgirPlanta?: boolean;
}

export interface FetchEscalasResult {
  escalas: EscalaMedica[];
  limitReached: boolean;
}

// Hard safety cap — stop paginating beyond this total
const ESCALAS_QUERY_LIMIT = 10000;
// Page size per request — stays within PostgREST's default max-rows (1000)
const PAGE_SIZE = 1000;

/**
 * Fetch escalas within a date range.
 * Paginates in PAGE_SIZE chunks to work around the PostgREST server-side
 * max-rows limit that would otherwise silently truncate large result sets.
 * Applies role-based filtering automatically.
 * Returns an object with escalas array and a flag indicating if the limit was reached.
 */
export async function fetchEscalas(params: FetchEscalasParams): Promise<FetchEscalasResult> {
  const {
    dataInicio,
    dataFim,
    userContratoIds,
    userCpf,
    isAdminTerceiro,
    isTerceiro,
    isAdminAgirCorporativo,
    isAdminAgirPlanta,
  } = params;

  const dataInicioFormatada = format(dataInicio, 'yyyy-MM-dd');
  const dataFimFormatada = format(dataFim, 'yyyy-MM-dd');

  // Paginate to bypass the PostgREST server-side max-rows cap
  let allEscalas: any[] = [];
  let offset = 0;

  while (true) {
    const { data: page, error } = await supabase
      .from('escalas_medicas')
      .select('*')
      .gte('data_inicio', dataInicioFormatada)
      .lte('data_inicio', dataFimFormatada)
      .order('data_inicio', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;

    allEscalas = allEscalas.concat(page || []);

    // Stop when the page is smaller than PAGE_SIZE (no more data) or safety cap reached
    if (!page || page.length < PAGE_SIZE || allEscalas.length >= ESCALAS_QUERY_LIMIT) {
      break;
    }

    offset += PAGE_SIZE;
  }

  // Check if safety limit was reached (might have more records)
  const limitReached = allEscalas.length >= ESCALAS_QUERY_LIMIT;

  let filteredEscalas = allEscalas;

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

  // Filter out "Excluída" status for non-admin-agir users
  const canSeeExcluida = isAdminAgirCorporativo || isAdminAgirPlanta;
  if (!canSeeExcluida) {
    filteredEscalas = filteredEscalas.filter((escala) => escala.status !== 'Excluída');
  }

  return {
    escalas: filteredEscalas,
    limitReached,
  };
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

  console.log('[escalasService.updateEscalaStatus] Single update:', {
    id,
    status,
    justificativa,
    userId,
  });

  const { error, count } = await supabase
    .from('escalas_medicas')
    .update({
      status,
      justificativa,
      status_alterado_por: userId,
      status_alterado_em: new Date().toISOString(),
    })
    .eq('id', id);

  console.log('[escalasService.updateEscalaStatus] Result:', { error, count });

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
  console.log('[escalasService.bulkUpdateStatus] Bulk update:', {
    idsCount: ids.length,
    ids,
    status,
    justificativa,
    userId,
  });

  const { error, count } = await supabase
    .from('escalas_medicas')
    .update({
      status,
      justificativa,
      status_alterado_por: userId,
      status_alterado_em: new Date().toISOString(),
    })
    .in('id', ids);

  console.log('[escalasService.bulkUpdateStatus] Result:', { error, count });

  if (error) throw error;

  return ids.length;
}

// ============================================
// Update Status Pagamento
// ============================================

/**
 * Update the payment status (status_pagamento) of a single escala.
 * Only administrador-corporativo and administrador-planta should call this.
 */
export async function updateStatusPagamento(
  id: string,
  status_pagamento: 'Sim' | 'Não',
  userId: string | null
): Promise<void> {
  const { error } = await supabase
    .from('escalas_medicas')
    .update({
      status_pagamento,
      status_alterado_por: userId,
      status_alterado_em: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
}

/**
 * Bulk update payment status for multiple escalas.
 * Only administrador-corporativo and administrador-planta should call this.
 */
export async function bulkUpdateStatusPagamento(
  ids: string[],
  status_pagamento: 'Sim' | 'Não',
  userId: string | null
): Promise<number> {
  let query = supabase
    .from('escalas_medicas')
    .update({
      status_pagamento,
      status_alterado_por: userId,
      status_alterado_em: new Date().toISOString(),
    })
    .in('id', ids);

  // Only "Aprovado" and "Aprovado com Glosa" escalas can be marked as paid
  if (status_pagamento === 'Sim') {
    query = query.in('status', ['Aprovado', 'Aprovado com Glosa']);
  }

  const { error } = await query;
  if (error) throw error;
  return ids.length;
}

/**
 * Update payment datetime overrides for an 'Aprovado com Glosa' escala.
 * Only administrador-corporativo and administrador-planta should call this.
 */
export async function updateHorariosPagamento(
  id: string,
  horario_pagamento_inicio: string | null,
  horario_pagamento_fim: string | null
): Promise<void> {
  const { error } = await supabase
    .from('escalas_medicas')
    .update({ horario_pagamento_inicio, horario_pagamento_fim })
    .eq('id', id);

  if (error) throw error;
}

/**
 * Update the payment calculation base for an escala.
 * - base_calculo: 'producao' or null (null = default hours-based)
 * - campo_producao: the produtividade column key (e.g. 'ambulatorio')
 * - quantidade_producao: the captured aggregate value at time of setting
 */
export async function updateBaseCalculo(
  id: string,
  base_calculo: string | null,
  campo_producao: string | null,
  quantidade_producao: number | null,
): Promise<void> {
  const { error } = await supabase
    .from('escalas_medicas')
    .update({ base_calculo, campo_producao, quantidade_producao })
    .eq('id', id);

  if (error) throw error;
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
  // Query in chunks of 50 to avoid URL length limits (502 Bad Gateway)
  if (usuarioIdsFromLink.length > 0) {
    const CHUNK_SIZE = 50;
    for (let i = 0; i < usuarioIdsFromLink.length; i += CHUNK_SIZE) {
      const chunk = usuarioIdsFromLink.slice(i, i + CHUNK_SIZE);
      const { data: usuariosFromLink, error: usersLinkError } = await supabase
        .from('usuarios')
        .select('*')
        .in('id', chunk)
        .eq('tipo', 'terceiro');

      if (usersLinkError) {
        console.error('Erro ao buscar usuários via link:', usersLinkError);
      } else if (usuariosFromLink) {
        usuariosData = [...usuariosData, ...usuariosFromLink];
      }
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

  // Mescla a unidade selecionada no contrato (contrato_itens.unidade_medida)
  // com os dados do item. A unidade é normalizada para string[] para manter
  // compatibilidade de tipos, mas conterá apenas a unidade escolhida para este contrato.
  return contratoItens.map((ci: any) => {
    const item = ci.item;
    const unidadeContrato: string | null = ci.unidade_medida;
    const unidadesItem: string[] = Array.isArray(item?.unidade_medida)
      ? item.unidade_medida
      : [item?.unidade_medida].filter(Boolean);
    return {
      ...item,
      // Resolve a unidade efetiva: prioriza a escolha do contrato, fallback ao item
      unidade_medida: unidadeContrato ? [unidadeContrato] : unidadesItem,
    };
  });
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
 * Load doctor's access logs for schedule day, day before, and day after.
 * Always fetches 3 days to give full context of the doctor's access patterns.
 */
export async function loadAcessosMedico(
  cpf: string,
  dataEscala: string,
  _atravessaMeiaNoite?: boolean // Kept for backwards compatibility, no longer used
): Promise<Acesso[]> {
  // Calculate day before and day after
  const dataEscalaDate = new Date(dataEscala + 'T12:00:00'); // Use noon to avoid timezone issues

  const diaAnterior = new Date(dataEscalaDate);
  diaAnterior.setDate(diaAnterior.getDate() - 1);
  const diaAnteriorFormatado = format(diaAnterior, 'yyyy-MM-dd');

  const diaSeguinte = new Date(dataEscalaDate);
  diaSeguinte.setDate(diaSeguinte.getDate() + 1);
  const diaSeguinteFormatado = format(diaSeguinte, 'yyyy-MM-dd');

  // Fetch accesses for all three days in parallel
  const [{ data: acessosDiaAnterior }, { data: acessosDiaEscala }, { data: acessosDiaSeguinte }] =
    await Promise.all([
      // Day before
      supabase
        .from('acessos')
        .select('*')
        .eq('cpf', cpf)
        .gte('data_acesso', `${diaAnteriorFormatado}T00:00:00`)
        .lte('data_acesso', `${diaAnteriorFormatado}T23:59:59`)
        .order('data_acesso', { ascending: true }),
      // Schedule day
      supabase
        .from('acessos')
        .select('*')
        .eq('cpf', cpf)
        .gte('data_acesso', `${dataEscala}T00:00:00`)
        .lte('data_acesso', `${dataEscala}T23:59:59`)
        .order('data_acesso', { ascending: true }),
      // Day after
      supabase
        .from('acessos')
        .select('*')
        .eq('cpf', cpf)
        .gte('data_acesso', `${diaSeguinteFormatado}T00:00:00`)
        .lte('data_acesso', `${diaSeguinteFormatado}T23:59:59`)
        .order('data_acesso', { ascending: true }),
    ]);

  // Combine all accesses, sorted by date
  return [
    ...(acessosDiaAnterior || []),
    ...(acessosDiaEscala || []),
    ...(acessosDiaSeguinte || []),
  ];
}

/**
 * Load productivity for all doctors on an escala.
 *
 * Uses usuario_codigomv table to get (codigomv, nm_unidade) pairs per doctor,
 * ensuring we only return production for the exact units each doctor is registered in.
 * This prevents cross-contamination when the same cd_prestador exists in multiple units.
 *
 * Returns all Produtividade records (one per unit) and a CPF→codigoMV map for display.
 */
export async function loadProdutividadeMedico(
  dataEscala: string,
  medicos: Array<{ nome: string; cpf: string }>,
  isOvernight: boolean,
): Promise<{ produtividade: Produtividade[]; codigosMV: Record<string, string | null> }> {
  if (medicos.length === 0) return { produtividade: [], codigosMV: {} };

  // 1. Safe date extraction — strip any time or timezone component
  const dateStr = dataEscala.split('T')[0];
  const datesToQuery = isOvernight
    ? [dateStr, format(addDays(parseISO(dateStr), 1), 'yyyy-MM-dd')]
    : [dateStr];

  const cpfs = medicos.map(m => m.cpf).filter(Boolean);
  const codigosMV: Record<string, string | null> = {};

  if (cpfs.length === 0) return { produtividade: [], codigosMV: {} };

  // 2. Get user IDs for these CPFs
  const { data: usuariosData } = await supabase
    .from('usuarios')
    .select('id, cpf, codigomv')
    .in('cpf', cpfs);

  const usuarioPorId: Record<string, string> = {}; // id → cpf
  (usuariosData || []).forEach((u: { id: string; cpf: string; codigomv: string | null }) => {
    if (u.cpf) {
      codigosMV[u.cpf] = u.codigomv ?? null; // fallback for display
      usuarioPorId[u.id] = u.cpf;
    }
  });

  const usuarioIds = Object.keys(usuarioPorId);

  // 3. Get (codigomv, nm_unidade) pairs from usuario_codigomv
  type CodigomvRow = { usuario_id: string; codigomv: string; nm_unidade: string };
  let paresAutorizados: Array<{ codigomv: string; nm_unidade: string; cpf: string }> = [];

  if (usuarioIds.length > 0) {
    const { data: codigomvRows } = await supabase
      .from('usuario_codigomv')
      .select('usuario_id, codigomv, nm_unidade')
      .in('usuario_id', usuarioIds);

    paresAutorizados = (codigomvRows || []).map((row: CodigomvRow) => ({
      codigomv: row.codigomv,
      nm_unidade: row.nm_unidade,
      cpf: usuarioPorId[row.usuario_id] ?? '',
    }));

    // Update codigosMV display map with first codigomv per CPF from usuario_codigomv
    paresAutorizados.forEach(({ cpf, codigomv }) => {
      if (cpf && !codigosMV[cpf]) codigosMV[cpf] = codigomv;
      else if (cpf && codigosMV[cpf] === null) codigosMV[cpf] = codigomv;
    });
  }

  const codigosMVList = [...new Set(paresAutorizados.map(p => p.codigomv))].filter(Boolean);
  const nmUnidadesList = [...new Set(paresAutorizados.map(p => p.nm_unidade))].filter(Boolean);
  const paresSet = new Set(paresAutorizados.map(p => `${p.codigomv}|${p.nm_unidade}`));

  let produtividadeRecords: Produtividade[] = [];

  if (codigosMVList.length > 0) {
    const { data } = await supabase
      .from('produtividade')
      .select('*')
      .in('data', datesToQuery)
      .in('codigo_mv', codigosMVList)
      .in('nm_unidade', nmUnidadesList.length > 0 ? nmUnidadesList : ['__none__'])
      .order('nm_unidade', { ascending: true });

    // Filter in-memory: keep only (codigo_mv, nm_unidade) pairs that are authorized
    produtividadeRecords = ((data || []) as Produtividade[]).filter(
      r => paresSet.has(`${r.codigo_mv}|${r.nm_unidade}`)
    );
  }

  if (produtividadeRecords.length === 0) {
    // Fallback: match by name (for doctors not yet in usuario_codigomv)
    const nomes = medicos.map(m => m.nome).filter(Boolean);
    if (nomes.length > 0) {
      const { data } = await supabase
        .from('produtividade')
        .select('*')
        .in('data', datesToQuery)
        .in('nome', nomes)
        .order('nm_unidade', { ascending: true });
      produtividadeRecords = (data || []) as Produtividade[];
    }
  }

  return { produtividade: produtividadeRecords, codigosMV };
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
): Promise<{ valor_unitario: number | null; quantidade: number; unidade_medida: string | null } | null> {
  const { data } = await supabase
    .from('contrato_itens')
    .select('valor_unitario, quantidade, unidade_medida')
    .eq('contrato_id', contratoId)
    .eq('item_id', itemId)
    .single();

  return data;
}
