/**
 * StatusDialog Component
 *
 * Dialog for changing the status of a single escala.
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
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Check,
  CheckCircle,
  Cancel,
  HourglassEmpty,
  ThumbUpAlt,
  Warning,
  HowToReg,
  Schedule,
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import type { EscalaMedica, StatusEscala, Contrato } from '../../types/escalas.types';
import { getStatusConfig, statusColorMap } from '../../utils/escalasStatusUtils';

// Icon mapping for status
const statusIconMap: Record<StatusEscala, React.ReactElement> = {
  'Pré-Agendado': <Schedule fontSize="small" />,
  'Programado': <HourglassEmpty fontSize="small" />,
  'Pré-Aprovado': <ThumbUpAlt fontSize="small" />,
  'Aprovação Parcial': <HowToReg fontSize="small" />,
  'Atenção': <Warning fontSize="small" />,
  'Aprovado': <CheckCircle fontSize="small" />,
  'Reprovado': <Cancel fontSize="small" />,
};

// ============================================
// Props
// ============================================

export interface StatusDialogProps {
  open: boolean;
  onClose: () => void;
  escala: EscalaMedica | null;
  contratos: Contrato[];
  novoStatus: StatusEscala;
  setNovoStatus: (status: StatusEscala) => void;
  justificativa: string;
  setJustificativa: (value: string) => void;
  onSave: () => void;
}

// ============================================
// Status Options
// ============================================

const STATUS_OPTIONS: StatusEscala[] = [
  'Programado',
  'Pré-Aprovado',
  'Aprovação Parcial',
  'Atenção',
  'Aprovado',
  'Reprovado',
];

// ============================================
// Component
// ============================================

export const StatusDialog: React.FC<StatusDialogProps> = ({
  open,
  onClose,
  escala,
  contratos,
  novoStatus,
  setNovoStatus,
  justificativa,
  setJustificativa,
  onSave,
}) => {
  // Check if escala date is in the past
  const isEscalaInPast = () => {
    if (!escala) return false;
    const dataEscala = parseISO(escala.data_inicio);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    dataEscala.setHours(0, 0, 0, 0);
    return dataEscala < hoje;
  };

  const escalaNoPassado = isEscalaInPast();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Alterar Status da Escala</DialogTitle>

      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
          {/* Escala Info */}
          {escala && (
            <Card
              sx={{
                bgcolor: 'primary.50',
                borderLeft: '4px solid',
                borderColor: 'primary.main',
              }}
            >
              <CardContent>
                <Typography variant="subtitle2" fontWeight={600}>
                  {contratos.find((c) => c.id === escala.contrato_id)?.nome}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Data: {format(parseISO(escala.data_inicio), 'dd/MM/yyyy')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Médicos: {escala.medicos.length}
                </Typography>
              </CardContent>
            </Card>
          )}

          {/* Status Selector */}
          <Box>
            <Typography variant="subtitle2" gutterBottom fontWeight={600}>
              Novo Status
            </Typography>
            <Box display="flex" gap={1} flexWrap="wrap">
              {STATUS_OPTIONS.map((status) => {
                const config = getStatusConfig(status);
                const statusColor = statusColorMap[status];
                const isSelected = novoStatus === status;

                // "Programado" can only be used for future dates
                const isDisabled = status === 'Programado' && escalaNoPassado;

                const chip = (
                  <Chip
                    key={status}
                    icon={statusIconMap[status]}
                    label={config.label}
                    variant={isSelected ? 'filled' : 'outlined'}
                    onClick={() => !isDisabled && setNovoStatus(status)}
                    disabled={isDisabled}
                    sx={{
                      bgcolor: isSelected ? statusColor?.hex : statusColor?.bg,
                      color: isSelected ? '#fff' : statusColor?.hex,
                      borderColor: statusColor?.hex,
                      '& .MuiChip-icon': {
                        color: isSelected ? '#fff' : statusColor?.hex,
                      },
                      cursor: isDisabled ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      opacity: isDisabled ? 0.5 : 1,
                      '&:hover': {
                        transform: isDisabled ? 'none' : 'scale(1.05)',
                        bgcolor: isSelected ? statusColor?.hex : `${statusColor?.hex}20`,
                      },
                    }}
                  />
                );

                if (isDisabled) {
                  return (
                    <Tooltip
                      key={status}
                      title="Status 'Programado' só pode ser usado para escalas futuras"
                    >
                      <span>{chip}</span>
                    </Tooltip>
                  );
                }

                return chip;
              })}
            </Box>
          </Box>

          {/* Justification Field */}
          <TextField
            label="Justificativa"
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            multiline
            rows={4}
            fullWidth
            required={novoStatus === 'Reprovado'}
            error={novoStatus === 'Reprovado' && !justificativa.trim()}
            helperText={
              novoStatus === 'Reprovado'
                ? 'Justificativa obrigatória para status Reprovado'
                : 'Opcional para outros status'
            }
            placeholder="Digite a justificativa para a alteração de status..."
          />

          {/* Current Status Display */}
          {escala && (
            <Box
              sx={{
                p: 2,
                borderRadius: 1,
                bgcolor: 'background.default',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography variant="caption" color="text.secondary">
                Status Atual
              </Typography>
              <Box display="flex" alignItems="center" gap={1} mt={0.5}>
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
                {escala.justificativa && (
                  <Typography variant="caption" color="text.secondary">
                    {escala.justificativa}
                  </Typography>
                )}
              </Box>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          onClick={onSave}
          variant="contained"
          color="primary"
          startIcon={<Check />}
          disabled={novoStatus === 'Reprovado' && !justificativa.trim()}
        >
          Salvar Status
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default StatusDialog;
