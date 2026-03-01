/**
 * Escalas Hours Utilities
 *
 * Pure functions for hours-related calculations:
 * - Parse time strings
 * - Calculate hours for escalas
 * - Calculate metrics by status
 */

import type { EscalaMedica, StatusEscala, ContratoItem, ScorecardMetrics, StatusMetric } from '../types/escalas.types';

// ============================================
// Time Parsing
// ============================================

/**
 * Convert a time string (HH:mm or HH:mm:ss) to minutes since midnight.
 */
export function timeStringToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Parse a time string and return hours and minutes.
 */
export function parseTimeString(time: string): { hours: number; minutes: number } {
  const [hours, minutes] = time.split(':').map(Number);
  return { hours, minutes };
}

/**
 * Format minutes to HH:mm string.
 */
export function minutesToTimeString(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// ============================================
// Hours Calculation
// ============================================

/**
 * Calculate hours for a single escala.
 * Handles shifts that cross midnight.
 */
export function calculateEscalaHours(horarioEntrada: string, horarioSaida: string): number {
  const minutosEntrada = timeStringToMinutes(horarioEntrada);
  const minutosSaida = timeStringToMinutes(horarioSaida);

  let duracaoMinutos: number;

  if (minutosSaida >= minutosEntrada) {
    // Normal case: shift doesn't cross midnight
    duracaoMinutos = minutosSaida - minutosEntrada;
  } else {
    // Shift crosses midnight (e.g., 22:00 - 06:00)
    duracaoMinutos = 1440 - minutosEntrada + minutosSaida;
  }

  return duracaoMinutos / 60;
}

/**
 * Calculate total hours for an escala including all doctors.
 */
export function calculateTotalEscalaHours(escala: EscalaMedica): number {
  const hours = calculateEscalaHours(escala.horario_entrada, escala.horario_saida);
  return hours * escala.medicos.length;
}

/**
 * Check if a shift crosses midnight.
 */
export function shiftCrossesMidnight(horarioEntrada: string, horarioSaida: string): boolean {
  const minutosEntrada = timeStringToMinutes(horarioEntrada);
  const minutosSaida = timeStringToMinutes(horarioSaida);
  return minutosSaida < minutosEntrada;
}

// ============================================
// Metrics Calculation
// ============================================

/**
 * Create an empty status metric.
 */
export function createEmptyMetric(): StatusMetric {
  return { valor: 0, horas: 0, count: 0 };
}

/**
 * Create empty scorecard metrics.
 */
export function createEmptyScorecardMetrics(): ScorecardMetrics {
  return {
    preAgendado: createEmptyMetric(),
    programado: createEmptyMetric(),
    preAprovado: createEmptyMetric(),
    aprovacaoParcial: createEmptyMetric(),
    atencao: createEmptyMetric(),
    aprovado: createEmptyMetric(),
    reprovado: createEmptyMetric(),
  };
}

/**
 * Get the metrics key for a status.
 */
function getMetricsKey(status: StatusEscala): keyof ScorecardMetrics | null {
  const statusKeyMap: Record<StatusEscala, keyof ScorecardMetrics> = {
    'Pré-Agendado': 'preAgendado',
    'Programado': 'programado',
    'Pré-Aprovado': 'preAprovado',
    'Aprovação Parcial': 'aprovacaoParcial',
    'Atenção': 'atencao',
    'Aprovado': 'aprovado',
    'Reprovado': 'reprovado',
  };
  return statusKeyMap[status] || null;
}

/**
 * Calculate scorecard metrics from a list of escalas.
 * Includes valor (based on contract item price), horas, and count.
 */
export function calculateScorecardMetrics(
  escalas: EscalaMedica[],
  contratoItens: ContratoItem[]
): ScorecardMetrics {
  const metrics = createEmptyScorecardMetrics();

  for (const escala of escalas) {
    const key = getMetricsKey(escala.status);
    if (!key) continue;

    // Find the contract item to get the price
    const contratoItem = contratoItens.find(
      (ci) => ci.item_id === escala.item_contrato_id
    );

    // Calculate hours
    const totalHoras = calculateTotalEscalaHours(escala);

    // Calculate value (hours * price * doctors)
    const valor = contratoItem?.valor_unitario
      ? contratoItem.valor_unitario * totalHoras
      : 0;

    // Accumulate metrics
    metrics[key].valor += valor;
    metrics[key].horas += totalHoras;
    metrics[key].count++;
  }

  return metrics;
}

/**
 * Calculate total value for approved escalas (for PDF export).
 */
export function calculateApprovedValue(
  escalas: EscalaMedica[],
  contratoItens: ContratoItem[]
): number {
  let valorTotal = 0;

  for (const escala of escalas) {
    if (escala.status !== 'Aprovado') continue;

    const contratoItem = contratoItens.find(
      (ci) => ci.item_id === escala.item_contrato_id && ci.contrato_id === escala.contrato_id
    );

    if (contratoItem?.valor_unitario) {
      const totalHoras = calculateTotalEscalaHours(escala);
      valorTotal += totalHoras * contratoItem.valor_unitario;
    }
  }

  return valorTotal;
}

// ============================================
// Formatting
// ============================================

/**
 * Format hours as a string (e.g., "12.5h").
 */
export function formatHours(hours: number, decimals: number = 1): string {
  return `${hours.toFixed(decimals)}h`;
}

/**
 * Format currency value in BRL.
 */
export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format time range for display.
 */
export function formatTimeRange(horarioEntrada: string, horarioSaida: string): string {
  return `${horarioEntrada.substring(0, 5)} - ${horarioSaida.substring(0, 5)}`;
}
