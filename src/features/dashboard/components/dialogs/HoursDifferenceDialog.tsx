/**
 * HoursDifferenceDialog Component
 *
 * Shows detailed hours difference analysis.
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
  Grid,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
} from '@mui/material';
import { Close, AccessTime } from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { DiferencaHorasModalState } from '../../types/dashboard.types';

export interface HoursDifferenceDialogProps {
  open: boolean;
  onClose: () => void;
  data: DiferencaHorasModalState['data'];
}

export const HoursDifferenceDialog: React.FC<HoursDifferenceDialogProps> = ({
  open,
  onClose,
  data,
}) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gap={2}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '10px',
                bgcolor: '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AccessTime sx={{ color: 'white', fontSize: 24 }} />
            </Box>
            <Typography variant="h6" fontWeight={700}>
              Análise de Horas - {data?.nome}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {data && (
          <>
            {/* Summary */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={4}>
                <Paper
                  sx={{
                    p: 2,
                    bgcolor: '#eff6ff',
                    border: '1px solid #bfdbfe',
                  }}
                >
                  <Typography variant="caption" color="text.secondary" gutterBottom>
                    Total de Horas na Unidade
                  </Typography>
                  <Typography variant="h5" fontWeight={700} color="#1e40af">
                    {data.totalHoras.toFixed(1)}h
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Paper
                  sx={{
                    p: 2,
                    bgcolor: '#f3f4f6',
                    border: '1px solid #d1d5db',
                  }}
                >
                  <Typography variant="caption" color="text.secondary" gutterBottom>
                    Carga Horária Escalada
                  </Typography>
                  <Typography variant="h5" fontWeight={700} color="#374151">
                    {data.cargaHorariaEscalada.toFixed(1)}h
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Paper
                  sx={{
                    p: 2,
                    bgcolor:
                      data.diferenca > 0
                        ? '#f0fdf4'
                        : data.diferenca < 0
                          ? '#fef2f2'
                          : '#f9fafb',
                    border: `1px solid ${
                      data.diferenca > 0
                        ? '#bbf7d0'
                        : data.diferenca < 0
                          ? '#fecaca'
                          : '#e5e7eb'
                    }`,
                  }}
                >
                  <Typography variant="caption" color="text.secondary" gutterBottom>
                    Diferença
                  </Typography>
                  <Typography
                    variant="h5"
                    fontWeight={700}
                    color={
                      data.diferenca > 0
                        ? '#16a34a'
                        : data.diferenca < 0
                          ? '#dc2626'
                          : '#6b7280'
                    }
                  >
                    {data.diferenca > 0 ? '+' : ''}
                    {data.diferenca.toFixed(1)}h
                  </Typography>
                </Paper>
              </Grid>
            </Grid>

            {/* Daily Breakdown */}
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
              Detalhamento Diário ({data.detalhamentoDiario.length}{' '}
              {data.detalhamentoDiario.length === 1 ? 'dia' : 'dias'})
            </Typography>

            <TableContainer
              component={Paper}
              sx={{
                boxShadow: 'none',
                border: '1px solid #e5e7eb',
                maxHeight: 400,
              }}
            >
              <Table stickyHeader>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f9fafb' }}>
                    <TableCell width={60}>#</TableCell>
                    <TableCell>Data</TableCell>
                    <TableCell align="right">Horas Trabalhadas</TableCell>
                    <TableCell align="right">Carga Escalada</TableCell>
                    <TableCell align="right">Diferença</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.detalhamentoDiario.map((dia, index) => (
                    <TableRow key={index} sx={{ '&:hover': { bgcolor: '#f9fafb' } }}>
                      <TableCell>
                        <Box
                          sx={{
                            width: 28,
                            height: 28,
                            borderRadius: '6px',
                            bgcolor: '#3b82f6',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: 12,
                          }}
                        >
                          {index + 1}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {format(parseISO(dia.data), 'dd/MM/yyyy - EEEE', {
                            locale: ptBR,
                          })}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Chip
                          label={`${dia.horasTrabalhadas.toFixed(1)}h`}
                          size="small"
                          sx={{
                            bgcolor: '#eff6ff',
                            color: '#1e40af',
                            fontWeight: 600,
                          }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Chip
                          label={`${dia.cargaEscalada.toFixed(1)}h`}
                          size="small"
                          sx={{
                            bgcolor: '#f3f4f6',
                            color: '#374151',
                            fontWeight: 600,
                          }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Chip
                          label={`${dia.diferenca > 0 ? '+' : ''}${dia.diferenca.toFixed(1)}h`}
                          size="small"
                          sx={{
                            bgcolor:
                              dia.diferenca > 0
                                ? 'rgba(34, 197, 94, 0.1)'
                                : dia.diferenca < 0
                                  ? 'rgba(239, 68, 68, 0.1)'
                                  : 'rgba(156, 163, 175, 0.1)',
                            color:
                              dia.diferenca > 0
                                ? '#16a34a'
                                : dia.diferenca < 0
                                  ? '#dc2626'
                                  : '#6b7280',
                            fontWeight: 700,
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} variant="outlined">
          Fechar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default HoursDifferenceDialog;
