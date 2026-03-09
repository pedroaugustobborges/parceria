/**
 * BulkStatusDialog Component
 *
 * Dialog for changing the status of multiple escalas at once.
 */

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  Chip,
  TextField,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  DoneAll,
  Info,
  CheckCircle,
  Cancel,
  HourglassEmpty,
  ThumbUpAlt,
  Warning,
  HowToReg,
  Schedule,
  DeleteForever,
} from '@mui/icons-material';
import type { StatusEscala } from '../../types/escalas.types';
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
  'Excluída': <DeleteForever fontSize="small" />,
};

// ============================================
// Props
// ============================================

export interface BulkStatusDialogProps {
  open: boolean;
  onClose: () => void;
  selectedCount: number;
  bulkStatus: StatusEscala;
  setBulkStatus: (status: StatusEscala) => void;
  justificativa: string;
  setJustificativa: (value: string) => void;
  onSave: () => void;
  loading: boolean;
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
  'Excluída',
];

// ============================================
// Component
// ============================================

export const BulkStatusDialog: React.FC<BulkStatusDialogProps> = ({
  open,
  onClose,
  selectedCount,
  bulkStatus,
  setBulkStatus,
  justificativa,
  setJustificativa,
  onSave,
  loading,
}) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Alterar Status em Massa</DialogTitle>

      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
          {/* Selection Info */}
          <Alert severity="info" icon={<Info />}>
            <Typography variant="body2">
              Você está alterando o status de <strong>{selectedCount}</strong> escala
              {selectedCount > 1 ? 's' : ''} selecionada
              {selectedCount > 1 ? 's' : ''}.
            </Typography>
          </Alert>

          {/* Status Selector */}
          <Box>
            <Typography variant="subtitle2" gutterBottom fontWeight={600}>
              Novo Status
            </Typography>
            <Box display="flex" gap={1} flexWrap="wrap">
              {STATUS_OPTIONS.map((status) => {
                const config = getStatusConfig(status);
                const statusColor = statusColorMap[status];
                const isSelected = bulkStatus === status;

                return (
                  <Chip
                    key={status}
                    icon={statusIconMap[status]}
                    label={config.label}
                    variant={isSelected ? 'filled' : 'outlined'}
                    onClick={() => setBulkStatus(status)}
                    sx={{
                      bgcolor: isSelected ? statusColor?.hex : statusColor?.bg,
                      color: isSelected ? '#fff' : statusColor?.hex,
                      borderColor: statusColor?.hex,
                      '& .MuiChip-icon': {
                        color: isSelected ? '#fff' : statusColor?.hex,
                      },
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      '&:hover': {
                        transform: 'scale(1.05)',
                        bgcolor: isSelected ? statusColor?.hex : `${statusColor?.hex}20`,
                      },
                    }}
                  />
                );
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
            required={bulkStatus === 'Reprovado' || bulkStatus === 'Excluída'}
            error={(bulkStatus === 'Reprovado' || bulkStatus === 'Excluída') && !justificativa.trim()}
            helperText={
              bulkStatus === 'Reprovado'
                ? 'Justificativa obrigatória para status Reprovado'
                : bulkStatus === 'Excluída'
                  ? 'Justificativa obrigatória para excluir escalas'
                  : 'Opcional para outros status'
            }
            placeholder="Digite a justificativa para a alteração de status em massa..."
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          onClick={onSave}
          variant="contained"
          color="primary"
          startIcon={<DoneAll />}
          disabled={((bulkStatus === 'Reprovado' || bulkStatus === 'Excluída') && !justificativa.trim()) || loading}
        >
          {loading ? (
            <CircularProgress size={20} sx={{ color: 'white' }} />
          ) : (
            `Atualizar ${selectedCount} Escala${selectedCount > 1 ? 's' : ''}`
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BulkStatusDialog;
