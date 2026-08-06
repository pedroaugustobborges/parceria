/**
 * Export Utilities
 *
 * Functions for XLSX (Excel) export operations.
 */

import * as XLSX from 'xlsx';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Acesso, Produtividade, HorasCalculadas } from '../types/dashboard.types';

// ============================================
// Helper Functions
// ============================================

/**
 * Download an XLSX file with the given data.
 */
function downloadXLSX(
  data: (string | number | null | undefined)[][],
  filename: string,
  sheetName: string = 'Dados'
): void {
  const worksheet = XLSX.utils.aoa_to_sheet(data);

  // Auto-adjust column widths
  if (data.length > 0) {
    const colWidths = data[0].map((_, colIndex) => {
      const maxLength = Math.max(
        ...data.map((row) => String(row[colIndex] ?? '').length)
      );
      return { wch: Math.min(Math.max(maxLength + 2, 10), 50) };
    });
    worksheet['!cols'] = colWidths;
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  XLSX.writeFile(workbook, filename);
}

/**
 * Format value for Excel (handle null/undefined)
 */
function formatValue(value: string | number | null | undefined): string | number {
  if (value === null || value === undefined) return '';
  return value;
}

// ============================================
// Export Functions
// ============================================

/**
 * Export access history to XLSX
 */
export function exportAccessHistoryXLSX(
  person: HorasCalculadas,
  acessos: Acesso[]
): void {
  const headers = [
    'Data/Hora',
    'Tipo',
    'Matrícula',
    'Nome',
    'CPF',
    'Sentido',
    'Local',
  ];

  const rows = acessos.map((acesso) => [
    format(parseISO(acesso.data_acesso), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR }),
    acesso.tipo,
    acesso.matricula,
    acesso.nome,
    acesso.cpf,
    acesso.sentido === 'E' ? 'Entrada' : 'Saída',
    acesso.planta || '',
  ]);

  const data = [headers, ...rows];

  downloadXLSX(
    data,
    `acessos_${person.nome.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`,
    'Acessos'
  );
}

/**
 * Export productivity history to XLSX
 */
export function exportProductivityXLSX(
  person: HorasCalculadas,
  produtividade: Produtividade[]
): void {
  const headers = [
    'Data',
    'Código MV',
    'Nome',
    'Especialidade',
    'Unidade',
    'Prescrição',
    'Diagnóstico',
    'Encaminhamento',
    'Parecer',
    'Anotação',
    'Avaliação',
    'Doc. Eletrônico',
    'Evolução',
    'Alta Médica',
  ];

  const rows = produtividade.map((prod) => [
    prod.data ? format(parseISO(prod.data), 'dd/MM/yyyy', { locale: ptBR }) : '',
    prod.codigo_mv,
    prod.nome,
    formatValue(prod.especialidade),
    formatValue(prod.nm_unidade),
    prod.prescricao           || 0,
    prod.diagnostico          || 0,
    prod.encaminhamento       || 0,
    prod.parecer              || 0,
    prod.anotacao             || 0,
    prod.avaliacao            || 0,
    prod.documento_eletronico || 0,
    prod.evolucao             || 0,
    prod.alta_medica          || 0,
  ]);

  const data = [headers, ...rows];

  downloadXLSX(
    data,
    `produtividade_${person.matricula}_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`,
    'Produtividade'
  );
}

/**
 * Export inconsistency data to XLSX
 */
export function exportInconsistencyXLSX(
  nome: string,
  tipo: 'prodSemAcesso' | 'acessoSemProd',
  datas: string[],
  detalhes?: Map<string, Produtividade[]>
): void {
  const tipoTexto =
    tipo === 'prodSemAcesso' ? 'Produtividade sem Acesso' : 'Acesso sem Produtividade';

  let headers: string[];
  let rows: (string | number)[][];

  if (tipo === 'prodSemAcesso' && detalhes) {
    headers = [
      'Data',
      'Nome',
      'Tipo de Inconsistência',
      'Prescrição',
      'Diagnóstico',
      'Encaminhamento',
      'Parecer',
      'Anotação',
      'Avaliação',
      'Doc. Eletrônico',
      'Evolução',
      'Alta Médica',
      'Total Atividades',
    ];

    rows = datas.map((data) => {
      const registros = detalhes.get(data) || [];

      const totais = registros.reduce(
        (acc, reg) => ({
          prescricao:           acc.prescricao           + (reg.prescricao           || 0),
          diagnostico:          acc.diagnostico          + (reg.diagnostico          || 0),
          encaminhamento:       acc.encaminhamento       + (reg.encaminhamento       || 0),
          parecer:              acc.parecer              + (reg.parecer              || 0),
          anotacao:             acc.anotacao             + (reg.anotacao             || 0),
          avaliacao:            acc.avaliacao            + (reg.avaliacao            || 0),
          documento_eletronico: acc.documento_eletronico + (reg.documento_eletronico || 0),
          evolucao:             acc.evolucao             + (reg.evolucao             || 0),
          alta_medica:          acc.alta_medica          + (reg.alta_medica          || 0),
        }),
        {
          prescricao: 0, diagnostico: 0, encaminhamento: 0, parecer: 0,
          anotacao: 0, avaliacao: 0, documento_eletronico: 0, evolucao: 0, alta_medica: 0,
        }
      );

      const totalAtividades =
        totais.prescricao + totais.diagnostico + totais.encaminhamento +
        totais.parecer + totais.anotacao + totais.avaliacao +
        totais.documento_eletronico + totais.evolucao + totais.alta_medica;

      return [
        format(parseISO(data), 'dd/MM/yyyy', { locale: ptBR }),
        nome,
        tipoTexto,
        totais.prescricao,
        totais.diagnostico,
        totais.encaminhamento,
        totais.parecer,
        totais.anotacao,
        totais.avaliacao,
        totais.documento_eletronico,
        totais.evolucao,
        totais.alta_medica,
        totalAtividades,
      ];
    });
  } else {
    headers = ['Data', 'Nome', 'Tipo de Inconsistência'];
    rows = datas.map((data) => [
      format(parseISO(data), 'dd/MM/yyyy', { locale: ptBR }),
      nome,
      tipoTexto,
    ]);
  }

  const xlsxData = [headers, ...rows];

  downloadXLSX(
    xlsxData,
    `inconsistencia_${nome.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`,
    'Inconsistências'
  );
}

/**
 * Export dashboard hours data to XLSX
 */
export function exportDashboardXLSX(horasCalculadas: HorasCalculadas[]): void {
  const headers = [
    'Nome',
    'CPF',
    'Matrícula',
    'Tipo',
    'Código MV',
    'Especialidade',
    'Total Horas na Unidade',
    'Horas Escaladas',
    'Diferença',
    'Dias com Registro',
    'Entradas',
    'Saídas',
    'Último Acesso',
    'Prescrição',
    'Diagnóstico',
    'Encaminhamento',
    'Parecer',
    'Anotação',
    'Avaliação',
    'Doc. Eletrônico',
    'Evolução',
    'Alta Médica',
  ];

  const rows = horasCalculadas.map((h) => [
    h.nome,
    h.cpf,
    h.matricula,
    h.tipo,
    h.codigomv,
    h.especialidade,
    Number(h.totalHoras.toFixed(2)),
    Number(h.cargaHorariaEscalada.toFixed(2)),
    Number((h.totalHoras - h.cargaHorariaEscalada).toFixed(2)),
    h.diasComRegistro,
    h.entradas,
    h.saidas,
    format(parseISO(h.ultimoAcesso), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
    h.produtividade_prescricao,
    h.produtividade_diagnostico,
    h.produtividade_encaminhamento,
    h.produtividade_parecer,
    h.produtividade_anotacao,
    h.produtividade_avaliacao,
    h.produtividade_documento_eletronico,
    h.produtividade_evolucao,
    h.produtividade_alta_medica,
  ]);

  const data = [headers, ...rows];

  downloadXLSX(
    data,
    `dashboard_acessos_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`,
    'Dashboard'
  );
}

// ============================================
// Legacy exports (for backward compatibility)
// ============================================
export const exportAccessHistoryCSV = exportAccessHistoryXLSX;
export const exportProductivityCSV = exportProductivityXLSX;
export const exportInconsistencyCSV = exportInconsistencyXLSX;
export const exportDashboardCSV = exportDashboardXLSX;
