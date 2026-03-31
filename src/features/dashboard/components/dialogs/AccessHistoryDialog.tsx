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
  useTheme,
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
import {
  getTableHeaderStyles,
  getTableRowStyles,
  getTableContainerStyles,
} from '../../../../utils/dataGridStyles';

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
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

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
              <AccessTime sx={{ color: 'white', fontSize: 24 }} />
            </Box>
            <Box>
              <Typography
                variant="h5"
                fontWeight={700}
                color={isDark ? '#93c5fd' : '#1e40af'}
              >
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
        {selectedPerson && (
          <>
            {/* Person Info Cards */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              {[
                { icon: Person, label: 'CPF', value: selectedPerson.cpf, color: 'primary' },
                { icon: Badge, label: 'Matrícula', value: selectedPerson.matricula, color: 'success' },
                { icon: Work, label: 'Tipo', value: selectedPerson.tipo, color: 'warning' },
                { icon: Schedule, label: 'Total de Horas', value: `${selectedPerson.totalHoras}h`, color: 'info' },
              ].map((item, index) => (
                <Grid item xs={12} sm={6} md={3} key={index}>
                  <Card
                    elevation={0}
                    sx={{
                      background: isDark
                        ? 'rgba(59, 130, 246, 0.1)'
                        : `linear-gradient(135deg, ${alpha(theme.palette[item.color].main, 0.1)} 0%, ${alpha(theme.palette[item.color].light, 0.05)} 100%)`,
                      border: '1px solid',
                      borderColor: isDark
                        ? 'rgba(59, 130, 246, 0.2)'
                        : alpha(theme.palette[item.color].main, 0.2),
                      borderRadius: 2,
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: `0 8px 24px ${alpha(theme.palette[item.color].main, 0.15)}`,
                      },
                    }}
                  >
                    <CardContent sx={{ py: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <item.icon
                          sx={{
                            fontSize: 18,
                            color: isDark ? '#93c5fd' : theme.palette[item.color].main,
                          }}
                        />
                        <Typography variant="caption" color="text.secondary" fontWeight={500}>
                          {item.label}
                        </Typography>
                      </Box>
                      <Typography
                        variant="h6"
                        fontWeight={700}
                        color={isDark ? '#e2e8f0' : theme.palette[item.color].dark}
                      >
                        {item.value}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
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
              <Typography variant="h6" fontWeight={600} color={isDark ? '#e2e8f0' : 'text.primary'}>
                Registros de Acesso
              </Typography>
              <Chip
                label={`${personAcessos.length} registros`}
                size="small"
                sx={{
                  fontWeight: 600,
                  bgcolor: isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)',
                  color: isDark ? '#93c5fd' : '#3b82f6',
                  border: '1px solid',
                  borderColor: isDark ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.3)',
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
                    {['Data/Hora', 'Sentido', 'Tipo', 'Matrícula'].map((header) => (
                      <TableCell key={header} sx={getTableHeaderStyles(isDark)}>
                        {header}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {personAcessos.map((acesso, index) => (
                    <TableRow key={index} sx={getTableRowStyles(isDark)}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Box
                            sx={{
                              width: 32,
                              height: 32,
                              borderRadius: 1,
                              bgcolor: isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <AccessTime
                              sx={{ fontSize: 18, color: isDark ? '#93c5fd' : '#3b82f6' }}
                            />
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

      <Divider sx={{ borderColor: isDark ? 'rgba(59, 130, 246, 0.2)' : 'divider' }} />

      <DialogActions
        sx={{
          px: 3,
          py: 2,
          bgcolor: isDark ? '#0f172a' : 'background.paper',
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
