/**
 * Dashboard Feature Types
 *
 * Type definitions for the Dashboard feature including
 * state management, calculations, and UI components.
 */

// Re-export base types from database.types.ts
export type {
  Acesso,
  HorasCalculadas,
  Contrato,
  Produtividade,
  Usuario,
  UnidadeHospitalar,
  EscalaMedica,
  ContratoItem,
} from '../../../types/database.types';

import type {
  Acesso,
  HorasCalculadas,
  Contrato,
  Produtividade,
  Usuario,
  UnidadeHospitalar,
  EscalaMedica,
  ContratoItem,
} from '../../../types/database.types';

// ============================================
// Filter State Types
// ============================================

export interface DashboardFiltersState {
  filtroTipo: string[];
  filtroMatricula: string[];
  filtroNome: string[];
  filtroCpf: string[];
  filtroEspecialidade: string[];
  filtroContrato: Contrato | null;
  filtroUnidade: string[];
  filtroDataInicio: Date | null;
  filtroDataFim: Date | null;
  buscaRealizada: boolean;
}

// ============================================
// Modal State Types
// ============================================

export interface DetailsModalState {
  isOpen: boolean;
  selectedPerson: HorasCalculadas | null;
  personAcessos: Acesso[];
}

export interface ProdutividadeModalState {
  isOpen: boolean;
  selectedPerson: HorasCalculadas | null;
  personProdutividade: Produtividade[];
}

export interface ContratoWarningState {
  isOpen: boolean;
  pendingContrato: Contrato | null;
}

export interface InconsistenciaModalState {
  isOpen: boolean;
  data: {
    nome: string;
    tipo: 'prodSemAcesso' | 'acessoSemProd';
    datas: string[];
    detalhes?: Map<string, Produtividade[]>;
  } | null;
}

export interface PontualidadeModalState {
  isOpen: boolean;
  data: {
    nome: string;
    cpf: string;
    atrasos: AtrasoDetail[];
  } | null;
}

export interface AbsenteismoModalState {
  isOpen: boolean;
  data: {
    nome: string;
    cpf: string;
    ausencias: AusenciaDetail[];
  } | null;
}

export interface DiferencaHorasModalState {
  isOpen: boolean;
  data: {
    nome: string;
    cpf: string;
    totalHoras: number;
    cargaHorariaEscalada: number;
    diferenca: number;
    detalhamentoDiario: DiferencaDiariaDetail[];
  } | null;
}

export interface HorasEscaladasModalState {
  isOpen: boolean;
  data: {
    nome: string;
    cpf: string;
    totalHoras: number;
    detalhamento: EscalaDetail[];
  } | null;
}

export interface HorasUnidadeModalState {
  isOpen: boolean;
  data: {
    nome: string;
    cpf: string;
    totalHoras: number;
    detalhamento: UnidadeDetail[];
  } | null;
}

// ============================================
// Detail Types
// ============================================

export interface AtrasoDetail {
  data: string;
  horarioEscalado: string;
  horarioEntrada: string;
  atrasoMinutos: number;
}

export interface AusenciaDetail {
  data: string;
  horarioEscalado: string;
}

export interface DiferencaDiariaDetail {
  data: string;
  horasTrabalhadas: number;
  cargaEscalada: number;
  diferenca: number;
}

export interface EscalaDetail {
  data: string;
  horarioEntrada: string;
  horarioSaida: string;
  horas: number;
  observacoes: string | null;
  status: string;
}

export interface UnidadeDetail {
  data: string;
  primeiraEntrada: string;
  ultimaSaida: string;
  horas: number;
  entradas: number;
  saidas: number;
}

// ============================================
// Calculation Result Types
// ============================================

export interface InconsistenciaItem {
  nome: string;
  count: number;
  datas: string[];
}

export interface InconsistenciasResult {
  prodSemAcesso: InconsistenciaItem[];
  acessoSemProd: InconsistenciaItem[];
}

export interface PontualidadeItem {
  cpf: string;
  nome: string;
  totalEscalas: number;
  atrasos: number;
  detalhesAtrasos: AtrasoDetail[];
  indice: string;
}

export interface AbsenteismoItem {
  cpf: string;
  nome: string;
  totalEscalas: number;
  ausencias: number;
  detalhesAusencias: AusenciaDetail[];
  indice: string;
}

export interface IndicadoresEscalasResult {
  pontualidade: PontualidadeItem[];
  absenteismo: AbsenteismoItem[];
}

// ============================================
// Chart Data Types
// ============================================

export interface ProductivityChartItem {
  name: string;
  value: number;
  color: string;
}

export interface DailyAccessChartItem {
  date: string;
  count: number;
  formattedDate: string;
}

export interface HeatmapDayData {
  dia: string;
  valores: HeatmapHourData[];
}

export interface HeatmapHourData {
  horario: string;
  count: number;
  intensity: number;
}

// ============================================
// Auxiliary Data Types
// ============================================

export interface DashboardAuxiliaryData {
  contratos: Contrato[];
  contratoItems: ContratoItem[];
  produtividade: Produtividade[];
  escalas: EscalaMedica[];
  usuarios: Usuario[];
  unidades: UnidadeHospitalar[];
}

// ============================================
// Statistics Types
// ============================================

export interface DashboardStatistics {
  totalPessoas: number;
  totalHorasGeral: number;
  totalDiasUnicos: number;
  mediaHoras: string;
  totalProdutividade: number;
  produtividadeMedia: string;
  cargaHorariaContratada: number;
  cargaHorariaEscalada: number;
}

// ============================================
// Hook Return Types
// ============================================

export interface UseDashboardReturn {
  // Data
  acessos: Acesso[];
  acessosFiltrados: Acesso[];
  horasCalculadas: HorasCalculadas[];
  auxiliaryData: DashboardAuxiliaryData;
  cpfsDoContratoFiltrado: string[];

  // Loading states
  loading: boolean;

  // Messages
  error: string;
  setError: (error: string) => void;

  // Actions
  setAcessos: (acessos: Acesso[]) => void;
  setAcessosFiltrados: (acessos: Acesso[]) => void;
  setHorasCalculadas: (horas: HorasCalculadas[]) => void;
  setCpfsDoContratoFiltrado: (cpfs: string[]) => void;
  loadAuxiliaryData: () => Promise<void>;
  handleBuscarAcessos: (filters: DashboardFiltersState) => Promise<void>;
}

export interface UseDashboardFiltersReturn extends DashboardFiltersState {
  setFiltroTipo: (value: string[]) => void;
  setFiltroMatricula: (value: string[]) => void;
  setFiltroNome: (value: string[]) => void;
  setFiltroCpf: (value: string[]) => void;
  setFiltroEspecialidade: (value: string[]) => void;
  setFiltroContrato: (value: Contrato | null) => void;
  setFiltroUnidade: (value: string[]) => void;
  setFiltroDataInicio: (value: Date | null) => void;
  setFiltroDataFim: (value: Date | null) => void;
  setBuscaRealizada: (value: boolean) => void;
  handleClearFilters: () => void;

  // Computed unique options
  tiposUnicos: string[];
  matriculasUnicas: string[];
  nomesUnicos: string[];
  cpfsUnicos: string[];
  plantasUnicas: string[];
  especialidadesUnicas: string[];
}
