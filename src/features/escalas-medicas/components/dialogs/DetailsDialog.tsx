/**
 * DetailsDialog Component
 *
 * Dialog for displaying complete details of an escala,
 * including access logs and productivity metrics.
 */

import React, { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Alert,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  CircularProgress,
  useTheme,
} from "@mui/material";
import {
  CalendarMonth,
  Schedule,
  Person,
  Edit,
  CheckCircle,
  Cancel,
  HourglassEmpty,
  ThumbUpAlt,
  Warning,
  HowToReg,
  DeleteForever,
  PieChart,
  Payments,
  EditCalendar,
  BarChart,
  SwapVert,
  ArrowForward,
  Save,
  RestartAlt,
  Info,
} from "@mui/icons-material";
import { Divider } from "@mui/material";
import { format, parseISO, subDays, addDays, isSameDay, differenceInMinutes, isValid, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import type {
  EscalaMedica,
  Contrato,
  ItemContrato,
  ContratoItem,
  Usuario,
  StatusEscala,
} from "../../types/escalas.types";
import { updateBaseCalculo, updateHorariosPagamento } from "../../services/escalasService";
import {
  getStatusConfig,
  statusColorMap,
  canEditStatus,
  isEscalaPaga,
} from "../../utils/escalasStatusUtils";
import { shiftCrossesMidnight } from "../../utils/escalasHoursUtils";

// Icon mapping for status
const statusIconMap: Record<StatusEscala, React.ReactElement> = {
  Programado: <HourglassEmpty fontSize="small" />,
  "Pré-Aprovado": <ThumbUpAlt fontSize="small" />,
  "Aprovação Parcial": <HowToReg fontSize="small" />,
  Atenção: <Warning fontSize="small" />,
  Aprovado: <CheckCircle fontSize="small" />,
  "Aprovado com Glosa": <PieChart fontSize="small" />,
  Reprovado: <Cancel fontSize="small" />,
  Excluída: <DeleteForever fontSize="small" />,
};

// ============================================
// Productivity fields config
// ============================================

const PROD_FIELDS: Array<{ key: keyof ProdutividadeMedico; label: string }> = [
  { key: 'prescricao', label: 'Prescrição' },
  { key: 'evolucao', label: 'Evoluções' },
  { key: 'procedimento', label: 'Procedimentos' },
  { key: 'urgencia', label: 'Urgências' },
  { key: 'parecer_solicitado', label: 'Parecer Solicitado' },
  { key: 'parecer_realizado', label: 'Parecer Realizado' },
  { key: 'ambulatorio', label: 'Ambulatórios' },
  { key: 'evolucao_noturna_cti', label: 'Evol. Noturna CTI' },
  { key: 'evolucao_diurna_cti', label: 'Evol. Diurna CTI' },
  { key: 'cirurgia_realizada', label: 'Cirurgias' },
  { key: 'folha_objetivo_diario', label: 'Folha Obj. Diário' },
  { key: 'qtd_documentos_pep', label: 'Docs no PEP' },
];

// ============================================
// Types
// ============================================

interface AcessoMedico {
  data_acesso: string;
  sentido: "E" | "S";
  planta?: string;
  codin?: string;
}

interface ProdutividadeMedico {
  prescricao: number;
  evolucao: number;
  procedimento: number;
  urgencia: number;
  parecer_solicitado: number;
  parecer_realizado: number;
  ambulatorio: number;
  evolucao_noturna_cti: number;
  evolucao_diurna_cti: number;
  cirurgia_realizada: number;
  folha_objetivo_diario: number;
  qtd_documentos_pep: number;
}

// ============================================
// Props
// ============================================

export interface DetailsDialogProps {
  open: boolean;
  onClose: () => void;
  escala: EscalaMedica | null;
  contratos: Contrato[];
  todosItensContrato: ItemContrato[];
  usuarioAlterouStatus: Usuario | null;
  acessosMedico: AcessoMedico[];
  produtividadeMedico: ProdutividadeMedico | null;
  loadingDetalhes: boolean;
  isAdminAgir: boolean;
  isAdminAgirCorporativo?: boolean;
  isAdminAgirPlanta?: boolean;
  isAdminTerceiro: boolean;
  isTerceiro?: boolean;
  contratoItens?: ContratoItem[];
  medicosCodigosMV?: Record<string, string | null>;
  onEdit: (escala: EscalaMedica) => void;
  onChangeStatus: (escala: EscalaMedica) => void;
  onDelete?: (escala: EscalaMedica) => void;
  onHorariosPagamentoUpdated?: () => void;
  onBaseCalculoUpdated?: () => void;
  scrollToHorarioPagamento?: boolean;
  onScrollToHorarioDone?: () => void;
}

// ============================================
// Component
// ============================================

export const DetailsDialog: React.FC<DetailsDialogProps> = ({
  open,
  onClose,
  escala,
  contratos,
  todosItensContrato,
  usuarioAlterouStatus,
  acessosMedico,
  produtividadeMedico,
  loadingDetalhes,
  isAdminAgir,
  isAdminAgirCorporativo = false,
  isAdminAgirPlanta = false,
  isAdminTerceiro,
  isTerceiro: _isTerceiro = false,
  contratoItens = [],
  medicosCodigosMV = {},
  onEdit,
  onChangeStatus,
  onDelete,
  onHorariosPagamentoUpdated,
  onBaseCalculoUpdated,
  scrollToHorarioPagamento = false,
  onScrollToHorarioDone,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [horarioPagamentoOpen, setHorarioPagamentoOpen] = useState(false);
  const horarioPagamentoRef = useRef<HTMLDivElement>(null);

  // ── Inline Horário de Pagamento form state ───────────────────────────────
  const [hpInicio, setHpInicio] = useState<Date | null>(null);
  const [hpFim, setHpFim] = useState<Date | null>(null);
  const [hpLoading, setHpLoading] = useState(false);
  const [hpError, setHpError] = useState('');

  // Initialize form values whenever the inline panel opens
  useEffect(() => {
    if (!horarioPagamentoOpen || !escala) return;
    setHpError('');
    if (escala.horario_pagamento_inicio && escala.horario_pagamento_fim) {
      setHpInicio(new Date(escala.horario_pagamento_inicio));
      setHpFim(new Date(escala.horario_pagamento_fim));
    } else {
      // Default to original schedule times
      const crossesMidnight = shiftCrossesMidnight(escala.horario_entrada, escala.horario_saida);
      const baseDate = escala.data_inicio.split('T')[0];
      const fimDate = crossesMidnight
        ? format(addDays(new Date(baseDate), 1), 'yyyy-MM-dd')
        : baseDate;
      setHpInicio(new Date(`${baseDate}T${escala.horario_entrada.length === 5 ? escala.horario_entrada + ':00' : escala.horario_entrada}`));
      setHpFim(new Date(`${fimDate}T${escala.horario_saida.length === 5 ? escala.horario_saida + ':00' : escala.horario_saida}`));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horarioPagamentoOpen]);

  const hpIsClearing = hpInicio === null && hpFim === null;
  const hpDurationMinutes =
    hpInicio && hpFim && isValid(hpInicio) && isValid(hpFim)
      ? differenceInMinutes(hpFim, hpInicio)
      : null;
  const hpDurationLabel =
    hpDurationMinutes !== null && hpDurationMinutes > 0
      ? `${Math.floor(hpDurationMinutes / 60)}h${hpDurationMinutes % 60 > 0 ? ` ${hpDurationMinutes % 60}min` : ''}`
      : '—';
  const hpIsValidRange =
    hpInicio !== null && hpFim !== null && isValid(hpInicio) && isValid(hpFim) && isAfter(hpFim, hpInicio);

  const handleSaveHorarioPagamento = async () => {
    if (!hpIsClearing && !hpIsValidRange) {
      setHpError('O horário de fim deve ser posterior ao horário de início.');
      return;
    }
    setHpLoading(true);
    setHpError('');
    try {
      await updateHorariosPagamento(
        escala!.id,
        hpInicio ? hpInicio.toISOString() : null,
        hpFim ? hpFim.toISOString() : null,
      );
      setHorarioPagamentoOpen(false);
      onHorariosPagamentoUpdated?.();
    } catch (err: any) {
      setHpError('Erro ao salvar: ' + err.message);
    } finally {
      setHpLoading(false);
    }
  };

  // Auto-scroll + auto-open Horário de Pagamento when signalled from parent
  useEffect(() => {
    if (!scrollToHorarioPagamento || !open) return;
    const timer = setTimeout(() => {
      horarioPagamentoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setHorarioPagamentoOpen(true);
      onScrollToHorarioDone?.();
    }, 200);
    return () => clearTimeout(timer);
  }, [scrollToHorarioPagamento, open, onScrollToHorarioDone]);

  // ── Base de cálculo state ────────────────────────────────────────────────
  const [pendingProdField, setPendingProdField] = useState<string | null>(null);
  const [localBaseCalculo, setLocalBaseCalculo] = useState<string | null>(null);
  const [localCampoProducao, setLocalCampoProducao] = useState<string | null>(null);
  const [savingBaseCalculo, setSavingBaseCalculo] = useState(false);
  const [baseCalculoError, setBaseCalculoError] = useState('');

  // Sync local state when escala or dialog open/close changes
  useEffect(() => {
    setLocalBaseCalculo(escala?.base_calculo ?? null);
    setLocalCampoProducao(escala?.campo_producao ?? null);
    setPendingProdField(null);
    setBaseCalculoError('');
  }, [escala?.id, open]);

  if (!escala) return null;

  const escalaPaga = isEscalaPaga(escala.status_pagamento);
  const isAprovadoComGlosa = escala.status === "Aprovado com Glosa";

  // Paid escalas and Excluída cannot be edited by anyone
  const canEdit =
    !escalaPaga &&
    escala.status !== "Excluída" &&
    canEditStatus(escala.status, isAdminAgir, isAdminTerceiro, escala.status_pagamento);
  const canChangeStatusFlag =
    isAdminAgir && !escalaPaga && escala.status !== "Excluída";
  const canDelete =
    !escalaPaga &&
    escala.status !== "Excluída" &&
    ((escala.status !== "Aprovado" &&
      escala.status !== "Reprovado" &&
      escala.status !== "Aprovado com Glosa") ||
      isAdminAgir);

  const getEditTooltip = () => {
    if (canEdit) return "";
    if (escalaPaga) {
      return "Esta escala já foi paga e não pode ser editada.";
    }
    if (escala.status === "Excluída") {
      return "Escalas excluídas não podem ser editadas.";
    }
    const allowedStatuses = isAdminTerceiro
      ? '"Programado", "Atenção" ou "Aprovação Parcial"'
      : '"Programado", "Aprovação Parcial", "Aprovado" ou "Aprovado com Glosa"';
    return `Não é possível editar. Apenas escalas com status ${allowedStatuses} podem ser editadas.`;
  };

  const getStatusChangeTooltip = () => {
    if (canChangeStatusFlag) return "";
    if (escalaPaga) {
      return "Esta escala já foi paga. O status não pode ser alterado.";
    }
    if (escala.status === "Excluída") {
      return "Escalas excluídas não podem ter o status alterado.";
    }
    return `Status bloqueado. Escalas ${escala.status.toLowerCase()}s não podem ter o status alterado.`;
  };

  const getDeleteTooltip = () => {
    if (canDelete) return "";
    if (escalaPaga) {
      return "Esta escala já foi paga e não pode ser excluída.";
    }
    if (escala.status === "Excluída") {
      return "Esta escala já foi excluída.";
    }
    return `Não é possível excluir. Escalas ${escala.status.toLowerCase()}s não podem ser excluídas.`;
  };

  // ── Base de cálculo derived values ────────────────────────────────────────
  const contratoItem = contratoItens.find(
    (ci) => ci.item_id === escala.item_contrato_id && ci.contrato_id === escala.contrato_id,
  );
  const valorUnitario = contratoItem?.valor_unitario ?? 0;

  const canChangeBaseCalculo = (isAdminAgirCorporativo || isAdminAgirPlanta) && !escalaPaga && !!produtividadeMedico;

  const activeProdLabel =
    localCampoProducao
      ? (PROD_FIELDS.find((f) => f.key === localCampoProducao)?.label ?? localCampoProducao)
      : null;

  // Pending field info (for confirmation panel)
  const pendingIsReset = pendingProdField === '__reset__';
  const pendingFieldInfo = pendingProdField && !pendingIsReset
    ? PROD_FIELDS.find((f) => f.key === pendingProdField)
    : null;
  const pendingQuantity =
    pendingFieldInfo && produtividadeMedico
      ? (produtividadeMedico as unknown as Record<string, number>)[pendingProdField!] ?? 0
      : 0;
  const pendingTotal = pendingQuantity * valorUnitario;

  const handleSaveBaseCalculo = async (field: string | null) => {
    setSavingBaseCalculo(true);
    setBaseCalculoError('');
    try {
      const newBase = field ? 'producao' : null;
      const newQuantity =
        field && produtividadeMedico
          ? (produtividadeMedico as unknown as Record<string, number>)[field] ?? 0
          : null;

      await updateBaseCalculo(escala.id, newBase, field, newQuantity);

      // Optimistic local update — dialog stays open, card shows new state
      setLocalBaseCalculo(newBase);
      setLocalCampoProducao(field);
      setPendingProdField(null);

      // Refresh the list in the background
      onBaseCalculoUpdated?.();
      onHorariosPagamentoUpdated?.(); // also reloads escala list
    } catch (err: any) {
      setBaseCalculoError('Erro ao salvar: ' + (err.message ?? 'Tente novamente.'));
    } finally {
      setSavingBaseCalculo(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
          <span style={{ fontWeight: 700 }}>Detalhes da Escala Médica</span>
          <Box display="flex" gap={1} alignItems="center" flexWrap="wrap">
            <Chip
              icon={statusIconMap[escala.status]}
              label={getStatusConfig(escala.status).label}
              size="small"
              sx={{
                bgcolor: statusColorMap[escala.status]?.bg,
                color: statusColorMap[escala.status]?.hex,
                border: `1px solid ${statusColorMap[escala.status]?.hex}`,
                "& .MuiChip-icon": {
                  color: statusColorMap[escala.status]?.hex,
                },
              }}
            />
            <Chip
              icon={<Payments fontSize="small" />}
              label={`Escala paga? ${escala.status_pagamento}`}
              size="small"
              sx={{
                bgcolor: escalaPaga ? '#ecfdf5' : '#f8fafc',
                color: escalaPaga ? '#10b981' : '#64748b',
                border: `1px solid ${escalaPaga ? '#10b981' : '#cbd5e1'}`,
                "& .MuiChip-icon": {
                  color: escalaPaga ? '#10b981' : '#64748b',
                },
                fontWeight: 600,
              }}
            />
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3, mt: 2 }}>
          {/* Contract Info */}
          <Card
            sx={{
              bgcolor:
                theme.palette.mode === "dark"
                  ? "rgba(59, 130, 246, 0.1)"
                  : "primary.50",
              borderLeft: "4px solid",
              borderColor: "primary.main",
            }}
          >
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Contrato
              </Typography>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                {contratos.find((c) => c.id === escala.contrato_id)?.nome ||
                  "Não encontrado"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Empresa:{" "}
                {contratos.find((c) => c.id === escala.contrato_id)?.empresa ||
                  "Não encontrado"}
              </Typography>
              {contratos.find((c) => c.id === escala.contrato_id)
                ?.numero_contrato && (
                <Typography variant="body2" color="text.secondary">
                  Nº Contrato:{" "}
                  {
                    contratos.find((c) => c.id === escala.contrato_id)
                      ?.numero_contrato
                  }
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* Escala Info Grid */}
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="overline" color="text.secondary">
                    Data da Escala
                  </Typography>
                  <Box display="flex" alignItems="center" gap={1} mt={1}>
                    <CalendarMonth color="primary" />
                    <Typography variant="h6">
                      {format(parseISO(escala.data_inicio), "dd/MM/yyyy")}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="overline" color="text.secondary">
                    Horário
                  </Typography>
                  <Box display="flex" alignItems="center" gap={1} mt={1}>
                    <Schedule color="primary" />
                    <Typography variant="h6">
                      {escala.horario_entrada.substring(0, 5)} -{" "}
                      {escala.horario_saida.substring(0, 5)}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="overline" color="text.secondary">
                    Item de Contrato
                  </Typography>
                  <Typography variant="body1" fontWeight={600} mt={1}>
                    {todosItensContrato.find(
                      (i) => i.id === escala.item_contrato_id,
                    )?.nome || "Não encontrado"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Unidade de medida:{" "}
                    {todosItensContrato.find(
                      (i) => i.id === escala.item_contrato_id,
                    )?.unidade_medida || "N/A"}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Doctors Table */}
          <Box>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Médicos Escalados ({escala.medicos.length})
            </Typography>
            <TableContainer
              component={Paper}
              elevation={0}
              sx={{
                border:
                  theme.palette.mode === "dark"
                    ? "1px solid rgba(255, 255, 255, 0.12)"
                    : "1px solid #e0e0e0",
              }}
            >
              <Table>
                <TableHead>
                  <TableRow
                    sx={{
                      bgcolor:
                        theme.palette.mode === "dark"
                          ? "rgba(255, 255, 255, 0.05)"
                          : "grey.50",
                    }}
                  >
                    <TableCell>
                      <strong>Nome</strong>
                    </TableCell>
                    <TableCell>
                      <strong>CPF</strong>
                    </TableCell>
                    <TableCell>
                      <strong>Código MV</strong>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {escala.medicos.map((medico, idx) => {
                    const codigoMV = medicosCodigosMV[medico.cpf];
                    return (
                    <TableRow key={idx}>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Person color="primary" />
                          {medico.nome}
                        </Box>
                      </TableCell>
                      <TableCell>{medico.cpf}</TableCell>
                      <TableCell>
                        {codigoMV
                          ? <Chip label={codigoMV} size="small" sx={{ fontFamily: 'monospace', fontWeight: 600 }} />
                          : <Typography variant="caption" color="text.disabled">—</Typography>
                        }
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>

          {/* Status Info */}
          <Card
            sx={{
              bgcolor: "background.default",
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Informações de Status
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">
                    Status Atual
                  </Typography>
                  <Box mt={1}>
                    <Chip
                      icon={statusIconMap[escala.status]}
                      label={getStatusConfig(escala.status).label}
                      sx={{
                        bgcolor: statusColorMap[escala.status]?.bg,
                        color: statusColorMap[escala.status]?.hex,
                        border: `1px solid ${statusColorMap[escala.status]?.hex}`,
                        "& .MuiChip-icon": {
                          color: statusColorMap[escala.status]?.hex,
                        },
                      }}
                    />
                  </Box>
                </Grid>

                {usuarioAlterouStatus && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" color="text.secondary">
                      Alterado por
                    </Typography>
                    <Typography variant="body1" fontWeight={600} mt={1}>
                      {usuarioAlterouStatus.nome}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {usuarioAlterouStatus.email}
                    </Typography>
                  </Grid>
                )}

                {escala.status_alterado_em && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" color="text.secondary">
                      Data da Alteração
                    </Typography>
                    <Typography variant="body1" mt={1}>
                      {format(
                        parseISO(escala.status_alterado_em),
                        "dd/MM/yyyy 'às' HH:mm",
                        {
                          locale: ptBR,
                        },
                      )}
                    </Typography>
                  </Grid>
                )}

                {escala.justificativa && (
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">
                      Justificativa
                    </Typography>
                    <Paper
                      sx={{
                        p: 2,
                        mt: 1,
                        bgcolor: "grey.50",
                        border: "1px solid",
                        borderColor: "divider",
                      }}
                    >
                      <Typography variant="body2">
                        {escala.justificativa}
                      </Typography>
                    </Paper>
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>

          {/* Aprovado com Glosa — Horário para fins de pagamento */}
          {isAprovadoComGlosa && (
            <Card
              ref={horarioPagamentoRef}
              sx={{
                borderLeft: "4px solid #d97706",
                bgcolor: theme.palette.mode === "dark" ? "rgba(217,119,6,0.08)" : "#fffbeb",
              }}
            >
              <CardContent>
                {/* Header */}
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={2} flexWrap="wrap" gap={1}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <PieChart sx={{ color: "#d97706" }} />
                    <Typography variant="h6" fontWeight={600} color="#d97706">
                      Horário de Pagamento
                    </Typography>
                  </Box>
                  {isAdminAgir && !escalaPaga && (
                    <Button
                      size="small"
                      variant={horarioPagamentoOpen ? "outlined" : escala.horario_pagamento_inicio ? "outlined" : "contained"}
                      startIcon={horarioPagamentoOpen ? <Cancel sx={{ fontSize: 16 }} /> : <EditCalendar />}
                      onClick={() => setHorarioPagamentoOpen((v) => !v)}
                      sx={
                        horarioPagamentoOpen
                          ? { borderColor: "divider", color: "text.secondary" }
                          : escala.horario_pagamento_inicio
                          ? {
                              borderColor: "#d97706",
                              color: "#d97706",
                              "&:hover": {
                                borderColor: "#b45309",
                                bgcolor: theme.palette.mode === "dark" ? "rgba(217,119,6,0.12)" : "#fef3c7",
                              },
                            }
                          : { bgcolor: "#d97706", "&:hover": { bgcolor: "#b45309" } }
                      }
                    >
                      {horarioPagamentoOpen ? "Fechar" : escala.horario_pagamento_inicio ? "Editar horário" : "Definir horário"}
                    </Button>
                  )}
                </Box>

                {/* Content */}
                <Grid container spacing={2} alignItems="stretch">
                  {/* Original schedule */}
                  <Grid item xs={12} sm={5}>
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: 1.5,
                        bgcolor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.7)",
                        border: `1px solid ${theme.palette.mode === "dark" ? "rgba(217,119,6,0.25)" : "#fde68a"}`,
                        height: "100%",
                      }}
                    >
                      <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={0.5}>
                        HORÁRIO ORIGINAL
                      </Typography>
                      <Typography variant="body1" fontWeight={700}>
                        {escala.horario_entrada.substring(0, 5)} – {escala.horario_saida.substring(0, 5)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {format(parseISO(escala.data_inicio), "dd/MM/yyyy")}
                      </Typography>
                    </Box>
                  </Grid>

                  {/* Arrow */}
                  <Grid item xs={12} sm={2} sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Typography color="text.disabled" fontSize={20}>→</Typography>
                  </Grid>

                  {/* Payment schedule */}
                  <Grid item xs={12} sm={5}>
                    {escala.horario_pagamento_inicio && escala.horario_pagamento_fim ? (
                      <Box
                        sx={{
                          p: 1.5,
                          borderRadius: 1.5,
                          bgcolor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.9)",
                          border: "2px solid #d97706",
                          height: "100%",
                        }}
                      >
                        <Typography variant="caption" color="#d97706" fontWeight={600} display="block" mb={0.5}>
                          HORÁRIO DE PAGAMENTO
                        </Typography>
                        <Typography variant="body1" fontWeight={700} color="#d97706">
                          {format(new Date(escala.horario_pagamento_inicio), "HH:mm")}
                          {" – "}
                          {format(new Date(escala.horario_pagamento_fim), "HH:mm")}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {format(new Date(escala.horario_pagamento_inicio), "dd/MM/yyyy", { locale: ptBR })}
                        </Typography>
                      </Box>
                    ) : (
                      <Box
                        sx={{
                          p: 1.5,
                          borderRadius: 1.5,
                          bgcolor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.5)",
                          border: `1px dashed ${theme.palette.mode === "dark" ? "rgba(217,119,6,0.4)" : "#fcd34d"}`,
                          height: "100%",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          textAlign: "center",
                          gap: 0.5,
                        }}
                      >
                        <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">
                          HORÁRIO DE PAGAMENTO
                        </Typography>
                        <Typography variant="body2" color="text.secondary" fontStyle="italic">
                          Não definido
                        </Typography>
                        <Typography variant="caption" color="text.disabled">
                          usando horário original
                        </Typography>
                        {isAdminAgir && !escalaPaga && (
                          <Button
                            size="small"
                            variant="text"
                            startIcon={<EditCalendar sx={{ fontSize: 14 }} />}
                            onClick={() => setHorarioPagamentoOpen(true)}
                            sx={{ mt: 0.5, color: "#d97706", fontSize: "0.7rem", p: 0.5 }}
                          >
                            Definir horário
                          </Button>
                        )}
                      </Box>
                    )}
                  </Grid>
                </Grid>


                {/* ── Inline form ─────────────────────────────────────────── */}
                {isAdminAgir && !escalaPaga && (
                  <Collapse in={horarioPagamentoOpen} unmountOnExit>
                    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ptBR}>
                      <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${isDark ? 'rgba(217,119,6,0.25)' : '#fde68a'}` }}>
                        <Alert severity="info" icon={<Info />} sx={{ mb: 2 }}>
                          <Typography variant="body2" fontWeight={600} gutterBottom>
                            Defina o intervalo efetivo para cálculo do pagamento da glosa.
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Se deixado em branco, o horário original será usado.
                          </Typography>
                        </Alert>

                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <DateTimePicker
                            label="Início do pagamento"
                            value={hpInicio}
                            onChange={(val) => { setHpInicio(val); setHpError(''); }}
                            ampm={false}
                            format="dd/MM/yyyy HH:mm"
                            slotProps={{
                              textField: {
                                fullWidth: true,
                                size: 'small',
                                helperText: 'Data e hora em que o período de pagamento começa',
                              },
                            }}
                          />

                          <Box display="flex" justifyContent="center">
                            <ArrowForward sx={{ color: 'text.disabled' }} />
                          </Box>

                          <DateTimePicker
                            label="Fim do pagamento"
                            value={hpFim}
                            onChange={(val) => { setHpFim(val); setHpError(''); }}
                            ampm={false}
                            format="dd/MM/yyyy HH:mm"
                            minDateTime={hpInicio ?? undefined}
                            slotProps={{
                              textField: {
                                fullWidth: true,
                                size: 'small',
                                helperText: 'Data e hora em que o período de pagamento termina',
                                error: hpFim !== null && hpInicio !== null && !isAfter(hpFim, hpInicio),
                              },
                            }}
                          />
                        </Box>

                        {/* Live duration */}
                        <Box
                          sx={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            gap: 1.5, p: 1.5, mt: 2, borderRadius: 2,
                            bgcolor: hpIsValidRange
                              ? isDark ? 'rgba(217,119,6,0.12)' : '#fffbeb'
                              : isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc',
                            border: '1px dashed',
                            borderColor: hpIsValidRange ? '#d97706' : isDark ? 'rgba(255,255,255,0.12)' : '#e2e8f0',
                            transition: 'all 0.2s',
                          }}
                        >
                          <Schedule sx={{ color: hpIsValidRange ? '#d97706' : 'text.disabled', fontSize: 18 }} />
                          <Typography variant="body2" fontWeight={600} color={hpIsValidRange ? '#d97706' : 'text.secondary'}>
                            Duração calculada:
                          </Typography>
                          <Typography variant="h6" fontWeight={700} color={hpIsValidRange ? '#d97706' : 'text.disabled'}>
                            {hpDurationLabel}
                          </Typography>
                        </Box>

                        {hpError && <Alert severity="error" sx={{ mt: 1.5 }}>{hpError}</Alert>}

                        {hpIsClearing && (
                          <Alert severity="success" sx={{ mt: 1.5, py: 0.5 }}>
                            <Typography variant="caption">
                              Nenhum horário definido — o <strong>horário original</strong> será usado para calcular o valor.
                            </Typography>
                          </Alert>
                        )}

                        <Divider sx={{ my: 2 }} />

                        <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                          <Button
                            startIcon={<RestartAlt />}
                            onClick={() => { setHpInicio(null); setHpFim(null); setHpError(''); }}
                            disabled={hpLoading || hpIsClearing}
                            color="inherit"
                            size="small"
                            sx={{ color: 'text.secondary' }}
                          >
                            Usar horário original
                          </Button>
                          <Box display="flex" gap={1}>
                            <Button
                              size="small"
                              onClick={() => setHorarioPagamentoOpen(false)}
                              disabled={hpLoading}
                            >
                              Cancelar
                            </Button>
                            <Button
                              variant="contained"
                              size="small"
                              startIcon={hpLoading ? <CircularProgress size={14} sx={{ color: 'white' }} /> : <Save />}
                              onClick={handleSaveHorarioPagamento}
                              disabled={hpLoading || (!hpIsValidRange && !hpIsClearing)}
                              sx={{
                                bgcolor: '#d97706',
                                '&:hover': { bgcolor: '#b45309' },
                                '&.Mui-disabled': { bgcolor: isDark ? 'rgba(217,119,6,0.3)' : '#fcd34d' },
                              }}
                            >
                              Salvar
                            </Button>
                          </Box>
                        </Box>
                      </Box>
                    </LocalizationProvider>
                  </Collapse>
                )}
              </CardContent>
            </Card>
          )}

          {/* Observations */}
          {escala.observacoes && (
            <Box>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Observações
              </Typography>
              <Paper
                sx={{
                  p: 2,
                  bgcolor: "grey.50",
                  border: "1px solid",
                  borderColor: "divider",
                }}
              >
                <Typography variant="body2">{escala.observacoes}</Typography>
              </Paper>
            </Box>
          )}

          {/* Access Logs & Productivity */}
          {loadingDetalhes ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {/* Access Logs */}
              <Card
                sx={{
                  background:
                    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  color: "white",
                }}
              >
                <CardContent>
                  <Typography variant="h6" fontWeight={700} gutterBottom>
                    Registros de Acesso do Médico
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9, mb: 2 }}>
                    Exibindo acessos do dia anterior, dia da escala e dia
                    seguinte
                  </Typography>
                  {acessosMedico.length > 0 ? (
                    <TableContainer
                      component={Paper}
                      sx={{ mt: 2, borderRadius: "8px" }}
                    >
                      <Table size="small">
                        <TableHead>
                          <TableRow
                            sx={{
                              bgcolor:
                                theme.palette.mode === "dark"
                                  ? "rgba(255, 255, 255, 0.05)"
                                  : "grey.100",
                            }}
                          >
                            <TableCell>
                              <strong>Dia</strong>
                            </TableCell>
                            <TableCell>
                              <strong>Data</strong>
                            </TableCell>
                            <TableCell>
                              <strong>Horário</strong>
                            </TableCell>
                            <TableCell>
                              <strong>Sentido</strong>
                            </TableCell>
                            <TableCell>
                              <strong>Unidade</strong>
                            </TableCell>
                            <TableCell>
                              <strong>
                                <center>Local</center>
                              </strong>
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {acessosMedico.map((acesso, idx) => {
                            const dataAcesso = parseISO(acesso.data_acesso);
                            const dataEscala = parseISO(escala.data_inicio);
                            const diaAnterior = subDays(dataEscala, 1);
                            const diaSeguinte = addDays(dataEscala, 1);

                            let dayLabel = "";
                            let dayColor = "default";
                            if (isSameDay(dataAcesso, diaAnterior)) {
                              dayLabel = "Anterior";
                              dayColor = "warning";
                            } else if (isSameDay(dataAcesso, dataEscala)) {
                              dayLabel = "Escala";
                              dayColor = "primary";
                            } else if (isSameDay(dataAcesso, diaSeguinte)) {
                              dayLabel = "Seguinte";
                              dayColor = "info";
                            }

                            return (
                              <TableRow
                                key={idx}
                                sx={{
                                  bgcolor: isSameDay(dataAcesso, dataEscala)
                                    ? "rgba(99, 102, 241, 0.08)"
                                    : "transparent",
                                }}
                              >
                                <TableCell>
                                  <Chip
                                    label={dayLabel}
                                    size="small"
                                    color={dayColor as any}
                                    variant={
                                      isSameDay(dataAcesso, dataEscala)
                                        ? "filled"
                                        : "outlined"
                                    }
                                    sx={{ minWidth: 70 }}
                                  />
                                </TableCell>
                                <TableCell>
                                  {format(dataAcesso, "dd/MM/yyyy")}
                                </TableCell>
                                <TableCell>
                                  {format(dataAcesso, "HH:mm:ss")}
                                </TableCell>
                                <TableCell>
                                  <Chip
                                    label={
                                      acesso.sentido === "E"
                                        ? "Entrada"
                                        : "Saída"
                                    }
                                    size="small"
                                    color={
                                      acesso.sentido === "E"
                                        ? "success"
                                        : "error"
                                    }
                                  />
                                </TableCell>
                                <TableCell>{acesso.planta || "—"}</TableCell>
                                <TableCell>
                                  {acesso.codin ? (
                                    <Tooltip
                                      title={acesso.codin}
                                      placement="top"
                                    >
                                      <Chip
                                        label={acesso.codin}
                                        size="small"
                                        variant="outlined"
                                        sx={{
                                          maxWidth: 120,
                                          fontSize: "0.7rem",
                                          height: 22,
                                          "& .MuiChip-label": { px: 1 },
                                        }}
                                      />
                                    </Tooltip>
                                  ) : (
                                    "—"
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <Paper
                      sx={{
                        p: 3,
                        mt: 2,
                        textAlign: "center",
                        bgcolor: "rgba(255,255,255,0.1)",
                        color: "white",
                      }}
                    >
                      <Typography>
                        Nenhum registro de acesso encontrado para este médico
                        nos 3 dias analisados
                      </Typography>
                    </Paper>
                  )}
                </CardContent>
              </Card>

              {/* Productivity Metrics */}
              <Card
                sx={{
                  background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
                  color: "white",
                }}
              >
                <CardContent>
                  {/* Section header */}
                  <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1} mb={0.5}>
                    <Typography variant="h6" fontWeight={700}>
                      Produtividade do Médico
                    </Typography>
                    <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                      {/* Current base badge */}
                      <Chip
                        size="small"
                        icon={
                          localBaseCalculo === 'producao'
                            ? <BarChart sx={{ fontSize: '14px !important', color: 'white !important' }} />
                            : <Schedule sx={{ fontSize: '14px !important', color: 'white !important' }} />
                        }
                        label={
                          localBaseCalculo === 'producao' && activeProdLabel
                            ? `Base: ${activeProdLabel}`
                            : 'Base: Horas'
                        }
                        sx={{
                          bgcolor: localBaseCalculo === 'producao'
                            ? 'rgba(99,102,241,0.35)'
                            : 'rgba(255,255,255,0.2)',
                          color: 'white',
                          fontWeight: 600,
                          border: localBaseCalculo === 'producao'
                            ? '1px solid rgba(99,102,241,0.7)'
                            : '1px solid rgba(255,255,255,0.35)',
                          fontSize: '0.7rem',
                          '& .MuiChip-icon': { color: 'white' },
                        }}
                      />
                      {/* Reset to hours */}
                      {canChangeBaseCalculo && localBaseCalculo === 'producao' && (
                        <Button
                          size="small"
                          onClick={() => setPendingProdField('__reset__')}
                          disabled={savingBaseCalculo}
                          sx={{
                            color: 'white',
                            fontSize: '0.7rem',
                            py: 0.25,
                            px: 1,
                            borderColor: 'rgba(255,255,255,0.5)',
                            border: '1px solid',
                            borderRadius: 1,
                            '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' },
                          }}
                        >
                          Resetar para horas
                        </Button>
                      )}
                    </Box>
                  </Box>

                  {/* Admin hint */}
                  {canChangeBaseCalculo && (
                    <Typography
                      variant="caption"
                      sx={{ color: 'rgba(255,255,255,0.75)', display: 'block', mb: 1.5 }}
                    >
                      Selecione um item para usar como base de cálculo do pagamento
                    </Typography>
                  )}

                  {produtividadeMedico ? (
                    <>
                      <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
                        {PROD_FIELDS.map((field) => {
                          const value = produtividadeMedico[field.key] ?? 0;
                          const isSelected = localCampoProducao === field.key && localBaseCalculo === 'producao';
                          const isPending = pendingProdField === field.key;
                          const isSelectable = canChangeBaseCalculo;

                          return (
                            <Grid item xs={6} sm={4} md={3} key={field.key}>
                              <Paper
                                onClick={() => {
                                  if (!isSelectable) return;
                                  if (isSelected) {
                                    // clicking active selection triggers reset
                                    setPendingProdField('__reset__');
                                  } else {
                                    setPendingProdField(field.key);
                                    setBaseCalculoError('');
                                  }
                                }}
                                elevation={isPending || isSelected ? 4 : 1}
                                sx={{
                                  p: 1.5,
                                  textAlign: 'center',
                                  position: 'relative',
                                  cursor: isSelectable ? 'pointer' : 'default',
                                  border: '2px solid',
                                  borderColor: isSelected
                                    ? '#6366f1'
                                    : isPending
                                    ? 'rgba(99,102,241,0.55)'
                                    : 'transparent',
                                  transition: 'all 0.18s ease',
                                  '&:hover': isSelectable
                                    ? {
                                        borderColor: '#6366f1',
                                        boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
                                        transform: 'translateY(-2px)',
                                      }
                                    : {},
                                }}
                              >
                                {/* Selected indicator */}
                                {isSelected && (
                                  <CheckCircle
                                    sx={{
                                      position: 'absolute',
                                      top: 4,
                                      right: 4,
                                      fontSize: 15,
                                      color: '#6366f1',
                                    }}
                                  />
                                )}
                                <Typography variant="h5" fontWeight={700} color={isSelected ? '#6366f1' : 'primary'}>
                                  {value}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2, display: 'block' }}>
                                  {field.label}
                                </Typography>
                              </Paper>
                            </Grid>
                          );
                        })}
                      </Grid>

                      {/* Inline confirmation panel */}
                      <Collapse in={pendingProdField !== null} unmountOnExit>
                        <Box
                          sx={{
                            mt: 2,
                            p: 2.5,
                            borderRadius: 2,
                            bgcolor: isDark ? '#1e1b4b' : 'white',
                            border: '2px solid #6366f1',
                            boxShadow: '0 8px 28px rgba(99,102,241,0.25)',
                          }}
                        >
                          {pendingIsReset ? (
                            /* ─── Reset confirmation ───────────────────────── */
                            <>
                              <Box display="flex" alignItems="center" gap={1} mb={1}>
                                <Schedule sx={{ color: '#6366f1', fontSize: 20 }} />
                                <Typography fontWeight={700} color={isDark ? 'white' : '#1e1b4b'}>
                                  Voltar para cálculo por horas?
                                </Typography>
                              </Box>
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                O pagamento voltará a ser calculado com base nas horas de plantão × valor unitário.
                              </Typography>
                            </>
                          ) : (
                            /* ─── Production field confirmation ───────────── */
                            <>
                              <Box display="flex" alignItems="center" gap={1} mb={1.5}>
                                <BarChart sx={{ color: '#6366f1', fontSize: 20 }} />
                                <Typography fontWeight={700} color={isDark ? 'white' : '#1e1b4b'}>
                                  Alterar base de cálculo do pagamento?
                                </Typography>
                              </Box>

                              {/* Comparison */}
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                                {/* Current (hours) */}
                                <Box
                                  sx={{
                                    p: 1.5,
                                    borderRadius: 1.5,
                                    bgcolor: isDark ? 'rgba(255,255,255,0.06)' : '#f9fafb',
                                    border: '1px solid',
                                    borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#e5e7eb',
                                  }}
                                >
                                  <Typography variant="caption" color="text.secondary" fontWeight={700} display="block" gutterBottom>
                                    BASE ATUAL — HORAS
                                  </Typography>
                                  <Typography variant="body2" color="text.primary">
                                    Horas de plantão × R$ {valorUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/h
                                  </Typography>
                                </Box>

                                {/* Arrow */}
                                <Box display="flex" justifyContent="center">
                                  <SwapVert sx={{ color: '#6366f1', fontSize: 22 }} />
                                </Box>

                                {/* New (production) */}
                                <Box
                                  sx={{
                                    p: 1.5,
                                    borderRadius: 1.5,
                                    bgcolor: isDark ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.07)',
                                    border: '2px solid #6366f1',
                                  }}
                                >
                                  <Typography variant="caption" fontWeight={700} display="block" gutterBottom sx={{ color: '#6366f1' }}>
                                    NOVA BASE — {pendingFieldInfo?.label?.toUpperCase()}
                                  </Typography>
                                  <Box display="flex" alignItems="baseline" gap={0.5} flexWrap="wrap">
                                    <Typography variant="body2" color="text.primary" fontWeight={600}>
                                      {pendingQuantity}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      × R$ {valorUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} =
                                    </Typography>
                                    <Typography variant="body2" fontWeight={700} sx={{ color: '#6366f1' }}>
                                      R$ {pendingTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </Typography>
                                  </Box>
                                  {pendingQuantity === 0 && (
                                    <Typography variant="caption" sx={{ color: '#f59e0b', display: 'block', mt: 0.5 }}>
                                      Quantidade zero — verifique se há produtividade registrada.
                                    </Typography>
                                  )}
                                </Box>
                              </Box>

                              <Alert severity="info" sx={{ mb: 1.5, py: 0.5 }}>
                                <Typography variant="caption">
                                  O valor <strong>{pendingQuantity}</strong> é a produção capturada agora e será salvo na escala como base de pagamento.
                                </Typography>
                              </Alert>
                            </>
                          )}

                          {baseCalculoError && (
                            <Alert severity="error" sx={{ mb: 1.5, py: 0.5 }}>
                              {baseCalculoError}
                            </Alert>
                          )}

                          {/* Action buttons */}
                          <Box display="flex" gap={1} justifyContent="flex-end">
                            <Button
                              size="small"
                              onClick={() => { setPendingProdField(null); setBaseCalculoError(''); }}
                              disabled={savingBaseCalculo}
                              sx={{ color: 'text.secondary' }}
                            >
                              Cancelar
                            </Button>
                            <Button
                              variant="contained"
                              size="small"
                              onClick={() => handleSaveBaseCalculo(pendingIsReset ? null : pendingProdField)}
                              disabled={savingBaseCalculo}
                              startIcon={savingBaseCalculo ? <CircularProgress size={13} sx={{ color: 'white' }} /> : null}
                              sx={{
                                bgcolor: '#6366f1',
                                '&:hover': { bgcolor: '#4f46e5' },
                                '&.Mui-disabled': { bgcolor: isDark ? 'rgba(99,102,241,0.4)' : 'rgba(99,102,241,0.5)' },
                              }}
                            >
                              {pendingIsReset ? 'Confirmar reset' : 'Confirmar alteração'}
                            </Button>
                          </Box>
                        </Box>
                      </Collapse>
                    </>
                  ) : (
                    <Paper
                      sx={{
                        p: 3,
                        mt: 2,
                        textAlign: "center",
                        bgcolor: "rgba(255,255,255,0.1)",
                        color: "white",
                      }}
                    >
                      <Typography>
                        Nenhum registro de produtividade encontrado para este
                        médico nesta data
                      </Typography>
                    </Paper>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {/* Metadata */}
          <Box
            sx={{
              p: 2,
              borderRadius: 1,
              bgcolor:
                theme.palette.mode === "dark"
                  ? "rgba(255, 255, 255, 0.03)"
                  : "grey.50",
              border: "1px dashed",
              borderColor: "divider",
            }}
          >
            <Typography variant="caption" color="text.secondary">
              <strong>Criado em:</strong>{" "}
              {escala.created_at ? format(parseISO(escala.created_at), "dd/MM/yyyy 'às' HH:mm") : '—'}
            </Typography>
            {escala.updated_at && (
              <>
                {" • "}
                <Typography
                  variant="caption"
                  color="text.secondary"
                  component="span"
                >
                  <strong>Atualizado em:</strong>{" "}
                  {format(parseISO(escala.updated_at), "dd/MM/yyyy 'às' HH:mm")}
                </Typography>
              </>
            )}
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} variant="outlined">
          Fechar
        </Button>
        {(isAdminAgir || isAdminTerceiro) && (
          <Tooltip title={getEditTooltip()}>
            <span>
              <Button
                onClick={() => {
                  onClose();
                  onEdit(escala);
                }}
                variant="outlined"
                startIcon={<Edit />}
                disabled={!canEdit}
              >
                Editar
              </Button>
            </span>
          </Tooltip>
        )}
        {/* Delete button - available for all users */}
        {onDelete && (
          <Tooltip title={getDeleteTooltip()}>
            <span>
              <Button
                onClick={() => {
                  onClose();
                  onDelete(escala);
                }}
                variant="contained"
                startIcon={<DeleteForever />}
                disabled={!canDelete}
                sx={{
                  bgcolor: "#64748b",
                  "&:hover": {
                    bgcolor: "#475569",
                  },
                  "&.Mui-disabled": {
                    bgcolor: "#94a3b8",
                  },
                }}
              >
                Excluir
              </Button>
            </span>
          </Tooltip>
        )}
        {isAdminAgir && (
          <Tooltip title={getStatusChangeTooltip()}>
            <span>
              <Button
                onClick={() => {
                  onChangeStatus(escala);
                }}
                variant="contained"
                color="primary"
                disabled={!canChangeStatusFlag}
              >
                Alterar Status
              </Button>
            </span>
          </Tooltip>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default DetailsDialog;
