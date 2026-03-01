/**
 * PunctualityDetailsDialog Component
 *
 * Shows detailed punctuality information for a doctor.
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
  useTheme,
} from '@mui/material';
import { Close, Schedule } from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { PontualidadeModalState } from '../../types/dashboard.types';

export interface PunctualityDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  data: PontualidadeModalState['data'];
}

export const PunctualityDetailsDialog: React.FC<PunctualityDetailsDialogProps> = ({
  open,
  onClose,
  data,
}) => {
  const theme = useTheme();

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
                bgcolor: '#22c55e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Schedule sx={{ color: 'white', fontSize: 24 }} />
            </Box>
            <Typography variant="h6" fontWeight={700}>
              Detalhes de Pontualidade - {data?.nome}
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
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Total de atrasos: {data.atrasos.length}
            </Typography>

            <TableContainer
              component={Paper}
              sx={{
                boxShadow: 'none',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Table>
                <TableHead>
                  <TableRow
                    sx={{
                      bgcolor:
                        theme.palette.mode === 'dark'
                          ? 'rgba(255, 255, 255, 0.05)'
                          : 'grey.50',
                    }}
                  >
                    <TableCell width={60}>#</TableCell>
                    <TableCell>Data</TableCell>
                    <TableCell>Horário Escalado</TableCell>
                    <TableCell>Horário de Entrada</TableCell>
                    <TableCell>Atraso</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.atrasos.map((atraso, index) => (
                    <TableRow
                      key={index}
                      sx={{
                        '&:hover': {
                          bgcolor:
                            theme.palette.mode === 'dark'
                              ? 'rgba(255, 255, 255, 0.05)'
                              : 'grey.50',
                        },
                      }}
                    >
                      <TableCell>
                        <Box
                          sx={{
                            width: 28,
                            height: 28,
                            borderRadius: '6px',
                            bgcolor: '#22c55e',
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
                          {format(parseISO(atraso.data), 'dd/MM/yyyy - EEEE', {
                            locale: ptBR,
                          })}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={atraso.horarioEscalado}
                          size="small"
                          sx={{
                            bgcolor:
                              theme.palette.mode === 'dark'
                                ? 'rgba(59, 130, 246, 0.2)'
                                : '#dbeafe',
                            color:
                              theme.palette.mode === 'dark' ? '#93c5fd' : '#1e40af',
                            fontWeight: 600,
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={atraso.horarioEntrada}
                          size="small"
                          sx={{
                            bgcolor:
                              theme.palette.mode === 'dark'
                                ? 'rgba(251, 191, 36, 0.2)'
                                : '#fef3c7',
                            color:
                              theme.palette.mode === 'dark' ? '#fcd34d' : '#92400e',
                            fontWeight: 600,
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={`${atraso.atrasoMinutos} min`}
                          size="small"
                          sx={{
                            bgcolor:
                              theme.palette.mode === 'dark'
                                ? atraso.atrasoMinutos > 30
                                  ? 'rgba(239, 68, 68, 0.2)'
                                  : 'rgba(251, 146, 60, 0.2)'
                                : atraso.atrasoMinutos > 30
                                  ? '#fecaca'
                                  : '#fed7aa',
                            color:
                              theme.palette.mode === 'dark'
                                ? atraso.atrasoMinutos > 30
                                  ? '#fca5a5'
                                  : '#fdba74'
                                : atraso.atrasoMinutos > 30
                                  ? '#991b1b'
                                  : '#92400e',
                            fontWeight: 600,
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

export default PunctualityDetailsDialog;
