/**
 * Conflict Detection Service
 *
 * Handles time overlap detection and scheduling conflict checks.
 * These are pure functions that can be tested independently.
 */

import { format, parseISO } from 'date-fns';
import { supabase } from '../../../lib/supabase';
import type { ConflictCheckResult, MedicoEscala } from '../types/escalas.types';
import { timeStringToMinutes } from '../utils/escalasHoursUtils';

// ============================================
// Time Overlap Detection
// ============================================

/**
 * Check if two time ranges overlap.
 * Handles shifts that cross midnight correctly.
 *
 * @param start1 - Start time of range 1 (HH:mm or HH:mm:ss)
 * @param end1 - End time of range 1
 * @param start2 - Start time of range 2
 * @param end2 - End time of range 2
 * @returns true if there is an overlap
 */
export function checkTimeOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  const start1Min = timeStringToMinutes(start1);
  const end1Min = timeStringToMinutes(end1);
  const start2Min = timeStringToMinutes(start2);
  const end2Min = timeStringToMinutes(end2);

  // Adjust for shifts that cross midnight
  const end1Adjusted = end1Min < start1Min ? end1Min + 1440 : end1Min;
  const end2Adjusted = end2Min < start2Min ? end2Min + 1440 : end2Min;

  // If shift 2 crosses midnight, check two scenarios
  if (end2Min < start2Min) {
    // Scenario 1: Compare with the part of shift 2 until midnight
    const overlap1 =
      start1Min < 1440 &&
      start2Min < 1440 &&
      start1Min < 1440 &&
      end1Adjusted > start2Min;

    // Scenario 2: Compare with the part of shift 2 after midnight (0 to end2Min)
    const overlap2 =
      start1Min < end2Min ||
      end1Min < end2Min ||
      (start1Min === 0 && end1Min > 0);

    if (overlap1 || overlap2) return true;
  }

  // If shift 1 crosses midnight, check two scenarios
  if (end1Min < start1Min) {
    // Scenario 1: Compare with the part of shift 1 until midnight
    const overlap1 =
      start2Min < 1440 &&
      start1Min < 1440 &&
      start2Min < 1440 &&
      end2Adjusted > start1Min;

    // Scenario 2: Compare with the part of shift 1 after midnight (0 to end1Min)
    const overlap2 =
      start2Min < end1Min ||
      end2Min < end1Min ||
      (start2Min === 0 && end2Min > 0);

    if (overlap1 || overlap2) return true;
  }

  // Default case: neither shift crosses midnight
  // Overlap if: start1 < end2 AND end1 > start2
  return start1Min < end2Adjusted && end1Adjusted > start2Min;
}

// ============================================
// Database Conflict Checking
// ============================================

/**
 * Check for conflicting schedules in the database.
 *
 * @param cpf - Doctor's CPF
 * @param dataInicio - Date in YYYY-MM-DD format
 * @param horarioEntrada - Entry time in HH:mm:ss format
 * @param horarioSaida - Exit time in HH:mm:ss format
 * @param excludeEscalaId - Optional escala ID to exclude (for editing)
 * @returns Conflict check result
 */
export async function checkConflictingSchedules(
  cpf: string,
  dataInicio: string,
  horarioEntrada: string,
  horarioSaida: string,
  excludeEscalaId?: string
): Promise<ConflictCheckResult> {
  try {
    // Query all escalas for the same date
    let query = supabase
      .from('escalas_medicas')
      .select('*')
      .eq('data_inicio', dataInicio);

    // Exclude current escala if editing
    if (excludeEscalaId) {
      query = query.neq('id', excludeEscalaId);
    }

    const { data: escalasExistentes, error } = await query;

    if (error) throw error;

    if (!escalasExistentes || escalasExistentes.length === 0) {
      return { hasConflict: false };
    }

    // Filter out "Excluída" schedules - they should not cause conflicts
    const escalasAtivas = escalasExistentes.filter(
      (escala) => escala.status !== 'Excluída'
    );

    if (escalasAtivas.length === 0) {
      return { hasConflict: false };
    }

    // Check if any existing escala has the same CPF with overlapping times
    for (const escala of escalasAtivas) {
      const medicosComCpf = escala.medicos.filter(
        (medico: MedicoEscala) => medico.cpf === cpf
      );

      if (medicosComCpf.length > 0) {
        const hasOverlap = checkTimeOverlap(
          horarioEntrada,
          horarioSaida,
          escala.horario_entrada,
          escala.horario_saida
        );

        if (hasOverlap) {
          const medico = medicosComCpf[0];
          return {
            hasConflict: true,
            conflictDetails: formatConflictMessage(
              medico.nome,
              cpf,
              dataInicio,
              escala.horario_entrada,
              escala.horario_saida,
              horarioEntrada,
              horarioSaida
            ),
          };
        }
      }
    }

    return { hasConflict: false };
  } catch (err: any) {
    console.error('Erro ao verificar conflitos:', err);
    throw new Error('Erro ao verificar conflitos de agendamento');
  }
}

/**
 * Check for conflicts for multiple doctors on multiple dates.
 * Returns array of conflict details.
 */
export async function checkBulkConflicts(
  medicos: MedicoEscala[],
  datas: Date[],
  horarioEntrada: string,
  horarioSaida: string,
  excludeEscalaId?: string
): Promise<string[]> {
  const conflictErrors: string[] = [];

  for (const dataInicio of datas) {
    const dataInicioFormatada = format(dataInicio, 'yyyy-MM-dd');

    for (const medico of medicos) {
      const conflictCheck = await checkConflictingSchedules(
        medico.cpf,
        dataInicioFormatada,
        horarioEntrada,
        horarioSaida,
        excludeEscalaId
      );

      if (conflictCheck.hasConflict) {
        conflictErrors.push(conflictCheck.conflictDetails || 'Conflito detectado');
      }
    }
  }

  return conflictErrors;
}

// ============================================
// Internal Conflict Checking (within a batch)
// ============================================

interface ScheduleEntry {
  cpf: string;
  nome: string;
  data_inicio: string;
  horario_entrada: string;
  horario_saida: string;
}

/**
 * Check for conflicts within a batch of schedules (e.g., CSV import).
 * Returns the conflicting entry if found, or undefined.
 */
export function checkInternalConflict(
  newEntry: ScheduleEntry,
  existingEntries: ScheduleEntry[]
): ScheduleEntry | undefined {
  return existingEntries.find((existing) => {
    if (existing.cpf !== newEntry.cpf || existing.data_inicio !== newEntry.data_inicio) {
      return false;
    }

    return checkTimeOverlap(
      newEntry.horario_entrada + ':00',
      newEntry.horario_saida + ':00',
      existing.horario_entrada + ':00',
      existing.horario_saida + ':00'
    );
  });
}

// ============================================
// Formatting
// ============================================

/**
 * Format a conflict message for display.
 */
export function formatConflictMessage(
  nome: string,
  cpf: string,
  dataInicio: string,
  existingEntrada: string,
  existingSaida: string,
  newEntrada: string,
  newSaida: string
): string {
  const dataFormatada = format(parseISO(dataInicio), 'dd/MM/yyyy');

  return `O médico ${nome} (CPF: ${cpf}) já possui um agendamento no dia ${dataFormatada} das ${existingEntrada.substring(0, 5)} às ${existingSaida.substring(0, 5)}, que conflita com o horário ${newEntrada.substring(0, 5)} às ${newSaida.substring(0, 5)}.`;
}

/**
 * Format internal conflict message (within CSV).
 */
export function formatInternalConflictMessage(
  nome: string,
  cpf: string,
  dataInicio: string,
  existingEntrada: string,
  existingSaida: string
): string {
  const dataFormatada = format(parseISO(dataInicio), 'dd/MM/yyyy');

  return `Conflito detectado dentro do CSV. O médico ${nome} (CPF: ${cpf}) já possui outro agendamento no mesmo arquivo para o dia ${dataFormatada} das ${existingEntrada} às ${existingSaida}.`;
}
