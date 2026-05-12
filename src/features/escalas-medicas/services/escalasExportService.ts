/**
 * Escalas Export Service
 *
 * Handles PDF and XLSX export generation.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { format, parseISO, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Checks if a schedule is overnight (ends the next day).
 * Returns true if horario_saida < horario_entrada (e.g., 07:00 < 19:00)
 */
function isOvernightShift(horarioEntrada: string, horarioSaida: string): boolean {
  const entrada = horarioEntrada.substring(0, 5);
  const saida = horarioSaida.substring(0, 5);
  return saida < entrada;
}

/**
 * Local hours calculation without importing the full utility (avoids circular dep).
 */
function calculateEscalaHoursLocal(horarioEntrada: string, horarioSaida: string): number {
  const [eh, em] = horarioEntrada.substring(0, 5).split(':').map(Number);
  const [sh, sm] = horarioSaida.substring(0, 5).split(':').map(Number);
  const entMin = eh * 60 + em;
  const saiMin = sh * 60 + sm;
  const durMin = saiMin >= entMin ? saiMin - entMin : 1440 - entMin + saiMin;
  return durMin / 60;
}
import type {
  EscalaMedica,
  Contrato,
  UnidadeHospitalar,
  ItemContrato,
  ContratoItem,
} from "../types/escalas.types";
import { calculateTotalEscalaHours } from "../utils/escalasHoursUtils";
import { getContratoItemValue } from "./escalasService";
import { supabase } from "../../../lib/supabase";

// ============================================
// XLSX Export
// ============================================

export interface CsvExportData {
  escalas: EscalaMedica[];
  contratos: Contrato[];
  unidades: UnidadeHospitalar[];
  todosItensContrato: ItemContrato[];
}

/**
 * Export escalas to XLSX (Excel) format.
 */
export function exportToCSV(data: CsvExportData): void {
  const { escalas, contratos, unidades, todosItensContrato } = data;

  // Headers
  const headers = [
    "Data",
    "Horário Entrada",
    "Horário Saída",
    "Contrato",
    "Parceiro",
    "Unidade",
    "Item Contrato",
    "Status",
    "Escala paga?",
    "Horário Pgto Início",
    "Horário Pgto Fim",
    "Duração do Pagamento (h)",
    "Médicos",
    "CPFs",
    "Observações",
    "Justificativa",
    "Alterado Por",
    "Data Alteração",
  ];

  // Build rows
  const rows = escalas.map((escala) => {
    const contrato = contratos.find((c) => c.id === escala.contrato_id);
    const unidade = unidades.find(
      (u) => u.id === contrato?.unidade_hospitalar_id,
    );
    const itemContrato = todosItensContrato.find(
      (i) => i.id === escala.item_contrato_id,
    );
    const medicos = escala.medicos.map((m) => m.nome).join("; ");
    const cpfs = escala.medicos.map((m) => m.cpf).join("; ");

    // Payment datetime & duration for Aprovado com Glosa
    let horarioPgtoInicio = "";
    let horarioPgtoFim = "";
    let duracaoPgto = "";
    if (escala.status === "Aprovado com Glosa") {
      if (escala.horario_pagamento_inicio && escala.horario_pagamento_fim) {
        horarioPgtoInicio = format(
          new Date(escala.horario_pagamento_inicio),
          "dd/MM/yyyy HH:mm"
        );
        horarioPgtoFim = format(
          new Date(escala.horario_pagamento_fim),
          "dd/MM/yyyy HH:mm"
        );
        const diffMs =
          new Date(escala.horario_pagamento_fim).getTime() -
          new Date(escala.horario_pagamento_inicio).getTime();
        duracaoPgto = (diffMs / 3_600_000).toFixed(2);
      } else {
        horarioPgtoInicio = "Horário original";
        horarioPgtoFim = "Horário original";
        duracaoPgto = calculateEscalaHoursLocal(
          escala.horario_entrada,
          escala.horario_saida
        ).toFixed(2);
      }
    }

    return [
      format(parseISO(escala.data_inicio), "dd/MM/yyyy"),
      escala.horario_entrada.substring(0, 5),
      escala.horario_saida.substring(0, 5),
      contrato?.nome || "N/A",
      contrato?.empresa || "N/A",
      unidade?.nome || "N/A",
      itemContrato?.nome || "N/A",
      escala.status,
      escala.status_pagamento,
      horarioPgtoInicio,
      horarioPgtoFim,
      duracaoPgto,
      medicos,
      cpfs,
      escala.observacoes || "",
      escala.justificativa || "",
      escala.status_alterado_por || "",
      escala.status_alterado_em
        ? format(parseISO(escala.status_alterado_em), "dd/MM/yyyy HH:mm")
        : "",
    ];
  });

  // Create worksheet data
  const worksheetData = [headers, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

  // Auto-adjust column widths
  const colWidths = headers.map((header, colIndex) => {
    const maxLength = Math.max(
      header.length,
      ...rows.map((row) => String(row[colIndex] ?? "").length)
    );
    return { wch: Math.min(Math.max(maxLength + 2, 10), 50) };
  });
  worksheet["!cols"] = colWidths;

  // Amber fill for "Aprovado com Glosa" rows + green for paid rows
  escalas.forEach((escala, rowIdx) => {
    const xlsxRow = rowIdx + 2; // +1 for header, +1 for 1-based index
    const statusColLetter = "H"; // Status is column H (index 7)
    const cellRef = `${statusColLetter}${xlsxRow}`;
    if (escala.status === "Aprovado com Glosa") {
      // Apply amber background to all cells in row
      for (let c = 0; c < headers.length; c++) {
        const col = XLSX.utils.encode_col(c);
        const ref = `${col}${xlsxRow}`;
        if (!worksheet[ref]) worksheet[ref] = { v: "", t: "s" };
        worksheet[ref].s = { fill: { patternType: "solid", fgColor: { rgb: "FFF3CD" } } };
      }
    } else if (escala.status_pagamento === "Sim") {
      // Soft green background for paid escalas
      const col = XLSX.utils.encode_col(8); // Column I = "Escala paga?"
      const ref = `${col}${xlsxRow}`;
      if (!worksheet[ref]) worksheet[ref] = { v: "Sim", t: "s" };
      worksheet[ref].s = { fill: { patternType: "solid", fgColor: { rgb: "D1FAE5" } } };
    }
    // Suppress unused variable warning
    void cellRef;
  });

  // Create workbook and download
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Escalas Médicas");

  XLSX.writeFile(
    workbook,
    `escalas_medicas_${format(new Date(), "yyyy-MM-dd_HHmmss")}.xlsx`
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
  const { escalas, contratos, unidades, todosItensContrato, contratoItens } =
    data;

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  // Theme colors
  const primaryColor: [number, number, number] = [14, 165, 233]; // #0ea5e9
  const goldColor: [number, number, number] = [251, 191, 36]; // #fbbf24

  const pageWidth = doc.internal.pageSize.getWidth();

  // Header background
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, pageWidth, 35, "F");

  // Logo/App name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("Parcer", 15, 15);

  doc.setTextColor(goldColor[0], goldColor[1], goldColor[2]);
  doc.text("IA", 42, 15);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Gestão Inteligente de Acessos e Parcerias", 15, 22);

  // Report title
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Relatório de Escalas Médicas", 15, 32);

  // Report info (right side)
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(255, 255, 255);
  const dataRelatorio = format(new Date(), "dd/MM/yyyy 'às' HH:mm", {
    locale: ptBR,
  });
  doc.text(`Gerado em: ${dataRelatorio}`, pageWidth - 15, 15, {
    align: "right",
  });
  doc.text(`Total de escalas: ${escalas.length}`, pageWidth - 15, 22, {
    align: "right",
  });
  doc.text("Powered by Daher.lab - Agir", pageWidth - 15, 29, {
    align: "right",
  });

  // Build table data - fetch documentos PEP for each escala
  const amberColor: [number, number, number] = [217, 119, 6]; // #d97706
  const amberBg: [number, number, number] = [255, 243, 205]; // #FFF3CD

  const tableData = await Promise.all(
    escalas.map(async (escala) => {
      const contrato = contratos.find((c) => c.id === escala.contrato_id);
      const unidade = unidades.find(
        (u) => u.id === contrato?.unidade_hospitalar_id,
      );
      const itemContrato = todosItensContrato.find(
        (i) => i.id === escala.item_contrato_id,
      );
      const medicos = escala.medicos.map((m) => m.nome).join("\n");

      // Get sum of documentos PEP for this schedule
      const documentosPep = await getDocumentosPepSum(escala);

      // Payment datetime for Aprovado com Glosa
      let horarioDisplay = `${escala.horario_entrada.substring(0, 5)} - ${escala.horario_saida.substring(0, 5)}`;
      if (
        escala.status === "Aprovado com Glosa" &&
        escala.horario_pagamento_inicio &&
        escala.horario_pagamento_fim
      ) {
        const pgtoInicio = format(new Date(escala.horario_pagamento_inicio), "HH:mm");
        const pgtoFim = format(new Date(escala.horario_pagamento_fim), "HH:mm");
        horarioDisplay += `\nPgto: ${pgtoInicio} - ${pgtoFim}`;
      }

      return [
        format(parseISO(escala.data_inicio), "dd/MM/yyyy"),
        horarioDisplay,
        contrato?.nome || "N/A",
        contrato?.empresa || "N/A",
        unidade?.nome || "N/A",
        itemContrato?.nome || "N/A",
        medicos,
        documentosPep.toString(),
        escala.status,
        escala.status_pagamento,
      ];
    }),
  );

  // Create table
  autoTable(doc, {
    startY: 40,
    head: [
      [
        "Data",
        "Horário",
        "Contrato",
        "Parceiro",
        "Unidade",
        "Item",
        "Médicos",
        "Docs no PEP",
        "Status",
        "Pago?",
      ],
    ],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
      halign: "center",
    },
    styles: {
      fontSize: 8,
      cellPadding: 3,
      overflow: "linebreak",
    },
    columnStyles: {
      0: { cellWidth: 20, halign: "center" },
      1: { cellWidth: 25, halign: "center" },
      2: { cellWidth: 32 },
      3: { cellWidth: 28 },
      4: { cellWidth: 28 },
      5: { cellWidth: 25 },
      6: { cellWidth: 35 },
      7: { cellWidth: 14, halign: "center" },
      8: { cellWidth: 22, halign: "center" },
      9: { cellWidth: 12, halign: "center" },
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    margin: { left: 15, right: 15 },
    didParseCell: (data) => {
      // Amber left border + background for Aprovado com Glosa rows
      const rowData = tableData[data.row.index];
      if (rowData && rowData[8] === "Aprovado com Glosa") {
        data.cell.styles.fillColor = amberBg;
        data.cell.styles.textColor = amberColor;
        if (data.column.index === 0) {
          data.cell.styles.lineWidthLeft = 2;
          data.cell.styles.drawColor = amberColor;
        }
      }
    },
  });

  // Calculate total value for approved escalas
  const valorTotalAprovadas = await calculateApprovedEscalasValue(
    escalas,
    contratoItens,
  );
  const escalasAprovadas = escalas.filter(
    (e) => e.status === "Aprovado" || e.status === "Aprovado com Glosa"
  );
  const escalasPagas = escalas.filter((e) => e.status_pagamento === "Sim");

  // Add footer with page numbers
  const pageCount = doc.getNumberOfPages();
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();

    // Page number
    doc.text(`Página ${i} de ${pageCount}`, pageWidth / 2, pageHeight - 10, {
      align: "center",
    });

    // Add approved escalas summary on last page
    if (i === pageCount && escalasAprovadas.length > 0) {
      // Green box for approved summary
      doc.setFillColor(46, 204, 113);
      doc.roundedRect(pageWidth - 165, pageHeight - 27, 150, 22, 3, 3, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("ESCALAS APROVADAS (incl. Aprovado com Glosa)", pageWidth - 90, pageHeight - 21, {
        align: "center",
      });

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(
        `Qtd: ${escalasAprovadas.length} | Pagas: ${escalasPagas.length}`,
        pageWidth - 90,
        pageHeight - 16,
        { align: "center" },
      );

      // Total value
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      const valorFormatado = valorTotalAprovadas.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      doc.text(
        `Valor Total: R$ ${valorFormatado}`,
        pageWidth - 90,
        pageHeight - 10,
        {
          align: "center",
        },
      );

      // Explanatory note
      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);
      doc.setFont("helvetica", "italic");
      doc.text(
        "* Cálculo: Horas trabalhadas × Valor unitário × Número de médicos",
        15,
        pageHeight - 18,
      );
    }
  }

  // Download PDF
  doc.save(`escalas_medicas_${format(new Date(), "yyyy-MM-dd_HHmmss")}.pdf`);
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get the sum of qtd_documentos_pep for doctors in a schedule on a specific date.
 * Searches by doctor names in the produtividade table.
 * For overnight shifts (e.g., 19:00 - 07:00), also includes productivity from the next day.
 */
async function getDocumentosPepSum(escala: EscalaMedica): Promise<number> {
  try {
    const dataEscala = parseISO(escala.data_inicio);
    const dataFormatada = format(dataEscala, "yyyy-MM-dd");
    const medicoNames = escala.medicos.map((m) => m.nome);

    if (medicoNames.length === 0) return 0;

    // Check if it's an overnight shift
    const overnight = isOvernightShift(escala.horario_entrada, escala.horario_saida);
    const dataSeguinteFormatada = overnight
      ? format(addDays(dataEscala, 1), "yyyy-MM-dd")
      : null;

    // Query productivity for all doctors by name on the schedule date
    const { data: produtividadeDia, error: errorDia } = await supabase
      .from("produtividade")
      .select("nome, qtd_documentos_pep")
      .in("nome", medicoNames)
      .eq("data", dataFormatada);

    if (errorDia) {
      console.error("Error fetching documentos PEP:", errorDia);
    }

    // For overnight shifts, also query the next day
    let produtividadeSeguinte: typeof produtividadeDia = [];
    if (overnight && dataSeguinteFormatada) {
      const { data: prodSeguinte, error: errorSeguinte } = await supabase
        .from("produtividade")
        .select("nome, qtd_documentos_pep")
        .in("nome", medicoNames)
        .eq("data", dataSeguinteFormatada);

      if (errorSeguinte) {
        console.error("Error fetching documentos PEP (next day):", errorSeguinte);
      }
      produtividadeSeguinte = prodSeguinte || [];
    }

    // Combine productivity from both days
    const allProdutividade = [...(produtividadeDia || []), ...produtividadeSeguinte];

    // Sum all qtd_documentos_pep values
    const total = allProdutividade.reduce((sum, record) => {
      return sum + (record.qtd_documentos_pep || 0);
    }, 0);

    return total;
  } catch (error) {
    console.error("Error in getDocumentosPepSum:", error);
    return 0;
  }
}

/**
 * Calculate total value for approved escalas.
 */
async function calculateApprovedEscalasValue(
  escalas: EscalaMedica[],
  contratoItens: ContratoItem[],
): Promise<number> {
  let valorTotal = 0;

  for (const escala of escalas) {
    if (escala.status !== "Aprovado" && escala.status !== "Aprovado com Glosa") continue;

    // Find the contract item locally first
    const contratoItem = contratoItens.find(
      (ci) =>
        ci.item_id === escala.item_contrato_id &&
        ci.contrato_id === escala.contrato_id,
    );

    if (contratoItem?.valor_unitario) {
      const totalHoras = calculateTotalEscalaHours(escala);
      valorTotal += totalHoras * contratoItem.valor_unitario;
    } else {
      // Fallback to database query
      try {
        const dbItem = await getContratoItemValue(
          escala.contrato_id,
          escala.item_contrato_id,
        );
        if (dbItem?.valor_unitario) {
          const totalHoras = calculateTotalEscalaHours(escala);
          valorTotal += totalHoras * dbItem.valor_unitario;
        }
      } catch (error) {
        console.error("Erro ao calcular valor da escala:", error);
      }
    }
  }

  return valorTotal;
}

/**
 * Download a file with the given content.
 */
function downloadFile(
  content: string,
  filename: string,
  mimeType: string,
): void {
  const blob = new Blob([content], { type: mimeType });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
