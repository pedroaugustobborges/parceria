import * as XLSX from 'xlsx';
import { format } from 'date-fns';

/**
 * Cria e baixa um arquivo XLSX (Excel)
 * @deprecated Use xlsxExport.ts functions instead
 */
export const downloadCSV = (
  filename: string,
  headers: string[],
  rows: (string | number)[][]
): void => {
  // Create worksheet data
  const data = [headers, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(data);

  // Auto-adjust column widths
  const colWidths = headers.map((header, colIndex) => {
    const maxLength = Math.max(
      header.length,
      ...rows.map((row) => String(row[colIndex] ?? '').length)
    );
    return { wch: Math.min(Math.max(maxLength + 2, 10), 50) };
  });
  worksheet['!cols'] = colWidths;

  // Create workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Dados');

  // Generate file and download
  const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
  XLSX.writeFile(workbook, `${filename}_${timestamp}.xlsx`);
};
