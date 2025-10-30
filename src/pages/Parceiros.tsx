import React, { useState, useEffect } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
} from "@mui/material";
import { DataGrid, GridColDef, GridToolbar } from "@mui/x-data-grid";
import { Add, Edit, Delete, Business } from "@mui/icons-material";
import { supabase } from "../lib/supabase";
import { Parceiro } from "../types/database.types";
import { format, parseISO } from "date-fns";
import DeleteConfirmDialog from "../components/DeleteConfirmDialog";

const Parceiros: React.FC = () => {
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingParceiro, setEditingParceiro] = useState<Parceiro | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    cnpj: "",
    telefone: "",
    email: "",
  });

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [parceiroToDelete, setParceiroToDelete] = useState<Parceiro | null>(null);
  const [deleteBlocked, setDeleteBlocked] = useState(false);
  const [deleteBlockReason, setDeleteBlockReason] = useState("");
  const [deleteRelatedItems, setDeleteRelatedItems] = useState<any[]>([]);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadParceiros();
  }, []);

  const loadParceiros = async () => {
    try {
      setLoading(true);
      setError("");

      const { data, error: fetchError } = await supabase
        .from("parceiros")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;

      setParceiros(data || []);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar parceiros");
      console.error("Erro:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (parceiro?: Parceiro) => {
    if (parceiro) {
      setEditingParceiro(parceiro);
      setFormData({
        nome: parceiro.nome,
        cnpj: parceiro.cnpj,
        telefone: parceiro.telefone || "",
        email: parceiro.email || "",
      });
    } else {
      setEditingParceiro(null);
      setFormData({
        nome: "",
        cnpj: "",
        telefone: "",
        email: "",
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingParceiro(null);
    setError("");
  };

  const formatCNPJ = (value: string) => {
    // Remove tudo que não é dígito
    const numbers = value.replace(/\D/g, "");

    // Aplica a máscara de CNPJ
    if (numbers.length <= 14) {
      return numbers
        .replace(/(\d{2})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1/$2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    }
    return value;
  };

  const formatTelefone = (value: string) => {
    // Remove tudo que não é dígito
    const numbers = value.replace(/\D/g, "");

    // Aplica a máscara de telefone
    if (numbers.length <= 11) {
      return numbers
        .replace(/(\d{2})(\d)/, "($1) $2")
        .replace(/(\d{4,5})(\d{4})$/, "$1-$2");
    }
    return value;
  };

  const handleSave = async () => {
    try {
      setError("");
      setSuccess("");

      if (!formData.nome.trim() || !formData.cnpj.trim()) {
        setError("Nome e CNPJ são obrigatórios");
        return;
      }

      // Remove formatação do CNPJ para salvar
      const cnpjLimpo = formData.cnpj.replace(/\D/g, "");

      if (cnpjLimpo.length !== 14) {
        setError("CNPJ deve ter 14 dígitos");
        return;
      }

      const parceiroData = {
        nome: formData.nome,
        cnpj: cnpjLimpo,
        telefone: formData.telefone || null,
        email: formData.email || null,
      };

      if (editingParceiro) {
        // Update existing parceiro
        const { error: updateError } = await supabase
          .from("parceiros")
          .update(parceiroData)
          .eq("id", editingParceiro.id);

        if (updateError) throw updateError;
        setSuccess("Parceiro atualizado com sucesso!");
      } else {
        // Create new parceiro
        const { error: insertError } = await supabase
          .from("parceiros")
          .insert(parceiroData);

        if (insertError) throw insertError;
        setSuccess("Parceiro criado com sucesso!");
      }

      handleCloseDialog();
      loadParceiros();
    } catch (err: any) {
      setError(err.message || "Erro ao salvar parceiro");
      console.error("Erro:", err);
    }
  };

  const handleToggleAtivo = async (parceiro: Parceiro) => {
    try {
      const { error: updateError } = await supabase
        .from("parceiros")
        .update({ ativo: !parceiro.ativo })
        .eq("id", parceiro.id);

      if (updateError) throw updateError;

      setSuccess(
        `Parceiro ${!parceiro.ativo ? "ativado" : "desativado"} com sucesso!`
      );
      loadParceiros();
    } catch (err: any) {
      setError(err.message || "Erro ao atualizar parceiro");
      console.error("Erro:", err);
    }
  };

  const handleOpenDeleteDialog = async (parceiro: Parceiro) => {
    setParceiroToDelete(parceiro);
    setDeleteBlocked(false);
    setDeleteBlockReason("");
    setDeleteRelatedItems([]);

    try {
      // Verificar vínculos com contratos
      const { data: contratos, error: contratosError } = await supabase
        .from("contratos")
        .select("nome")
        .eq("empresa", parceiro.nome);

      if (contratosError) throw contratosError;

      const relatedItems = [];

      if (contratos && contratos.length > 0) {
        relatedItems.push({
          type: "Contrato(s) vinculado(s)",
          count: contratos.length,
          items: contratos.map((c: any) => c.nome),
        });
      }

      if (relatedItems.length > 0) {
        setDeleteBlocked(true);
        setDeleteBlockReason(
          "Este parceiro não pode ser excluído pois possui contratos vinculados. Remova os contratos antes de excluir."
        );
        setDeleteRelatedItems(relatedItems);
      }
    } catch (err: any) {
      console.error("Erro ao verificar vínculos:", err);
      setError("Erro ao verificar vínculos do parceiro");
      return;
    }

    setDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setParceiroToDelete(null);
    setDeleteBlocked(false);
    setDeleteBlockReason("");
    setDeleteRelatedItems([]);
  };

  const handleConfirmDelete = async () => {
    if (!parceiroToDelete || deleteBlocked) return;

    try {
      setDeleting(true);
      const { error: deleteError } = await supabase
        .from("parceiros")
        .delete()
        .eq("id", parceiroToDelete.id);

      if (deleteError) throw deleteError;

      setSuccess("Parceiro excluído com sucesso!");
      handleCloseDeleteDialog();
      loadParceiros();
    } catch (err: any) {
      setError(err.message || "Erro ao excluir parceiro");
      console.error("Erro:", err);
      handleCloseDeleteDialog();
    } finally {
      setDeleting(false);
    }
  };

  const columns: GridColDef[] = [
    {
      field: "nome",
      headerName: "Nome",
      flex: 1,
      minWidth: 250,
    },
    {
      field: "cnpj",
      headerName: "CNPJ",
      width: 180,
      renderCell: (params) => formatCNPJ(params.value),
    },
    {
      field: "telefone",
      headerName: "Telefone",
      width: 150,
      renderCell: (params) =>
        params.value ? formatTelefone(params.value) : "-",
    },
    {
      field: "email",
      headerName: "E-mail",
      flex: 1,
      minWidth: 200,
      renderCell: (params) => params.value || "-",
    },
    {
      field: "ativo",
      headerName: "Status",
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value ? "Ativo" : "Inativo"}
          size="small"
          color={params.value ? "success" : "default"}
          onClick={() => handleToggleAtivo(params.row)}
          sx={{ cursor: "pointer" }}
        />
      ),
    },
    {
      field: "created_at",
      headerName: "Cadastro",
      width: 120,
      renderCell: (params) => format(parseISO(params.value), "dd/MM/yyyy"),
    },
    {
      field: "actions",
      headerName: "Ações",
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: "flex", gap: 1 }}>
          <IconButton
            size="small"
            color="primary"
            onClick={() => handleOpenDialog(params.row)}
          >
            <Edit fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            color="error"
            onClick={() => handleOpenDeleteDialog(params.row)}
          >
            <Delete fontSize="small" />
          </IconButton>
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 4,
        }}
      >
        <Box>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Parceiros
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Gerencie as empresas parceiras contratadas
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
          sx={{
            height: 42,
            background: "linear-gradient(135deg, #0ea5e9 0%, #8b5cf6 100%)",
            color: "white",
            "&:hover": {
              background: "linear-gradient(135deg, #0284c7 0%, #7c3aed 100%)",
            },
          }}
        >
          Novo Parceiro
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess("")}>
          {success}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Box sx={{ height: 600, width: "100%" }}>
            {loading ? (
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  height: "100%",
                }}
              >
                <CircularProgress />
              </Box>
            ) : (
              <DataGrid
                rows={parceiros}
                columns={columns}
                pageSizeOptions={[10, 25, 50, 100]}
                initialState={{
                  pagination: { paginationModel: { pageSize: 25 } },
                }}
                slots={{ toolbar: GridToolbar }}
                slotProps={{
                  toolbar: {
                    showQuickFilter: true,
                    quickFilterProps: { debounceMs: 500 },
                  },
                }}
                disableRowSelectionOnClick
                sx={{
                  border: "none",
                  "& .MuiDataGrid-cell:focus": {
                    outline: "none",
                  },
                }}
              />
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Dialog para criar/editar parceiro */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Business color="primary" />
            <Typography variant="h6" fontWeight={600}>
              {editingParceiro ? "Editar Parceiro" : "Novo Parceiro"}
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ pt: 3 }}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <TextField
              label="Nome da Empresa"
              value={formData.nome}
              onChange={(e) =>
                setFormData({ ...formData, nome: e.target.value })
              }
              required
              fullWidth
              autoFocus
            />

            <TextField
              label="CNPJ"
              value={formData.cnpj}
              onChange={(e) =>
                setFormData({ ...formData, cnpj: formatCNPJ(e.target.value) })
              }
              required
              fullWidth
              helperText="Ex: 12.345.678/0001-90"
              inputProps={{ maxLength: 18 }}
            />

            <TextField
              label="Telefone"
              value={formData.telefone}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  telefone: formatTelefone(e.target.value),
                })
              }
              fullWidth
              helperText="Ex: (62) 3234-5678"
              inputProps={{ maxLength: 15 }}
            />

            <TextField
              label="E-mail"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              type="email"
              fullWidth
              helperText="Ex: contato@empresa.com.br"
            />
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleCloseDialog} variant="outlined">
            Cancelar
          </Button>
          <Button onClick={handleSave} variant="contained">
            {editingParceiro ? "Salvar" : "Criar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
        onConfirm={handleConfirmDelete}
        title="Excluir Parceiro"
        itemName={parceiroToDelete?.nome || ""}
        severity="warning"
        isBlocked={deleteBlocked}
        blockReason={deleteBlockReason}
        relatedItems={deleteRelatedItems}
        warningMessage={
          !deleteBlocked
            ? "Esta ação não poderá ser desfeita. O parceiro será permanentemente removido do sistema."
            : undefined
        }
        loading={deleting}
      />
    </Box>
  );
};

export default Parceiros;
