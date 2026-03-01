/**
 * ScheduledHoursDialog Component
 *
 * Shows detailed scheduled hours for a person.
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
import { Close, CalendarMonth } from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { HorasEscaladasModalState } from '../../types/dashboard.types';

export interface ScheduledHoursDialogProps {
  open: boolean;
  onClose: () => void;
  data: HorasEscaladasModalState['data'];
}

export const ScheduledHoursDialog: React.FC<ScheduledHoursDialogProps> = ({
  open,
  onClose,
  data,
}) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gap={2}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '10px',
                bgcolor: '#ed6c02',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CalendarMonth sx={{ color: 'white', fontSize: 24 }} />
            </Box>
            <Typography variant="h6" fontWeight={700}>
              Horas Escaladas - {data?.nome}
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
            <Paper
              sx={{
                p: 2,
                mb: 3,
                bgcolor: '#fff7ed',
                border: '1px solid #fed7aa',
              }}
            >
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Total de Horas Escaladas
              </Typography>
              <Typography variant="h4" fontWeight={700} color="#ea580c">
                {data.totalHoras.toFixed(1)}h
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {data.detalhamento.length}{' '}
                {data.detalhamento.length === 1 ? 'escala' : 'escalas'}
              </Typography>
            </Paper>

            {/* Details */}
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
              Detalhamento das Escalas
            </Typography>

            {data.detalhamento.length > 0 ? (
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
                      <TableCell align="center">Entrada</TableCell>
                      <TableCell align="center">Saída</TableCell>
                      <TableCell align="right">Horas</TableCell>
                      <TableCell align="center">Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.detalhamento.map((escala, index) => (
                      <TableRow key={index} sx={{ '&:hover': { bgcolor: '#f9fafb' } }}>
                        <TableCell>
                          <Box
                            sx={{
                              width: 28,
                              height: 28,
                              borderRadius: '6px',
                              bgcolor: '#ed6c02',
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
                            {format(parseISO(escala.data), 'dd/MM/yyyy - EEEE', {
                              locale: ptBR,
                            })}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={escala.horarioEntrada}
                            size="small"
                            sx={{
                              bgcolor: '#dbeafe',
                              color: '#1e40af',
                              fontWeight: 600,
                            }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={escala.horarioSaida}
                            size="small"
                            sx={{
                              bgcolor: '#fecaca',
                              color: '#991b1b',
                              fontWeight: 600,
                            }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight={700} color="#ea580c">
                            {escala.horas.toFixed(1)}h
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={escala.status}
                            size="small"
                            color={
                              escala.status === 'Aprovado'
                                ? 'success'
                                : escala.status === 'Reprovado'
                                  ? 'error'
                                  : escala.status === 'Atenção'
                                    ? 'warning'
                                    : 'default'
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Paper
                sx={{
                  p: 3,
                  textAlign: 'center',
                  bgcolor: '#f9fafb',
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  Nenhuma escala encontrada no período selecionado
                </Typography>
              </Paper>
            )}
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

export default ScheduledHoursDialog;
