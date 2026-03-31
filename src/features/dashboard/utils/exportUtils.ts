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
    'Vínculo',
    'Origem',
    'Procedimentos',
    'Pareceres Solicitados',
    'Pareceres Realizados',
    'Cirurgias Realizadas',
    'Prescrições',
    'Evoluções',
    'Urgências',
    'Ambulatórios',
    'Documentos Assinados no PEP',
  ];

  const rows = produtividade.map((prod) => [
    prod.data ? format(parseISO(prod.data), 'dd/MM/yyyy', { locale: ptBR }) : '',
    prod.codigo_mv,
    prod.nome,
    formatValue(prod.especialidade),
    formatValue(prod.vinculo),
    formatValue(prod.origem),
    prod.procedimento || 0,
    prod.parecer_solicitado || 0,
    prod.parecer_realizado || 0,
    prod.cirurgia_realizada || 0,
    prod.prescricao || 0,
    prod.evolucao || 0,
    prod.urgencia || 0,
    prod.ambulatorio || 0,
    prod.qtd_documentos_pep || 0,
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
      'Procedimentos',
      'Pareceres Sol.',
      'Pareceres Real.',
      'Cirurgias',
      'Prescrições',
      'Evoluções',
      'Urgências',
      'Ambulatórios',
      'Documentos Assinados no PEP',
      'Total Atividades',
    ];

    rows = datas.map((data) => {
      const registros = detalhes.get(data) || [];

      const totais = registros.reduce(
        (acc, reg) => ({
          procedimento: acc.procedimento + (reg.procedimento || 0),
          parecer_solicitado: acc.parecer_solicitado + (reg.parecer_solicitado || 0),
          parecer_realizado: acc.parecer_realizado + (reg.parecer_realizado || 0),
          cirurgia: acc.cirurgia + (reg.cirurgia_realizada || 0),
          prescricao: acc.prescricao + (reg.prescricao || 0),
          evolucao: acc.evolucao + (reg.evolucao || 0),
          urgencia: acc.urgencia + (reg.urgencia || 0),
          ambulatorio: acc.ambulatorio + (reg.ambulatorio || 0),
          qtd_documentos_pep: acc.qtd_documentos_pep + (reg.qtd_documentos_pep || 0),
        }),
        {
          procedimento: 0,
          parecer_solicitado: 0,
          parecer_realizado: 0,
          cirurgia: 0,
          prescricao: 0,
          evolucao: 0,
          urgencia: 0,
          ambulatorio: 0,
          qtd_documentos_pep: 0,
        }
      );

      const totalAtividades =
        totais.procedimento +
        totais.parecer_solicitado +
        totais.parecer_realizado +
        totais.cirurgia +
        totais.prescricao +
        totais.evolucao +
        totais.urgencia +
        totais.ambulatorio +
        totais.qtd_documentos_pep;

      return [
        format(parseISO(data), 'dd/MM/yyyy', { locale: ptBR }),
        nome,
        tipoTexto,
        totais.procedimento,
        totais.parecer_solicitado,
        totais.parecer_realizado,
        totais.cirurgia,
        totais.prescricao,
        totais.evolucao,
        totais.urgencia,
        totais.ambulatorio,
        totais.qtd_documentos_pep,
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
    'Procedimentos',
    'Pareceres Solicitados',
    'Pareceres Realizados',
    'Cirurgias',
    'Prescrições',
    'Evoluções',
    'Urgências',
    'Ambulatórios',
    'Auxiliar',
    'Encaminhamento',
    'Folha Objetivo Diário',
    'Evolução Diurna CTI',
    'Evolução Noturna CTI',
    'Documentos Assinados no PEP',
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
    h.produtividade_procedimento,
    h.produtividade_parecer_solicitado,
    h.produtividade_parecer_realizado,
    h.produtividade_cirurgia_realizada,
    h.produtividade_prescricao,
    h.produtividade_evolucao,
    h.produtividade_urgencia,
    h.produtividade_ambulatorio,
    h.produtividade_auxiliar,
    h.produtividade_encaminhamento,
    h.produtividade_folha_objetivo_diario,
    h.produtividade_evolucao_diurna_cti,
    h.produtividade_evolucao_noturna_cti,
    h.produtividade_qtd_documentos_pep,
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
