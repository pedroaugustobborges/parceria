import React, { useState, useEffect, useRef } from "react";
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
  Autocomplete,
  FormHelperText,
  FormControl,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { useTheme } from "@mui/material";
import CustomDataGridToolbar from "../components/CustomDataGridToolbar";
import { getDataGridStyles } from "../utils/dataGridStyles";
import { Add, Edit, Delete, Inventory } from "@mui/icons-material";
import { supabase } from "../lib/supabase";
import { ItemContrato, UnidadeMedida } from "../types/database.types";
import DeleteConfirmDialog from "../components/DeleteConfirmDialog";

// Chaves de sessionStorage para persistência do rascunho do formulário
const RASCUNHO_FORM_KEY = "itens_rascunho_formulario";
const RASCUNHO_META_KEY = "itens_rascunho_meta";

export const UNIDADES_MEDIDA: UnidadeMedida[] = [
  "atendimento ambulatorial",
  "atendimento domiciliar",
  "auxílio",
  "carga horária mensal",
  "carga horária semanal",
  "cirurgia",
  "consulta",
  "diária",
  "do mensal estimado",
  "horas",
  "intervenção",
  "parecer médico",
  "período",
  "plantão",
  "procedimento",
  "sobreaviso",
  "unidade",
  "visita",
];

const Itens: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const jaRestaurouRef = useRef(false);
  const [itens, setItens] = useState<ItemContrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemContrato | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
    unidades_medida: ["horas"] as UnidadeMedida[],
    codigo_corporativo: "",
  });

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<ItemContrato | null>(null);
  const [deleteBlocked, setDeleteBlocked] = useState(false);
  const [deleteBlockReason, setDeleteBlockReason] = useState("");
  const [deleteRelatedItems, setDeleteRelatedItems] = useState<any[]>([]);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadItens();
  }, []);

  // Salva o rascunho no sessionStorage sempre que o formulário mudar e o dialog estiver aberto
  useEffect(() => {
    if (!dialogOpen) return;
    try {
      sessionStorage.setItem(RASCUNHO_FORM_KEY, JSON.stringify(formData));
      sessionStorage.setItem(
        RASCUNHO_META_KEY,
        JSON.stringify({
          dialogAberto: true,
          itemId: editingItem?.id ?? null,
        }),
      );
    } catch {
      // ignora erros de quota
    }
  }, [formData, dialogOpen, editingItem]);

  // Restaura o rascunho após o carregamento inicial dos dados
  useEffect(() => {
    if (loading || jaRestaurouRef.current) return;
    jaRestaurouRef.current = true;
    try {
      const metaRaw = sessionStorage.getItem(RASCUNHO_META_KEY);
      const formRaw = sessionStorage.getItem(RASCUNHO_FORM_KEY);
      if (!metaRaw || !formRaw) return;

      const meta = JSON.parse(metaRaw);
      const form = JSON.parse(formRaw);

      if (!meta.dialogAberto) return;

      setFormData(form);

      if (meta.itemId) {
        const itemEncontrado = itens.find((i) => i.id === meta.itemId);
        if (itemEncontrado) setEditingItem(itemEncontrado);
      }

      setDialogOpen(true);
    } catch {
      limparRascunhoFormulario();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

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

  const limparRascunhoFormulario = () => {
    sessionStorage.removeItem(RASCUNHO_FORM_KEY);
    sessionStorage.removeItem(RASCUNHO_META_KEY);
  };

  const handleOpenDialog = (item?: ItemContrato) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        nome: item.nome,
        descricao: item.descricao || "",
        unidades_medida: (item.unidade_medida as UnidadeMedida[]) || ["horas"],
        codigo_corporativo: item.codigo_corporativo || "",
      });
    } else {
      setEditingItem(null);
      setFormData({
        nome: "",
        descricao: "",
        unidades_medida: ["horas"],
        codigo_corporativo: "",
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    limparRascunhoFormulario();
    setDialogOpen(false);
    setEditingItem(null);
    setFormData({
      nome: "",
      descricao: "",
      unidades_medida: ["horas"],
      codigo_corporativo: "",
    });
  };

  const handleSave = async () => {
    try {
      if (!formData.nome.trim()) {
        setError("Nome é obrigatório");
        return;
      }

      if (formData.unidades_medida.length === 0) {
        setError("Selecione ao menos uma unidade de medida");
        return;
      }

      setError("");

      if (editingItem) {
        const { error: updateError } = await supabase
          .from("itens_contrato")
          .update({
            nome: formData.nome,
            descricao: formData.descricao || null,
            unidade_medida: formData.unidades_medida,
            codigo_corporativo: formData.codigo_corporativo.trim() || null,
          })
          .eq("id", editingItem.id);

        if (updateError) {
          if (updateError.code === "23505") {
            setError(
              "Este código corporativo já está em uso. Utilize um código único.",
            );
            return;
          }
          throw updateError;
        }
      } else {
        const { error: insertError } = await supabase
          .from("itens_contrato")
          .insert({
            nome: formData.nome,
            descricao: formData.descricao || null,
            unidade_medida: formData.unidades_medida,
            codigo_corporativo: formData.codigo_corporativo.trim() || null,
          });

        if (insertError) {
          if (insertError.code === "23505") {
            setError(
              "Este código corporativo já está em uso. Utilize um código único.",
            );
            return;
          }
          throw insertError;
        }
      }

      limparRascunhoFormulario();
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

  const handleOpenDeleteDialog = async (item: ItemContrato) => {
    setItemToDelete(item);
    setDeleteBlocked(false);
    setDeleteBlockReason("");
    setDeleteRelatedItems([]);

    try {
      const { data: vinculos, error: vinculosError } = await supabase
        .from("contrato_itens")
        .select("contrato_id, contratos(nome)")
        .eq("item_id", item.id);

      if (vinculosError) throw vinculosError;

      const relatedItems = [];

      if (vinculos && vinculos.length > 0) {
        relatedItems.push({
          type: "Contrato(s) que utilizam este item",
          count: vinculos.length,
          items: vinculos.map((v: any) => v.contratos?.nome || "Contrato"),
        });
      }

      if (relatedItems.length > 0) {
        setDeleteBlocked(true);
        setDeleteBlockReason(
          "Este item não pode ser excluído pois está vinculado a contratos. Remova o item dos contratos antes de excluir.",
        );
        setDeleteRelatedItems(relatedItems);
      }
    } catch (err: any) {
      console.error("Erro ao verificar vínculos:", err);
      setError("Erro ao verificar vínculos do item");
      return;
    }

    setDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setItemToDelete(null);
    setDeleteBlocked(false);
    setDeleteBlockReason("");
    setDeleteRelatedItems([]);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete || deleteBlocked) return;

    try {
      setDeleting(true);
      const { error: deleteError } = await supabase
        .from("itens_contrato")
        .delete()
        .eq("id", itemToDelete.id);

      if (deleteError) throw deleteError;

      handleCloseDeleteDialog();
      loadItens();
    } catch (err: any) {
      setError(err.message || "Erro ao excluir item");
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
      field: "codigo_corporativo",
      headerName: "Cód. Padronização",
      width: 160,
      renderCell: (params) => (
        <Typography
          variant="body2"
          color={params.value ? "primary.main" : "text.disabled"}
          fontWeight={params.value ? 600 : 400}
        >
          {params.value || "—"}
        </Typography>
      ),
    },
    {
      field: "unidade_medida",
      headerName: "Unidade(s) de Medida",
      width: 280,
      renderCell: (params) => {
        const unidades: string[] = Array.isArray(params.value)
          ? params.value
          : [params.value].filter(Boolean);
        return (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, py: 0.5 }}>
            {unidades.map((u) => (
              <Chip
                key={u}
                label={u}
                size="small"
                color="primary"
                variant="outlined"
                sx={{ fontSize: "0.7rem" }}
              />
            ))}
          </Box>
        );
      },
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
                slots={{ toolbar: CustomDataGridToolbar }}
                slotProps={{
                  toolbar: {
                    showQuickFilter: true,
                    quickFilterProps: { debounceMs: 500 },
                    fileName: "itens_contrato",
                    sheetName: "Itens",
                  },
                }}
                disableRowSelectionOnClick
                getRowHeight={() => "auto"}
                sx={{
                  ...getDataGridStyles(isDark),
                  "& .MuiDataGrid-cell": {
                    py: 1,
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
              variant="outlined"
              margin="normal"
              value={formData.nome}
              onChange={(e) =>
                setFormData({ ...formData, nome: e.target.value })
              }
              required
              fullWidth
              autoFocus
              InputLabelProps={{
                shrink: !!formData.nome,
              }}
            />

            <TextField
              label="Cód. Padronização"
              value={formData.codigo_corporativo}
              onChange={(e) =>
                setFormData({ ...formData, codigo_corporativo: e.target.value })
              }
              fullWidth
              helperText="Código único do item (ex: 001, A01). Deixe em branco se não houver."
              inputProps={{ maxLength: 50 }}
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

            {/* Multi-select para Unidades de Medida */}
            <FormControl fullWidth>
              <Autocomplete
                multiple
                options={UNIDADES_MEDIDA}
                value={formData.unidades_medida}
                onChange={(_, newValue) =>
                  setFormData({
                    ...formData,
                    unidades_medida: newValue as UnidadeMedida[],
                  })
                }
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => {
                    const { key, ...tagProps } = getTagProps({ index });
                    return (
                      <Chip
                        key={key}
                        label={option}
                        size="small"
                        color="primary"
                        variant="outlined"
                        {...tagProps}
                      />
                    );
                  })
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Unidades de Medida"
                    required
                    placeholder={
                      formData.unidades_medida.length === 0
                        ? "Selecione uma ou mais..."
                        : ""
                    }
                    error={formData.unidades_medida.length === 0}
                  />
                )}
              />
              {formData.unidades_medida.length === 0 && (
                <FormHelperText error>
                  Selecione ao menos uma unidade de medida
                </FormHelperText>
              )}
              {formData.unidades_medida.length > 1 && (
                <FormHelperText>
                  Quando este item for adicionado a um contrato, será solicitada
                  a escolha da unidade a ser utilizada.
                </FormHelperText>
              )}
            </FormControl>
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

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
        onConfirm={handleConfirmDelete}
        title="Excluir Item de Contrato"
        itemName={itemToDelete?.nome || ""}
        severity="warning"
        isBlocked={deleteBlocked}
        blockReason={deleteBlockReason}
        relatedItems={deleteRelatedItems}
        warningMessage={
          !deleteBlocked
            ? "Esta ação não poderá ser desfeita. O item será permanentemente removido do sistema."
            : undefined
        }
        loading={deleting}
      />
    </Box>
  );
};

export default Itens;
