/**
 * Escalas Medicas Feature Types
 *
 * Re-exports base types from database.types.ts and defines
 * feature-specific types for state management, forms, and UI.
 */

// Re-export base types for convenience
export type {
  EscalaMedica,
  MedicoEscala,
  StatusEscala,
  Contrato,
  Usuario,
  UnidadeHospitalar,
  ItemContrato,
  ContratoItem,
  Acesso,
  Produtividade,
} from '../../../types/database.types';

import type {
  EscalaMedica,
  MedicoEscala,
  StatusEscala,
  Contrato,
  Usuario,
  UnidadeHospitalar,
  ItemContrato,
  ContratoItem,
  Acesso,
  Produtividade,
} from '../../../types/database.types';

// ============================================
// Status Configuration Types
// ============================================

export interface StatusColorConfig {
  hex: string;
  bg: string;
  border: string;
}

export interface StatusConfig {
  color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
  icon: React.ReactNode;
  label: string;
  hex: string;
  bg: string;
}

// ============================================
// Metrics Types
// ============================================

export interface StatusMetric {
  valor: number;
  horas: number;
  count: number;
}

export interface ScorecardMetrics {
  preAgendado: StatusMetric;
  programado: StatusMetric;
  preAprovado: StatusMetric;
  aprovacaoParcial: StatusMetric;
  atencao: StatusMetric;
  aprovado: StatusMetric;
  reprovado: StatusMetric;
  excluida: StatusMetric;
}

export interface ScorecardConfig {
  key: keyof ScorecardMetrics;
  label: string;
  color: string;
  bgColor: string;
  icon: React.ComponentType<{ sx?: object }>;
  metrics: StatusMetric;
}

// ============================================
// Filter State Types
// ============================================

export interface EscalaFiltersState {
  filtroContrato: string[];
  filtroItemContrato: string[];
  filtroUnidade: string[];
  filtroNome: string[];
  filtroCpf: string[];
  filtroStatus: StatusEscala[];
  filtroDataInicio: Date | null;
  filtroDataFim: Date | null;
  buscaRealizada: boolean;
}

export interface FilterOption {
  id: string;
  label: string;
}

// ============================================
// Form State Types
// ============================================

export interface EscalaFormData {
  contrato_id: string;
  item_contrato_id: string;
  data_inicio: Date[];
  horario_entrada: Date | null;
  horario_saida: Date | null;
  medicos_selecionados: Usuario[];
  observacoes: string;
}

export interface EscalaPreviewData {
  contrato: Contrato | null;
  medicos: MedicoEscala[];
}

export interface FormDraft {
  formData: EscalaFormData;
  dialogOpen: boolean;
  activeStep: number;
  timestamp: string;
}

// ============================================
// CSV Import Types
// ============================================

export interface CsvPreviewRow {
  cpf: string;
  nome: string;
  data_inicio: string;
  horario_entrada: string;
  horario_saida: string;
}

/**
 * Extended row with validation status for partial import support
 */
export interface CsvValidatedRow extends CsvPreviewRow {
  lineNumber: number;
  isValid: boolean;
  error?: string;
}

export interface CsvValidationResult {
  isValid: boolean;
  errors: string[];
  previewData: CsvPreviewRow[];
  /** All rows with validation status for partial import */
  validatedRows?: CsvValidatedRow[];
  /** Count of valid rows that can be imported */
  validCount?: number;
  /** Count of invalid rows that will be skipped */
  invalidCount?: number;
}

export interface CsvRawRow {
  cpf?: string;
  data_inicio?: string;
  horario_entrada?: string;
  horario_saida?: string;
  [key: string]: string | undefined;
}

// ============================================
// Conflict Detection Types
// ============================================

export interface ConflictCheckResult {
  hasConflict: boolean;
  conflictDetails?: string;
}

export interface TimeRange {
  start: string;
  end: string;
}

// ============================================
// Dialog State Types
// ============================================

export interface StatusDialogState {
  isOpen: boolean;
  escala: EscalaMedica | null;
  novoStatus: StatusEscala;
  justificativa: string;
}

export interface BulkStatusDialogState {
  isOpen: boolean;
  status: StatusEscala;
  justificativa: string;
}

export interface DetailsDialogState {
  isOpen: boolean;
  escala: EscalaMedica | null;
  usuarioAlterouStatus: Usuario | null;
  acessosMedico: Acesso[];
  produtividadeMedico: Produtividade | null;
  loading: boolean;
}

// ============================================
// Auxiliary Data Types
// ============================================

export interface AuxiliaryData {
  contratos: Contrato[];
  usuarios: Usuario[];
  unidades: UnidadeHospitalar[];
  itensContrato: ItemContrato[];
  todosItensContrato: ItemContrato[];
  contratoItens: ContratoItem[];
}

// ============================================
// View State Types
// ============================================

export type ViewMode = 'card' | 'calendar';

export interface CalendarWeekState {
  currentWeekStart: Date;
  setCurrentWeekStart: (date: Date | ((prev: Date) => Date)) => void;
}

// ============================================
// Create/Update Escala Types
// ============================================

export interface CreateEscalaInput {
  contrato_id: string;
  item_contrato_id: string;
  data_inicio: string;
  horario_entrada: string;
  horario_saida: string;
  medicos: MedicoEscala[];
  observacoes: string | null;
  status: StatusEscala;
}

export interface UpdateEscalaInput extends Partial<CreateEscalaInput> {
  id: string;
}

export interface UpdateStatusInput {
  id: string;
  status: StatusEscala;
  justificativa: string | null;
  status_alterado_por: string | null;
  status_alterado_em: string;
}

// ============================================
// Export Types
// ============================================

export interface ExportContext {
  escalas: EscalaMedica[];
  contratos: Contrato[];
  unidades: UnidadeHospitalar[];
  todosItensContrato: ItemContrato[];
  contratoItens: ContratoItem[];
}

// ============================================
// Hook Return Types
// ============================================

export interface UseEscalasReturn {
  // Data
  escalas: EscalaMedica[];
  escalasFiltradas: EscalaMedica[];
  auxiliaryData: AuxiliaryData;
  metrics: ScorecardMetrics;

  // Loading states
  loading: boolean;
  loadingUsuarios: boolean;
  recalculando: boolean;

  // Messages
  error: string;
  success: string;
  setError: (error: string) => void;
  setSuccess: (success: string) => void;

  // Actions
  buscarEscalas: () => Promise<void>;
  createEscala: (input: CreateEscalaInput) => Promise<void>;
  updateEscala: (input: UpdateEscalaInput) => Promise<void>;
  deleteEscala: (escala: EscalaMedica) => Promise<void>;
  recalcularStatus: () => Promise<void>;
  loadUsuariosByContrato: (contratoId: string) => Promise<void>;
  loadItensContrato: (contratoId: string) => Promise<void>;
}

export interface UseEscalaFiltersReturn extends EscalaFiltersState {
  setFiltroContrato: (value: string[]) => void;
  setFiltroItemContrato: (value: string[]) => void;
  setFiltroUnidade: (value: string[]) => void;
  setFiltroNome: (value: string[]) => void;
  setFiltroCpf: (value: string[]) => void;
  setFiltroStatus: (value: StatusEscala[]) => void;
  setFiltroDataInicio: (value: Date | null) => void;
  setFiltroDataFim: (value: Date | null) => void;
  setBuscaRealizada: (value: boolean) => void;
  clearFilters: () => void;

  // Computed options
  contratosUnicos: FilterOption[];
  itensContratoUnicos: FilterOption[];
  unidadesUnicas: string[];
  nomesUnicos: string[];
  cpfsUnicos: string[];
}

export interface UseEscalaFormReturn {
  // State
  formData: EscalaFormData;
  previewData: EscalaPreviewData;
  activeStep: number;
  editingEscala: EscalaMedica | null;
  dialogOpen: boolean;

  // Actions
  setFormData: React.Dispatch<React.SetStateAction<EscalaFormData>>;
  setActiveStep: (step: number) => void;
  openDialog: (escala?: EscalaMedica) => Promise<void>;
  closeDialog: () => void;
  handleNext: () => boolean;
  handleBack: () => void;
  handleContratoChange: (contrato: Contrato | null) => void;
  preparePreview: () => void;

  // Validation
  validateBasicStep: () => boolean;
}
