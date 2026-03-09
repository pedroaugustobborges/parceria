/**
 * Escalas Status Utilities
 *
 * Pure functions for status-related operations:
 * - Status color configurations
 * - Status icons and labels
 * - Permission checks for editing/deleting based on status
 */

import type { StatusEscala, StatusColorConfig } from '../types/escalas.types';

// ============================================
// Status Color Map
// ============================================

/**
 * Color configuration for each status.
 * Used for consistent styling across components.
 */
export const statusColorMap: Record<StatusEscala, StatusColorConfig> = {
  'Pré-Agendado': { hex: '#6366f1', bg: '#eef2ff', border: '#6366f1' },
  'Programado': { hex: '#8b5cf6', bg: '#f5f3ff', border: '#8b5cf6' },
  'Pré-Aprovado': { hex: '#3b82f6', bg: '#eff6ff', border: '#3b82f6' },
  'Aprovação Parcial': { hex: '#06b6d4', bg: '#ecfeff', border: '#06b6d4' },
  'Atenção': { hex: '#f59e0b', bg: '#fffbeb', border: '#f59e0b' },
  'Aprovado': { hex: '#10b981', bg: '#ecfdf5', border: '#10b981' },
  'Reprovado': { hex: '#ef4444', bg: '#fef2f2', border: '#ef4444' },
  'Excluída': { hex: '#64748b', bg: '#f1f5f9', border: '#64748b' },
};

// ============================================
// Status Options
// ============================================

/**
 * All available status values in workflow order.
 */
export const ALL_STATUS_OPTIONS: StatusEscala[] = [
  'Pré-Agendado',
  'Programado',
  'Pré-Aprovado',
  'Aprovação Parcial',
  'Atenção',
  'Aprovado',
  'Reprovado',
  'Excluída',
];

/**
 * Statuses that are considered "finalized" (cannot be changed).
 */
export const FINALIZED_STATUSES: StatusEscala[] = ['Aprovado', 'Reprovado', 'Excluída'];

/**
 * Statuses that Admin-Agir can edit.
 */
export const ADMIN_AGIR_EDITABLE_STATUSES: StatusEscala[] = ['Programado', 'Pré-Agendado'];

/**
 * Statuses that Admin-Terceiro can edit.
 */
export const ADMIN_TERCEIRO_EDITABLE_STATUSES: StatusEscala[] = [
  'Programado',
  'Pré-Agendado',
  'Atenção',
  'Aprovação Parcial',
];

// ============================================
// MUI Chip Color Mapping
// ============================================

type ChipColor = 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';

const statusChipColorMap: Record<StatusEscala, ChipColor> = {
  'Pré-Agendado': 'default',
  'Programado': 'info',
  'Pré-Aprovado': 'primary',
  'Aprovação Parcial': 'info',
  'Atenção': 'warning',
  'Aprovado': 'success',
  'Reprovado': 'error',
  'Excluída': 'default',
};

// ============================================
// Status Configuration
// ============================================

export interface StatusConfigResult {
  color: ChipColor;
  label: string;
  hex: string;
  bg: string;
}

/**
 * Get the configuration for a status (color, label, hex, bg).
 * Does NOT include icon since icons are React components.
 * Icon mapping should be done at the component level.
 */
export function getStatusConfig(status: StatusEscala): StatusConfigResult {
  const colors = statusColorMap[status] || statusColorMap.Programado;

  return {
    color: statusChipColorMap[status] || 'info',
    label: status,
    hex: colors.hex,
    bg: colors.bg,
  };
}

/**
 * Get color configuration for a status.
 */
export function getStatusColors(status: StatusEscala): StatusColorConfig {
  return statusColorMap[status] || statusColorMap.Programado;
}

// ============================================
// Permission Checks
// ============================================

/**
 * Check if a status can be edited by Admin-Agir.
 */
export function canAdminAgirEditStatus(status: StatusEscala): boolean {
  return ADMIN_AGIR_EDITABLE_STATUSES.includes(status);
}

/**
 * Check if a status can be edited by Admin-Terceiro.
 */
export function canAdminTerceiroEditStatus(status: StatusEscala): boolean {
  return ADMIN_TERCEIRO_EDITABLE_STATUSES.includes(status);
}

/**
 * Check if a status can be edited based on user role.
 */
export function canEditStatus(
  status: StatusEscala,
  isAdminAgir: boolean,
  isAdminTerceiro: boolean
): boolean {
  if (isAdminTerceiro) {
    return canAdminTerceiroEditStatus(status);
  }
  if (isAdminAgir) {
    return canAdminAgirEditStatus(status);
  }
  return false;
}

/**
 * Check if a status can be deleted based on user role.
 * Same rules as editing.
 */
export function canDeleteStatus(
  status: StatusEscala,
  isAdminAgir: boolean,
  isAdminTerceiro: boolean
): boolean {
  return canEditStatus(status, isAdminAgir, isAdminTerceiro);
}

/**
 * Check if a status change is allowed (not finalized).
 */
export function canChangeStatus(status: StatusEscala): boolean {
  return !FINALIZED_STATUSES.includes(status);
}

/**
 * Check if a status is finalized (Aprovado or Reprovado).
 */
export function isStatusFinalized(status: StatusEscala): boolean {
  return FINALIZED_STATUSES.includes(status);
}

// ============================================
// Error Messages
// ============================================

/**
 * Get the allowed statuses message for a user role.
 */
export function getAllowedStatusesMessage(isAdminTerceiro: boolean): string {
  if (isAdminTerceiro) {
    return '"Programado", "Pré-Agendado", "Atenção" ou "Aprovação Parcial"';
  }
  return '"Programado" ou "Pré-Agendado"';
}

/**
 * Get error message for cannot edit status.
 */
export function getCannotEditStatusMessage(status: StatusEscala, isAdminTerceiro: boolean): string {
  const allowedStatuses = getAllowedStatusesMessage(isAdminTerceiro);
  return `Não é possível editar uma escala com status "${status}". Apenas escalas com status ${allowedStatuses} podem ser editadas.`;
}

/**
 * Get error message for cannot delete status.
 */
export function getCannotDeleteStatusMessage(status: StatusEscala, isAdminTerceiro: boolean): string {
  const allowedStatuses = getAllowedStatusesMessage(isAdminTerceiro);
  return `Não é possível excluir uma escala com status "${status}". Apenas escalas com status ${allowedStatuses} podem ser excluídas.`;
}

/**
 * Get error message for cannot change finalized status.
 */
export function getCannotChangeStatusMessage(status: StatusEscala): string {
  return `Não é possível alterar o status. A escala já está ${status.toLowerCase()}. Apenas escalas não finalizadas podem ter o status alterado.`;
}

// ============================================
// Initial Status
// ============================================

/**
 * Get the initial status for a new escala based on user role.
 */
export function getInitialStatus(isAdminAgir: boolean): StatusEscala {
  return isAdminAgir ? 'Programado' : 'Pré-Agendado';
}

// ============================================
// Excluída Status Visibility
// ============================================

/**
 * Check if a user can see "Excluída" status.
 * Only admin-agir-corporativo and admin-agir-planta can see excluded escalas.
 */
export function canSeeExcluidaStatus(
  isAdminAgirCorporativo: boolean,
  isAdminAgirPlanta: boolean
): boolean {
  return isAdminAgirCorporativo || isAdminAgirPlanta;
}

/**
 * Check if a status is "Excluída".
 */
export function isStatusExcluida(status: StatusEscala): boolean {
  return status === 'Excluída';
}

/**
 * Get status options filtered by user visibility.
 * "Excluída" is only visible to admin-agir users.
 */
export function getVisibleStatusOptions(
  isAdminAgirCorporativo: boolean,
  isAdminAgirPlanta: boolean
): StatusEscala[] {
  if (canSeeExcluidaStatus(isAdminAgirCorporativo, isAdminAgirPlanta)) {
    return ALL_STATUS_OPTIONS;
  }
  return ALL_STATUS_OPTIONS.filter((status) => status !== 'Excluída');
}
