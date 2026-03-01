/**
 * CSV Validation Utilities
 *
 * Pure functions for CSV parsing and validation.
 * Does not handle file reading - that should be done at the component level with PapaParse.
 */

import { parseISO } from 'date-fns';
import type { CsvRawRow, CsvPreviewRow } from '../types/escalas.types';
import { checkTimeOverlap } from '../services/conflictDetectionService';

// ============================================
// Required Columns
// ============================================

export const CSV_REQUIRED_COLUMNS = ['cpf', 'data_inicio', 'horario_entrada', 'horario_saida'];

// ============================================
// Validation Patterns
// ============================================

/**
 * Regex for date validation (YYYY-MM-DD).
 */
export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Regex for time validation (HH:MM or HH:MM:SS).
 */
export const TIME_REGEX = /^([0-1][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;

// ============================================
// Column Validation
// ============================================

/**
 * Check if all required columns are present.
 * Returns array of missing column names.
 */
export function validateColumns(headers: string[]): string[] {
  return CSV_REQUIRED_COLUMNS.filter((col) => !headers.includes(col));
}

// ============================================
// CPF Validation
// ============================================

/**
 * Clean a CPF string (remove non-numeric characters).
 */
export function cleanCpf(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

/**
 * Validate CPF format (8-13 digits).
 */
export function isValidCpfFormat(cpf: string): boolean {
  const cpfLimpo = cleanCpf(cpf);
  return cpfLimpo.length >= 8 && cpfLimpo.length <= 13;
}

/**
 * Get CPF validation error message.
 */
export function getCpfFormatError(cpf: string): string {
  return `CPF "${cpf}" em formato inválido (deve ter entre 8 e 13 dígitos)`;
}

// ============================================
// Date Validation
// ============================================

/**
 * Validate date format (YYYY-MM-DD).
 */
export function isValidDateFormat(date: string): boolean {
  return DATE_REGEX.test(date);
}

/**
 * Validate that a date string represents a valid date.
 */
export function isValidDate(date: string): boolean {
  if (!isValidDateFormat(date)) return false;

  const parsed = parseISO(date);
  return !isNaN(parsed.getTime());
}

/**
 * Get date format error message.
 */
export function getDateFormatError(date: string): string {
  return `data_inicio "${date}" em formato inválido (use YYYY-MM-DD)`;
}

/**
 * Get invalid date error message.
 */
export function getInvalidDateError(date: string): string {
  return `data_inicio "${date}" é uma data inválida`;
}

// ============================================
// Time Validation
// ============================================

/**
 * Validate time format (HH:MM or HH:MM:SS).
 */
export function isValidTimeFormat(time: string): boolean {
  return TIME_REGEX.test(time);
}

/**
 * Normalize time to HH:MM format (remove seconds if present).
 */
export function normalizeTimeString(time: string): string {
  return time.substring(0, 5);
}

/**
 * Get time format error message.
 */
export function getTimeFormatError(fieldName: string, time: string): string {
  return `${fieldName} "${time}" em formato inválido (use HH:MM ou HH:MM:SS)`;
}

// ============================================
// Row Validation
// ============================================

export interface RowValidationResult {
  isValid: boolean;
  error?: string;
  data?: {
    cpf: string;
    data_inicio: string;
    horario_entrada: string;
    horario_saida: string;
  };
}

/**
 * Validate a single CSV row.
 * Returns validation result without checking conflicts or database.
 */
export function validateCsvRow(row: CsvRawRow, lineNumber: number): RowValidationResult {
  // Validate CPF
  const cpf = row.cpf?.toString().trim();
  if (!cpf) {
    return { isValid: false, error: `Linha ${lineNumber}: CPF não informado` };
  }

  const cpfLimpo = cleanCpf(cpf);
  if (!isValidCpfFormat(cpf)) {
    return {
      isValid: false,
      error: `Linha ${lineNumber}: ${getCpfFormatError(cpf)}`,
    };
  }

  // Validate data_inicio
  const dataInicio = row.data_inicio?.toString().trim();
  if (!dataInicio) {
    return { isValid: false, error: `Linha ${lineNumber}: data_inicio não informada` };
  }

  if (!isValidDateFormat(dataInicio)) {
    return {
      isValid: false,
      error: `Linha ${lineNumber}: ${getDateFormatError(dataInicio)}`,
    };
  }

  if (!isValidDate(dataInicio)) {
    return {
      isValid: false,
      error: `Linha ${lineNumber}: ${getInvalidDateError(dataInicio)}`,
    };
  }

  // Validate horario_entrada
  const horarioEntrada = row.horario_entrada?.toString().trim();
  if (!horarioEntrada) {
    return { isValid: false, error: `Linha ${lineNumber}: horario_entrada não informado` };
  }

  if (!isValidTimeFormat(horarioEntrada)) {
    return {
      isValid: false,
      error: `Linha ${lineNumber}: ${getTimeFormatError('horario_entrada', horarioEntrada)}`,
    };
  }

  // Validate horario_saida
  const horarioSaida = row.horario_saida?.toString().trim();
  if (!horarioSaida) {
    return { isValid: false, error: `Linha ${lineNumber}: horario_saida não informado` };
  }

  if (!isValidTimeFormat(horarioSaida)) {
    return {
      isValid: false,
      error: `Linha ${lineNumber}: ${getTimeFormatError('horario_saida', horarioSaida)}`,
    };
  }

  return {
    isValid: true,
    data: {
      cpf: cpfLimpo,
      data_inicio: dataInicio,
      horario_entrada: normalizeTimeString(horarioEntrada),
      horario_saida: normalizeTimeString(horarioSaida),
    },
  };
}

// ============================================
// Internal Conflict Detection (within CSV)
// ============================================

/**
 * Check for conflicts between a new entry and existing validated entries.
 */
export function findInternalConflict(
  newEntry: CsvPreviewRow,
  existingEntries: CsvPreviewRow[]
): CsvPreviewRow | undefined {
  return existingEntries.find((prev) => {
    if (prev.cpf !== newEntry.cpf || prev.data_inicio !== newEntry.data_inicio) {
      return false;
    }

    return checkTimeOverlap(
      newEntry.horario_entrada + ':00',
      newEntry.horario_saida + ':00',
      prev.horario_entrada + ':00',
      prev.horario_saida + ':00'
    );
  });
}

/**
 * Format internal conflict error message.
 */
export function formatInternalConflictError(
  lineNumber: number,
  nome: string,
  cpf: string,
  dataInicio: string,
  existingEntry: CsvPreviewRow
): string {
  const { format: formatDate } = require('date-fns');
  const { parseISO } = require('date-fns');

  return `Linha ${lineNumber}: Conflito detectado dentro do CSV. O médico ${nome} (CPF: ${cpf}) já possui outro agendamento no mesmo arquivo para o dia ${formatDate(parseISO(dataInicio), 'dd/MM/yyyy')} das ${existingEntry.horario_entrada} às ${existingEntry.horario_saida}.`;
}

// ============================================
// Batch Validation
// ============================================

/**
 * Validate multiple CSV rows.
 * Note: This only performs format validation.
 * Database checks (user exists, conflicts) must be done separately.
 */
export function validateCsvRows(rows: CsvRawRow[]): {
  validRows: Array<{ lineNumber: number; data: NonNullable<RowValidationResult['data']> }>;
  errors: string[];
} {
  const validRows: Array<{ lineNumber: number; data: NonNullable<RowValidationResult['data']> }> = [];
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const lineNumber = i + 2; // +2 because of header and 0-based index
    const result = validateCsvRow(rows[i], lineNumber);

    if (result.isValid && result.data) {
      validRows.push({ lineNumber, data: result.data });
    } else if (result.error) {
      errors.push(result.error);
    }
  }

  return { validRows, errors };
}

// ============================================
// Export Template
// ============================================

/**
 * Get CSV template headers for import.
 */
export function getCsvTemplateHeaders(): string[] {
  return ['cpf', 'data_inicio', 'horario_entrada', 'horario_saida'];
}

/**
 * Generate example CSV content for template download.
 */
export function generateCsvTemplate(): string {
  const headers = getCsvTemplateHeaders().join(',');
  const exampleRow = '12345678901,2024-01-15,08:00,12:00';

  return `${headers}\n${exampleRow}`;
}
