import { parseISO } from "date-fns";

/**
 * Normaliza uma data para meia-noite (00:00:00) para comparações de data
 */
export const normalizeDate = (date: Date | null): Date | null => {
  if (!date) return null;
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

/**
 * Verifica se uma data está dentro do intervalo especificado
 */
export const isDateInRange = (
  date: Date | string,
  startDate: Date | null,
  endDate: Date | null
): boolean => {
  const targetDate = typeof date === "string" ? parseISO(date) : date;
  const normalized = normalizeDate(targetDate);

  if (!normalized) return false;

  if (startDate) {
    const start = normalizeDate(startDate);
    if (start && normalized < start) return false;
  }

  if (endDate) {
    const end = normalizeDate(endDate);
    if (end && normalized > end) return false;
  }

  return true;
};

/**
 * Extrai a data no formato YYYY-MM-DD de uma string ISO
 */
export const extractDateString = (isoDate: string): string => {
  return isoDate.split("T")[0];
};

/**
 * Parseia uma data ISO corretamente sem problemas de timezone
 */
export const parseISODate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split("T")[0].split("-").map(Number);
  return new Date(year, month - 1, day);
};
