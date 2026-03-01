/**
 * ProductivityHistoryDialog Component
 *
 * Shows detailed productivity history for a person.
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
} from '@mui/material';
import { Close, Download, Warning, AccessTime } from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { HorasCalculadas, Produtividade } from '../../types/dashboard.types';
import { exportProductivityCSV } from '../../utils/exportUtils';

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
      exportProductivityCSV(selectedPerson, personProdutividade);
    }
  };

  const totalRegistros = personProdutividade.reduce(
    (sum, p) =>
      sum +
      p.procedimento +
      p.parecer_solicitado +
      p.parecer_realizado +
      p.cirurgia_realizada +
      p.prescricao +
      p.evolucao +
      p.urgencia +
      p.ambulatorio +
      p.auxiliar +
      p.encaminhamento +
      p.folha_objetivo_diario +
      p.evolucao_diurna_cti +
      p.evolucao_noturna_cti,
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
              Histórico de Produtividade
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
                      Registros
                    </Typography>
                    <Typography variant="h6" fontWeight={600}>
                      {totalRegistros}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Productivity Table */}
            <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
              Registros de Produtividade ({personProdutividade.length})
            </Typography>

            {personProdutividade.length === 0 ? (
              <Alert severity="info" sx={{ mb: 2 }} icon={<Warning />}>
                <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                  Nenhum registro de produtividade encontrado
                </Typography>
                <Typography variant="caption" component="div">
                  Possíveis causas:
                </Typography>
                <Typography variant="caption" component="div" sx={{ ml: 2 }}>
                  • Não há registros de produtividade para este profissional no período
                  selecionado
                </Typography>
                <Typography variant="caption" component="div" sx={{ ml: 2 }}>
                  • O código MV do profissional pode não estar cadastrado ou vinculado
                  corretamente
                </Typography>
                <Typography variant="caption" component="div" sx={{ ml: 2 }}>
                  • Os dados de produtividade ainda não foram importados para o período
                </Typography>
                <Typography
                  variant="caption"
                  component="div"
                  sx={{ mt: 1, fontStyle: 'italic', color: 'text.secondary' }}
                >
                  💡 Dica: Verifique o console do navegador (F12) para mais detalhes de
                  diagnóstico
                </Typography>
              </Alert>
            ) : (
              <TableContainer
                component={Paper}
                sx={{
                  maxHeight: 500,
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
                        Data
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50' }}>
                        Procedimentos
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50' }}>
                        Parecer Sol.
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50' }}>
                        Parecer Real.
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50' }}>
                        Cirurgias
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50' }}>
                        Prescrições
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50' }}>
                        Evoluções
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50' }}>
                        Urgências
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50' }}>
                        Ambulatórios
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {personProdutividade.map((prod, index) => (
                      <TableRow
                        key={index}
                        sx={{
                          '&:hover': { bgcolor: 'action.hover' },
                          '&:last-child td': { border: 0 },
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
                          <Chip
                            label={prod.procedimento}
                            size="small"
                            color={prod.procedimento > 0 ? 'success' : 'default'}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={prod.parecer_solicitado}
                            size="small"
                            color={prod.parecer_solicitado > 0 ? 'success' : 'default'}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={prod.parecer_realizado}
                            size="small"
                            color={prod.parecer_realizado > 0 ? 'success' : 'default'}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={prod.cirurgia_realizada}
                            size="small"
                            color={prod.cirurgia_realizada > 0 ? 'success' : 'default'}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={prod.prescricao}
                            size="small"
                            color={prod.prescricao > 0 ? 'success' : 'default'}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={prod.evolucao}
                            size="small"
                            color={prod.evolucao > 0 ? 'success' : 'default'}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={prod.urgencia}
                            size="small"
                            color={prod.urgencia > 0 ? 'success' : 'default'}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={prod.ambulatorio}
                            size="small"
                            color={prod.ambulatorio > 0 ? 'success' : 'default'}
                          />
                        </TableCell>
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

      <DialogActions sx={{ px: 3, py: 2 }}>
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
              color="secondary"
              startIcon={<AccessTime />}
            >
              Ver Acessos
            </Button>
          </Box>
        )}
        <Button onClick={onClose} variant="outlined">
          Fechar
        </Button>
        <Button
          onClick={handleExport}
          variant="contained"
          startIcon={<Download />}
          sx={{ ml: 1 }}
          disabled={personProdutividade.length === 0}
        >
          Exportar CSV
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ProductivityHistoryDialog;
