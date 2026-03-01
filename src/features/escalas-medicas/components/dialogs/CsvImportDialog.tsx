/**
 * CsvImportDialog Component
 *
 * Dialog for uploading and validating CSV files for bulk escala import.
 */

import React, { useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  Typography,
  Alert,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
} from '@mui/material';
import { CloudUpload, Analytics } from '@mui/icons-material';

// ============================================
// Props
// ============================================

export interface CsvImportDialogProps {
  open: boolean;
  onClose: () => void;
  csvFile: File | null;
  setCsvFile: (file: File | null) => void;
  csvErrors: string[];
  onProcess: () => void;
  processing: boolean;
}

// ============================================
// Component
// ============================================

export const CsvImportDialog: React.FC<CsvImportDialogProps> = ({
  open,
  onClose,
  csvFile,
  setCsvFile,
  csvErrors,
  onProcess,
  processing,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setCsvFile(file);
    }
  };

  const handleClose = () => {
    if (!processing) {
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={(_event, reason) => {
        // Prevent closing on backdrop click or ESC key to avoid losing CSV data
        if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
          return;
        }
        handleClose();
      }}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <CloudUpload sx={{ color: 'primary.main' }} />
          <span style={{ fontWeight: 700 }}>Importar Escalas via CSV</span>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2" fontWeight={600} gutterBottom>
              Formato do arquivo CSV:
            </Typography>
            <Typography variant="body2" component="div">
              <strong>Colunas obrigatórias:</strong> cpf, data_inicio, horario_entrada,
              horario_saida
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              <strong>Formatos:</strong>
            </Typography>
            <List dense>
              <ListItem sx={{ py: 0 }}>
                <ListItemText
                  primary="• CPF: 8 a 13 dígitos numéricos (deve existir na base de usuários)"
                  primaryTypographyProps={{ variant: 'body2' }}
                />
              </ListItem>
              <ListItem sx={{ py: 0 }}>
                <ListItemText
                  primary="• data_inicio: YYYY-MM-DD (ex: 2025-01-15)"
                  primaryTypographyProps={{ variant: 'body2' }}
                />
              </ListItem>
              <ListItem sx={{ py: 0 }}>
                <ListItemText
                  primary="• horario_entrada e horario_saida: HH:MM ou HH:MM:SS (ex: 08:00 ou 08:00:00)"
                  primaryTypographyProps={{ variant: 'body2' }}
                />
              </ListItem>
            </List>
          </Alert>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />

          {/* Upload area */}
          <Box
            sx={{
              border: '2px dashed',
              borderColor: csvFile ? 'success.main' : 'grey.300',
              borderRadius: 2,
              p: 4,
              textAlign: 'center',
              bgcolor: csvFile ? 'success.50' : 'grey.50',
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': {
                borderColor: 'primary.main',
                bgcolor: 'primary.50',
              },
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <CloudUpload
              sx={{
                fontSize: 48,
                color: csvFile ? 'success.main' : 'grey.400',
                mb: 1,
              }}
            />
            <Typography variant="body1" fontWeight={600}>
              {csvFile ? csvFile.name : 'Clique para selecionar um arquivo'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {csvFile ? 'Arquivo selecionado' : 'Formatos aceitos: .csv'}
            </Typography>
          </Box>

          {/* Error messages */}
          {csvErrors.length > 0 && (
            <Alert severity="error" sx={{ mt: 3 }}>
              <Typography variant="body2" fontWeight={600} gutterBottom>
                Erros encontrados:
              </Typography>
              <List dense>
                {csvErrors.map((error, index) => (
                  <ListItem key={index} sx={{ py: 0 }}>
                    <ListItemText
                      primary={`• ${error}`}
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItem>
                ))}
              </List>
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={processing}>
          Cancelar
        </Button>
        <Button
          onClick={onProcess}
          variant="contained"
          disabled={!csvFile || processing}
          startIcon={
            processing ? <CircularProgress size={20} sx={{ color: 'white' }} /> : <Analytics />
          }
        >
          {processing ? 'Validando...' : 'Validar e Continuar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CsvImportDialog;
