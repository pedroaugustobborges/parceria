import * as XLSX from 'xlsx';
import { format } from 'date-fns';

/**
 * Cria e baixa um arquivo XLSX (Excel)
 */
export const downloadXLSX = (
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
  sheetName: string = 'Dados'
): void => {
  // Criar dados com cabeçalhos
  const data = [headers, ...rows];

  // Criar worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(data);

  // Estilizar colunas (largura automática)
  const colWidths = headers.map((header, colIndex) => {
    const maxLength = Math.max(
      header.length,
      ...rows.map((row) => String(row[colIndex] ?? '').length)
    );
    return { wch: Math.min(Math.max(maxLength + 2, 10), 50) };
  });
  worksheet['!cols'] = colWidths;

  // Criar workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Gerar arquivo e baixar
  const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
  XLSX.writeFile(workbook, `${filename}_${timestamp}.xlsx`);
};

/**
 * Cria e baixa um arquivo XLSX com múltiplas abas
 */
export const downloadXLSXMultiSheet = (
  filename: string,
  sheets: Array<{
    name: string;
    headers: string[];
    rows: (string | number | null | undefined)[][];
  }>
): void => {
  const workbook = XLSX.utils.book_new();

  sheets.forEach((sheet) => {
    const data = [sheet.headers, ...sheet.rows];
    const worksheet = XLSX.utils.aoa_to_sheet(data);

    // Estilizar colunas
    const colWidths = sheet.headers.map((header, colIndex) => {
      const maxLength = Math.max(
        header.length,
        ...sheet.rows.map((row) => String(row[colIndex] ?? '').length)
      );
      return { wch: Math.min(Math.max(maxLength + 2, 10), 50) };
    });
    worksheet['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
  });

  const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
  XLSX.writeFile(workbook, `${filename}_${timestamp}.xlsx`);
};

/**
 * Exporta dados de um DataGrid para XLSX
 */
export const exportDataGridToXLSX = (
  rows: Record<string, unknown>[],
  columns: Array<{ field: string; headerName?: string }>,
  filename: string
): void => {
  const headers = columns.map((col) => col.headerName || col.field);
  const data = rows.map((row) =>
    columns.map((col) => {
      const value = row[col.field];
      if (value === null || value === undefined) return '';
      return value;
    })
  );

  downloadXLSX(filename, headers, data as (string | number)[][]);
};
