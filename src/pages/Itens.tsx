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
  MenuItem,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
} from "@mui/material";
import { DataGrid, GridColDef, GridToolbar } from "@mui/x-data-grid";
import { Add, Edit, Delete, Inventory } from "@mui/icons-material";
import { supabase } from "../lib/supabase";
import { ItemContrato, UnidadeMedida } from "../types/database.types";

const UNIDADES_MEDIDA: UnidadeMedida[] = [
  "horas",
  "plantão",
  "procedimento",
  "cirurgia",
  "consulta",
  "diária",
  "atendimento ambulatorial",
  "atendimento domiciliar",
  "intervenção",
  "parecer médico",
  "visita",
  "carga horária semanal",
  "carga horária mensal",
];

const Itens: React.FC = () => {
  const [itens, setItens] = useState<ItemContrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemContrato | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
    unidade_medida: "horas" as UnidadeMedida,
  });

  useEffect(() => {
    loadItens();
  }, []);

  const loadItens = async () => {
    try {
      setLoading(true);
      setError("");

      const { data, error: fetchError } = await supabase
        .from("itens_contrato")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;

      setItens(data || []);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar itens");
      console.error("Erro:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (item?: ItemContrato) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        nome: item.nome,
        descricao: item.descricao || "",
        unidade_medida: item.unidade_medida,
      });
    } else {
      setEditingItem(null);
      setFormData({
        nome: "",
        descricao: "",
        unidade_medida: "horas",
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingItem(null);
    setFormData({
      nome: "",
      descricao: "",
      unidade_medida: "horas",
    });
  };

  const handleSave = async () => {
    try {
      if (!formData.nome.trim()) {
        setError("Nome é obrigatório");
        return;
      }

      setError("");

      if (editingItem) {
        // Update existing item
        const { error: updateError } = await supabase
          .from("itens_contrato")
          .update({
            nome: formData.nome,
            descricao: formData.descricao || null,
            unidade_medida: formData.unidade_medida,
          })
          .eq("id", editingItem.id);

        if (updateError) throw updateError;
      } else {
        // Create new item
        const { error: insertError } = await supabase
          .from("itens_contrato")
          .insert({
            nome: formData.nome,
            descricao: formData.descricao || null,
            unidade_medida: formData.unidade_medida,
          });

        if (insertError) throw insertError;
      }

      handleCloseDialog();
      loadItens();
    } catch (err: any) {
      setError(err.message || "Erro ao salvar item");
      console.error("Erro:", err);
    }
  };

  const handleToggleAtivo = async (item: ItemContrato) => {
    try {
      const { error: updateError } = await supabase
        .from("itens_contrato")
        .update({ ativo: !item.ativo })
        .eq("id", item.id);

      if (updateError) throw updateError;

      loadItens();
    } catch (err: any) {
      setError(err.message || "Erro ao atualizar item");
      console.error("Erro:", err);
    }
  };

  const handleDelete = async (item: ItemContrato) => {
    if (
      !window.confirm(`Tem certeza que deseja excluir o item "${item.nome}"?`)
    ) {
      return;
    }

    try {
      const { error: deleteError } = await supabase
        .from("itens_contrato")
        .delete()
        .eq("id", item.id);

      if (deleteError) throw deleteError;

      loadItens();
    } catch (err: any) {
      setError(err.message || "Erro ao excluir item");
      console.error("Erro:", err);
    }
  };

  const columns: GridColDef[] = [
    {
      field: "nome",
      headerName: "Nome",
      flex: 1,
      minWidth: 200,
    },
    {
      field: "descricao",
      headerName: "Descrição",
      flex: 1,
      minWidth: 250,
      renderCell: (params) => (
        <Typography variant="body2" color="text.secondary">
          {params.value || "-"}
        </Typography>
      ),
    },
    {
      field: "unidade_medida",
      headerName: "Unidade de Medida",
      width: 200,
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color="primary"
          variant="outlined"
        />
      ),
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
            onClick={() => handleDelete(params.row)}
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
            Itens de Contrato
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Gerencie os itens que podem ser incluídos em contratos
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
          Novo Item
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError("")}>
          {error}
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
                rows={itens}
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

      {/* Dialog para criar/editar item */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Inventory color="primary" />
            <Typography variant="h6" fontWeight={600}>
              {editingItem ? "Editar Item" : "Novo Item"}
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ pt: 3 }}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <TextField
              label="Nome do Item"
              value={formData.nome}
              onChange={(e) =>
                setFormData({ ...formData, nome: e.target.value })
              }
              required
              fullWidth
              autoFocus
            />

            <TextField
              label="Descrição"
              value={formData.descricao}
              onChange={(e) =>
                setFormData({ ...formData, descricao: e.target.value })
              }
              multiline
              rows={3}
              fullWidth
            />

            <TextField
              label="Unidade de Medida"
              value={formData.unidade_medida}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  unidade_medida: e.target.value as UnidadeMedida,
                })
              }
              select
              required
              fullWidth
            >
              {UNIDADES_MEDIDA.map((unidade) => (
                <MenuItem key={unidade} value={unidade}>
                  {unidade}
                </MenuItem>
              ))}
            </TextField>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleCloseDialog} variant="outlined">
            Cancelar
          </Button>
          <Button onClick={handleSave} variant="contained">
            {editingItem ? "Salvar" : "Criar"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Itens;
