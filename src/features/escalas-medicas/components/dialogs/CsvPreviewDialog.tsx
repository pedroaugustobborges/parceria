/**
 * CsvPreviewDialog Component
 *
 * Dialog for previewing and confirming CSV import data.
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
  Grid,
  Typography,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
} from '@mui/material';
import { Analytics, Close, CheckCircle } from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import type { CsvPreviewRow, Contrato, ItemContrato } from '../../types/escalas.types';

// ============================================
// Props
// ============================================

export interface CsvPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  previewData: CsvPreviewRow[];
  contratos: Contrato[];
  itensContrato: ItemContrato[];
  contratoId: string;
  itemContratoId: string;
  onConfirm: () => void;
  importing: boolean;
}

// ============================================
// Component
// ============================================

export const CsvPreviewDialog: React.FC<CsvPreviewDialogProps> = ({
  open,
  onClose,
  previewData,
  contratos,
  itensContrato,
  contratoId,
  itemContratoId,
  onConfirm,
  importing,
}) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <Analytics sx={{ color: 'primary.main' }} />
          <span style={{ fontWeight: 700 }}>
            Confirmar Importação - {previewData.length} Escala(s)
          </span>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Alert severity="success" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>Validação concluída!</strong> Os dados abaixo serão importados para o
            contrato e item selecionados. Revise as informações antes de confirmar.
          </Typography>
        </Alert>

        {/* Contract and Item Info */}
        <Card sx={{ mb: 3, bgcolor: 'primary.50' }}>
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="caption" color="text.secondary">
                  Contrato:
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  {contratos.find((c) => c.id === contratoId)?.nome || '-'}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="caption" color="text.secondary">
                  Item de Contrato:
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  {itensContrato.find((i) => i.id === itemContratoId)?.nome || '-'}
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Preview Table */}
        <TableContainer component={Paper} sx={{ maxHeight: '400px', overflow: 'auto' }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>Médico</TableCell>
                <TableCell>CPF</TableCell>
                <TableCell>Data</TableCell>
                <TableCell>Horário Entrada</TableCell>
                <TableCell>Horário Saída</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {previewData.map((row, index) => (
                <TableRow
                  key={index}
                  sx={{
                    '&:nth-of-type(odd)': { bgcolor: 'grey.50' },
                  }}
                >
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{row.nome}</TableCell>
                  <TableCell>{row.cpf}</TableCell>
                  <TableCell>{format(parseISO(row.data_inicio), 'dd/MM/yyyy')}</TableCell>
                  <TableCell>{row.horario_entrada}</TableCell>
                  <TableCell>{row.horario_saida}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={importing} startIcon={<Close />}>
          Voltar
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          disabled={importing}
          startIcon={
            importing ? (
              <CircularProgress size={20} sx={{ color: 'white' }} />
            ) : (
              <CheckCircle />
            )
          }
        >
          {importing ? 'Importando...' : `Confirmar Importação (${previewData.length})`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CsvPreviewDialog;
