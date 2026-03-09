/**
 * useEscalas Hook
 *
 * Main data hook for escalas management.
 * Handles data fetching, CRUD operations, and state management.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { startOfWeek } from 'date-fns';
import { useAuth } from '../../../contexts/AuthContext';
import { usePersistentState, usePersistentArray } from '../../../hooks/usePersistentState';
import { recalcularStatusEscalas } from '../../../services/statusAnalysisService';
import * as escalasService from '../services/escalasService';
import { applyFilters, useEscalaFilters, UseEscalaFiltersProps } from './useEscalaFilters';
import { calculateScorecardMetrics } from '../utils/escalasHoursUtils';
import type {
  EscalaMedica,
  Contrato,
  Usuario,
  UnidadeHospitalar,
  ItemContrato,
  ContratoItem,
  StatusEscala,
  ScorecardMetrics,
  ViewMode,
  AuxiliaryData,
  CsvPreviewRow,
  CsvValidationResult,
} from '../types/escalas.types';

// ============================================
// Hook Return Type
// ============================================

export interface UseEscalasReturn {
  // Data
  escalas: EscalaMedica[];
  escalasFiltradas: EscalaMedica[];
  auxiliaryData: AuxiliaryData;
  metrics: ScorecardMetrics;

  // View state
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  currentWeekStart: Date;
  setCurrentWeekStart: (date: Date | ((prev: Date) => Date)) => void;

  // Loading states
  loading: boolean;
  loadingUsuarios: boolean;
  recalculando: boolean;

  // Messages
  error: string;
  success: string;
  setError: (error: string) => void;
  setSuccess: (success: string) => void;

  // Filter hook return
  filters: ReturnType<typeof useEscalaFilters>;

  // Data actions
  buscarEscalas: () => Promise<void>;
  loadUsuariosByContrato: (contratoId: string) => Promise<void>;
  loadItensContrato: (contratoId: string) => Promise<void>;

  // CRUD actions
  deleteEscala: (escala: EscalaMedica) => Promise<void>;
  updateEscalaStatus: (
    escalaId: number | string,
    status: StatusEscala,
    justificativa: string
  ) => Promise<void>;
  bulkUpdateStatus: (status: StatusEscala, justificativa: string) => Promise<number>;
  recalcularStatus: () => Promise<void>;

  // Details dialog
  loadEscalaDetails: (escala: EscalaMedica) => Promise<{
    usuarioAlterouStatus: Usuario | null;
    acessosMedico: any[];
    produtividadeMedico: any | null;
  }>;

  // CSV Import
  validateCsvFile: (file: File, contratoId: string) => Promise<CsvValidationResult>;
  importCsvData: (
    previewData: CsvPreviewRow[],
    contratoId: string,
    itemContratoId: string
  ) => Promise<void>;

  // Bulk selection
  selectedEscalas: Set<string>;
  setSelectedEscalas: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectAll: () => void;
  deselectAll: () => void;
  toggleSelection: (escalaId: string) => void;
}

// ============================================
// Hook Implementation
// ============================================

export function useEscalas(): UseEscalasReturn {
  const { isAdminTerceiro, isTerceiro, userProfile, userContratoIds, isAdminAgirCorporativo, isAdminAgirPlanta } = useAuth();

  // ============================================
  // Data State
  // ============================================

  const [escalas, setEscalas] = useState<EscalaMedica[]>([]);
  const [escalasFiltradas, setEscalasFiltradas] = useState<EscalaMedica[]>([]);

  // Auxiliary data (persisted)
  const [contratos, setContratos] = usePersistentArray<Contrato>('escalas_contratos');
  const [usuarios, setUsuarios] = usePersistentArray<Usuario>('escalas_usuarios');
  const [unidades, setUnidades] = usePersistentArray<UnidadeHospitalar>('escalas_unidades');
  const [itensContrato, setItensContrato] = usePersistentArray<ItemContrato>(
    'escalas_itensContrato'
  );
  const [todosItensContrato, setTodosItensContrato] = usePersistentArray<ItemContrato>(
    'escalas_todosItensContrato'
  );
  const [contratoItens, setContratoItens] = usePersistentArray<ContratoItem>(
    'escalas_contratoItens'
  );

  // ============================================
  // Loading & Message State
  // ============================================

  const [loading, setLoading] = useState(false);
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);
  const [recalculando, setRecalculando] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ============================================
  // View State
  // ============================================

  const [viewMode, setViewMode] = usePersistentState<ViewMode>('escalas_viewMode', 'calendar');
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 0 })
  );

  // ============================================
  // Bulk Selection State
  // ============================================

  const [selectedEscalas, setSelectedEscalas] = useState<Set<string>>(new Set());

  // ============================================
  // Filters Hook
  // ============================================

  const filterProps: UseEscalaFiltersProps = {
    escalas,
    contratos,
    unidades,
    todosItensContrato,
    contratoItens,
  };

  const filters = useEscalaFilters(filterProps);

  // ============================================
  // Apply Filters Effect
  // ============================================

  useEffect(() => {
    const filtered = applyFilters({
      escalas,
      filtroContrato: filters.filtroContrato,
      filtroItemContrato: filters.filtroItemContrato,
      filtroUnidade: filters.filtroUnidade,
      filtroNome: filters.filtroNome,
      filtroCpf: filters.filtroCpf,
      filtroStatus: filters.filtroStatus,
      contratos,
      unidades,
    });
    setEscalasFiltradas(filtered);

    // Sync selection with filtered results - remove any selected items no longer visible
    const filteredIds = new Set(filtered.map((e) => e.id));
    setSelectedEscalas((prevSelected) => {
      const newSelected = new Set<string>();
      for (const id of prevSelected) {
        if (filteredIds.has(id)) {
          newSelected.add(id);
        }
      }
      // Only update if there's a change to avoid unnecessary re-renders
      if (newSelected.size !== prevSelected.size) {
        return newSelected;
      }
      return prevSelected;
    });
  }, [
    escalas,
    filters.filtroContrato,
    filters.filtroItemContrato,
    filters.filtroUnidade,
    filters.filtroNome,
    filters.filtroCpf,
    filters.filtroStatus,
    contratos,
    unidades,
  ]);

  // ============================================
  // Metrics Calculation
  // ============================================

  const metrics = useMemo<ScorecardMetrics>(() => {
    return calculateScorecardMetrics(escalasFiltradas, contratoItens);
  }, [escalasFiltradas, contratoItens]);

  // ============================================
  // Load Auxiliary Data
  // ============================================

  const loadAuxiliaryData = useCallback(async () => {
    try {
      const data = await escalasService.loadAuxiliaryData(userContratoIds, isAdminTerceiro);
      setContratos(data.contratos);
      setUnidades(data.unidades);
      setTodosItensContrato(data.todosItensContrato);
      setContratoItens(data.contratoItens);
    } catch (err: any) {
      console.error('Erro ao carregar dados auxiliares:', err);
    }
  }, [
    userContratoIds,
    isAdminTerceiro,
    setContratos,
    setUnidades,
    setTodosItensContrato,
    setContratoItens,
  ]);

  // Load on mount
  useEffect(() => {
    loadAuxiliaryData();
  }, [loadAuxiliaryData]);

  // Auto-reload escalas if filters are saved and search was previously performed
  useEffect(() => {
    if (
      filters.buscaRealizada &&
      filters.filtroDataInicio &&
      filters.filtroDataFim &&
      escalas.length === 0
    ) {
      console.log('🔄 Auto-reloading escalas data from saved filters...');
      buscarEscalas();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================
  // Fetch Escalas
  // ============================================

  const buscarEscalas = useCallback(async () => {
    if (!filters.filtroDataInicio || !filters.filtroDataFim) {
      setError(
        'Por favor, selecione uma data de início e uma data de fim para buscar as escalas.'
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

      const data = await escalasService.fetchEscalas({
        dataInicio: filters.filtroDataInicio,
        dataFim: filters.filtroDataFim,
        userContratoIds,
        userCpf: userProfile?.cpf,
        isAdminTerceiro,
        isTerceiro,
        isAdminAgirCorporativo,
        isAdminAgirPlanta,
      });

      setEscalas(data);
      filters.setBuscaRealizada(true);

      // Sync calendar view to start of the search period
      if (filters.filtroDataInicio) {
        setCurrentWeekStart(startOfWeek(filters.filtroDataInicio, { weekStartsOn: 0 }));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [
    filters.filtroDataInicio,
    filters.filtroDataFim,
    userContratoIds,
    userProfile?.cpf,
    isAdminTerceiro,
    isTerceiro,
    isAdminAgirCorporativo,
    isAdminAgirPlanta,
    filters.setBuscaRealizada,
  ]);

  // ============================================
  // Load Users by Contract
  // ============================================

  const loadUsuariosByContrato = useCallback(
    async (contratoId: string) => {
      setLoadingUsuarios(true);
      try {
        const data = await escalasService.loadUsuariosByContrato(contratoId);
        setUsuarios(data);
      } catch (err: any) {
        console.error('Erro ao carregar usuários:', err);
        setError('Erro ao carregar médicos');
        setUsuarios([]);
      } finally {
        setLoadingUsuarios(false);
      }
    },
    [setUsuarios]
  );

  // ============================================
  // Load Items by Contract
  // ============================================

  const loadItensContrato = useCallback(
    async (contratoId: string) => {
      try {
        const data = await escalasService.loadItensContrato(contratoId);
        setItensContrato(data);
      } catch (err: any) {
        console.error('Erro ao carregar itens:', err);
        setItensContrato([]);
      }
    },
    [setItensContrato]
  );

  // ============================================
  // Delete Escala
  // ============================================

  const deleteEscala = useCallback(
    async (escala: EscalaMedica) => {
      try {
        await escalasService.deleteEscala(escala.id);
        setSuccess('Escala excluída com sucesso!');
        await buscarEscalas();
      } catch (err: any) {
        setError(err.message);
      }
    },
    [buscarEscalas]
  );

  // ============================================
  // Update Status
  // ============================================

  const updateEscalaStatus = useCallback(
    async (escalaId: number | string, status: StatusEscala, justificativa: string) => {
      try {
        await escalasService.updateEscalaStatus({
          id: String(escalaId),
          status,
          justificativa: justificativa.trim() || null,
          userId: userProfile?.id || null,
        });
      } catch (err: any) {
        throw err;
      }
    },
    [userProfile?.id]
  );

  // ============================================
  // Bulk Update Status
  // ============================================

  const bulkUpdateStatus = useCallback(
    async (status: StatusEscala, justificativa: string) => {
      try {
        setLoading(true);
        const ids = Array.from(selectedEscalas);
        const count = await escalasService.bulkUpdateStatus(
          ids,
          status,
          justificativa.trim() || null,
          userProfile?.id || null
        );
        setSelectedEscalas(new Set());
        return count;
      } catch (err: any) {
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [userProfile?.id, selectedEscalas]
  );

  // ============================================
  // Recalculate Status
  // ============================================

  const recalcularStatus = useCallback(async () => {
    try {
      setRecalculando(true);
      setError('');
      setSuccess('');

      const resultado = await recalcularStatusEscalas();

      if (resultado.success) {
        setSuccess(resultado.mensagem);
        await buscarEscalas();
      } else {
        setError(resultado.mensagem);
      }
    } catch (err: any) {
      setError(`Erro ao recalcular status: ${err.message}`);
    } finally {
      setRecalculando(false);
    }
  }, [buscarEscalas]);

  // ============================================
  // Bulk Selection
  // ============================================

  const selectAll = useCallback(() => {
    // Only select escalas that can have status changed (not Aprovado, Reprovado, or Excluída)
    const selectableEscalas = escalasFiltradas.filter(
      (e) => e.status !== 'Aprovado' && e.status !== 'Reprovado' && e.status !== 'Excluída'
    );
    setSelectedEscalas(new Set(selectableEscalas.map((e) => e.id)));
  }, [escalasFiltradas]);

  const deselectAll = useCallback(() => {
    setSelectedEscalas(new Set());
  }, []);

  const toggleSelection = useCallback((escalaId: string) => {
    setSelectedEscalas((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(escalaId)) {
        newSet.delete(escalaId);
      } else {
        newSet.add(escalaId);
      }
      return newSet;
    });
  }, []);

  // ============================================
  // Load Escala Details
  // ============================================

  const loadEscalaDetails = useCallback(
    async (escala: EscalaMedica) => {
      let usuarioAlterouStatus: Usuario | null = null;
      let acessosMedico: any[] = [];
      let produtividadeMedico: any | null = null;

      try {
        // Load user who changed status
        if (escala.status_alterado_por) {
          usuarioAlterouStatus = await escalasService.loadUsuarioById(escala.status_alterado_por);
        }

        // Load access logs and productivity for first doctor
        if (escala.medicos.length > 0) {
          const primeiroMedico = escala.medicos[0];

          // Check if shift crosses midnight
          const atravessaMeiaNoite = escala.horario_saida < escala.horario_entrada;

          acessosMedico = await escalasService.loadAcessosMedico(
            primeiroMedico.cpf,
            escala.data_inicio,
            atravessaMeiaNoite
          );
          produtividadeMedico = await escalasService.loadProdutividadeMedico(
            escala.data_inicio,
            primeiroMedico.nome
          );
        }
      } catch (err) {
        console.error('Error loading escala details:', err);
      }

      return {
        usuarioAlterouStatus,
        acessosMedico,
        produtividadeMedico,
      };
    },
    []
  );

  // ============================================
  // CSV Import
  // ============================================

  const validateCsvFile = useCallback(
    async (file: File, contratoId: string): Promise<CsvValidationResult> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const Papa = (await import('papaparse')).default;
            const text = e.target?.result as string;
            const result = Papa.parse(text, { header: true, skipEmptyLines: true });

            if (result.errors.length > 0) {
              resolve({
                isValid: false,
                errors: result.errors.map((err) => `Linha ${err.row}: ${err.message}`),
                previewData: [],
              });
              return;
            }

            const rows = result.data as any[];
            const errors: string[] = [];
            const previewData: CsvPreviewRow[] = [];

            // Load users for this contract to validate CPFs
            const usuariosContrato = await escalasService.loadUsuariosByContrato(contratoId);
            const cpfMap = new Map(usuariosContrato.map((u) => [u.cpf.replace(/\D/g, ''), u]));

            for (let i = 0; i < rows.length; i++) {
              const row = rows[i];
              const rowNum = i + 2; // Account for header row

              // Validate required fields
              if (!row.cpf) {
                errors.push(`Linha ${rowNum}: CPF é obrigatório`);
                continue;
              }
              if (!row.data_inicio) {
                errors.push(`Linha ${rowNum}: data_inicio é obrigatório`);
                continue;
              }
              if (!row.horario_entrada) {
                errors.push(`Linha ${rowNum}: horario_entrada é obrigatório`);
                continue;
              }
              if (!row.horario_saida) {
                errors.push(`Linha ${rowNum}: horario_saida é obrigatório`);
                continue;
              }

              // Validate CPF exists in contract
              const cpfLimpo = String(row.cpf).replace(/\D/g, '');
              const usuario = cpfMap.get(cpfLimpo);
              if (!usuario) {
                errors.push(`Linha ${rowNum}: CPF ${row.cpf} não encontrado no contrato`);
                continue;
              }

              // Validate date format
              const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
              if (!dateRegex.test(row.data_inicio)) {
                errors.push(`Linha ${rowNum}: data_inicio deve estar no formato YYYY-MM-DD`);
                continue;
              }

              // Validate time format
              const timeRegex = /^\d{2}:\d{2}(:\d{2})?$/;
              if (!timeRegex.test(row.horario_entrada)) {
                errors.push(`Linha ${rowNum}: horario_entrada deve estar no formato HH:MM`);
                continue;
              }
              if (!timeRegex.test(row.horario_saida)) {
                errors.push(`Linha ${rowNum}: horario_saida deve estar no formato HH:MM`);
                continue;
              }

              previewData.push({
                cpf: cpfLimpo,
                nome: usuario.nome,
                data_inicio: row.data_inicio,
                horario_entrada: row.horario_entrada.substring(0, 5),
                horario_saida: row.horario_saida.substring(0, 5),
              });
            }

            resolve({
              isValid: errors.length === 0,
              errors,
              previewData,
            });
          } catch (err: any) {
            reject(err);
          }
        };
        reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
        reader.readAsText(file);
      });
    },
    []
  );

  const importCsvData = useCallback(
    async (previewData: CsvPreviewRow[], contratoId: string, itemContratoId: string) => {
      try {
        setLoading(true);

        // Group by date+time to create escalas
        const escalasToCreate: Array<{
          contrato_id: string;
          item_contrato_id: string;
          data_inicio: string;
          horario_entrada: string;
          horario_saida: string;
          medicos: Array<{ nome: string; cpf: string }>;
          observacoes: string | null;
          status: StatusEscala;
        }> = [];

        // Group rows by date + time
        const grouped = new Map<string, CsvPreviewRow[]>();
        for (const row of previewData) {
          const key = `${row.data_inicio}_${row.horario_entrada}_${row.horario_saida}`;
          if (!grouped.has(key)) {
            grouped.set(key, []);
          }
          grouped.get(key)!.push(row);
        }

        // Create escala for each group
        for (const [key, rows] of grouped) {
          const [data_inicio, horario_entrada, horario_saida] = key.split('_');
          escalasToCreate.push({
            contrato_id: contratoId,
            item_contrato_id: itemContratoId,
            data_inicio,
            horario_entrada: horario_entrada + ':00',
            horario_saida: horario_saida + ':00',
            medicos: rows.map((r) => ({ nome: r.nome, cpf: r.cpf })),
            observacoes: null,
            status: 'Programado',
          });
        }

        await escalasService.createEscalas(escalasToCreate);
      } catch (err: any) {
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // ============================================
  // Auxiliary Data Object
  // ============================================

  const auxiliaryData: AuxiliaryData = useMemo(
    () => ({
      contratos,
      usuarios,
      unidades,
      itensContrato,
      todosItensContrato,
      contratoItens,
    }),
    [contratos, usuarios, unidades, itensContrato, todosItensContrato, contratoItens]
  );

  // ============================================
  // Return
  // ============================================

  return {
    // Data
    escalas,
    escalasFiltradas,
    auxiliaryData,
    metrics,

    // View state
    viewMode,
    setViewMode,
    currentWeekStart,
    setCurrentWeekStart,

    // Loading states
    loading,
    loadingUsuarios,
    recalculando,

    // Messages
    error,
    success,
    setError,
    setSuccess,

    // Filter hook
    filters,

    // Data actions
    buscarEscalas,
    loadUsuariosByContrato,
    loadItensContrato,

    // CRUD actions
    deleteEscala,
    updateEscalaStatus,
    bulkUpdateStatus,
    recalcularStatus,

    // Details dialog
    loadEscalaDetails,

    // CSV Import
    validateCsvFile,
    importCsvData,

    // Bulk selection
    selectedEscalas,
    setSelectedEscalas,
    selectAll,
    deselectAll,
    toggleSelection,
  };
}
