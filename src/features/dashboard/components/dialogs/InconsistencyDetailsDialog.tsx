/**
 * InconsistencyDetailsDialog Component
 *
 * Shows detailed inconsistency information with modern UI.
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
  useTheme,
} from '@mui/material';
import { Close, Download, Warning, ErrorOutline, InfoOutlined } from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { InconsistenciaModalState, Produtividade } from '../../types/dashboard.types';
import { exportInconsistencyXLSX } from '../../utils/exportUtils';
import {
  getTableHeaderStyles,
  getTableRowStyles,
  getTableContainerStyles,
} from '../../../../utils/dataGridStyles';

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
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const handleExport = () => {
    if (data) {
      exportInconsistencyXLSX(data.nome, data.tipo, data.datas, data.detalhes);
    }
  };

  const calculateTotals = (registros: Produtividade[]) => {
    return registros.reduce(
      (acc, reg) => ({
        procedimento: acc.procedimento + (reg.procedimento || 0),
        parecer_solicitado: acc.parecer_solicitado + (reg.parecer_solicitado || 0),
        parecer_realizado: acc.parecer_realizado + (reg.parecer_realizado || 0),
        cirurgia: acc.cirurgia + (reg.cirurgia_realizada || 0),
        prescricao: acc.prescricao + (reg.prescricao || 0),
        evolucao: acc.evolucao + (reg.evolucao || 0),
        urgencia: acc.urgencia + (reg.urgencia || 0),
        ambulatorio: acc.ambulatorio + (reg.ambulatorio || 0),
        qtd_documentos_pep: acc.qtd_documentos_pep + (reg.qtd_documentos_pep || 0),
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
        qtd_documentos_pep: 0,
      }
    );
  };

  const isProdSemAcesso = data?.tipo === 'prodSemAcesso';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          overflow: 'hidden',
          bgcolor: isDark ? '#0f172a' : 'background.paper',
        },
      }}
    >
      <DialogTitle
        sx={{
          pb: 1,
          background: isDark
            ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.05) 100%)'
            : 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.03) 100%)',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                bgcolor: '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isProdSemAcesso ? (
                <ErrorOutline sx={{ color: 'white', fontSize: 24 }} />
              ) : (
                <InfoOutlined sx={{ color: 'white', fontSize: 24 }} />
              )}
            </Box>
            <Box>
              <Typography
                variant="h5"
                fontWeight={700}
                color={isDark ? '#93c5fd' : '#1e40af'}
              >
                Detalhes da Inconsistência
              </Typography>
              {data && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    {data.nome}
                  </Typography>
                  <Chip
                    label={isProdSemAcesso ? 'Produtividade sem Acesso' : 'Acesso sem Produtividade'}
                    size="small"
                    sx={{
                      fontWeight: 600,
                      borderRadius: 1.5,
                      bgcolor: isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)',
                      color: isDark ? '#93c5fd' : '#3b82f6',
                    }}
                  />
                </Box>
              )}
            </Box>
          </Box>
          <IconButton
            onClick={onClose}
            size="small"
            sx={{
              bgcolor: isDark ? 'rgba(59, 130, 246, 0.2)' : 'grey.100',
              '&:hover': { bgcolor: isDark ? 'rgba(59, 130, 246, 0.3)' : 'grey.200' },
            }}
          >
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <Divider sx={{ borderColor: isDark ? 'rgba(59, 130, 246, 0.2)' : 'divider' }} />

      <DialogContent
        sx={{
          pt: 3,
          bgcolor: isDark ? 'rgba(15, 23, 42, 0.5)' : 'grey.50',
        }}
      >
        {data && (
          <>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 2,
              }}
            >
              <Typography variant="body1" color="text.secondary">
                Datas com inconsistência identificadas
              </Typography>
              <Chip
                icon={<Warning sx={{ fontSize: 16 }} />}
                label={`${data.datas.length} ${data.datas.length === 1 ? 'data' : 'datas'}`}
                size="small"
                sx={{
                  fontWeight: 600,
                  bgcolor: isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)',
                  color: isDark ? '#93c5fd' : '#3b82f6',
                  border: '1px solid',
                  borderColor: isDark ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.3)',
                  '& .MuiChip-icon': {
                    color: isDark ? '#93c5fd' : '#3b82f6',
                  },
                }}
              />
            </Box>

            <TableContainer
              component={Paper}
              elevation={0}
              sx={{
                maxHeight: 400,
                ...getTableContainerStyles(isDark),
              }}
            >
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ ...getTableHeaderStyles(isDark), width: 60 }}>
                      #
                    </TableCell>
                    <TableCell sx={getTableHeaderStyles(isDark)}>
                      Data
                    </TableCell>
                    <TableCell sx={getTableHeaderStyles(isDark)}>
                      Tipo
                    </TableCell>
                    {isProdSemAcesso && (
                      <>
                        {['Proc.', 'Par.Sol.', 'Par.Real.', 'Cirur.', 'Presc.', 'Evol.', 'Urg.', 'Amb.', 'Docs PEP', 'Total'].map(
                          (header) => (
                            <TableCell
                              key={header}
                              sx={{
                                ...getTableHeaderStyles(isDark),
                                textAlign: 'center',
                              }}
                            >
                              {header}
                            </TableCell>
                          )
                        )}
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
                      totais.ambulatorio +
                      totais.qtd_documentos_pep;

                    return (
                      <TableRow key={index} sx={getTableRowStyles(isDark)}>
                        <TableCell>
                          <Box
                            sx={{
                              width: 32,
                              height: 32,
                              borderRadius: 1,
                              bgcolor: '#3b82f6',
                              color: 'white',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: 13,
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
                            label={isProdSemAcesso ? 'Produção sem Acesso' : 'Acesso sem Produção'}
                            size="small"
                            sx={{
                              fontWeight: 600,
                              borderRadius: 1.5,
                              bgcolor: isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)',
                              color: isDark ? '#93c5fd' : '#3b82f6',
                            }}
                          />
                        </TableCell>
                        {isProdSemAcesso && (
                          <>
                            {[
                              totais.procedimento,
                              totais.parecer_solicitado,
                              totais.parecer_realizado,
                              totais.cirurgia,
                              totais.prescricao,
                              totais.evolucao,
                              totais.urgencia,
                              totais.ambulatorio,
                              totais.qtd_documentos_pep,
                            ].map((value, i) => (
                              <TableCell key={i} sx={{ textAlign: 'center' }}>
                                <Typography
                                  variant="body2"
                                  fontWeight={600}
                                  color={value > 0 ? 'text.primary' : 'text.disabled'}
                                >
                                  {value}
                                </Typography>
                              </TableCell>
                            ))}
                            <TableCell sx={{ textAlign: 'center' }}>
                              <Chip
                                label={totalAtividades}
                                size="small"
                                sx={{
                                  fontWeight: 700,
                                  minWidth: 40,
                                  borderRadius: 1,
                                  bgcolor: '#3b82f6',
                                  color: 'white',
                                }}
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

      <Divider sx={{ borderColor: isDark ? 'rgba(59, 130, 246, 0.2)' : 'divider' }} />

      <DialogActions
        sx={{
          px: 3,
          py: 2,
          bgcolor: isDark ? '#0f172a' : 'background.paper',
          gap: 1,
        }}
      >
        <Button
          onClick={onClose}
          variant="outlined"
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600,
          }}
        >
          Fechar
        </Button>
        <Button
          onClick={handleExport}
          variant="contained"
          startIcon={<Download />}
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600,
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
            },
          }}
        >
          Exportar Excel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default InconsistencyDetailsDialog;
