/**
 * Export Utilities
 *
 * Functions for CSV export operations.
 */

import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Acesso, Produtividade, HorasCalculadas } from '../types/dashboard.types';

// ============================================
// Helper Functions
// ============================================

/**
 * Download a file with the given content.
 */
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Escape CSV field value
 */
function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return `"${String(value).replace(/"/g, '""')}"`;
}

// ============================================
// Export Functions
// ============================================

/**
 * Export access history to CSV
 */
export function exportAccessHistoryCSV(
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

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map(escapeCSV).join(',')),
  ].join('\n');

  downloadFile(
    '\uFEFF' + csvContent,
    `acessos_${person.nome.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`,
    'text/csv;charset=utf-8;'
  );
}

/**
 * Export productivity history to CSV
 */
export function exportProductivityCSV(
  person: HorasCalculadas,
  produtividade: Produtividade[]
): void {
  const headers = [
    'Data',
    'Código MV',
    'Nome',
    'Especialidade',
    'Vínculo',
    'Procedimentos',
    'Pareceres Solicitados',
    'Pareceres Realizados',
    'Cirurgias Realizadas',
    'Prescrições',
    'Evoluções',
    'Urgências',
    'Ambulatórios',
  ];

  const rows = produtividade.map((prod) => [
    prod.data ? format(parseISO(prod.data), 'dd/MM/yyyy', { locale: ptBR }) : '',
    prod.codigo_mv,
    prod.nome,
    prod.especialidade || '',
    prod.vinculo || '',
    prod.procedimento,
    prod.parecer_solicitado,
    prod.parecer_realizado,
    prod.cirurgia_realizada,
    prod.prescricao,
    prod.evolucao,
    prod.urgencia,
    prod.ambulatorio,
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map(escapeCSV).join(',')),
  ].join('\n');

  downloadFile(
    '\uFEFF' + csvContent,
    `produtividade_${person.matricula}_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`,
    'text/csv;charset=utf-8;'
  );
}

/**
 * Export inconsistency data to CSV
 */
export function exportInconsistencyCSV(
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
      'Total Atividades',
    ];

    rows = datas.map((data) => {
      const registros = detalhes.get(data) || [];

      const totais = registros.reduce(
        (acc, reg) => ({
          procedimento: acc.procedimento + reg.procedimento,
          parecer_solicitado: acc.parecer_solicitado + reg.parecer_solicitado,
          parecer_realizado: acc.parecer_realizado + reg.parecer_realizado,
          cirurgia: acc.cirurgia + reg.cirurgia_realizada,
          prescricao: acc.prescricao + reg.prescricao,
          evolucao: acc.evolucao + reg.evolucao,
          urgencia: acc.urgencia + reg.urgencia,
          ambulatorio: acc.ambulatorio + reg.ambulatorio,
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
        totais.ambulatorio;

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

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map(escapeCSV).join(',')),
  ].join('\n');

  downloadFile(
    '\uFEFF' + csvContent,
    `inconsistencia_${nome.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`,
    'text/csv;charset=utf-8;'
  );
}

/**
 * Export dashboard hours data to CSV
 */
export function exportDashboardCSV(horasCalculadas: HorasCalculadas[]): void {
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
  ];

  const rows = horasCalculadas.map((h) => [
    h.nome,
    h.cpf,
    h.matricula,
    h.tipo,
    h.codigomv,
    h.especialidade,
    h.totalHoras.toFixed(2),
    h.cargaHorariaEscalada.toFixed(2),
    (h.totalHoras - h.cargaHorariaEscalada).toFixed(2),
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
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map(escapeCSV).join(',')),
  ].join('\n');

  downloadFile(
    '\uFEFF' + csvContent,
    `dashboard_acessos_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`,
    'text/csv;charset=utf-8;'
  );
}
