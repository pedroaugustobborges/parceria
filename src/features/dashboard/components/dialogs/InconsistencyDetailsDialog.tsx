/**
 * InconsistencyDetailsDialog Component
 *
 * Shows detailed inconsistency information.
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
  Divider,
} from '@mui/material';
import { Close, Download, Warning } from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { InconsistenciaModalState, Produtividade } from '../../types/dashboard.types';
import { exportInconsistencyCSV } from '../../utils/exportUtils';

export interface InconsistencyDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  data: InconsistenciaModalState['data'];
}

export const InconsistencyDetailsDialog: React.FC<InconsistencyDetailsDialogProps> = ({
  open,
  onClose,
  data,
}) => {
  const handleExport = () => {
    if (data) {
      exportInconsistencyCSV(data.nome, data.tipo, data.datas, data.detalhes);
    }
  };

  const calculateTotals = (registros: Produtividade[]) => {
    return registros.reduce(
      (acc, reg) => ({
        procedimento: acc.procedimento + reg.procedimento,
        parecer_solicitado: acc.parecer_solicitado + reg.parecer_solicitado,
        parecer_realizado: acc.parecer_realizado + reg.parecer_realizado,
        cirurgia: acc.cirurgia + reg.cirurgia_realizada,
        prescricao: acc.prescricao + reg.prescricao,
        evolucao: acc.evolucao + reg.evolucao,
        urgencia: acc.urgencia + reg.urgencia,
        ambulatorio: acc.ambulatorio + reg.ambulatorio,
      }),
      {
        procedimento: 0,
        parecer_solicitado: 0,
        parecer_realizado: 0,
        cirurgia: 0,
        prescricao: 0,
        evolucao: 0,
        urgencia: 0,
        ambulatorio: 0,
      }
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box display="flex" alignItems="center" gap={2}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '10px',
                bgcolor: data?.tipo === 'prodSemAcesso' ? 'warning.main' : 'info.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Warning sx={{ color: 'white', fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={700}>
                Detalhes da Inconsistência
              </Typography>
              {data && (
                <Typography variant="body2" color="text.secondary">
                  {data.nome} -{' '}
                  {data.tipo === 'prodSemAcesso'
                    ? 'Produtividade sem Acesso'
                    : 'Acesso sem Produtividade'}
                </Typography>
              )}
            </Box>
          </Box>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ pt: 3 }}>
        {data && (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Total de datas com inconsistência: {data.datas.length}
            </Typography>

            <TableContainer
              component={Paper}
              sx={{
                maxHeight: 400,
                boxShadow: 'none',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
              }}
            >
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50' }} width={60}>
                      #
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50' }}>
                      Data
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50' }}>
                      Tipo
                    </TableCell>
                    {data.tipo === 'prodSemAcesso' && (
                      <>
                        <TableCell
                          sx={{ fontWeight: 600, bgcolor: 'grey.50', textAlign: 'center' }}
                        >
                          Proc.
                        </TableCell>
                        <TableCell
                          sx={{ fontWeight: 600, bgcolor: 'grey.50', textAlign: 'center' }}
                        >
                          Par.Sol.
                        </TableCell>
                        <TableCell
                          sx={{ fontWeight: 600, bgcolor: 'grey.50', textAlign: 'center' }}
                        >
                          Par.Real.
                        </TableCell>
                        <TableCell
                          sx={{ fontWeight: 600, bgcolor: 'grey.50', textAlign: 'center' }}
                        >
                          Cirur.
                        </TableCell>
                        <TableCell
                          sx={{ fontWeight: 600, bgcolor: 'grey.50', textAlign: 'center' }}
                        >
                          Presc.
                        </TableCell>
                        <TableCell
                          sx={{ fontWeight: 600, bgcolor: 'grey.50', textAlign: 'center' }}
                        >
                          Evol.
                        </TableCell>
                        <TableCell
                          sx={{ fontWeight: 600, bgcolor: 'grey.50', textAlign: 'center' }}
                        >
                          Urg.
                        </TableCell>
                        <TableCell
                          sx={{ fontWeight: 600, bgcolor: 'grey.50', textAlign: 'center' }}
                        >
                          Amb.
                        </TableCell>
                        <TableCell
                          sx={{ fontWeight: 600, bgcolor: 'grey.50', textAlign: 'center' }}
                        >
                          Total
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.datas.map((dataStr, index) => {
                    const registros = data.detalhes?.get(dataStr) || [];
                    const totais = calculateTotals(registros);
                    const totalAtividades =
                      totais.procedimento +
                      totais.parecer_solicitado +
                      totais.parecer_realizado +
                      totais.cirurgia +
                      totais.prescricao +
                      totais.evolucao +
                      totais.urgencia +
                      totais.ambulatorio;

                    return (
                      <TableRow
                        key={index}
                        sx={{
                          '&:hover': { bgcolor: 'action.hover' },
                          '&:last-child td': { border: 0 },
                        }}
                      >
                        <TableCell>
                          <Box
                            sx={{
                              width: 28,
                              height: 28,
                              borderRadius: '6px',
                              bgcolor: data.tipo === 'prodSemAcesso' ? 'warning.main' : 'info.main',
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
                            {format(parseISO(dataStr), 'dd/MM/yyyy - EEEE', {
                              locale: ptBR,
                            })}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={
                              data.tipo === 'prodSemAcesso'
                                ? 'Produção sem Acesso'
                                : 'Acesso sem Produção'
                            }
                            size="small"
                            color={data.tipo === 'prodSemAcesso' ? 'warning' : 'info'}
                            sx={{ fontWeight: 600 }}
                          />
                        </TableCell>
                        {data.tipo === 'prodSemAcesso' && (
                          <>
                            <TableCell sx={{ textAlign: 'center' }}>
                              <Typography variant="body2" fontWeight={600}>
                                {totais.procedimento}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ textAlign: 'center' }}>
                              <Typography variant="body2" fontWeight={600}>
                                {totais.parecer_solicitado}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ textAlign: 'center' }}>
                              <Typography variant="body2" fontWeight={600}>
                                {totais.parecer_realizado}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ textAlign: 'center' }}>
                              <Typography variant="body2" fontWeight={600}>
                                {totais.cirurgia}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ textAlign: 'center' }}>
                              <Typography variant="body2" fontWeight={600}>
                                {totais.prescricao}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ textAlign: 'center' }}>
                              <Typography variant="body2" fontWeight={600}>
                                {totais.evolucao}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ textAlign: 'center' }}>
                              <Typography variant="body2" fontWeight={600}>
                                {totais.urgencia}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ textAlign: 'center' }}>
                              <Typography variant="body2" fontWeight={600}>
                                {totais.ambulatorio}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ textAlign: 'center' }}>
                              <Chip
                                label={totalAtividades}
                                size="small"
                                color="primary"
                                sx={{ fontWeight: 700 }}
                              />
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </DialogContent>

      <Divider />

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} variant="outlined">
          Fechar
        </Button>
        <Button
          onClick={handleExport}
          variant="contained"
          startIcon={<Download />}
          sx={{ ml: 1 }}
        >
          Exportar CSV
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default InconsistencyDetailsDialog;
