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

// Maximum number of escalas to fetch per query
const ESCALAS_QUERY_LIMIT = 10000;

/**
 * Fetch escalas within a date range.
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

  const { data: escalas, error } = await supabase
    .from('escalas_medicas')
    .select('*')
    .gte('data_inicio', dataInicioFormatada)
    .lte('data_inicio', dataFimFormatada)
    .order('data_inicio', { ascending: true })
    .limit(ESCALAS_QUERY_LIMIT);

  if (error) throw error;

  // Check if limit was reached (might have more records)
  const limitReached = (escalas?.length || 0) >= ESCALAS_QUERY_LIMIT;

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
 * Load productivity for all doctors on an escala, aggregated into a single record.
 *
 * Fixes vs. the old version:
 * - Strips time/timezone from data_inicio before comparing (avoids off-by-one day)
 * - Matches by codigo_mv (same as Dashboard) with nome fallback
 * - Queries ALL doctors on the escala, not just the first
 * - Handles overnight shifts by also querying the next day
 *
 * Returns both the aggregated Produtividade and a CPF→codigoMV map for display.
 */
export async function loadProdutividadeMedico(
  dataEscala: string,
  medicos: Array<{ nome: string; cpf: string }>,
  isOvernight: boolean,
): Promise<{ produtividade: Produtividade | null; codigosMV: Record<string, string | null> }> {
  if (medicos.length === 0) return { produtividade: null, codigosMV: {} };

  // 1. Safe date extraction — strip any time or timezone component
  const dateStr = dataEscala.split('T')[0];
  const datesToQuery = isOvernight
    ? [dateStr, format(addDays(parseISO(dateStr), 1), 'yyyy-MM-dd')]
    : [dateStr];

  // 2. Lookup codigo_mv for each doctor by CPF
  const cpfs = medicos.map(m => m.cpf).filter(Boolean);
  const codigosMV: Record<string, string | null> = {};

  if (cpfs.length > 0) {
    const { data: usuarios } = await supabase
      .from('usuarios')
      .select('cpf, codigomv')
      .in('cpf', cpfs);
    (usuarios || []).forEach((u: { cpf: string | null; codigomv: string | null }) => {
      if (u.cpf) codigosMV[u.cpf] = u.codigomv ?? null;
    });
  }

  // 3. Query produtividade — primary: codigo_mv, fallback: nome
  const codigosMVList = Object.values(codigosMV).filter((v): v is string => !!v);
  let produtividadeRecords: Produtividade[] = [];

  if (codigosMVList.length > 0) {
    const { data } = await supabase
      .from('produtividade')
      .select('*')
      .in('data', datesToQuery)
      .in('codigo_mv', codigosMVList);
    produtividadeRecords = (data || []) as Produtividade[];
  }

  if (produtividadeRecords.length === 0) {
    // Fallback: match by name
    const nomes = medicos.map(m => m.nome).filter(Boolean);
    if (nomes.length > 0) {
      const { data } = await supabase
        .from('produtividade')
        .select('*')
        .in('data', datesToQuery)
        .in('nome', nomes);
      produtividadeRecords = (data || []) as Produtividade[];
    }
  }

  if (produtividadeRecords.length === 0) return { produtividade: null, codigosMV };

  // 4. Aggregate all records across all doctors and both days
  const [first, ...rest] = produtividadeRecords;
  const aggregated: Produtividade = rest.reduce(
    (acc, record) => ({
      ...acc,
      prescricao: (acc.prescricao || 0) + (record.prescricao || 0),
      evolucao: (acc.evolucao || 0) + (record.evolucao || 0),
      procedimento: (acc.procedimento || 0) + (record.procedimento || 0),
      urgencia: (acc.urgencia || 0) + (record.urgencia || 0),
      parecer_solicitado: (acc.parecer_solicitado || 0) + (record.parecer_solicitado || 0),
      parecer_realizado: (acc.parecer_realizado || 0) + (record.parecer_realizado || 0),
      ambulatorio: (acc.ambulatorio || 0) + (record.ambulatorio || 0),
      evolucao_noturna_cti: (acc.evolucao_noturna_cti || 0) + (record.evolucao_noturna_cti || 0),
      evolucao_diurna_cti: (acc.evolucao_diurna_cti || 0) + (record.evolucao_diurna_cti || 0),
      cirurgia_realizada: (acc.cirurgia_realizada || 0) + (record.cirurgia_realizada || 0),
      folha_objetivo_diario: (acc.folha_objetivo_diario || 0) + (record.folha_objetivo_diario || 0),
      qtd_documentos_pep: (acc.qtd_documentos_pep || 0) + (record.qtd_documentos_pep || 0),
      auxiliar: (acc.auxiliar || 0) + (record.auxiliar || 0),
      encaminhamento: (acc.encaminhamento || 0) + (record.encaminhamento || 0),
    }),
    { ...first } as Produtividade,
  );

  return { produtividade: aggregated, codigosMV };
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
