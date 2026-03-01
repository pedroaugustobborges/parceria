/**
 * useEscalaFilters Hook
 *
 * Manages filter state with sessionStorage persistence.
 * Provides computed filter options based on data.
 */

import { useEffect, useMemo, useCallback } from 'react';
import {
  usePersistentState,
  usePersistentArray,
} from '../../../hooks/usePersistentState';
import type {
  StatusEscala,
  EscalaMedica,
  Contrato,
  UnidadeHospitalar,
  ItemContrato,
  ContratoItem,
  FilterOption,
  UseEscalaFiltersReturn,
} from '../types/escalas.types';

// ============================================
// Hook Props
// ============================================

export interface UseEscalaFiltersProps {
  escalas: EscalaMedica[];
  contratos: Contrato[];
  unidades: UnidadeHospitalar[];
  todosItensContrato: ItemContrato[];
  contratoItens: ContratoItem[];
}

// ============================================
// Hook Implementation
// ============================================

export function useEscalaFilters(props: UseEscalaFiltersProps): UseEscalaFiltersReturn {
  const { escalas, contratos, unidades, todosItensContrato, contratoItens } = props;

  // ============================================
  // Filter State (with sessionStorage persistence)
  // ============================================

  const [filtroContrato, setFiltroContrato] = usePersistentArray<string>('escalas_filtroContrato');
  const [filtroItemContrato, setFiltroItemContrato] = usePersistentArray<string>(
    'escalas_filtroItemContrato'
  );
  const [filtroUnidade, setFiltroUnidade] = usePersistentArray<string>('escalas_filtroUnidade');
  const [filtroNome, setFiltroNome] = usePersistentArray<string>('escalas_filtroNome');
  const [filtroCpf, setFiltroCpf] = usePersistentArray<string>('escalas_filtroCpf');
  const [filtroStatus, setFiltroStatus] = usePersistentArray<StatusEscala>('escalas_filtroStatus');
  const [filtroDataInicio, setFiltroDataInicio] = usePersistentState<Date | null>(
    'escalas_filtroDataInicio',
    null
  );
  const [filtroDataFim, setFiltroDataFim] = usePersistentState<Date | null>(
    'escalas_filtroDataFim',
    null
  );
  const [buscaRealizada, setBuscaRealizada] = usePersistentState<boolean>(
    'escalas_buscaRealizada',
    false
  );

  // ============================================
  // Clear Invalid Item Selections
  // ============================================

  useEffect(() => {
    if (filtroItemContrato.length > 0) {
      const contratoIdsParaFiltrar =
        filtroContrato.length > 0 ? filtroContrato : contratos.map((c) => c.id);

      const itemIdsValidos = contratoItens
        .filter((ci) => contratoIdsParaFiltrar.includes(ci.contrato_id))
        .map((ci) => ci.item_id);

      const itensValidos = filtroItemContrato.filter((itemId) => itemIdsValidos.includes(itemId));

      if (itensValidos.length !== filtroItemContrato.length) {
        setFiltroItemContrato(itensValidos);
      }
    }
  }, [filtroContrato, contratos, contratoItens, filtroItemContrato, setFiltroItemContrato]);

  // ============================================
  // Computed Filter Options
  // ============================================

  const contratosUnicos = useMemo<FilterOption[]>(() => {
    return contratos.map((c) => ({
      id: c.id,
      label: `${c.nome} - ${c.empresa}`,
    }));
  }, [contratos]);

  const itensContratoUnicos = useMemo<FilterOption[]>(() => {
    // If contracts are selected, use those; otherwise use all accessible contracts
    const contratoIdsParaFiltrar =
      filtroContrato.length > 0 ? filtroContrato : contratos.map((c) => c.id);

    // Get item IDs linked to the contracts
    const itemIdsAcessiveis = contratoItens
      .filter((ci) => contratoIdsParaFiltrar.includes(ci.contrato_id))
      .map((ci) => ci.item_id);

    // Filter items to only those linked to the contracts
    return todosItensContrato
      .filter((i) => itemIdsAcessiveis.includes(i.id))
      .map((i) => ({
        id: i.id,
        label: i.nome,
      }));
  }, [filtroContrato, contratos, contratoItens, todosItensContrato]);

  const unidadesUnicas = useMemo<string[]>(() => {
    return unidades.map((u) => u.codigo).sort();
  }, [unidades]);

  // Extract unique names and CPFs from all doctors in escalas
  const nomesUnicos = useMemo<string[]>(() => {
    return Array.from(new Set(escalas.flatMap((e) => e.medicos.map((m) => m.nome)))).sort();
  }, [escalas]);

  const cpfsUnicos = useMemo<string[]>(() => {
    return Array.from(new Set(escalas.flatMap((e) => e.medicos.map((m) => m.cpf)))).sort();
  }, [escalas]);

  // ============================================
  // Clear Filters
  // ============================================

  const clearFilters = useCallback(() => {
    setFiltroContrato([]);
    setFiltroItemContrato([]);
    setFiltroUnidade([]);
    setFiltroNome([]);
    setFiltroCpf([]);
    setFiltroStatus([]);
    setFiltroDataInicio(null);
    setFiltroDataFim(null);
    setBuscaRealizada(false);

    // Clear all escalas-related sessionStorage keys
    const escalasKeys = Object.keys(sessionStorage).filter((k) => k.startsWith('escalas_'));
    escalasKeys.forEach((k) => sessionStorage.removeItem(k));
  }, [
    setFiltroContrato,
    setFiltroItemContrato,
    setFiltroUnidade,
    setFiltroNome,
    setFiltroCpf,
    setFiltroStatus,
    setFiltroDataInicio,
    setFiltroDataFim,
    setBuscaRealizada,
  ]);

  // ============================================
  // Return
  // ============================================

  return {
    // State
    filtroContrato,
    filtroItemContrato,
    filtroUnidade,
    filtroNome,
    filtroCpf,
    filtroStatus,
    filtroDataInicio,
    filtroDataFim,
    buscaRealizada,

    // Setters
    setFiltroContrato,
    setFiltroItemContrato,
    setFiltroUnidade,
    setFiltroNome,
    setFiltroCpf,
    setFiltroStatus,
    setFiltroDataInicio,
    setFiltroDataFim,
    setBuscaRealizada,
    clearFilters,

    // Computed options
    contratosUnicos,
    itensContratoUnicos,
    unidadesUnicas,
    nomesUnicos,
    cpfsUnicos,
  };
}

// ============================================
// Filter Application Logic
// ============================================

export interface ApplyFiltersParams {
  escalas: EscalaMedica[];
  filtroContrato: string[];
  filtroItemContrato: string[];
  filtroUnidade: string[];
  filtroNome: string[];
  filtroCpf: string[];
  filtroStatus: StatusEscala[];
  contratos: Contrato[];
  unidades: UnidadeHospitalar[];
}

/**
 * Apply filters to escalas.
 * Note: Date filtering is done in the Supabase query, not here.
 */
export function applyFilters(params: ApplyFiltersParams): EscalaMedica[] {
  const {
    escalas,
    filtroContrato,
    filtroItemContrato,
    filtroUnidade,
    filtroNome,
    filtroCpf,
    filtroStatus,
    contratos,
    unidades,
  } = params;

  let filtered = [...escalas];

  // Filter by contract
  if (filtroContrato.length > 0) {
    filtered = filtered.filter((escala) => filtroContrato.includes(escala.contrato_id));
  }

  // Filter by contract item
  if (filtroItemContrato.length > 0) {
    filtered = filtered.filter((escala) => filtroItemContrato.includes(escala.item_contrato_id));
  }

  // Filter by hospital unit
  if (filtroUnidade.length > 0) {
    filtered = filtered.filter((escala) => {
      const contrato = contratos.find((c) => c.id === escala.contrato_id);
      if (!contrato || !contrato.unidade_hospitalar_id) return false;
      const unidade = unidades.find((u) => u.id === contrato.unidade_hospitalar_id);
      return unidade && filtroUnidade.includes(unidade.codigo);
    });
  }

  // Filter by doctor name
  if (filtroNome.length > 0) {
    filtered = filtered.filter((escala) => {
      return escala.medicos.some((medico) => filtroNome.includes(medico.nome));
    });
  }

  // Filter by CPF
  if (filtroCpf.length > 0) {
    filtered = filtered.filter((escala) => {
      return escala.medicos.some((medico) => filtroCpf.includes(medico.cpf));
    });
  }

  // Filter by status
  if (filtroStatus.length > 0) {
    filtered = filtered.filter((escala) => filtroStatus.includes(escala.status));
  }

  return filtered;
}
