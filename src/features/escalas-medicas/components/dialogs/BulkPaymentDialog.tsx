/**
 * BulkPaymentDialog Component
 *
 * Dialog for marking multiple escalas as paid (status_pagamento) at once.
 * Only accessible to administrador-corporativo and administrador-planta.
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
  Typography,
  Alert,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  Payments,
  Info,
  CheckCircle,
  Cancel,
} from '@mui/icons-material';

// ============================================
// Props
// ============================================

export interface BulkPaymentDialogProps {
  open: boolean;
  onClose: () => void;
  selectedCount: number;
  /** Number of selected escalas that actually qualify (Aprovado or Aprovado com Glosa) when marking as paid */
  qualifyingCount: number;
  statusPagamento: 'Sim' | 'Não';
  setStatusPagamento: (value: 'Sim' | 'Não') => void;
  onSave: () => void;
  loading: boolean;
}

// ============================================
// Component
// ============================================

export const BulkPaymentDialog: React.FC<BulkPaymentDialogProps> = ({
  open,
  onClose,
  selectedCount,
  qualifyingCount,
  statusPagamento,
  setStatusPagamento,
  onSave,
  loading,
}) => {
  const markingAsPaid = statusPagamento === 'Sim';
  const nonQualifyingCount = markingAsPaid ? selectedCount - qualifyingCount : 0;
  const effectiveCount = markingAsPaid ? qualifyingCount : selectedCount;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Payments sx={{ color: '#10b981' }} />
        Alterar Status de Pagamento
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
          {/* Selection Info */}
          <Alert severity="info" icon={<Info />}>
            <Typography variant="body2">
              Você está alterando o status de pagamento de{' '}
              <strong>{effectiveCount}</strong> escala
              {effectiveCount !== 1 ? 's' : ''} selecionada
              {effectiveCount !== 1 ? 's' : ''}.
            </Typography>
          </Alert>

          {/* Warning: non-qualifying escalas will be skipped */}
          {markingAsPaid && nonQualifyingCount > 0 && (
            <Alert severity="warning" icon={<Info />}>
              <Typography variant="body2" fontWeight={600} gutterBottom>
                {nonQualifyingCount} escala{nonQualifyingCount !== 1 ? 's' : ''} serão ignorada{nonQualifyingCount !== 1 ? 's' : ''}
              </Typography>
              <Typography variant="body2">
                Apenas escalas com status <strong>Aprovado</strong> ou{' '}
                <strong>Aprovado com Glosa</strong> podem ser marcadas como pagas.
                As demais selecionadas não serão afetadas.
              </Typography>
            </Alert>
          )}

          {markingAsPaid && qualifyingCount === 0 && (
            <Alert severity="error">
              <Typography variant="body2" fontWeight={600}>
                Nenhuma escala selecionada pode ser marcada como paga.
              </Typography>
              <Typography variant="body2">
                Selecione apenas escalas com status <strong>Aprovado</strong> ou{' '}
                <strong>Aprovado com Glosa</strong>.
              </Typography>
            </Alert>
          )}

          {/* Payment Status Toggle */}
          <Box>
            <Typography variant="subtitle2" gutterBottom fontWeight={600}>
              Escala paga?
            </Typography>
            <ToggleButtonGroup
              value={statusPagamento}
              exclusive
              onChange={(_, value) => {
                if (value !== null) setStatusPagamento(value);
              }}
              sx={{ mt: 1 }}
            >
              <ToggleButton
                value="Sim"
                sx={{
                  px: 3,
                  py: 1.5,
                  '&.Mui-selected': {
                    bgcolor: '#ecfdf5',
                    color: '#10b981',
                    borderColor: '#10b981',
                    '&:hover': { bgcolor: '#d1fae5' },
                  },
                }}
              >
                <CheckCircle sx={{ mr: 1, fontSize: 20 }} />
                Sim — Marcar como Paga
              </ToggleButton>
              <ToggleButton
                value="Não"
                sx={{
                  px: 3,
                  py: 1.5,
                  '&.Mui-selected': {
                    bgcolor: '#fef2f2',
                    color: '#ef4444',
                    borderColor: '#ef4444',
                    '&:hover': { bgcolor: '#fee2e2' },
                  },
                }}
              >
                <Cancel sx={{ mr: 1, fontSize: 20 }} />
                Não — Remover marcação
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Warning when marking as paid */}
          {markingAsPaid && (
            <Alert severity="warning">
              <Typography variant="body2" fontWeight={600} gutterBottom>
                Atenção: esta ação bloqueia edição
              </Typography>
              <Typography variant="body2">
                Escalas marcadas como pagas ficam <strong>bloqueadas para edição</strong>.
                Somente administradores podem remover esta marcação posteriormente.
              </Typography>
            </Alert>
          )}

          {/* Summary chips */}
          <Box display="flex" gap={1} flexWrap="wrap">
            <Chip
              icon={markingAsPaid ? <CheckCircle /> : <Cancel />}
              label={markingAsPaid ? `${effectiveCount} será${effectiveCount !== 1 ? 'ão' : ''} marcada${effectiveCount !== 1 ? 's' : ''} como PAGA${effectiveCount !== 1 ? 'S' : ''}` : `${effectiveCount} será${effectiveCount !== 1 ? 'ão' : ''} desmarcada${effectiveCount !== 1 ? 's' : ''}`}
              sx={{
                bgcolor: markingAsPaid ? '#ecfdf5' : '#fef2f2',
                color: markingAsPaid ? '#10b981' : '#ef4444',
                borderColor: markingAsPaid ? '#10b981' : '#ef4444',
                border: '1px solid',
                '& .MuiChip-icon': {
                  color: markingAsPaid ? '#10b981' : '#ef4444',
                },
                fontWeight: 600,
              }}
            />
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button
          onClick={onSave}
          variant="contained"
          startIcon={<Payments />}
          disabled={loading || effectiveCount === 0}
          sx={{
            bgcolor: markingAsPaid ? '#10b981' : '#6b7280',
            '&:hover': {
              bgcolor: markingAsPaid ? '#059669' : '#4b5563',
            },
          }}
        >
          {loading ? (
            <CircularProgress size={20} sx={{ color: 'white' }} />
          ) : (
            `Atualizar ${effectiveCount} Escala${effectiveCount !== 1 ? 's' : ''}`
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BulkPaymentDialog;
