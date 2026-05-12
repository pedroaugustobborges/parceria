/**
 * HorarioPagamentoDialog Component
 *
 * Focused dialog for admin-agir to define or edit the payment datetime
 * override for an "Aprovado com Glosa" escala.
 *
 * Flow:
 *  - Pre-fills with existing horario_pagamento_inicio/fim if set, otherwise
 *    defaults to the escala's original date + entry/exit times.
 *  - Shows a live duration calculation as the user adjusts the pickers.
 *  - "Usar horário original" clears both fields (back to null → original used).
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Chip,
  Divider,
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import {
  PieChart,
  Schedule,
  RestartAlt,
  Save,
  Info,
  ArrowForward,
} from '@mui/icons-material';
import { format, addDays, differenceInMinutes, isValid, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { EscalaMedica } from '../../types/escalas.types';
import { updateHorariosPagamento } from '../../services/escalasService';
import { shiftCrossesMidnight } from '../../utils/escalasHoursUtils';

// ============================================
// Helpers
// ============================================

function buildDatetime(dateStr: string, timeStr: string): Date {
  // dateStr: "2026-04-15", timeStr: "07:00:00" or "07:00"
  return new Date(`${dateStr}T${timeStr.length === 5 ? timeStr + ':00' : timeStr}`);
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

// ============================================
// Props
// ============================================

export interface HorarioPagamentoDialogProps {
  open: boolean;
  onClose: () => void;
  escala: EscalaMedica;
  onSaved: () => void;
}

// ============================================
// Component
// ============================================

export const HorarioPagamentoDialog: React.FC<HorarioPagamentoDialogProps> = ({
  open,
  onClose,
  escala,
  onSaved,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Build sensible defaults ──────────────────────────────────────────────
  const originalInicio = useMemo(
    () => buildDatetime(escala.data_inicio, escala.horario_entrada),
    [escala.data_inicio, escala.horario_entrada]
  );

  const originalFim = useMemo(() => {
    const crossesMidnight = shiftCrossesMidnight(
      escala.horario_entrada,
      escala.horario_saida
    );
    const fimDate = crossesMidnight
      ? format(addDays(new Date(escala.data_inicio), 1), 'yyyy-MM-dd')
      : escala.data_inicio;
    return buildDatetime(fimDate, escala.horario_saida);
  }, [escala.data_inicio, escala.horario_entrada, escala.horario_saida]);

  // ── Picker state ─────────────────────────────────────────────────────────
  const [inicio, setInicio] = useState<Date | null>(null);
  const [fim, setFim] = useState<Date | null>(null);

  // Populate when dialog opens
  useEffect(() => {
    if (!open) return;
    setError('');
    if (escala.horario_pagamento_inicio && escala.horario_pagamento_fim) {
      setInicio(new Date(escala.horario_pagamento_inicio));
      setFim(new Date(escala.horario_pagamento_fim));
    } else {
      setInicio(originalInicio);
      setFim(originalFim);
    }
  }, [open, escala.horario_pagamento_inicio, escala.horario_pagamento_fim, originalInicio, originalFim]);

  // ── Live duration ────────────────────────────────────────────────────────
  const durationMinutes = useMemo(() => {
    if (!inicio || !fim || !isValid(inicio) || !isValid(fim)) return null;
    return differenceInMinutes(fim, inicio);
  }, [inicio, fim]);

  const durationLabel = durationMinutes !== null ? formatDuration(durationMinutes) : '—';
  const isValidRange =
    inicio !== null &&
    fim !== null &&
    isValid(inicio) &&
    isValid(fim) &&
    isAfter(fim, inicio);

  // ── Actions ──────────────────────────────────────────────────────────────
  const handleResetToOriginal = () => {
    setInicio(null);
    setFim(null);
    setError('');
  };

  const handleSave = async () => {
    if (!isValidRange) {
      setError('O horário de fim deve ser posterior ao horário de início.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await updateHorariosPagamento(
        escala.id,
        inicio ? inicio.toISOString() : null,
        fim ? fim.toISOString() : null
      );
      onSaved();
      onClose();
    } catch (err: any) {
      setError('Erro ao salvar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const isClearing = inicio === null && fim === null;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          fontWeight: 700,
          color: '#d97706',
          borderBottom: '2px solid #fef3c7',
          pb: 2,
        }}
      >
        <PieChart sx={{ color: '#d97706' }} />
        Horário de Pagamento
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

          {/* Context — original schedule as reference */}
          <Alert
            severity="info"
            icon={<Info />}
            sx={{ bgcolor: '#eff6ff', '& .MuiAlert-icon': { color: '#3b82f6' } }}
          >
            <Typography variant="body2" fontWeight={600} gutterBottom>
              Escala original de referência
            </Typography>
            <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
              <Chip
                icon={<Schedule sx={{ fontSize: '14px !important' }} />}
                label={`${escala.horario_entrada.substring(0, 5)} – ${escala.horario_saida.substring(0, 5)}`}
                size="small"
                sx={{ bgcolor: '#dbeafe', color: '#1d4ed8', fontWeight: 600 }}
              />
              <Typography variant="caption" color="text.secondary">
                {format(new Date(escala.data_inicio), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              Defina abaixo o intervalo efetivo para cálculo do pagamento desta glosa. Se deixado em
              branco, o horário original será usado.
            </Typography>
          </Alert>

          <Divider />

          {/* Pickers */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <DateTimePicker
              label="Início do pagamento"
              value={inicio}
              onChange={(val) => { setInicio(val); setError(''); }}
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
              <ArrowForward sx={{ color: '#9ca3af' }} />
            </Box>

            <DateTimePicker
              label="Fim do pagamento"
              value={fim}
              onChange={(val) => { setFim(val); setError(''); }}
              ampm={false}
              format="dd/MM/yyyy HH:mm"
              minDateTime={inicio ?? undefined}
              slotProps={{
                textField: {
                  fullWidth: true,
                  size: 'small',
                  helperText: 'Data e hora em que o período de pagamento termina',
                  error: fim !== null && inicio !== null && !isAfter(fim, inicio),
                },
              }}
            />
          </Box>

          {/* Live duration */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1.5,
              p: 2,
              borderRadius: 2,
              bgcolor: isValidRange ? '#fffbeb' : '#f8fafc',
              border: '1px dashed',
              borderColor: isValidRange ? '#d97706' : '#e2e8f0',
              transition: 'all 0.2s',
            }}
          >
            <Schedule sx={{ color: isValidRange ? '#d97706' : '#9ca3af', fontSize: 20 }} />
            <Typography
              variant="body2"
              fontWeight={600}
              color={isValidRange ? '#d97706' : 'text.secondary'}
            >
              Duração calculada:
            </Typography>
            <Typography
              variant="h6"
              fontWeight={700}
              color={isValidRange ? '#d97706' : 'text.disabled'}
            >
              {durationLabel}
            </Typography>
          </Box>

          {/* Error */}
          {error && <Alert severity="error">{error}</Alert>}

          {/* Reset hint */}
          {!isClearing && (
            <Alert severity="warning" sx={{ py: 0.5 }}>
              <Typography variant="caption">
                Para voltar ao horário original da escala, clique em{' '}
                <strong>Usar horário original</strong> abaixo.
              </Typography>
            </Alert>
          )}

          {isClearing && (
            <Alert severity="success" sx={{ py: 0.5 }}>
              <Typography variant="caption">
                Nenhum horário de pagamento definido — o <strong>horário original</strong> da escala
                será usado para calcular o valor.
              </Typography>
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, gap: 1, flexWrap: 'wrap', justifyContent: 'space-between' }}>
        {/* Left: reset action */}
        <Button
          startIcon={<RestartAlt />}
          onClick={handleResetToOriginal}
          disabled={loading || isClearing}
          color="inherit"
          sx={{ color: '#6b7280' }}
        >
          Usar horário original
        </Button>

        {/* Right: cancel + save */}
        <Box display="flex" gap={1}>
          <Button onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            startIcon={loading ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <Save />}
            onClick={handleSave}
            disabled={loading || (!isValidRange && !isClearing)}
            sx={{
              bgcolor: '#d97706',
              '&:hover': { bgcolor: '#b45309' },
              '&.Mui-disabled': { bgcolor: '#fcd34d' },
            }}
          >
            Salvar
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default HorarioPagamentoDialog;
