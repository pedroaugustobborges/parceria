/**
 * Dashboard Service
 *
 * Handles all Supabase CRUD operations for the Dashboard feature.
 */

import { format } from 'date-fns';
import { supabase } from '../../../lib/supabase';
import { normalizeCPFInObject } from '../utils/cpfUtils';
import type {
  Acesso,
  Contrato,
  ContratoItem,
  Produtividade,
  EscalaMedica,
  Usuario,
  UnidadeHospitalar,
  DashboardAuxiliaryData,
} from '../types/dashboard.types';

// ============================================
// Load Contratos
// ============================================

export async function loadContratos(): Promise<Contrato[]> {
  const { data, error } = await supabase
    .from('contratos')
    .select('*')
    .eq('ativo', true)
    .order('nome');

  if (error) {
    console.error('Erro ao carregar contratos:', error);
    throw error;
  }

  return data || [];
}

// ============================================
// Load Contrato Items
// ============================================

export async function loadContratoItems(): Promise<ContratoItem[]> {
  const { data, error } = await supabase.from('contrato_itens').select('*');

  if (error) {
    console.error('Erro ao carregar itens de contrato:', error);
    throw error;
  }

  return data || [];
}

// ============================================
// Load Produtividade
// ============================================

export async function loadProdutividade(
  dataInicio?: Date,
  dataFim?: Date
): Promise<Produtividade[]> {
  console.log('🔄 Carregando dados de produtividade...');

  const pageSize = 1000;
  let allProdutividade: Produtividade[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from('produtividade')
      .select('*')
      .order('data', { ascending: false })
      .range(from, from + pageSize - 1);

    if (dataInicio) {
      const dataInicioFormatada = format(dataInicio, 'yyyy-MM-dd');
      query = query.gte('data', dataInicioFormatada);
    }
    if (dataFim) {
      const dataFimFormatada = format(dataFim, 'yyyy-MM-dd');
      query = query.lte('data', dataFimFormatada);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ Erro ao carregar produtividade:', error);
      throw error;
    }

    if (data && data.length > 0) {
      allProdutividade = [...allProdutividade, ...data];
      from += pageSize;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  console.log(`✅ Produtividade carregada: ${allProdutividade.length} registros`);
  return allProdutividade;
}

// ============================================
// Load Escalas
// ============================================

export async function loadEscalas(): Promise<EscalaMedica[]> {
  const { data, error } = await supabase
    .from('escalas_medicas')
    .select('*')
    .eq('ativo', true)
    .order('data_inicio', { ascending: false });

  if (error) {
    console.error('Erro ao carregar escalas:', error);
    throw error;
  }

  return data || [];
}

// ============================================
// Load Usuarios
// ============================================

export async function loadUsuarios(): Promise<Usuario[]> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('cpf, codigomv, especialidade, nome, contrato_id');

  if (error) {
    console.error('Erro ao carregar usuarios:', error);
    throw error;
  }

  // Normalizar CPFs para garantir formato consistente (11 dígitos)
  const normalizedData = (data || []).map(normalizeCPFInObject);
  console.log(`✅ Usuários carregados e CPFs normalizados: ${normalizedData.length} registros`);

  return normalizedData;
}

// ============================================
// Load Unidades
// ============================================

export async function loadUnidades(): Promise<UnidadeHospitalar[]> {
  const { data, error } = await supabase
    .from('unidades_hospitalares')
    .select('*')
    .eq('ativo', true)
    .order('codigo');

  if (error) {
    console.error('Erro ao carregar unidades:', error);
    throw error;
  }

  return data || [];
}

// ============================================
// Load All Auxiliary Data
// ============================================

export async function loadAuxiliaryData(): Promise<DashboardAuxiliaryData> {
  const [contratos, contratoItems, produtividade, escalas, usuarios, unidades] =
    await Promise.all([
      loadContratos(),
      loadContratoItems(),
      loadProdutividade(),
      loadEscalas(),
      loadUsuarios(),
      loadUnidades(),
    ]);

  return {
    contratos,
    contratoItems,
    produtividade,
    escalas,
    usuarios,
    unidades,
  };
}

// ============================================
// Load Acessos (with filters)
// ============================================

export interface LoadAcessosParams {
  dataInicio: Date;
  dataFim: Date;
  userCpf?: string;
  isTerceiro?: boolean;
  isAdminTerceiro?: boolean;
  userContratoIds?: string[];
}

export async function loadAcessos(params: LoadAcessosParams): Promise<Acesso[]> {
  const { dataInicio, dataFim, userCpf, isTerceiro, isAdminTerceiro, userContratoIds } =
    params;

  const dataInicioFormatada = format(dataInicio, 'yyyy-MM-dd');
  const dataFimFormatada = format(dataFim, 'yyyy-MM-dd');

  const pageSize = 1000;
  let allAcessos: Acesso[] = [];
  let from = 0;
  let hasMore = true;

  // Get CPFs for admin-terceiro filtering
  let cpfsToFilter: string[] | null = null;
  if (isAdminTerceiro && userContratoIds && userContratoIds.length > 0) {
    const { data: usuariosContrato } = await supabase
      .from('usuario_contrato')
      .select('cpf')
      .in('contrato_id', userContratoIds);

    if (usuariosContrato && usuariosContrato.length > 0) {
      cpfsToFilter = [...new Set(usuariosContrato.map((u: { cpf: string }) => u.cpf))];
    }
  }

  while (hasMore) {
    let query = supabase
      .from('acessos')
      .select('*')
      .gte('data_acesso', `${dataInicioFormatada}T00:00:00`)
      .lte('data_acesso', `${dataFimFormatada}T23:59:59`)
      .order('data_acesso', { ascending: false })
      .range(from, from + pageSize - 1);

    // Apply role-based filters
    if (isTerceiro && userCpf) {
      query = query.eq('cpf', userCpf);
    } else if (cpfsToFilter && cpfsToFilter.length > 0) {
      query = query.in('cpf', cpfsToFilter);
    }

    const { data, error } = await query;

    if (error) throw error;

    if (data && data.length > 0) {
      allAcessos = [...allAcessos, ...data];
      from += pageSize;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  // Normalizar CPFs
  const normalizedAcessos = allAcessos.map(normalizeCPFInObject);
  console.log(`✅ Acessos carregados e CPFs normalizados: ${normalizedAcessos.length} registros`);

  return normalizedAcessos;
}

// ============================================
// Load CPFs by Contrato
// ============================================

export async function loadCpfsByContrato(
  contratoId?: string,
  userContratoIds?: string[]
): Promise<string[]> {
  if (!contratoId && (!userContratoIds || userContratoIds.length === 0)) {
    return [];
  }

  let cpfs: string[] = [];

  // Get CPFs from usuario_contrato junction table
  if (contratoId) {
    const { data: usuariosContrato } = await supabase
      .from('usuario_contrato')
      .select('cpf')
      .eq('contrato_id', contratoId);

    if (usuariosContrato && usuariosContrato.length > 0) {
      cpfs = usuariosContrato.map((u: { cpf: string }) => u.cpf);
    }

    // Also get CPFs from usuarios table directly (for CSV-imported users)
    const { data: usuariosDirectos } = await supabase
      .from('usuarios')
      .select('cpf')
      .eq('contrato_id', contratoId);

    if (usuariosDirectos && usuariosDirectos.length > 0) {
      const cpfsDirectos = usuariosDirectos.map((u: { cpf: string }) => u.cpf);
      cpfs = [...new Set([...cpfs, ...cpfsDirectos])];
    }
  } else if (userContratoIds && userContratoIds.length > 0) {
    // Admin-terceiro: get CPFs from all their contracts
    const { data: usuariosContrato } = await supabase
      .from('usuario_contrato')
      .select('cpf')
      .in('contrato_id', userContratoIds);

    if (usuariosContrato && usuariosContrato.length > 0) {
      cpfs = [...new Set(usuariosContrato.map((u: { cpf: string }) => u.cpf))];
    }

    const { data: usuariosDirectos } = await supabase
      .from('usuarios')
      .select('cpf')
      .in('contrato_id', userContratoIds);

    if (usuariosDirectos && usuariosDirectos.length > 0) {
      const cpfsDirectos = usuariosDirectos.map((u: { cpf: string }) => u.cpf);
      cpfs = [...new Set([...cpfs, ...cpfsDirectos])];
    }
  }

  // Normalize CPFs
  const { normalizeCPF } = await import('../utils/cpfUtils');
  return cpfs.map((cpf) => normalizeCPF(cpf));
}

// ============================================
// Load Produtividade for Person
// ============================================

export interface LoadPersonProdutividadeParams {
  codigoMV?: string;
  nome: string;
  dataInicio?: Date;
  dataFim?: Date;
}

export async function loadPersonProdutividade(
  params: LoadPersonProdutividadeParams
): Promise<Produtividade[]> {
  const { codigoMV, nome, dataInicio, dataFim } = params;

  if (!dataInicio || !dataFim) {
    console.warn('⚠️ Filtros de data não definidos para busca de produtividade');
    return [];
  }

  const dataInicioFormatada = format(dataInicio, 'yyyy-MM-dd');
  const dataFimFormatada = format(dataFim, 'yyyy-MM-dd');

  let query = supabase
    .from('produtividade')
    .select('*')
    .gte('data', dataInicioFormatada)
    .lte('data', dataFimFormatada)
    .order('data', { ascending: false });

  // Search by codigo_mv (preferred) or name
  if (codigoMV) {
    query = query.eq('codigo_mv', codigoMV);
  } else {
    query = query.ilike('nome', `%${nome}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('❌ Erro ao buscar produtividade:', error);
    throw error;
  }

  console.log(`✅ Produtividade encontrada: ${data?.length || 0} registros`);
  return data || [];
}
