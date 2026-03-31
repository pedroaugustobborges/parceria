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
  alpha,
} from '@mui/material';
import { Close, Download, Warning, ErrorOutline, InfoOutlined } from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { InconsistenciaModalState, Produtividade } from '../../types/dashboard.types';
import { exportInconsistencyXLSX } from '../../utils/exportUtils';

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
  const iconColor = isProdSemAcesso ? 'warning' : 'info';
  const gradientColor = isProdSemAcesso ? 'warning' : 'info';

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
        },
      }}
    >
      <DialogTitle
        sx={{
          pb: 1,
          background: (theme) =>
            `linear-gradient(135deg, ${alpha(theme.palette[gradientColor].main, 0.12)} 0%, ${alpha(theme.palette[gradientColor].light, 0.04)} 100%)`,
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
                bgcolor: `${iconColor}.main`,
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
              <Typography variant="h5" fontWeight={700} color="text.primary">
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
                    color={iconColor}
                    sx={{ fontWeight: 600, borderRadius: 1.5 }}
                  />
                </Box>
              )}
            </Box>
          </Box>
          <IconButton
            onClick={onClose}
            size="small"
            sx={{
              bgcolor: 'grey.100',
              '&:hover': { bgcolor: 'grey.200' },
            }}
          >
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ pt: 3, bgcolor: 'grey.50' }}>
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
                color={iconColor}
                variant="outlined"
                sx={{ fontWeight: 600 }}
              />
            </Box>

            <TableContainer
              component={Paper}
              elevation={0}
              sx={{
                maxHeight: 400,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell
                      sx={{
                        fontWeight: 700,
                        bgcolor: 'grey.100',
                        color: 'text.primary',
                        borderBottom: '2px solid',
                        borderColor: `${iconColor}.main`,
                        width: 60,
                      }}
                    >
                      #
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 700,
                        bgcolor: 'grey.100',
                        color: 'text.primary',
                        borderBottom: '2px solid',
                        borderColor: `${iconColor}.main`,
                      }}
                    >
                      Data
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 700,
                        bgcolor: 'grey.100',
                        color: 'text.primary',
                        borderBottom: '2px solid',
                        borderColor: `${iconColor}.main`,
                      }}
                    >
                      Tipo
                    </TableCell>
                    {isProdSemAcesso && (
                      <>
                        {['Proc.', 'Par.Sol.', 'Par.Real.', 'Cirur.', 'Presc.', 'Evol.', 'Urg.', 'Amb.', 'Docs PEP', 'Total'].map(
                          (header) => (
                            <TableCell
                              key={header}
                              sx={{
                                fontWeight: 700,
                                bgcolor: 'grey.100',
                                color: 'text.primary',
                                borderBottom: '2px solid',
                                borderColor: `${iconColor}.main`,
                                textAlign: 'center',
                                whiteSpace: 'nowrap',
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
                      <TableRow
                        key={index}
                        sx={{
                          transition: 'background-color 0.15s',
                          '&:hover': {
                            bgcolor: (theme) => alpha(theme.palette[iconColor].main, 0.04),
                          },
                          '&:last-child td': { border: 0 },
                          '&:nth-of-type(even)': {
                            bgcolor: 'grey.50',
                          },
                        }}
                      >
                        <TableCell>
                          <Box
                            sx={{
                              width: 32,
                              height: 32,
                              borderRadius: 1,
                              bgcolor: `${iconColor}.main`,
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
                            color={iconColor}
                            sx={{
                              fontWeight: 600,
                              borderRadius: 1.5,
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
                                color="primary"
                                sx={{
                                  fontWeight: 700,
                                  minWidth: 40,
                                  borderRadius: 1,
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

      <Divider />

      <DialogActions
        sx={{
          px: 3,
          py: 2,
          bgcolor: 'background.paper',
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
