/**
 * BulkDeleteDialog Component
 *
 * Dialog for bulk deleting (soft-delete) multiple escalas.
 * Only requires justificativa - status is always set to "Excluída".
 * Used by terceiro and admin-terceiro users who can ONLY delete, not change to other statuses.
 */

import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  Chip,
  TextField,
  Typography,
  Alert,
} from "@mui/material";
import { DeleteForever, Cancel } from "@mui/icons-material";

// ============================================
// Props
// ============================================

export interface BulkDeleteDialogProps {
  open: boolean;
  onClose: () => void;
  selectedCount: number;
  justificativa: string;
  setJustificativa: (value: string) => void;
  onConfirm: () => void;
  loading?: boolean;
}

// ============================================
// Component
// ============================================

export const BulkDeleteDialog: React.FC<BulkDeleteDialogProps> = ({
  open,
  onClose,
  selectedCount,
  justificativa,
  setJustificativa,
  onConfirm,
  loading = false,
}) => {
  const isValid = justificativa.trim().length > 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle
        sx={{
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          gap: 1,
          color: "#64748b",
        }}
      >
        <DeleteForever />
        Excluir Escalas em Massa
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3, mt: 2 }}>
          {/* Warning Alert */}
          <Alert severity="warning" icon={<DeleteForever />}>
            Esta ação irá marcar as escalas selecionadas como{" "}
            <strong>Excluída</strong>. As escalas não serão mais visíveis para
            você após a exclusão, mas ainda poderão ser recuperadas por
            administradores pelos próximos 30 dias.
          </Alert>

          {/* Selection Info */}
          <Box
            sx={{
              p: 2,
              borderRadius: 1,
              bgcolor: "#f1f5f9",
              border: "1px solid #64748b",
              display: "flex",
              alignItems: "center",
              gap: 2,
            }}
          >
            <Chip
              label={`${selectedCount} escala${selectedCount > 1 ? "s" : ""}`}
              sx={{
                bgcolor: "#64748b",
                color: "white",
                fontWeight: 600,
              }}
            />
            <Typography variant="body2" color="text.secondary">
              {selectedCount > 1 ? "serão excluídas" : "será excluída"}
            </Typography>
          </Box>

          {/* Justification Field */}
          <TextField
            label="Justificativa *"
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            multiline
            rows={4}
            fullWidth
            required
            error={!isValid && justificativa.length > 0}
            helperText="Justificativa obrigatória para excluir as escalas (será aplicada a todas)"
            placeholder="Digite o motivo da exclusão..."
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} startIcon={<Cancel />} disabled={loading}>
          Cancelar
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          startIcon={<DeleteForever />}
          disabled={!isValid || loading}
          sx={{
            bgcolor: "#64748b",
            "&:hover": {
              bgcolor: "#475569",
            },
          }}
        >
          {loading ? "Excluindo..." : `Confirmar Exclusão (${selectedCount})`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BulkDeleteDialog;
