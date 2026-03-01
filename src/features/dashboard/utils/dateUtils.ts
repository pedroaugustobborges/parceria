/**
 * Date Utilities
 *
 * Functions for date handling and extraction.
 */

/**
 * Extrai string de data consistente (ignora timezone)
 * Trata tanto "2024-01-15" (date) quanto "2024-01-15T10:30:00+00" (timestamptz)
 *
 * CRÍTICO: Resolve problema de timezone onde:
 *   - acessos.data_acesso: timestamptz (pode mudar de dia com timezone)
 *   - produtividade.data: date (sempre o mesmo dia)
 *
 * Solução: Extrai apenas YYYY-MM-DD antes de qualquer conversão de timezone
 */
export function extractDateString(dateValue: string | null | undefined): string {
  if (!dateValue) return '';

  // Convert to string if needed
  const dateStr = String(dateValue);

  // Extract YYYY-MM-DD portion only (before 'T' if exists)
  const datePart = dateStr.split('T')[0];

  // Validate format and normalize padding
  const parts = datePart.split('-');
  if (parts.length !== 3) return '';

  const [year, month, day] = parts.map((p) => parseInt(p, 10));

  // Return normalized date string (always YYYY-MM-DD with proper padding)
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

/**
 * Normaliza uma data para comparação (zerando horas)
 */
export function normalizeDate(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

/**
 * Verifica se uma data está dentro de um intervalo
 */
export function isDateInRange(
  date: Date,
  startDate: Date | null,
  endDate: Date | null
): boolean {
  const normalizedDate = normalizeDate(date);

  if (startDate) {
    const normalizedStart = normalizeDate(startDate);
    if (normalizedDate < normalizedStart) return false;
  }

  if (endDate) {
    const normalizedEnd = normalizeDate(endDate);
    if (normalizedDate > normalizedEnd) return false;
  }

  return true;
}
