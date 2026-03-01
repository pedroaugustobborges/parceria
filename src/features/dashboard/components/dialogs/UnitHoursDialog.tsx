/**
 * UnitHoursDialog Component
 *
 * Shows detailed hours in unit for a person.
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
import { Close, AccessTime } from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { HorasUnidadeModalState } from '../../types/dashboard.types';

export interface UnitHoursDialogProps {
  open: boolean;
  onClose: () => void;
  data: HorasUnidadeModalState['data'];
}

export const UnitHoursDialog: React.FC<UnitHoursDialogProps> = ({
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
                bgcolor: '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AccessTime sx={{ color: 'white', fontSize: 24 }} />
            </Box>
            <Typography variant="h6" fontWeight={700}>
              Horas na Unidade - {data?.nome}
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
                bgcolor: '#eff6ff',
                border: '1px solid #bfdbfe',
              }}
            >
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Total de Horas na Unidade
              </Typography>
              <Typography variant="h4" fontWeight={700} color="#1e40af">
                {data.totalHoras.toFixed(1)}h
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {data.detalhamento.length}{' '}
                {data.detalhamento.length === 1 ? 'dia' : 'dias'} com registro
              </Typography>
            </Paper>

            {/* Details */}
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
              Detalhamento Diário
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
                      <TableCell align="center">Primeira Entrada</TableCell>
                      <TableCell align="center">Última Saída</TableCell>
                      <TableCell align="center">E/S</TableCell>
                      <TableCell align="right">Horas</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.detalhamento.map((dia, index) => (
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
                        <TableCell align="center">
                          <Chip
                            label={dia.primeiraEntrada}
                            size="small"
                            sx={{
                              bgcolor: '#dcfce7',
                              color: '#166534',
                              fontWeight: 600,
                            }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={dia.ultimaSaida}
                            size="small"
                            sx={{
                              bgcolor: '#fee2e2',
                              color: '#991b1b',
                              fontWeight: 600,
                            }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Box
                            sx={{
                              display: 'flex',
                              gap: 1,
                              justifyContent: 'center',
                            }}
                          >
                            <Chip label={`E: ${dia.entradas}`} size="small" color="success" />
                            <Chip label={`S: ${dia.saidas}`} size="small" color="error" />
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight={700} color="#1e40af">
                            {dia.horas.toFixed(1)}h
                          </Typography>
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
                  Nenhum acesso encontrado no período selecionado
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

export default UnitHoursDialog;
