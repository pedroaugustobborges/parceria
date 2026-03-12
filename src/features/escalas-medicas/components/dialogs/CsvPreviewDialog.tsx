/**
 * CsvPreviewDialog Component
 *
 * Dialog for previewing and confirming CSV import data.
 * Supports partial import: shows valid/invalid rows and allows importing only valid ones.
 */

import React, { useMemo } from 'react';
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
  Chip,
  Tooltip,
} from '@mui/material';
import {
  Analytics,
  Close,
  CheckCircle,
  Cancel,
  Warning,
  ErrorOutline,
} from '@mui/icons-material';
import { format, parseISO, isValid } from 'date-fns';
import type {
  CsvPreviewRow,
  CsvValidatedRow,
  Contrato,
  ItemContrato,
} from '../../types/escalas.types';

// Helper to safely format dates
const formatDateSafe = (dateStr: string | undefined): string => {
  if (!dateStr) return '-';
  try {
    const parsed = parseISO(dateStr);
    return isValid(parsed) ? format(parsed, 'dd/MM/yyyy') : dateStr;
  } catch {
    return dateStr || '-';
  }
};

// ============================================
// Props
// ============================================

export interface CsvPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  previewData: CsvPreviewRow[];
  /** All rows with validation status for partial import */
  validatedRows?: CsvValidatedRow[];
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
  validatedRows,
  contratos,
  itensContrato,
  contratoId,
  itemContratoId,
  onConfirm,
  importing,
}) => {
  // Calculate counts
  const { validCount, invalidCount, hasInvalidRows } = useMemo(() => {
    if (validatedRows && validatedRows.length > 0) {
      const valid = validatedRows.filter((r) => r.isValid).length;
      const invalid = validatedRows.filter((r) => !r.isValid).length;
      return { validCount: valid, invalidCount: invalid, hasInvalidRows: invalid > 0 };
    }
    return {
      validCount: previewData.length,
      invalidCount: 0,
      hasInvalidRows: false,
    };
  }, [validatedRows, previewData]);

  // Use validatedRows if available, otherwise fall back to previewData
  const displayRows = useMemo(() => {
    if (validatedRows && validatedRows.length > 0) {
      return validatedRows;
    }
    // Convert previewData to validatedRows format for backwards compatibility
    return previewData.map(
      (row, index): CsvValidatedRow => ({
        ...row,
        lineNumber: index + 2,
        isValid: true,
      })
    );
  }, [validatedRows, previewData]);

  const canImport = validCount > 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <Analytics sx={{ color: 'primary.main' }} />
          <span style={{ fontWeight: 700 }}>
            Revisão da Importação - {displayRows.length} Linha(s)
          </span>
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* Summary Alert */}
        {hasInvalidRows ? (
          <Alert
            severity="warning"
            icon={<Warning />}
            sx={{ mb: 3 }}
          >
            <Typography variant="body2" component="div">
              <strong>Algumas linhas apresentam problemas.</strong>
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              <Chip
                size="small"
                icon={<CheckCircle sx={{ fontSize: 16 }} />}
                label={`${validCount} válida${validCount !== 1 ? 's' : ''}`}
                color="success"
                variant="outlined"
                sx={{ mr: 1, fontWeight: 600 }}
              />
              <Chip
                size="small"
                icon={<Cancel sx={{ fontSize: 16 }} />}
                label={`${invalidCount} com erro${invalidCount !== 1 ? 's' : ''}`}
                color="error"
                variant="outlined"
                sx={{ fontWeight: 600 }}
              />
            </Typography>
            <Typography variant="body2" sx={{ mt: 1.5, color: 'text.secondary' }}>
              Você pode importar apenas as linhas válidas. As linhas com erro serão ignoradas.
            </Typography>
          </Alert>
        ) : (
          <Alert severity="success" sx={{ mb: 3 }}>
            <Typography variant="body2">
              <strong>Validação concluída!</strong> Todas as {validCount} linhas estão válidas e
              serão importadas.
            </Typography>
          </Alert>
        )}

        {/* Contract and Item Info */}
        <Card sx={{ mb: 3, bgcolor: 'primary.50' }}>
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="caption" color="text.secondary">
                  Contrato:
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {contratos.find((c) => c.id === contratoId)?.nome || '-'}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="caption" color="text.secondary">
                  Item de Contrato:
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {itensContrato.find((i) => i.id === itemContratoId)?.nome || '-'}
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Preview Table */}
        <TableContainer component={Paper} sx={{ maxHeight: '400px', overflow: 'auto' }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, width: 50 }}>Linha</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 60 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Médico</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>CPF</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Data</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Entrada</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Saída</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {displayRows.map((row, index) => {
                const isValid = row.isValid;
                return (
                  <TableRow
                    key={index}
                    sx={{
                      bgcolor: isValid ? 'transparent' : 'error.50',
                      '&:nth-of-type(odd)': {
                        bgcolor: isValid ? 'grey.50' : 'error.50',
                      },
                      opacity: isValid ? 1 : 0.85,
                    }}
                  >
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {row.lineNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {isValid ? (
                        <Tooltip title="Será importada">
                          <CheckCircle
                            sx={{ color: 'success.main', fontSize: 20 }}
                          />
                        </Tooltip>
                      ) : (
                        <Tooltip title={row.error || 'Erro de validação'}>
                          <ErrorOutline
                            sx={{ color: 'error.main', fontSize: 20, cursor: 'help' }}
                          />
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          color: isValid ? 'text.primary' : 'text.secondary',
                          textDecoration: isValid ? 'none' : 'line-through',
                        }}
                      >
                        {row.nome}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          color: isValid ? 'text.primary' : 'text.secondary',
                          textDecoration: isValid ? 'none' : 'line-through',
                        }}
                      >
                        {row.cpf}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          color: isValid ? 'text.primary' : 'text.secondary',
                          textDecoration: isValid ? 'none' : 'line-through',
                        }}
                      >
                        {formatDateSafe(row.data_inicio)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          color: isValid ? 'text.primary' : 'text.secondary',
                          textDecoration: isValid ? 'none' : 'line-through',
                        }}
                      >
                        {row.horario_entrada || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          color: isValid ? 'text.primary' : 'text.secondary',
                          textDecoration: isValid ? 'none' : 'line-through',
                        }}
                      >
                        {row.horario_saida || '-'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Invalid rows detail */}
        {hasInvalidRows && (
          <Box sx={{ mt: 2 }}>
            <Typography
              variant="subtitle2"
              color="error.main"
              sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}
            >
              <ErrorOutline sx={{ fontSize: 18 }} />
              Detalhes dos erros:
            </Typography>
            <Box
              sx={{
                bgcolor: 'error.50',
                borderRadius: 1,
                p: 1.5,
                maxHeight: 150,
                overflow: 'auto',
              }}
            >
              {displayRows
                .filter((r) => !r.isValid)
                .map((row, idx) => (
                  <Typography
                    key={idx}
                    variant="body2"
                    color="error.dark"
                    sx={{ mb: 0.5, '&:last-child': { mb: 0 } }}
                  >
                    <strong>Linha {row.lineNumber}:</strong> {row.error}
                  </Typography>
                ))}
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={importing} startIcon={<Close />}>
          Cancelar
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          disabled={importing || !canImport}
          color={hasInvalidRows ? 'warning' : 'primary'}
          startIcon={
            importing ? (
              <CircularProgress size={20} sx={{ color: 'white' }} />
            ) : (
              <CheckCircle />
            )
          }
        >
          {importing
            ? 'Importando...'
            : hasInvalidRows
              ? `Importar ${validCount} Válida${validCount !== 1 ? 's' : ''}`
              : `Confirmar Importação (${validCount})`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CsvPreviewDialog;
