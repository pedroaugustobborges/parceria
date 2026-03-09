/**
 * DetailsDialog Component
 *
 * Dialog for displaying complete details of an escala,
 * including access logs and productivity metrics.
 */

import React from 'react';
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
} from '@mui/material';
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
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type {
  EscalaMedica,
  Contrato,
  ItemContrato,
  Usuario,
  StatusEscala,
} from '../../types/escalas.types';
import { getStatusConfig, statusColorMap, canEditStatus } from '../../utils/escalasStatusUtils';

// Icon mapping for status
const statusIconMap: Record<StatusEscala, React.ReactElement> = {
  'Pré-Agendado': <Schedule fontSize="small" />,
  'Programado': <HourglassEmpty fontSize="small" />,
  'Pré-Aprovado': <ThumbUpAlt fontSize="small" />,
  'Aprovação Parcial': <HowToReg fontSize="small" />,
  'Atenção': <Warning fontSize="small" />,
  'Aprovado': <CheckCircle fontSize="small" />,
  'Reprovado': <Cancel fontSize="small" />,
  'Excluída': <DeleteForever fontSize="small" />,
};

// ============================================
// Types
// ============================================

interface AcessoMedico {
  data_acesso: string;
  sentido: 'E' | 'S';
  planta?: string;
}

interface ProdutividadeMedico {
  procedimento: number;
  cirurgia_realizada: number;
  evolucao: number;
  parecer_realizado: number;
  urgencia: number;
  ambulatorio: number;
  prescricao: number;
  encaminhamento: number;
  auxiliar: number;
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
  isAdminTerceiro: boolean;
  isTerceiro?: boolean;
  onEdit: (escala: EscalaMedica) => void;
  onChangeStatus: (escala: EscalaMedica) => void;
  onDelete?: (escala: EscalaMedica) => void;
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
  isAdminTerceiro,
  isTerceiro: _isTerceiro = false,
  onEdit,
  onChangeStatus,
  onDelete,
}) => {
  const theme = useTheme();

  if (!escala) return null;

  // "Excluída" schedules cannot be edited by anyone
  const canEdit = escala.status !== 'Excluída' && canEditStatus(escala.status, isAdminAgir, isAdminTerceiro);
  const canChangeStatus =
    isAdminAgir && escala.status !== 'Aprovado' && escala.status !== 'Reprovado' && escala.status !== 'Excluída';
  // All users can delete schedules that are not finalized
  const canDelete =
    escala.status !== 'Aprovado' && escala.status !== 'Reprovado' && escala.status !== 'Excluída';

  const getEditTooltip = () => {
    if (canEdit) return '';
    if (escala.status === 'Excluída') {
      return 'Escalas excluídas não podem ser editadas.';
    }
    const allowedStatuses = isAdminTerceiro
      ? '"Programado", "Pré-Agendado", "Atenção" ou "Aprovação Parcial"'
      : '"Programado" ou "Pré-Agendado"';
    return `Não é possível editar. Apenas escalas com status ${allowedStatuses} podem ser editadas.`;
  };

  const getStatusChangeTooltip = () => {
    if (canChangeStatus) return '';
    if (escala.status === 'Excluída') {
      return 'Escalas excluídas não podem ter o status alterado.';
    }
    return `Status bloqueado. Escalas ${escala.status.toLowerCase()}s não podem ter o status alterado.`;
  };

  const getDeleteTooltip = () => {
    if (canDelete) return '';
    if (escala.status === 'Excluída') {
      return 'Esta escala já foi excluída.';
    }
    return `Não é possível excluir. Escalas ${escala.status.toLowerCase()}s não podem ser excluídas.`;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <span style={{ fontWeight: 700 }}>Detalhes da Escala Médica</span>
          <Chip
            icon={statusIconMap[escala.status]}
            label={getStatusConfig(escala.status).label}
            size="small"
            sx={{
              bgcolor: statusColorMap[escala.status]?.bg,
              color: statusColorMap[escala.status]?.hex,
              border: `1px solid ${statusColorMap[escala.status]?.hex}`,
              '& .MuiChip-icon': {
                color: statusColorMap[escala.status]?.hex,
              },
            }}
          />
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
          {/* Contract Info */}
          <Card
            sx={{
              bgcolor: theme.palette.mode === 'dark' ? 'rgba(59, 130, 246, 0.1)' : 'primary.50',
              borderLeft: '4px solid',
              borderColor: 'primary.main',
            }}
          >
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Contrato
              </Typography>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                {contratos.find((c) => c.id === escala.contrato_id)?.nome || 'Não encontrado'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Empresa:{' '}
                {contratos.find((c) => c.id === escala.contrato_id)?.empresa || 'Não encontrado'}
              </Typography>
              {contratos.find((c) => c.id === escala.contrato_id)?.numero_contrato && (
                <Typography variant="body2" color="text.secondary">
                  Nº Contrato:{' '}
                  {contratos.find((c) => c.id === escala.contrato_id)?.numero_contrato}
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
                      {format(parseISO(escala.data_inicio), 'dd/MM/yyyy')}
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
                      {escala.horario_entrada.substring(0, 5)} -{' '}
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
                    {todosItensContrato.find((i) => i.id === escala.item_contrato_id)?.nome ||
                      'Não encontrado'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Unidade de medida:{' '}
                    {todosItensContrato.find((i) => i.id === escala.item_contrato_id)
                      ?.unidade_medida || 'N/A'}
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
                  theme.palette.mode === 'dark'
                    ? '1px solid rgba(255, 255, 255, 0.12)'
                    : '1px solid #e0e0e0',
              }}
            >
              <Table>
                <TableHead>
                  <TableRow
                    sx={{
                      bgcolor:
                        theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'grey.50',
                    }}
                  >
                    <TableCell>
                      <strong>Nome</strong>
                    </TableCell>
                    <TableCell>
                      <strong>CPF</strong>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {escala.medicos.map((medico, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Person color="primary" />
                          {medico.nome}
                        </Box>
                      </TableCell>
                      <TableCell>{medico.cpf}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>

          {/* Status Info */}
          <Card
            sx={{
              bgcolor: 'background.default',
              border: '1px solid',
              borderColor: 'divider',
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
                        '& .MuiChip-icon': {
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
                      {format(parseISO(escala.status_alterado_em), "dd/MM/yyyy 'às' HH:mm", {
                        locale: ptBR,
                      })}
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
                        bgcolor: 'grey.50',
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <Typography variant="body2">{escala.justificativa}</Typography>
                    </Paper>
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>

          {/* Observations */}
          {escala.observacoes && (
            <Box>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Observações
              </Typography>
              <Paper
                sx={{
                  p: 2,
                  bgcolor: 'grey.50',
                  border: '1px solid',
                  borderColor: 'divider',
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
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                }}
              >
                <CardContent>
                  <Typography variant="h6" fontWeight={700} gutterBottom>
                    Registros de Acesso do Médico
                  </Typography>
                  {acessosMedico.length > 0 ? (
                    <TableContainer component={Paper} sx={{ mt: 2, borderRadius: '8px' }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow
                            sx={{
                              bgcolor:
                                theme.palette.mode === 'dark'
                                  ? 'rgba(255, 255, 255, 0.05)'
                                  : 'grey.100',
                            }}
                          >
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
                              <strong>Planta</strong>
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {acessosMedico.map((acesso, idx) => (
                            <TableRow key={idx}>
                              <TableCell>
                                {format(parseISO(acesso.data_acesso), 'dd/MM/yyyy')}
                              </TableCell>
                              <TableCell>
                                {format(parseISO(acesso.data_acesso), 'HH:mm:ss')}
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={acesso.sentido === 'E' ? 'Entrada' : 'Saída'}
                                  size="small"
                                  color={acesso.sentido === 'E' ? 'success' : 'error'}
                                />
                              </TableCell>
                              <TableCell>{acesso.planta || 'N/A'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <Paper
                      sx={{
                        p: 3,
                        mt: 2,
                        textAlign: 'center',
                        bgcolor: 'rgba(255,255,255,0.1)',
                        color: 'white',
                      }}
                    >
                      <Typography>
                        Nenhum registro de acesso encontrado para este médico nesta data
                      </Typography>
                    </Paper>
                  )}
                </CardContent>
              </Card>

              {/* Productivity Metrics */}
              <Card
                sx={{
                  background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                  color: 'white',
                }}
              >
                <CardContent>
                  <Typography variant="h6" fontWeight={700} gutterBottom>
                    Produtividade do Médico
                  </Typography>
                  {produtividadeMedico ? (
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                      {[
                        { label: 'Procedimentos', value: produtividadeMedico.procedimento },
                        { label: 'Cirurgias', value: produtividadeMedico.cirurgia_realizada },
                        { label: 'Evoluções', value: produtividadeMedico.evolucao },
                        { label: 'Pareceres', value: produtividadeMedico.parecer_realizado },
                        { label: 'Urgências', value: produtividadeMedico.urgencia },
                        { label: 'Ambulatórios', value: produtividadeMedico.ambulatorio },
                        { label: 'Prescrição', value: produtividadeMedico.prescricao },
                        { label: 'Encaminhamento', value: produtividadeMedico.encaminhamento },
                        { label: 'Auxiliar', value: produtividadeMedico.auxiliar },
                      ].map((item, idx) => (
                        <Grid item xs={6} sm={4} key={idx}>
                          <Paper sx={{ p: 2, textAlign: 'center' }}>
                            <Typography variant="h4" color="primary" fontWeight={700}>
                              {item.value}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {item.label}
                            </Typography>
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>
                  ) : (
                    <Paper
                      sx={{
                        p: 3,
                        mt: 2,
                        textAlign: 'center',
                        bgcolor: 'rgba(255,255,255,0.1)',
                        color: 'white',
                      }}
                    >
                      <Typography>
                        Nenhum registro de produtividade encontrado para este médico nesta data
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
              bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'grey.50',
              border: '1px dashed',
              borderColor: 'divider',
            }}
          >
            <Typography variant="caption" color="text.secondary">
              <strong>Criado em:</strong>{' '}
              {format(parseISO(escala.created_at), "dd/MM/yyyy 'às' HH:mm")}
            </Typography>
            {escala.updated_at && (
              <>
                {' • '}
                <Typography variant="caption" color="text.secondary" component="span">
                  <strong>Atualizado em:</strong>{' '}
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
                  bgcolor: '#64748b',
                  '&:hover': {
                    bgcolor: '#475569',
                  },
                  '&.Mui-disabled': {
                    bgcolor: '#94a3b8',
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
                  onClose();
                  onChangeStatus(escala);
                }}
                variant="contained"
                color="primary"
                disabled={!canChangeStatus}
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
