/**
 * useDashboard Hook
 *
 * Main hook for Dashboard data management.
 */

import { useState, useCallback, useEffect } from 'react';
import { usePersistentArray } from '../../../hooks/usePersistentState';
import { useAuth } from '../../../contexts/AuthContext';
import {
  loadAuxiliaryData as loadAuxiliaryDataService,
  loadAcessos,
  loadProdutividade,
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

  // Auxiliary data - persisted (smaller, ~100-500KB total)
  const [contratos, setContratos] = usePersistentArray<Contrato>('dashboard_contratos');
  const [contratoItems, setContratoItems] = usePersistentArray<ContratoItem>(
    'dashboard_contratoItems'
  );
  const [produtividade, setProdutividade] = usePersistentArray<Produtividade>(
    'dashboard_produtividade'
  );
  const [escalas, setEscalas] = usePersistentArray<EscalaMedica>('dashboard_escalas');
  const [usuarios, setUsuarios] = usePersistentArray<Usuario>('dashboard_usuarios');
  const [unidades, setUnidades] = usePersistentArray<UnidadeHospitalar>(
    'dashboard_unidades'
  );

  // Transient state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load auxiliary data
  const loadAuxiliaryData = useCallback(async () => {
    try {
      const data = await loadAuxiliaryDataService();
      setContratos(data.contratos);
      setContratoItems(data.contratoItems);
      setProdutividade(data.produtividade);
      setEscalas(data.escalas);
      setUsuarios(data.usuarios);
      setUnidades(data.unidades);
    } catch (err) {
      console.error('Erro ao carregar dados auxiliares:', err);
    }
  }, [
    setContratos,
    setContratoItems,
    setProdutividade,
    setEscalas,
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

        const acessosData = await loadAcessos({
          dataInicio: filters.filtroDataInicio,
          dataFim: filters.filtroDataFim,
          userCpf: userProfile?.cpf,
          isTerceiro,
          isAdminTerceiro,
          userContratoIds,
        });

        setAcessos(acessosData);

        // Load produtividade with same date filters
        const produtividadeData = await loadProdutividade(
          filters.filtroDataInicio,
          filters.filtroDataFim
        );
        setProdutividade(produtividadeData);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar acessos';
        setError(errorMessage);
        console.error('Erro:', err);
      } finally {
        setLoading(false);
      }
    },
    [
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
