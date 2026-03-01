/**
 * Escalas Export Service
 *
 * Handles PDF and CSV export generation.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type {
  EscalaMedica,
  Contrato,
  UnidadeHospitalar,
  ItemContrato,
  ContratoItem,
} from '../types/escalas.types';
import { calculateTotalEscalaHours } from '../utils/escalasHoursUtils';
import { getContratoItemValue } from './escalasService';

// ============================================
// CSV Export
// ============================================

export interface CsvExportData {
  escalas: EscalaMedica[];
  contratos: Contrato[];
  unidades: UnidadeHospitalar[];
  todosItensContrato: ItemContrato[];
}

/**
 * Export escalas to CSV format.
 */
export function exportToCSV(data: CsvExportData): void {
  const { escalas, contratos, unidades, todosItensContrato } = data;

  // CSV headers
  const headers = [
    'Data',
    'Horário Entrada',
    'Horário Saída',
    'Contrato',
    'Parceiro',
    'Unidade',
    'Item Contrato',
    'Status',
    'Médicos',
    'CPFs',
    'Observações',
    'Justificativa',
    'Alterado Por',
    'Data Alteração',
  ];

  // Build CSV rows
  const rows = escalas.map((escala) => {
    const contrato = contratos.find((c) => c.id === escala.contrato_id);
    const unidade = unidades.find((u) => u.id === contrato?.unidade_hospitalar_id);
    const itemContrato = todosItensContrato.find((i) => i.id === escala.item_contrato_id);
    const medicos = escala.medicos.map((m) => m.nome).join('; ');
    const cpfs = escala.medicos.map((m) => m.cpf).join('; ');

    return [
      format(parseISO(escala.data_inicio), 'dd/MM/yyyy'),
      escala.horario_entrada.substring(0, 5),
      escala.horario_saida.substring(0, 5),
      contrato?.nome || 'N/A',
      contrato?.empresa || 'N/A',
      unidade?.nome || 'N/A',
      itemContrato?.nome || 'N/A',
      escala.status,
      medicos,
      cpfs,
      escala.observacoes || '',
      escala.justificativa || '',
      escala.status_alterado_por || '',
      escala.status_alterado_em
        ? format(parseISO(escala.status_alterado_em), 'dd/MM/yyyy HH:mm')
        : '',
    ];
  });

  // Build CSV content
  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((field) => `"${field}"`).join(',')),
  ].join('\n');

  // Download file
  downloadFile(
    '\ufeff' + csvContent, // BOM for Excel compatibility
    `escalas_medicas_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.csv`,
    'text/csv;charset=utf-8;'
  );
}

// ============================================
// PDF Export
// ============================================

export interface PdfExportData extends CsvExportData {
  contratoItens: ContratoItem[];
}

/**
 * Export escalas to PDF format with branding and metrics.
 */
export async function exportToPDF(data: PdfExportData): Promise<void> {
  const { escalas, contratos, unidades, todosItensContrato, contratoItens } = data;

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  // Theme colors
  const primaryColor: [number, number, number] = [14, 165, 233]; // #0ea5e9
  const goldColor: [number, number, number] = [251, 191, 36]; // #fbbf24

  const pageWidth = doc.internal.pageSize.getWidth();

  // Header background
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, pageWidth, 35, 'F');

  // Logo/App name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('Parcer', 15, 15);

  doc.setTextColor(goldColor[0], goldColor[1], goldColor[2]);
  doc.text('IA', 42, 15);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Gestão Inteligente de Acessos e Parcerias', 15, 22);

  // Report title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Relatório de Escalas Médicas', 15, 32);

  // Report info (right side)
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 255, 255);
  const dataRelatorio = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  doc.text(`Gerado em: ${dataRelatorio}`, pageWidth - 15, 15, { align: 'right' });
  doc.text(`Total de escalas: ${escalas.length}`, pageWidth - 15, 22, { align: 'right' });
  doc.text('Powered by Daher.lab - Agir', pageWidth - 15, 29, { align: 'right' });

  // Build table data
  const tableData = escalas.map((escala) => {
    const contrato = contratos.find((c) => c.id === escala.contrato_id);
    const unidade = unidades.find((u) => u.id === contrato?.unidade_hospitalar_id);
    const itemContrato = todosItensContrato.find((i) => i.id === escala.item_contrato_id);
    const medicos = escala.medicos.map((m) => m.nome).join('\n');

    return [
      format(parseISO(escala.data_inicio), 'dd/MM/yyyy'),
      `${escala.horario_entrada.substring(0, 5)} - ${escala.horario_saida.substring(0, 5)}`,
      contrato?.nome || 'N/A',
      contrato?.empresa || 'N/A',
      unidade?.nome || 'N/A',
      itemContrato?.nome || 'N/A',
      medicos,
      escala.status,
    ];
  });

  // Create table
  autoTable(doc, {
    startY: 40,
    head: [['Data', 'Horário', 'Contrato', 'Parceiro', 'Unidade', 'Item', 'Médicos', 'Status']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center',
    },
    styles: {
      fontSize: 8,
      cellPadding: 3,
      overflow: 'linebreak',
    },
    columnStyles: {
      0: { cellWidth: 22, halign: 'center' },
      1: { cellWidth: 25, halign: 'center' },
      2: { cellWidth: 40 },
      3: { cellWidth: 35 },
      4: { cellWidth: 35 },
      5: { cellWidth: 35 },
      6: { cellWidth: 45 },
      7: { cellWidth: 20, halign: 'center' },
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    margin: { left: 15, right: 15 },
  });

  // Calculate total value for approved escalas
  const valorTotalAprovadas = await calculateApprovedEscalasValue(escalas, contratoItens);
  const escalasAprovadas = escalas.filter((e) => e.status === 'Aprovado');

  // Add footer with page numbers
  const pageCount = doc.getNumberOfPages();
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();

    // Page number
    doc.text(`Página ${i} de ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });

    // Add approved escalas summary on last page
    if (i === pageCount && escalasAprovadas.length > 0) {
      // Green box for approved summary
      doc.setFillColor(46, 204, 113);
      doc.roundedRect(pageWidth - 110, pageHeight - 25, 95, 20, 3, 3, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('ESCALAS APROVADAS', pageWidth - 62.5, pageHeight - 19, { align: 'center' });

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Quantidade: ${escalasAprovadas.length} escala${escalasAprovadas.length !== 1 ? 's' : ''}`,
        pageWidth - 62.5,
        pageHeight - 14.5,
        { align: 'center' }
      );

      // Total value
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      const valorFormatado = valorTotalAprovadas.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      doc.text(`Valor Total: R$ ${valorFormatado}`, pageWidth - 62.5, pageHeight - 9, {
        align: 'center',
      });

      // Explanatory note
      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);
      doc.setFont('helvetica', 'italic');
      doc.text(
        '* Cálculo: Horas trabalhadas × Valor unitário × Número de médicos',
        15,
        pageHeight - 18
      );
    }
  }

  // Download PDF
  doc.save(`escalas_medicas_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.pdf`);
}

// ============================================
// Helper Functions
// ============================================

/**
 * Calculate total value for approved escalas.
 */
async function calculateApprovedEscalasValue(
  escalas: EscalaMedica[],
  contratoItens: ContratoItem[]
): Promise<number> {
  let valorTotal = 0;

  for (const escala of escalas) {
    if (escala.status !== 'Aprovado') continue;

    // Find the contract item locally first
    const contratoItem = contratoItens.find(
      (ci) => ci.item_id === escala.item_contrato_id && ci.contrato_id === escala.contrato_id
    );

    if (contratoItem?.valor_unitario) {
      const totalHoras = calculateTotalEscalaHours(escala);
      valorTotal += totalHoras * contratoItem.valor_unitario;
    } else {
      // Fallback to database query
      try {
        const dbItem = await getContratoItemValue(escala.contrato_id, escala.item_contrato_id);
        if (dbItem?.valor_unitario) {
          const totalHoras = calculateTotalEscalaHours(escala);
          valorTotal += totalHoras * dbItem.valor_unitario;
        }
      } catch (error) {
        console.error('Erro ao calcular valor da escala:', error);
      }
    }
  }

  return valorTotal;
}

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
