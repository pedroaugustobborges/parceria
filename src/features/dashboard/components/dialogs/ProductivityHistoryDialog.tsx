/**
 * ProductivityHistoryDialog Component
 *
 * Shows detailed productivity history for a person with modern UI.
 */

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  Card,
  CardContent,
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
  Divider,
  Alert,
  alpha,
} from '@mui/material';
import {
  Close,
  Download,
  Warning,
  AccessTime,
  TrendingUp,
  Person,
  Badge,
  Work,
  Assignment,
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { HorasCalculadas, Produtividade } from '../../types/dashboard.types';
import { exportProductivityXLSX } from '../../utils/exportUtils';

export interface ProductivityHistoryDialogProps {
  open: boolean;
  onClose: () => void;
  selectedPerson: HorasCalculadas | null;
  personProdutividade: Produtividade[];
  onOpenAccessHistory?: (person: HorasCalculadas) => void;
}

export const ProductivityHistoryDialog: React.FC<ProductivityHistoryDialogProps> = ({
  open,
  onClose,
  selectedPerson,
  personProdutividade,
  onOpenAccessHistory,
}) => {
  const handleExport = () => {
    if (selectedPerson && personProdutividade.length > 0) {
      exportProductivityXLSX(selectedPerson, personProdutividade);
    }
  };

  const totalRegistros = personProdutividade.reduce(
    (sum, p) =>
      sum +
      (p.procedimento || 0) +
      (p.parecer_solicitado || 0) +
      (p.parecer_realizado || 0) +
      (p.cirurgia_realizada || 0) +
      (p.prescricao || 0) +
      (p.evolucao || 0) +
      (p.urgencia || 0) +
      (p.ambulatorio || 0) +
      (p.auxiliar || 0) +
      (p.encaminhamento || 0) +
      (p.folha_objetivo_diario || 0) +
      (p.evolucao_diurna_cti || 0) +
      (p.evolucao_noturna_cti || 0) +
      (p.qtd_documentos_pep || 0),
    0
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
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
            `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.08)} 0%, ${alpha(theme.palette.secondary.light, 0.04)} 100%)`,
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
                bgcolor: 'secondary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TrendingUp sx={{ color: 'white', fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={700} color="text.primary">
                Histórico de Produtividade
              </Typography>
              {selectedPerson && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {selectedPerson.nome}
                </Typography>
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
        {selectedPerson && (
          <>
            {/* Person Info Cards */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card
                  elevation={0}
                  sx={{
                    background: (theme) =>
                      `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.primary.light, 0.05)} 100%)`,
                    border: '1px solid',
                    borderColor: (theme) => alpha(theme.palette.primary.main, 0.2),
                    borderRadius: 2,
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: (theme) => `0 8px 24px ${alpha(theme.palette.primary.main, 0.15)}`,
                    },
                  }}
                >
                  <CardContent sx={{ py: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Person sx={{ fontSize: 18, color: 'primary.main' }} />
                      <Typography variant="caption" color="text.secondary" fontWeight={500}>
                        CPF
                      </Typography>
                    </Box>
                    <Typography variant="h6" fontWeight={700} color="primary.dark">
                      {selectedPerson.cpf}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card
                  elevation={0}
                  sx={{
                    background: (theme) =>
                      `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.1)} 0%, ${alpha(theme.palette.success.light, 0.05)} 100%)`,
                    border: '1px solid',
                    borderColor: (theme) => alpha(theme.palette.success.main, 0.2),
                    borderRadius: 2,
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: (theme) => `0 8px 24px ${alpha(theme.palette.success.main, 0.15)}`,
                    },
                  }}
                >
                  <CardContent sx={{ py: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Badge sx={{ fontSize: 18, color: 'success.main' }} />
                      <Typography variant="caption" color="text.secondary" fontWeight={500}>
                        Matrícula
                      </Typography>
                    </Box>
                    <Typography variant="h6" fontWeight={700} color="success.dark">
                      {selectedPerson.matricula}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card
                  elevation={0}
                  sx={{
                    background: (theme) =>
                      `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.1)} 0%, ${alpha(theme.palette.warning.light, 0.05)} 100%)`,
                    border: '1px solid',
                    borderColor: (theme) => alpha(theme.palette.warning.main, 0.2),
                    borderRadius: 2,
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: (theme) => `0 8px 24px ${alpha(theme.palette.warning.main, 0.15)}`,
                    },
                  }}
                >
                  <CardContent sx={{ py: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Work sx={{ fontSize: 18, color: 'warning.main' }} />
                      <Typography variant="caption" color="text.secondary" fontWeight={500}>
                        Tipo
                      </Typography>
                    </Box>
                    <Typography variant="h6" fontWeight={700} color="warning.dark">
                      {selectedPerson.tipo}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card
                  elevation={0}
                  sx={{
                    background: (theme) =>
                      `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.1)} 0%, ${alpha(theme.palette.info.light, 0.05)} 100%)`,
                    border: '1px solid',
                    borderColor: (theme) => alpha(theme.palette.info.main, 0.2),
                    borderRadius: 2,
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: (theme) => `0 8px 24px ${alpha(theme.palette.info.main, 0.15)}`,
                    },
                  }}
                >
                  <CardContent sx={{ py: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Assignment sx={{ fontSize: 18, color: 'info.main' }} />
                      <Typography variant="caption" color="text.secondary" fontWeight={500}>
                        Total de Atividades
                      </Typography>
                    </Box>
                    <Typography variant="h6" fontWeight={700} color="info.dark">
                      {totalRegistros}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Productivity Table */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 2,
              }}
            >
              <Typography variant="h6" fontWeight={600}>
                Registros de Produtividade
              </Typography>
              <Chip
                label={`${personProdutividade.length} registros`}
                size="small"
                color="secondary"
                variant="outlined"
                sx={{ fontWeight: 600 }}
              />
            </Box>

            {personProdutividade.length === 0 ? (
              <Alert
                severity="info"
                sx={{
                  mb: 2,
                  borderRadius: 2,
                  '& .MuiAlert-icon': {
                    alignItems: 'center',
                  },
                }}
                icon={<Warning />}
              >
                <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                  Nenhum registro de produtividade encontrado
                </Typography>
                <Typography variant="caption" component="div" color="text.secondary">
                  Possíveis causas:
                </Typography>
                <Typography variant="caption" component="div" color="text.secondary" sx={{ ml: 2 }}>
                  • Não há registros de produtividade para este profissional no período selecionado
                </Typography>
                <Typography variant="caption" component="div" color="text.secondary" sx={{ ml: 2 }}>
                  • O código MV do profissional pode não estar cadastrado ou vinculado corretamente
                </Typography>
                <Typography variant="caption" component="div" color="text.secondary" sx={{ ml: 2 }}>
                  • Os dados de produtividade ainda não foram importados para o período
                </Typography>
              </Alert>
            ) : (
              <TableContainer
                component={Paper}
                elevation={0}
                sx={{
                  maxHeight: 500,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  overflow: 'hidden',
                }}
              >
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      {[
                        'Data',
                        'Origem',
                        'Procedimentos',
                        'Par. Sol.',
                        'Par. Real.',
                        'Cirurgias',
                        'Prescrições',
                        'Evoluções',
                        'Urgências',
                        'Ambulatórios',
                        'Docs PEP',
                      ].map((header) => (
                        <TableCell
                          key={header}
                          sx={{
                            fontWeight: 700,
                            bgcolor: 'grey.100',
                            color: 'text.primary',
                            borderBottom: '2px solid',
                            borderColor: 'secondary.main',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {header}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {personProdutividade.map((prod, index) => (
                      <TableRow
                        key={index}
                        sx={{
                          transition: 'background-color 0.15s',
                          '&:hover': {
                            bgcolor: (theme) => alpha(theme.palette.secondary.main, 0.04),
                          },
                          '&:last-child td': { border: 0 },
                          '&:nth-of-type(even)': {
                            bgcolor: 'grey.50',
                          },
                        }}
                      >
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {prod.data
                              ? format(parseISO(prod.data), 'dd/MM/yyyy', { locale: ptBR })
                              : '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {prod.origem || '-'}
                          </Typography>
                        </TableCell>
                        {[
                          prod.procedimento,
                          prod.parecer_solicitado,
                          prod.parecer_realizado,
                          prod.cirurgia_realizada,
                          prod.prescricao,
                          prod.evolucao,
                          prod.urgencia,
                          prod.ambulatorio,
                          prod.qtd_documentos_pep,
                        ].map((value, i) => (
                          <TableCell key={i} align="center">
                            <Chip
                              label={value || 0}
                              size="small"
                              color={(value || 0) > 0 ? 'success' : 'default'}
                              sx={{
                                fontWeight: 600,
                                minWidth: 40,
                                borderRadius: 1,
                              }}
                            />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
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
        {onOpenAccessHistory && (
          <Box sx={{ flexGrow: 1 }}>
            <Button
              onClick={() => {
                if (selectedPerson) {
                  onClose();
                  onOpenAccessHistory(selectedPerson);
                }
              }}
              variant="outlined"
              color="primary"
              startIcon={<AccessTime />}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 600,
              }}
            >
              Ver Acessos
            </Button>
          </Box>
        )}
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
          disabled={personProdutividade.length === 0}
        >
          Exportar Excel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ProductivityHistoryDialog;
