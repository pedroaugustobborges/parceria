/**
 * Dashboard Hooks Index
 *
 * Re-exports all dashboard hooks.
 */

export { useDashboard } from './useDashboard';
export type { UseDashboardReturn } from './useDashboard';

export { useDashboardFilters } from './useDashboardFilters';
export type { UseDashboardFiltersParams } from './useDashboardFilters';

export { useDashboardModals } from './useDashboardModals';
export type {
  UseDashboardModalsReturn,
  InconsistenciaModalState,
  PontualidadeModalState,
  AbsenteismoModalState,
  DiferencaHorasModalState,
  HorasEscaladasModalState,
  HorasUnidadeModalState,
} from './useDashboardModals';

export { useHoursCalculation } from './useHoursCalculation';
export type { CalculateHoursParams, CalculateHoursResult } from './useHoursCalculation';
