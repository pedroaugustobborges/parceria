/**
 * useDashboard Hook
 *
 * Main hook for Dashboard data management.
 */

import { useState, useCallback, useEffect } from 'react';
import { usePersistentArray } from '../../../hooks/usePersistentState';
import { useAuth } from '../../../contexts/AuthContext';
import { normalizeCPF } from '../utils/cpfUtils';
import {
  loadAuxiliaryData as loadAuxiliaryDataService,
  loadAcessos,
  loadProdutividade,
  loadEscalas,
  loadCpfsByContrato,
} from '../services/dashboardService';
import type {
  Acesso,
  HorasCalculadas,
  Contrato,
  ContratoItem,
  Produtividade,
  EscalaMedica,
  Usuario,
  UnidadeHospitalar,
  DashboardFiltersState,
} from '../types/dashboard.types';

export interface UseDashboardReturn {
  // Data
  acessos: Acesso[];
  acessosFiltrados: Acesso[];
  horasCalculadas: HorasCalculadas[];
  contratos: Contrato[];
  contratoItems: ContratoItem[];
  produtividade: Produtividade[];
  escalas: EscalaMedica[];
  usuarios: Usuario[];
  unidades: UnidadeHospitalar[];
  cpfsDoContratoFiltrado: string[];

  // Loading states
  loading: boolean;

  // Messages
  error: string;
  setError: (error: string) => void;

  // Setters
  setAcessos: (acessos: Acesso[]) => void;
  setAcessosFiltrados: (acessos: Acesso[]) => void;
  setHorasCalculadas: (horas: HorasCalculadas[]) => void;
  setCpfsDoContratoFiltrado: (cpfs: string[]) => void;
  setContratos: (contratos: Contrato[]) => void;
  setContratoItems: (items: ContratoItem[]) => void;
  setProdutividade: (prod: Produtividade[]) => void;
  setEscalas: (escalas: EscalaMedica[]) => void;
  setUsuarios: (usuarios: Usuario[]) => void;
  setUnidades: (unidades: UnidadeHospitalar[]) => void;

  // Actions
  loadAuxiliaryData: () => Promise<void>;
  handleBuscarAcessos: (filters: DashboardFiltersState) => Promise<void>;
  fetchCpfsDoContrato: (contrato: Contrato | null) => Promise<void>;
}

export function useDashboard(): UseDashboardReturn {
  const { userProfile, isAdminTerceiro, isTerceiro, userContratoIds } = useAuth();

  // Large data arrays - NOT persisted (too large for sessionStorage)
  const [acessos, setAcessos] = useState<Acesso[]>([]);
  const [acessosFiltrados, setAcessosFiltrados] = useState<Acesso[]>([]);
  const [horasCalculadas, setHorasCalculadas] = useState<HorasCalculadas[]>([]);
  const [cpfsDoContratoFiltrado, setCpfsDoContratoFiltrado] = useState<string[]>([]);

  // Auxiliary data - small reference tables persisted, large search results NOT persisted
  const [contratos, setContratos] = usePersistentArray<Contrato>('dashboard_contratos');
  const [contratoItems, setContratoItems] = usePersistentArray<ContratoItem>(
    'dashboard_contratoItems'
  );
  // produtividade and escalas are large datasets — never persist to sessionStorage
  const [produtividade, setProdutividade] = useState<Produtividade[]>([]);
  const [escalas, setEscalas] = useState<EscalaMedica[]>([]);
  const [usuarios, setUsuarios] = usePersistentArray<Usuario>('dashboard_usuarios');
  const [unidades, setUnidades] = usePersistentArray<UnidadeHospitalar>(
    'dashboard_unidades'
  );

  // Transient state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load auxiliary data (small reference tables only — escalas/produtividade loaded on search)
  const loadAuxiliaryData = useCallback(async () => {
    try {
      const data = await loadAuxiliaryDataService();
      setContratos(data.contratos);
      setContratoItems(data.contratoItems);
      setUsuarios(data.usuarios);
      setUnidades(data.unidades);
    } catch (err) {
      console.error('Erro ao carregar dados auxiliares:', err);
    }
  }, [
    setContratos,
    setContratoItems,
    setUsuarios,
    setUnidades,
  ]);

  // Fetch CPFs from contract
  const fetchCpfsDoContrato = useCallback(
    async (contrato: Contrato | null) => {
      if (!contrato && !isAdminTerceiro) {
        setCpfsDoContratoFiltrado([]);
        return;
      }

      try {
        const cpfs = await loadCpfsByContrato(
          contrato?.id,
          isAdminTerceiro ? userContratoIds : undefined
        );
        setCpfsDoContratoFiltrado(cpfs);

        if (isAdminTerceiro && !contrato) {
          console.log(
            `✅ ${cpfs.length} CPFs carregados automaticamente para administrador-terceiro`
          );
        }
      } catch (err) {
        console.error('Erro ao buscar CPFs do contrato:', err);
        setCpfsDoContratoFiltrado([]);
      }
    },
    [isAdminTerceiro, userContratoIds]
  );

  // Handle search
  const handleBuscarAcessos = useCallback(
    async (filters: DashboardFiltersState) => {
      if (!filters.filtroDataInicio || !filters.filtroDataFim) {
        setError(
          'Por favor, selecione uma data de início e uma data de fim para buscar os acessos.'
        );
        return;
      }

      if (filters.filtroDataInicio > filters.filtroDataFim) {
        setError('A data de início não pode ser maior que a data de fim.');
        return;
      }

      try {
        setLoading(true);
        setError('');

        // Resolve filtroContrato → CPFs (server-side lookup)
        let contratoCpfs: string[] | undefined;
        if (filters.filtroContrato) {
          contratoCpfs = await loadCpfsByContrato(filters.filtroContrato.id);
        }

        // Resolve filtroEspecialidade → CPFs from the already-loaded usuarios state
        let especialidadeCpfs: string[] | undefined;
        if (filters.filtroEspecialidade.length > 0) {
          especialidadeCpfs = usuarios
            .filter((u) =>
              u.especialidade?.some((esp: string) =>
                filters.filtroEspecialidade.includes(esp)
              )
            )
            .map((u) => normalizeCPF(u.cpf))
            .filter(Boolean);
        }

        // Intersect: filtroCpf ∩ contratoCpfs ∩ especialidadeCpfs
        const cpfSets = [
          filters.filtroCpf.length > 0 ? filters.filtroCpf : undefined,
          contratoCpfs,
          especialidadeCpfs,
        ].filter((s): s is string[] => s !== undefined && s.length > 0);

        let effectiveCpfs: string[] | undefined;
        if (cpfSets.length > 0) {
          effectiveCpfs = cpfSets.reduce((a, b) => a.filter((cpf) => b.includes(cpf)));
        }

        // Fetch acessos, produtividade and escalas in parallel (all date-filtered)
        const [acessosData, produtividadeData, escalasData] = await Promise.all([
          loadAcessos({
            dataInicio: filters.filtroDataInicio,
            dataFim: filters.filtroDataFim,
            userCpf: userProfile?.cpf,
            isTerceiro,
            isAdminTerceiro,
            userContratoIds,
            filtroTipo: filters.filtroTipo.length > 0 ? filters.filtroTipo : undefined,
            filtroMatricula: filters.filtroMatricula.length > 0 ? filters.filtroMatricula : undefined,
            filtroNome: filters.filtroNome.length > 0 ? filters.filtroNome : undefined,
            filtroUnidade: filters.filtroUnidade.length > 0 ? filters.filtroUnidade : undefined,
            effectiveCpfs,
          }),
          loadProdutividade(filters.filtroDataInicio, filters.filtroDataFim),
          loadEscalas(filters.filtroDataInicio, filters.filtroDataFim),
        ]);

        setAcessos(acessosData);
        setProdutividade(produtividadeData);
        setEscalas(escalasData);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar acessos';
        setError(errorMessage);
        console.error('Erro:', err);
      } finally {
        setLoading(false);
      }
    },
    [
      usuarios,
      userProfile?.cpf,
      isTerceiro,
      isAdminTerceiro,
      userContratoIds,
      setProdutividade,
    ]
  );

  // Auto-load CPFs for admin-terceiro
  useEffect(() => {
    if (isAdminTerceiro && userContratoIds.length > 0 && cpfsDoContratoFiltrado.length === 0) {
      fetchCpfsDoContrato(null);
    }
  }, [isAdminTerceiro, userContratoIds, cpfsDoContratoFiltrado.length, fetchCpfsDoContrato]);

  return {
    // Data
    acessos,
    acessosFiltrados,
    horasCalculadas,
    contratos,
    contratoItems,
    produtividade,
    escalas,
    usuarios,
    unidades,
    cpfsDoContratoFiltrado,

    // Loading states
    loading,

    // Messages
    error,
    setError,

    // Setters
    setAcessos,
    setAcessosFiltrados,
    setHorasCalculadas,
    setCpfsDoContratoFiltrado,
    setContratos,
    setContratoItems,
    setProdutividade,
    setEscalas,
    setUsuarios,
    setUnidades,

    // Actions
    loadAuxiliaryData,
    handleBuscarAcessos,
    fetchCpfsDoContrato,
  };
}
