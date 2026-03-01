/**
 * ContractWarningDialog Component
 *
 * Shows a warning when selecting a contract filter.
 */

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Box,
  Button,
  Typography,
  Divider,
} from '@mui/material';
import { Warning } from '@mui/icons-material';

export interface ContractWarningDialogProps {
  open: boolean;
  onClose: () => void;
  onAccept: () => void;
}

export const ContractWarningDialog: React.FC<ContractWarningDialogProps> = ({
  open,
  onClose,
  onAccept,
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        },
      }}
    >
      <DialogContent sx={{ pt: 4, pb: 3 }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              bgcolor: 'warning.50',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 2,
            }}
          >
            <Warning sx={{ fontSize: 32, color: 'warning.main' }} />
          </Box>

          <Typography variant="h5" fontWeight={700} gutterBottom>
            Atenção
          </Typography>

          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ mt: 1, lineHeight: 1.7 }}
          >
            Ao selecionar um contrato, você estará visualizando todos os acessos de
            parceiros que estão vinculados ao número desse contrato. No entanto, isso não
            significa <em>necessariamente</em> que os acessos sejam referentes a esse
            contrato, uma vez que um parceiro pode participar de diferentes contratos.
          </Typography>
        </Box>
      </DialogContent>

      <Divider />

      <DialogActions sx={{ px: 3, py: 2, justifyContent: 'center' }}>
        <Button
          onClick={onAccept}
          variant="contained"
          sx={{
            minWidth: 120,
            background: 'linear-gradient(135deg, #0ea5e9 0%, #8b5cf6 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #0284c7 0%, #7c3aed 100%)',
            },
          }}
        >
          Entendido
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ContractWarningDialog;
