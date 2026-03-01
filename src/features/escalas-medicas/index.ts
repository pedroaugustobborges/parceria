/**
 * Escalas Medicas Feature
 *
 * Public API exports for the escalas-medicas feature.
 */

// ============================================
// Types
// ============================================

export * from './types/escalas.types';

// ============================================
// Hooks
// ============================================

export { useEscalas } from './hooks/useEscalas';
export type { UseEscalasReturn } from './hooks/useEscalas';

export { useEscalaFilters, applyFilters } from './hooks/useEscalaFilters';
export type { UseEscalaFiltersProps } from './hooks/useEscalaFilters';

export { useEscalaForm } from './hooks/useEscalaForm';
export type { UseEscalaFormProps, UseEscalaFormReturn } from './hooks/useEscalaForm';

// ============================================
// Services
// ============================================

export * as escalasService from './services/escalasService';
export * as conflictDetectionService from './services/conflictDetectionService';
export * as escalasExportService from './services/escalasExportService';

// ============================================
// Utils
// ============================================

export * from './utils/escalasStatusUtils';
export * from './utils/escalasHoursUtils';
export * from './utils/csvValidationUtils';

// ============================================
// Components
// ============================================

// Reusable
export { StatusChip } from './components/StatusChip';
export type { StatusChipProps } from './components/StatusChip';

// Header
export { EscalasHeader } from './components/header/EscalasHeader';
export type { EscalasHeaderProps } from './components/header/EscalasHeader';

// Filters
export { EscalasFilterBar } from './components/filters/EscalasFilterBar';
export type { EscalasFilterBarProps } from './components/filters/EscalasFilterBar';

// Scorecards
export { EscalasScorecards } from './components/scorecards/EscalasScorecards';
export type { EscalasScorecardsProps } from './components/scorecards/EscalasScorecards';

// Views
export { CalendarView } from './components/views/CalendarView';
export type { CalendarViewProps } from './components/views/CalendarView';

// Bulk Actions
export { BulkActionsBar } from './components/bulk-actions/BulkActionsBar';
export type { BulkActionsBarProps } from './components/bulk-actions/BulkActionsBar';

// Dialogs
export {
  StatusDialog,
  BulkStatusDialog,
  DetailsDialog,
  WizardDialog,
  CsvImportDialog,
  CsvPreviewDialog,
} from './components/dialogs';
export type {
  StatusDialogProps,
  BulkStatusDialogProps,
  DetailsDialogProps,
  WizardDialogProps,
  WizardFormData,
  PreviewData,
  CsvImportDialogProps,
  CsvPreviewDialogProps,
} from './components/dialogs';

// Main Page
export { EscalasMedicasPage } from './components/EscalasMedicasPage';
export { default as EscalasMedicasPageDefault } from './components/EscalasMedicasPage';
