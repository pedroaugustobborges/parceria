/**
 * AccessHistoryDialog Component
 *
 * Shows detailed access history for a person with modern UI.
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
  alpha,
} from '@mui/material';
import {
  Close,
  Download,
  TrendingUp,
  AccessTime,
  LoginOutlined,
  LogoutOutlined,
  Badge,
  Person,
  Work,
  Schedule,
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { HorasCalculadas, Acesso } from '../../types/dashboard.types';
import { exportAccessHistoryXLSX } from '../../utils/exportUtils';

export interface AccessHistoryDialogProps {
  open: boolean;
  onClose: () => void;
  selectedPerson: HorasCalculadas | null;
  personAcessos: Acesso[];
  onOpenProdutividade: (person: HorasCalculadas) => void;
  produtividadeAvailable: boolean;
}

export const AccessHistoryDialog: React.FC<AccessHistoryDialogProps> = ({
  open,
  onClose,
  selectedPerson,
  personAcessos,
  onOpenProdutividade,
  produtividadeAvailable,
}) => {
  const handleExport = () => {
    if (selectedPerson && personAcessos.length > 0) {
      exportAccessHistoryXLSX(selectedPerson, personAcessos);
    }
  };

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
            `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.primary.light, 0.04)} 100%)`,
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
                bgcolor: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AccessTime sx={{ color: 'white', fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={700} color="text.primary">
                Histórico de Acessos
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
                      <Schedule sx={{ fontSize: 18, color: 'info.main' }} />
                      <Typography variant="caption" color="text.secondary" fontWeight={500}>
                        Total de Horas
                      </Typography>
                    </Box>
                    <Typography variant="h6" fontWeight={700} color="info.dark">
                      {selectedPerson.totalHoras}h
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Access Table */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 2,
              }}
            >
              <Typography variant="h6" fontWeight={600}>
                Registros de Acesso
              </Typography>
              <Chip
                label={`${personAcessos.length} registros`}
                size="small"
                color="primary"
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
                        borderColor: 'primary.main',
                      }}
                    >
                      Data/Hora
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 700,
                        bgcolor: 'grey.100',
                        color: 'text.primary',
                        borderBottom: '2px solid',
                        borderColor: 'primary.main',
                      }}
                    >
                      Sentido
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 700,
                        bgcolor: 'grey.100',
                        color: 'text.primary',
                        borderBottom: '2px solid',
                        borderColor: 'primary.main',
                      }}
                    >
                      Tipo
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 700,
                        bgcolor: 'grey.100',
                        color: 'text.primary',
                        borderBottom: '2px solid',
                        borderColor: 'primary.main',
                      }}
                    >
                      Matrícula
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {personAcessos.map((acesso, index) => (
                    <TableRow
                      key={index}
                      sx={{
                        transition: 'background-color 0.15s',
                        '&:hover': {
                          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
                        },
                        '&:last-child td': { border: 0 },
                        '&:nth-of-type(even)': {
                          bgcolor: 'grey.50',
                        },
                      }}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Box
                            sx={{
                              width: 32,
                              height: 32,
                              borderRadius: 1,
                              bgcolor: 'grey.100',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <AccessTime sx={{ fontSize: 18, color: 'text.secondary' }} />
                          </Box>
                          <Typography variant="body2" fontWeight={500}>
                            {format(parseISO(acesso.data_acesso), 'dd/MM/yyyy HH:mm:ss', {
                              locale: ptBR,
                            })}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={
                            acesso.sentido === 'E' ? (
                              <LoginOutlined sx={{ fontSize: 16 }} />
                            ) : (
                              <LogoutOutlined sx={{ fontSize: 16 }} />
                            )
                          }
                          label={acesso.sentido === 'E' ? 'Entrada' : 'Saída'}
                          size="small"
                          color={acesso.sentido === 'E' ? 'success' : 'error'}
                          sx={{
                            fontWeight: 600,
                            borderRadius: 1.5,
                            '& .MuiChip-icon': {
                              marginLeft: '8px',
                            },
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {acesso.tipo}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {acesso.matricula}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
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
        <Box sx={{ flexGrow: 1 }}>
          <Button
            onClick={() => {
              if (selectedPerson) {
                onClose();
                onOpenProdutividade(selectedPerson);
              }
            }}
            variant="outlined"
            color="secondary"
            startIcon={<TrendingUp />}
            disabled={!produtividadeAvailable}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            Ver Produtividade
            {!produtividadeAvailable && ' (Carregando...)'}
          </Button>
        </Box>
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

export default AccessHistoryDialog;
