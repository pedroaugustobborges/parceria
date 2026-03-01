/**
 * AccessHistoryDialog Component
 *
 * Shows detailed access history for a person.
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
} from '@mui/material';
import {
  Close,
  Download,
  TrendingUp,
  AccessTime,
  LoginOutlined,
  LogoutOutlined,
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { HorasCalculadas, Acesso } from '../../types/dashboard.types';
import { exportAccessHistoryCSV } from '../../utils/exportUtils';

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
      exportAccessHistoryCSV(selectedPerson, personAcessos);
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
          <Box>
            <Typography variant="h5" fontWeight={700}>
              Histórico de Acessos
            </Typography>
            {selectedPerson && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {selectedPerson.nome}
              </Typography>
            )}
          </Box>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ pt: 3 }}>
        {selectedPerson && (
          <>
            {/* Person Info Cards */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card
                  sx={{
                    bgcolor: 'primary.50',
                    border: '1px solid',
                    borderColor: 'primary.200',
                  }}
                >
                  <CardContent sx={{ py: 2 }}>
                    <Typography variant="caption" color="text.secondary" gutterBottom>
                      CPF
                    </Typography>
                    <Typography variant="h6" fontWeight={600}>
                      {selectedPerson.cpf}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card
                  sx={{
                    bgcolor: 'success.50',
                    border: '1px solid',
                    borderColor: 'success.200',
                  }}
                >
                  <CardContent sx={{ py: 2 }}>
                    <Typography variant="caption" color="text.secondary" gutterBottom>
                      Matrícula
                    </Typography>
                    <Typography variant="h6" fontWeight={600}>
                      {selectedPerson.matricula}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card
                  sx={{
                    bgcolor: 'warning.50',
                    border: '1px solid',
                    borderColor: 'warning.200',
                  }}
                >
                  <CardContent sx={{ py: 2 }}>
                    <Typography variant="caption" color="text.secondary" gutterBottom>
                      Tipo
                    </Typography>
                    <Typography variant="h6" fontWeight={600}>
                      {selectedPerson.tipo}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card
                  sx={{
                    bgcolor: 'info.50',
                    border: '1px solid',
                    borderColor: 'info.200',
                  }}
                >
                  <CardContent sx={{ py: 2 }}>
                    <Typography variant="caption" color="text.secondary" gutterBottom>
                      Total de Horas na Unidade
                    </Typography>
                    <Typography variant="h6" fontWeight={600}>
                      {selectedPerson.totalHoras}h
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Access Table */}
            <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
              Registros de Acesso ({personAcessos.length})
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
                    <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50' }}>
                      Data/Hora
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50' }}>
                      Sentido
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50' }}>
                      Tipo
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50' }}>
                      Matrícula
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {personAcessos.map((acesso, index) => (
                    <TableRow
                      key={index}
                      sx={{
                        '&:hover': { bgcolor: 'action.hover' },
                        '&:last-child td': { border: 0 },
                      }}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <AccessTime fontSize="small" color="action" />
                          <Typography variant="body2">
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
                              <LoginOutlined fontSize="small" />
                            ) : (
                              <LogoutOutlined fontSize="small" />
                            )
                          }
                          label={acesso.sentido === 'E' ? 'Entrada' : 'Saída'}
                          size="small"
                          color={acesso.sentido === 'E' ? 'success' : 'error'}
                          sx={{ fontWeight: 600 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{acesso.tipo}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{acesso.matricula}</Typography>
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

      <DialogActions sx={{ px: 3, py: 2 }}>
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
          >
            Ver Produtividade
            {!produtividadeAvailable && ' (Carregando...)'}
          </Button>
        </Box>
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

export default AccessHistoryDialog;
