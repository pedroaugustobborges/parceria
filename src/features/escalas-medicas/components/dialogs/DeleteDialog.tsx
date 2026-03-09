/**
 * DeleteDialog Component
 *
 * Dialog for deleting (soft-delete) a single escala.
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
  Card,
  CardContent,
  TextField,
  Typography,
  Alert,
} from "@mui/material";
import { DeleteForever, Cancel } from "@mui/icons-material";
import { format, parseISO } from "date-fns";
import type { EscalaMedica, Contrato } from "../../types/escalas.types";

// ============================================
// Props
// ============================================

export interface DeleteDialogProps {
  open: boolean;
  onClose: () => void;
  escala: EscalaMedica | null;
  contratos: Contrato[];
  justificativa: string;
  setJustificativa: (value: string) => void;
  onConfirm: () => void;
  loading?: boolean;
}

// ============================================
// Component
// ============================================

export const DeleteDialog: React.FC<DeleteDialogProps> = ({
  open,
  onClose,
  escala,
  contratos,
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
        Excluir Escala
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3, mt: 2 }}>
          {/* Warning Alert */}
          <Alert severity="warning" icon={<DeleteForever />}>
            Esta ação irá marcar a escala como <strong>Excluída</strong>. A
            escala não será mais visível para você após a exclusão, mas ainda
            poderá ser recuperada por administradores pelos próximos 30 dias.
          </Alert>

          {/* Escala Info */}
          {escala && (
            <Card
              sx={{
                bgcolor: "#f1f5f9",
                borderLeft: "4px solid",
                borderColor: "#64748b",
              }}
            >
              <CardContent>
                <Typography variant="subtitle2" fontWeight={600}>
                  {contratos.find((c) => c.id === escala.contrato_id)?.nome}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Data: {format(parseISO(escala.data_inicio), "dd/MM/yyyy")}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Horário: {escala.horario_entrada.substring(0, 5)} -{" "}
                  {escala.horario_saida.substring(0, 5)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Médicos: {escala.medicos.length}
                </Typography>
              </CardContent>
            </Card>
          )}

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
            helperText="Justificativa obrigatória para excluir a escala"
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
          {loading ? "Excluindo..." : "Confirmar Exclusão"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeleteDialog;
