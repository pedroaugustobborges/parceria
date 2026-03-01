/**
 * CPF Utilities
 *
 * Functions for normalizing and handling CPF values.
 */

/**
 * Normaliza CPF para formato consistente de 11 dígitos
 * Converte números para string e adiciona zeros à esquerda quando necessário
 * Remove pontos, traços e espaços
 *
 * Exemplos:
 *   12345678900 -> "12345678900" (número convertido)
 *   1234567890 -> "01234567890" (número com zero perdido)
 *   "123.456.789-00" -> "12345678900" (string formatada)
 */
export function normalizeCPF(cpf: string | number | null | undefined): string {
  if (cpf === null || cpf === undefined) return '';

  // Converter para string se for número
  let cpfStr = String(cpf);

  // Remover caracteres de formatação
  cpfStr = cpfStr.replace(/[.\-\s]/g, '');

  // Garantir 11 dígitos com zeros à esquerda
  return cpfStr.padStart(11, '0');
}

/**
 * Normaliza um objeto de dados aplicando normalizeCPF ao campo 'cpf'
 */
export function normalizeCPFInObject<T extends { cpf?: string | number | null }>(obj: T): T {
  if (obj.cpf !== undefined) {
    return {
      ...obj,
      cpf: normalizeCPF(obj.cpf) as T['cpf'],
    };
  }
  return obj;
}

/**
 * Normaliza nome para comparação (remove acentos, espaços extras, lowercase)
 */
export function normalizeName(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ') // Remove extra spaces
    .normalize('NFD') // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, ''); // Remove diacritics
}
