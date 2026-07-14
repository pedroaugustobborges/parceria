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
 * Gera e baixa o modelo XLSX para importação de escalas via CSV.
 * - CPF: coluna formatada como texto para preservar zeros à esquerda
 * - data_inicio: formato YYYY-MM-DD como texto
 * - horario_entrada / horario_saida: HH:MM como texto (com zero à esquerda)
 */
export const downloadEscalasModeloXlsx = (): void => {
  const wb = XLSX.utils.book_new();

  // Dados do modelo: cabeçalhos + 2 linhas de exemplo
  const aoa: (string)[][] = [
    ['cpf', 'data_inicio', 'horario_entrada', 'horario_saida'],
    ['01234567890', '2026-01-15', '08:00', '17:00'],
    ['09876543210', '2026-01-16', '07:30', '19:30'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Forçar todas as células como texto para evitar que o Excel
  // remova zeros à esquerda do CPF ou converta horários em frações decimais
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:D3');
  for (let row = range.s.r; row <= range.e.r; row++) {
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
      if (ws[cellRef]) {
        ws[cellRef].t = 's'; // tipo string
        ws[cellRef].z = '@'; // formato "Texto" do Excel
      }
    }
  }

  // Larguras das colunas
  ws['!cols'] = [
    { wch: 16 }, // cpf
    { wch: 16 }, // data_inicio
    { wch: 18 }, // horario_entrada
    { wch: 16 }, // horario_saida
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Modelo');
  XLSX.writeFile(wb, 'modelo_importacao_escalas.xlsx');
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
