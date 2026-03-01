/**
 * useDashboardFilters Hook
 *
 * Manages filter state for the Dashboard with persistence.
 */

import { useMemo, useCallback } from 'react';
import {
  usePersistentState,
  usePersistentArray,
  useClearDashboardState,
} from '../../../hooks/usePersistentState';
import type {
  Contrato,
  Acesso,
  Usuario,
  DashboardFiltersState,
  UseDashboardFiltersReturn,
} from '../types/dashboard.types';

export interface UseDashboardFiltersParams {
  acessos: Acesso[];
  usuarios: Usuario[];
}

export function useDashboardFilters(
  params: UseDashboardFiltersParams
): UseDashboardFiltersReturn {
  const { acessos, usuarios } = params;

  // Persistent filter state
  const [filtroTipo, setFiltroTipo] = usePersistentArray<string>('dashboard_filtroTipo');
  const [filtroMatricula, setFiltroMatricula] = usePersistentArray<string>(
    'dashboard_filtroMatricula'
  );
  const [filtroNome, setFiltroNome] = usePersistentArray<string>('dashboard_filtroNome');
  const [filtroCpf, setFiltroCpf] = usePersistentArray<string>('dashboard_filtroCpf');
  const [filtroEspecialidade, setFiltroEspecialidade] = usePersistentArray<string>(
    'dashboard_filtroEspecialidade'
  );
  const [filtroContrato, setFiltroContrato] = usePersistentState<Contrato | null>(
    'dashboard_filtroContrato',
    null
  );
  const [filtroUnidade, setFiltroUnidade] = usePersistentArray<string>(
    'dashboard_filtroUnidade'
  );
  const [filtroDataInicio, setFiltroDataInicio] = usePersistentState<Date | null>(
    'dashboard_filtroDataInicio',
    null
  );
  const [filtroDataFim, setFiltroDataFim] = usePersistentState<Date | null>(
    'dashboard_filtroDataFim',
    null
  );
  const [buscaRealizada, setBuscaRealizada] = usePersistentState<boolean>(
    'dashboard_buscaRealizada',
    false
  );

  // Clear all dashboard state
  const clearDashboardState = useClearDashboardState();

  // Clear filters
  const handleClearFilters = useCallback(() => {
    setFiltroTipo([]);
    setFiltroMatricula([]);
    setFiltroNome([]);
    setFiltroCpf([]);
    setFiltroEspecialidade([]);
    setFiltroContrato(null);
    setFiltroUnidade([]);
    setFiltroDataInicio(null);
    setFiltroDataFim(null);
    setBuscaRealizada(false);
    clearDashboardState();
  }, [
    setFiltroTipo,
    setFiltroMatricula,
    setFiltroNome,
    setFiltroCpf,
    setFiltroEspecialidade,
    setFiltroContrato,
    setFiltroUnidade,
    setFiltroDataInicio,
    setFiltroDataFim,
    setBuscaRealizada,
    clearDashboardState,
  ]);

  // Computed unique options from acessos
  const tiposUnicos = useMemo(
    () => [...new Set(acessos.map((a) => a.tipo))].sort(),
    [acessos]
  );

  const matriculasUnicas = useMemo(
    () => [...new Set(acessos.map((a) => a.matricula))].sort(),
    [acessos]
  );

  const nomesUnicos = useMemo(
    () => [...new Set(acessos.map((a) => a.nome))].sort(),
    [acessos]
  );

  const cpfsUnicos = useMemo(
    () => [...new Set(acessos.map((a) => a.cpf))].sort(),
    [acessos]
  );

  const plantasUnicas = useMemo(
    () => [...new Set(acessos.map((a) => a.planta))].filter(Boolean).sort(),
    [acessos]
  );

  const especialidadesUnicas = useMemo(() => {
    const especialidades = new Set<string>();
    usuarios.forEach((u) => {
      if (u.especialidade && Array.isArray(u.especialidade)) {
        u.especialidade.forEach((esp) => {
          if (esp) especialidades.add(esp);
        });
      }
    });
    return [...especialidades].sort();
  }, [usuarios]);

  return {
    // Filter state
    filtroTipo,
    filtroMatricula,
    filtroNome,
    filtroCpf,
    filtroEspecialidade,
    filtroContrato,
    filtroUnidade,
    filtroDataInicio,
    filtroDataFim,
    buscaRealizada,

    // Setters
    setFiltroTipo,
    setFiltroMatricula,
    setFiltroNome,
    setFiltroCpf,
    setFiltroEspecialidade,
    setFiltroContrato,
    setFiltroUnidade,
    setFiltroDataInicio,
    setFiltroDataFim,
    setBuscaRealizada,
    handleClearFilters,

    // Unique options
    tiposUnicos,
    matriculasUnicas,
    nomesUnicos,
    cpfsUnicos,
    plantasUnicas,
    especialidadesUnicas,
  };
}
