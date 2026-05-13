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
function isOvernightShift(
  horarioEntrada: string,
  horarioSaida: string,
): boolean {
  const entrada = horarioEntrada.substring(0, 5);
  const saida = horarioSaida.substring(0, 5);
  return saida < entrada;
}

/**
 * Local hours calculation without importing the full utility (avoids circular dep).
 */
function calculateEscalaHoursLocal(
  horarioEntrada: string,
  horarioSaida: string,
): number {
  const [eh, em] = horarioEntrada.substring(0, 5).split(":").map(Number);
  const [sh, sm] = horarioSaida.substring(0, 5).split(":").map(Number);
  const entMin = eh * 60 + em;
  const saiMin = sh * 60 + sm;
  const durMin = saiMin >= entMin ? saiMin - entMin : 1440 - entMin + saiMin;
  return durMin / 60;
}

/**
 * Format a number as Brazilian currency string.
 */
function fmtCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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
// Memorial Helper
// ============================================

interface MemorialRow {
  nome: string;
  valorUnitario: number;
  totalHoras: number;
  totalValor: number;
}

function buildMemorialRows(
  escalas: EscalaMedica[],
  todosItensContrato: ItemContrato[],
  contratoItens: ContratoItem[],
): MemorialRow[] {
  const map = new Map<string, MemorialRow>();

  for (const escala of escalas) {
    const itemContrato = todosItensContrato.find(
      (i) => i.id === escala.item_contrato_id,
    );
    const contratoItem = contratoItens.find(
      (ci) =>
        ci.item_id === escala.item_contrato_id &&
        ci.contrato_id === escala.contrato_id,
    );

    const nome = itemContrato?.nome || `Item ${escala.item_contrato_id}`;
    const valorUnitario = contratoItem?.valor_unitario ?? 0;
    const horas = calculateTotalEscalaHours(escala);
    const key = `${escala.contrato_id}_${escala.item_contrato_id}`;

    const existing = map.get(key);
    if (existing) {
      existing.totalHoras += horas;
      existing.totalValor += valorUnitario * horas;
    } else {
      map.set(key, {
        nome,
        valorUnitario,
        totalHoras: horas,
        totalValor: valorUnitario * horas,
      });
    }
  }

  return Array.from(map.values());
}

// ============================================
// XLSX Export
// ============================================

export interface CsvExportData {
  escalas: EscalaMedica[];
  contratos: Contrato[];
  unidades: UnidadeHospitalar[];
  todosItensContrato: ItemContrato[];
  contratoItens: ContratoItem[];
}

/**
 * Export escalas to XLSX (Excel) format.
 */
export async function exportToCSV(data: CsvExportData): Promise<void> {
  const { escalas, contratos, unidades, todosItensContrato, contratoItens } =
    data;

  // ── Determine if "Docs no PEP" column applies ────────────────────────────
  const showDocsPep = escalas.some((escala) => {
    const contrato = contratos.find((c) => c.id === escala.contrato_id);
    const unidade = unidades.find(
      (u) => u.id === contrato?.unidade_hospitalar_id,
    );
    return !unidade?.possui_gestao_acesso;
  });

  // ── Email lookup for "Alterado Por" ──────────────────────────────────────
  const userIds = [
    ...new Set(escalas.map((e) => e.status_alterado_por).filter(Boolean)),
  ] as string[];
  const emailMap = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: usuarios } = await supabase
      .from("usuarios")
      .select("id, email")
      .in("id", userIds);
    (usuarios || []).forEach((u: { id: string; email: string | null }) => {
      if (u.email) emailMap.set(u.id, u.email);
    });
  }

  // ── Headers ──────────────────────────────────────────────────────────────
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
  if (showDocsPep) headers.splice(7, 0, "Docs no PEP");

  // ── Build rows ────────────────────────────────────────────────────────────
  const rows = await Promise.all(
    escalas.map(async (escala) => {
      const contrato = contratos.find((c) => c.id === escala.contrato_id);
      const unidade = unidades.find(
        (u) => u.id === contrato?.unidade_hospitalar_id,
      );
      const itemContrato = todosItensContrato.find(
        (i) => i.id === escala.item_contrato_id,
      );
      const medicos = escala.medicos.map((m) => m.nome).join("; ");
      const cpfs = escala.medicos.map((m) => m.cpf).join("; ");

      // Docs no PEP (only when column is shown)
      const docsPep = showDocsPep
        ? (await getDocumentosPepSum(escala)).toString()
        : undefined;

      // Payment datetime & duration for Aprovado com Glosa
      let horarioPgtoInicio = "";
      let horarioPgtoFim = "";
      let duracaoPgto = "";
      if (escala.status === "Aprovado com Glosa") {
        if (escala.horario_pagamento_inicio && escala.horario_pagamento_fim) {
          horarioPgtoInicio = format(
            new Date(escala.horario_pagamento_inicio),
            "dd/MM/yyyy HH:mm",
          );
          horarioPgtoFim = format(
            new Date(escala.horario_pagamento_fim),
            "dd/MM/yyyy HH:mm",
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
            escala.horario_saida,
          ).toFixed(2);
        }
      }

      // Email instead of UUID for "Alterado Por"
      const alteradoPor = escala.status_alterado_por
        ? emailMap.get(escala.status_alterado_por) || escala.status_alterado_por
        : "";

      const row: (string | number)[] = [
        format(parseISO(escala.data_inicio), "dd/MM/yyyy"),
        escala.horario_entrada.substring(0, 5),
        escala.horario_saida.substring(0, 5),
        contrato?.nome || "N/A",
        contrato?.empresa || "N/A",
        unidade?.nome || "N/A",
        itemContrato?.nome || "N/A",
      ];

      if (showDocsPep) row.push(docsPep!);

      row.push(
        escala.status,
        escala.status_pagamento,
        horarioPgtoInicio,
        horarioPgtoFim,
        duracaoPgto,
        medicos,
        cpfs,
        escala.observacoes || "",
        escala.justificativa || "",
        alteradoPor,
        escala.status_alterado_em
          ? format(parseISO(escala.status_alterado_em), "dd/MM/yyyy HH:mm")
          : "",
      );

      return row;
    }),
  );

  // ── Create main worksheet ─────────────────────────────────────────────────
  const worksheetData = [headers, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

  // Auto-adjust column widths
  const colWidths = headers.map((header, colIndex) => {
    const maxLength = Math.max(
      header.length,
      ...rows.map((row) => String(row[colIndex] ?? "").length),
    );
    return { wch: Math.min(Math.max(maxLength + 2, 10), 50) };
  });
  worksheet["!cols"] = colWidths;

  // Status column index shifts when Docs no PEP is shown
  const statusColIdx = showDocsPep ? 8 : 7;
  const paidColIdx = showDocsPep ? 9 : 8;

  // Amber fill for "Aprovado com Glosa" rows + green for paid rows
  escalas.forEach((escala, rowIdx) => {
    const xlsxRow = rowIdx + 2; // +1 for header, +1 for 1-based index
    if (escala.status === "Aprovado com Glosa") {
      for (let c = 0; c < headers.length; c++) {
        const col = XLSX.utils.encode_col(c);
        const ref = `${col}${xlsxRow}`;
        if (!worksheet[ref]) worksheet[ref] = { v: "", t: "s" };
        worksheet[ref].s = {
          fill: { patternType: "solid", fgColor: { rgb: "FFF3CD" } },
        };
      }
    } else if (escala.status_pagamento === "Sim") {
      const col = XLSX.utils.encode_col(paidColIdx);
      const ref = `${col}${xlsxRow}`;
      if (!worksheet[ref]) worksheet[ref] = { v: "Sim", t: "s" };
      worksheet[ref].s = {
        fill: { patternType: "solid", fgColor: { rgb: "D1FAE5" } },
      };
    }
    void statusColIdx;
    void paidColIdx;
  });

  // ── Memorial Executivo de Cálculo — second sheet ──────────────────────────
  const memorialRows = buildMemorialRows(
    escalas,
    todosItensContrato,
    contratoItens,
  );
  const grandTotal = memorialRows.reduce((sum, r) => sum + r.totalValor, 0);

  const primaryHex = "0EA5E9";
  const memorialHeader = [
    "Item de Contrato",
    "Valor Unitário (R$)",
    "Quantidade (h)",
    "Total (R$)",
  ];
  const memorialData: (string | number)[][] = [
    ["MEMORIAL EXECUTIVO DE CÁLCULO"],
    [],
    memorialHeader,
    ...memorialRows.map((r) => [
      r.nome,
      r.valorUnitario,
      parseFloat(r.totalHoras.toFixed(2)),
      parseFloat(r.totalValor.toFixed(2)),
    ]),
    [],
    ["TOTAL GERAL", "", "", parseFloat(grandTotal.toFixed(2))],
  ];

  const memorialWs = XLSX.utils.aoa_to_sheet(memorialData);

  // Style the title cell
  if (memorialWs["A1"]) {
    memorialWs["A1"].s = {
      font: { bold: true, sz: 14, color: { rgb: primaryHex } },
    };
  }

  // Style the header row (row 3, index 2 → xlsx row 3)
  memorialHeader.forEach((_, colIdx) => {
    const ref = `${XLSX.utils.encode_col(colIdx)}3`;
    if (!memorialWs[ref])
      memorialWs[ref] = { v: memorialHeader[colIdx], t: "s" };
    memorialWs[ref].s = {
      fill: { patternType: "solid", fgColor: { rgb: primaryHex } },
      font: { bold: true, color: { rgb: "FFFFFF" } },
    };
  });

  // Style the TOTAL GERAL row
  const totalRowIdx = memorialData.length; // 1-based xlsx row
  const totalCols = ["A", "B", "C", "D"];
  totalCols.forEach((col) => {
    const ref = `${col}${totalRowIdx}`;
    if (!memorialWs[ref]) memorialWs[ref] = { v: "", t: "s" };
    memorialWs[ref].s = {
      fill: { patternType: "solid", fgColor: { rgb: "DCFCE7" } },
      font: { bold: true },
    };
  });

  // Column widths for memorial sheet
  memorialWs["!cols"] = [{ wch: 40 }, { wch: 22 }, { wch: 18 }, { wch: 20 }];

  // ── Build workbook ────────────────────────────────────────────────────────
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Escalas Médicas");
  XLSX.utils.book_append_sheet(workbook, memorialWs, "Memorial Executivo");

  XLSX.writeFile(
    workbook,
    `escalas_medicas_${format(new Date(), "yyyy-MM-dd_HHmmss")}.xlsx`,
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

  // ── Determine if "Docs no PEP" column applies ────────────────────────────
  const showDocsPep = escalas.some((escala) => {
    const contrato = contratos.find((c) => c.id === escala.contrato_id);
    const unidade = unidades.find(
      (u) => u.id === contrato?.unidade_hospitalar_id,
    );
    return !unidade?.possui_gestao_acesso;
  });

  // ── Build table data ──────────────────────────────────────────────────────
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

      // Payment datetime for Aprovado com Glosa
      let horarioDisplay = `${escala.horario_entrada.substring(0, 5)} - ${escala.horario_saida.substring(0, 5)}`;
      if (
        escala.status === "Aprovado com Glosa" &&
        escala.horario_pagamento_inicio &&
        escala.horario_pagamento_fim
      ) {
        const pgtoInicio = format(
          new Date(escala.horario_pagamento_inicio),
          "HH:mm",
        );
        const pgtoFim = format(new Date(escala.horario_pagamento_fim), "HH:mm");
        horarioDisplay += `\nPgto: ${pgtoInicio} - ${pgtoFim}`;
      }

      const row: string[] = [
        format(parseISO(escala.data_inicio), "dd/MM/yyyy"),
        horarioDisplay,
        contrato?.nome || "N/A",
        contrato?.empresa || "N/A",
        unidade?.nome || "N/A",
        itemContrato?.nome || "N/A",
        medicos,
      ];

      if (showDocsPep) {
        const documentosPep = await getDocumentosPepSum(escala);
        row.push(documentosPep.toString());
      }

      row.push(escala.status, escala.status_pagamento);

      return row;
    }),
  );

  // ── Column config (adapts to showDocsPep) ────────────────────────────────
  const headRow = [
    "Data",
    "Horário",
    "Contrato",
    "Parceiro",
    "Unidade",
    "Item",
    "Médicos",
  ];
  if (showDocsPep) headRow.push("Docs no PEP");
  headRow.push("Status", "Pago?");

  // Status and Pago? are always the last two columns
  const statusIdx = headRow.length - 2;

  const columnStyles: Record<number, object> = {
    0: { cellWidth: 20, halign: "center" },
    1: { cellWidth: 25, halign: "center" },
    2: { cellWidth: 32 },
    3: { cellWidth: 28 },
    4: { cellWidth: 28 },
    5: { cellWidth: 25 },
    6: { cellWidth: 35 },
  };

  if (showDocsPep) {
    columnStyles[7] = { cellWidth: 14, halign: "center" };
    columnStyles[8] = { cellWidth: 22, halign: "center" };
    columnStyles[9] = { cellWidth: 18, halign: "center" }; // Pago? — wider to prevent line break
  } else {
    columnStyles[7] = { cellWidth: 22, halign: "center" };
    columnStyles[8] = { cellWidth: 18, halign: "center" }; // Pago? — wider to prevent line break
  }

  // ── Main table ────────────────────────────────────────────────────────────
  autoTable(doc, {
    startY: 40,
    head: [headRow],
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
    columnStyles,
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 15, right: 15 },
    didParseCell: (data) => {
      if (data.row.section === "head") return;
      const rowData = tableData[data.row.index];
      if (rowData && rowData[statusIdx] === "Aprovado com Glosa") {
        data.cell.styles.fillColor = amberBg;
        data.cell.styles.textColor = amberColor;
        if (data.column.index === 0) {
          data.cell.styles.lineWidth = 2;
        }
      }
    },
  });

  // ── Memorial Executivo de Cálculo ─────────────────────────────────────────
  const memorialRows = buildMemorialRows(
    escalas,
    todosItensContrato,
    contratoItens,
  );
  const grandTotal = memorialRows.reduce((sum, r) => sum + r.totalValor, 0);

  // Position after main table
  const afterMainTable = (doc as any).lastAutoTable?.finalY ?? 40;

  // Section title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(14, 165, 233);
  doc.text("Memorial Executivo de Cálculo", 15, afterMainTable + 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(
    "Resumo consolidado por item de contrato com base nas escalas exportadas.",
    15,
    afterMainTable + 18,
  );

  const darkGreen: [number, number, number] = [22, 163, 74];
  const lightGreen: [number, number, number] = [220, 252, 231];

  autoTable(doc, {
    startY: afterMainTable + 22,
    head: [
      [
        "Item de Contrato",
        "Valor Unitário (R$)",
        "Quantidade (h)",
        "Total (R$)",
      ],
    ],
    body: [
      ...memorialRows.map((r) => [
        r.nome,
        `R$ ${fmtCurrency(r.valorUnitario)}`,
        r.totalHoras.toFixed(2),
        `R$ ${fmtCurrency(r.totalValor)}`,
      ]),
      // Grand total row
      [
        {
          content: "TOTAL GERAL",
          styles: {
            fontStyle: "bold",
            fillColor: lightGreen,
            textColor: darkGreen,
          },
        },
        { content: "", styles: { fillColor: lightGreen } },
        { content: "", styles: { fillColor: lightGreen } },
        {
          content: `R$ ${fmtCurrency(grandTotal)}`,
          styles: {
            fontStyle: "bold",
            fillColor: lightGreen,
            textColor: darkGreen,
            halign: "right",
          },
        },
      ],
    ],
    theme: "grid",
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
      halign: "center",
    },
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 40, halign: "center" },
      2: { cellWidth: 30, halign: "center" },
      3: { cellWidth: 40, halign: "right" },
    },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 15, right: 15 },
  });

  // ── Summary & page footer ─────────────────────────────────────────────────
  const valorTotalAprovadas = await calculateApprovedEscalasValue(
    escalas,
    contratoItens,
  );
  const escalasAprovadas = escalas.filter(
    (e) => e.status === "Aprovado" || e.status === "Aprovado com Glosa",
  );
  const escalasPagas = escalas.filter((e) => e.status_pagamento === "Sim");

  const pageCount = doc.getNumberOfPages();
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();

    doc.text(`Página ${i} de ${pageCount}`, pageWidth / 2, pageHeight - 10, {
      align: "center",
    });

    if (i === pageCount && escalasAprovadas.length > 0) {
      doc.setFillColor(46, 204, 113);
      doc.roundedRect(pageWidth - 165, pageHeight - 27, 150, 22, 3, 3, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text(
        "VALOR TOTAL DAS ESCALAS APROVADAS (incl. Aprovado com Glosa)",
        pageWidth - 90,
        pageHeight - 21,
        { align: "center" },
      );

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(
        `Qtd: ${escalasAprovadas.length} | Pagas: ${escalasPagas.length}`,
        pageWidth - 90,
        pageHeight - 16,
        { align: "center" },
      );

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(
        `Valor Total: R$ ${fmtCurrency(valorTotalAprovadas)}`,
        pageWidth - 90,
        pageHeight - 10,
        { align: "center" },
      );

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

  doc.save(`escalas_medicas_${format(new Date(), "yyyy-MM-dd_HHmmss")}.pdf`);
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get the sum of qtd_documentos_pep for doctors in a schedule on a specific date.
 */
async function getDocumentosPepSum(escala: EscalaMedica): Promise<number> {
  try {
    const dataEscala = parseISO(escala.data_inicio);
    const dataFormatada = format(dataEscala, "yyyy-MM-dd");
    const medicoNames = escala.medicos.map((m) => m.nome);

    if (medicoNames.length === 0) return 0;

    const overnight = isOvernightShift(
      escala.horario_entrada,
      escala.horario_saida,
    );
    const dataSeguinteFormatada = overnight
      ? format(addDays(dataEscala, 1), "yyyy-MM-dd")
      : null;

    const { data: produtividadeDia, error: errorDia } = await supabase
      .from("produtividade")
      .select("nome, qtd_documentos_pep")
      .in("nome", medicoNames)
      .eq("data", dataFormatada);

    if (errorDia) console.error("Error fetching documentos PEP:", errorDia);

    let produtividadeSeguinte: typeof produtividadeDia = [];
    if (overnight && dataSeguinteFormatada) {
      const { data: prodSeguinte, error: errorSeguinte } = await supabase
        .from("produtividade")
        .select("nome, qtd_documentos_pep")
        .in("nome", medicoNames)
        .eq("data", dataSeguinteFormatada);

      if (errorSeguinte)
        console.error(
          "Error fetching documentos PEP (next day):",
          errorSeguinte,
        );
      produtividadeSeguinte = prodSeguinte || [];
    }

    const allProdutividade = [
      ...(produtividadeDia || []),
      ...produtividadeSeguinte,
    ];
    return allProdutividade.reduce(
      (sum, r) => sum + (r.qtd_documentos_pep || 0),
      0,
    );
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
    if (escala.status !== "Aprovado" && escala.status !== "Aprovado com Glosa")
      continue;

    const contratoItem = contratoItens.find(
      (ci) =>
        ci.item_id === escala.item_contrato_id &&
        ci.contrato_id === escala.contrato_id,
    );

    if (contratoItem?.valor_unitario) {
      const totalHoras = calculateTotalEscalaHours(escala);
      valorTotal += totalHoras * contratoItem.valor_unitario;
    } else {
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
