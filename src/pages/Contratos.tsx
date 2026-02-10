import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Alert,
  Chip,
  Switch,
  FormControlLabel,
  Autocomplete,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableFooter,
  Paper,
  Divider,
  CircularProgress,
} from "@mui/material";
import { DataGrid, GridColDef, GridToolbar } from "@mui/x-data-grid";
import {
  Add,
  Edit,
  Delete,
  Description,
  Remove,
  Inventory,
  CloudUpload,
  Download,
  PictureAsPdf,
  Visibility,
} from "@mui/icons-material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { ptBR } from "date-fns/locale";
import { supabase } from "../lib/supabase";
import {
  Contrato,
  ItemContrato,
  ContratoItem,
  Parceiro,
  UnidadeHospitalar,
  DocumentoContrato,
} from "../types/database.types";
import { format, parseISO } from "date-fns";
import { useAuth } from "../contexts/AuthContext";
import DeleteConfirmDialog from "../components/DeleteConfirmDialog";

interface ItemSelecionado {
  item: ItemContrato;
  quantidade: number;
  valor_unitario: number;
  observacoes: string;
}

const Contratos: React.FC = () => {
  const { isAdminAgirCorporativo, isAdminAgirPlanta, isAdminTerceiro, unidadeHospitalarId, userProfile, userContratoIds } =
    useAuth();

  // Partners (administrador-terceiro) have read-only access
  const isReadOnly = isAdminTerceiro;
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingContrato, setEditingContrato] = useState<Contrato | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contratoToDelete, setContratoToDelete] = useState<Contrato | null>(
    null
  );
  const [deleteRelatedItems, setDeleteRelatedItems] = useState<any[]>([]);
  const [deleting, setDeleting] = useState(false);

  // Items state
  const [itensDisponiveis, setItensDisponiveis] = useState<ItemContrato[]>([]);
  const [itensSelecionados, setItensSelecionados] = useState<ItemSelecionado[]>(
    []
  );
  const [itemParaAdicionar, setItemParaAdicionar] =
    useState<ItemContrato | null>(null);

  // Documentos state
  const [documentos, setDocumentos] = useState<DocumentoContrato[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Parceiros state
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);

  // Unidades state
  const [unidades, setUnidades] = useState<UnidadeHospitalar[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    nome: "",
    numero_contrato: "",
    empresa: "",
    data_inicio: null as Date | null,
    data_fim: null as Date | null,
    ativo: true,
    unidade_hospitalar_id: null as string | null,
  });

  useEffect(() => {
    loadContratos();
    loadItens();
    loadParceiros();
    loadUnidades();
  }, [isAdminTerceiro, userContratoIds]);

  const loadContratos = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("contratos")
        .select("*")
        .order("created_at", { ascending: false });

      // Partners can only see their own contracts
      if (isAdminTerceiro && userContratoIds.length > 0) {
        query = query.in("id", userContratoIds);
      } else if (isAdminTerceiro && userContratoIds.length === 0) {
        // Partner has no contracts linked, show empty list
        setContratos([]);
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setContratos(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadItens = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from("itens_contrato")
        .select("*")
        .eq("ativo", true)
        .order("nome");

      if (fetchError) throw fetchError;
      setItensDisponiveis(data || []);
    } catch (err: any) {
      console.error("Erro ao carregar itens:", err);
    }
  };

  const loadParceiros = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from("parceiros")
        .select("*")
        .eq("ativo", true)
        .order("nome");

      if (fetchError) throw fetchError;
      setParceiros(data || []);
    } catch (err: any) {
      console.error("Erro ao carregar parceiros:", err);
    }
  };

  const loadUnidades = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from("unidades_hospitalares")
        .select("*")
        .eq("ativo", true)
        .order("codigo");

      if (fetchError) throw fetchError;
      setUnidades(data || []);
    } catch (err: any) {
      console.error("Erro ao carregar unidades:", err);
    }
  };

  const loadContratoItens = async (contratoId: string) => {
    try {
      const { data, error } = await supabase
        .from("contrato_itens")
        .select("*, item:itens_contrato(*)")
        .eq("contrato_id", contratoId);

      if (error) throw error;

      const itens: ItemSelecionado[] = (data || []).map((ci: any) => ({
        item: ci.item,
        quantidade: ci.quantidade,
        valor_unitario: ci.valor_unitario || 0,
        observacoes: ci.observacoes || "",
      }));

      setItensSelecionados(itens);
    } catch (err: any) {
      console.error("Erro ao carregar itens do contrato:", err);
    }
  };

  const loadDocumentos = async (contratoId: string) => {
    try {
      const { data, error } = await supabase
        .from("documentos_contrato")
        .select("*")
        .eq("contrato_id", contratoId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDocumentos((data as DocumentoContrato[]) || []);
    } catch (err: any) {
      console.error("Erro ao carregar documentos:", err);
    }
  };

  const handleUploadDocumento = async (
    event: React.ChangeEvent<HTMLInputElement>,
    contratoId: string
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      setError("Apenas arquivos PDF sao permitidos");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setError("Arquivo muito grande. Limite: 20MB");
      return;
    }

    try {
      setUploadingDoc(true);
      setError("");

      const nomeArquivoSeguro = file.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]/g, "_");
      const caminho = `${contratoId}/${Date.now()}_${nomeArquivoSeguro}`;

      // Upload para Storage
      const { error: uploadError } = await supabase.storage
        .from("documentos-contratos")
        .upload(caminho, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Erro upload storage:", uploadError);
        throw new Error(`Erro no upload: ${uploadError.message}`);
      }

      // Inserir registro na tabela
      const { data: doc, error: insertError } = await supabase
        .from("documentos_contrato")
        .insert({
          contrato_id: contratoId,
          nome_arquivo: file.name,
          caminho_storage: caminho,
          tamanho_bytes: file.size,
          mime_type: file.type,
          enviado_por: userProfile?.id,
          status: "pendente",
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Disparar processamento via Edge Function
      supabase.functions
        .invoke("processar-documento", {
          body: { documento_id: doc.id },
        })
        .catch((err) =>
          console.error("Erro ao disparar processamento:", err)
        );

      setSuccess("Documento enviado! Processamento iniciado.");
      await loadDocumentos(contratoId);
    } catch (err: any) {
      setError(err.message || "Erro ao enviar documento");
    } finally {
      setUploadingDoc(false);
      // Reset input
      event.target.value = "";
    }
  };

  const handleDownloadDocumento = async (doc: DocumentoContrato) => {
    try {
      const { data, error } = await supabase.storage
        .from("documentos-contratos")
        .download(doc.caminho_storage);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.nome_arquivo;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError("Erro ao baixar documento");
    }
  };

  const handleExcluirDocumento = async (doc: DocumentoContrato) => {
    if (!confirm(`Excluir documento "${doc.nome_arquivo}"?`)) return;

    try {
      await supabase.storage
        .from("documentos-contratos")
        .remove([doc.caminho_storage]);

      await supabase.from("documentos_contrato").delete().eq("id", doc.id);

      setSuccess("Documento excluido");
      if (editingContrato) {
        await loadDocumentos(editingContrato.id);
      }
    } catch (err: any) {
      setError("Erro ao excluir documento");
    }
  };

  const handleOpenDialog = async (contrato?: Contrato) => {
    if (contrato) {
      setEditingContrato(contrato);
      setFormData({
        nome: contrato.nome,
        numero_contrato: contrato.numero_contrato || "",
        empresa: contrato.empresa,
        data_inicio: parseISO(contrato.data_inicio),
        data_fim: contrato.data_fim ? parseISO(contrato.data_fim) : null,
        ativo: contrato.ativo,
        unidade_hospitalar_id: contrato.unidade_hospitalar_id,
      });
      await loadContratoItens(contrato.id);
      await loadDocumentos(contrato.id);
    } else {
      setDocumentos([]);
      setEditingContrato(null);
      setFormData({
        nome: "",
        numero_contrato: "",
        empresa: "",
        data_inicio: null,
        data_fim: null,
        ativo: true,
        unidade_hospitalar_id: isAdminAgirPlanta ? unidadeHospitalarId : null,
      });
      setItensSelecionados([]);
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingContrato(null);
    setItensSelecionados([]);
    setItemParaAdicionar(null);
    setError("");
  };

  const handleAdicionarItem = () => {
    if (!itemParaAdicionar) return;

    // Check if item already added
    if (itensSelecionados.some((is) => is.item.id === itemParaAdicionar.id)) {
      setError("Este item já foi adicionado ao contrato");
      return;
    }

    setItensSelecionados([
      ...itensSelecionados,
      {
        item: itemParaAdicionar,
        quantidade: 1,
        valor_unitario: 10,
        observacoes: "",
      },
    ]);
    setItemParaAdicionar(null);
  };

  const handleRemoverItem = (itemId: string) => {
    setItensSelecionados(
      itensSelecionados.filter((is) => is.item.id !== itemId)
    );
  };

  const handleUpdateItemQuantidade = (itemId: string, quantidade: number) => {
    setItensSelecionados(
      itensSelecionados.map((is) =>
        is.item.id === itemId ? { ...is, quantidade } : is
      )
    );
  };

  const handleUpdateItemValor = (itemId: string, valor_unitario: number) => {
    setItensSelecionados(
      itensSelecionados.map((is) =>
        is.item.id === itemId ? { ...is, valor_unitario } : is
      )
    );
  };

  const handleSave = async () => {
    try {
      setError("");
      setSuccess("");

      if (
        !formData.nome ||
        !formData.empresa ||
        !formData.data_inicio ||
        !formData.unidade_hospitalar_id
      ) {
        setError(
          "Preencha todos os campos obrigatórios (incluindo Unidade Hospitalar)"
        );
        return;
      }

      // Validar que todos os itens tenham valor unitário preenchido
      const itemSemValor = itensSelecionados.find(
        (is) => !is.valor_unitario || is.valor_unitario <= 0
      );
      if (itemSemValor) {
        setError(
          `O item "${itemSemValor.item.nome}" precisa ter um valor unitário maior que zero`
        );
        return;
      }

      const contratoData: any = {
        nome: formData.nome,
        numero_contrato: formData.numero_contrato || null,
        empresa: formData.empresa,
        data_inicio: formData.data_inicio.toISOString(),
        data_fim: formData.data_fim ? formData.data_fim.toISOString() : null,
        ativo: formData.ativo,
        unidade_hospitalar_id: formData.unidade_hospitalar_id,
      };

      let contratoId: string;

      if (editingContrato) {
        // Update contract
        const { error: updateError } = await supabase
          .from("contratos")
          .update(contratoData)
          .eq("id", editingContrato.id);

        if (updateError) throw updateError;
        contratoId = editingContrato.id;

        // Delete existing items and insert new ones
        await supabase
          .from("contrato_itens")
          .delete()
          .eq("contrato_id", contratoId);

        setSuccess("Contrato atualizado com sucesso!");
      } else {
        // Create new contract
        const { data: newContrato, error: insertError } = await supabase
          .from("contratos")
          .insert(contratoData)
          .select()
          .single();

        if (insertError) throw insertError;
        contratoId = newContrato.id;
        setSuccess("Contrato criado com sucesso!");
      }

      // Insert contract items
      if (itensSelecionados.length > 0) {
        const contratoItensData = itensSelecionados.map((is) => ({
          contrato_id: contratoId,
          item_id: is.item.id,
          quantidade: is.quantidade,
          valor_unitario: is.valor_unitario,
          observacoes: is.observacoes,
        }));

        const { error: itensError } = await supabase
          .from("contrato_itens")
          .insert(contratoItensData);

        if (itensError) throw itensError;
      }

      handleCloseDialog();
      loadContratos();
    } catch (err: any) {
      setError(err.message || "Erro ao salvar contrato");
    }
  };

  const handleOpenDeleteDialog = async (contrato: Contrato) => {
    setContratoToDelete(contrato);
    setDeleteRelatedItems([]);

    try {
      // Buscar informações sobre vínculos (escalas, usuários, etc.)
      const [{ data: escalas }, { data: usuarios }, { data: itens }] =
        await Promise.all([
          supabase
            .from("escalas_medicas")
            .select("id")
            .eq("contrato_id", contrato.id),
          supabase
            .from("usuario_contrato")
            .select("usuarios(nome)")
            .eq("contrato_id", contrato.id),
          supabase
            .from("contrato_itens")
            .select("itens_contrato(nome)")
            .eq("contrato_id", contrato.id),
        ]);

      const relatedItems = [];

      if (escalas && escalas.length > 0) {
        relatedItems.push({
          type: "Escala(s) médica(s)",
          count: escalas.length,
        });
      }

      if (usuarios && usuarios.length > 0) {
        relatedItems.push({
          type: "Usuário(s) vinculado(s)",
          count: usuarios.length,
          items: usuarios.map((u: any) => u.usuarios?.nome).filter(Boolean),
        });
      }

      if (itens && itens.length > 0) {
        relatedItems.push({
          type: "Item(ns) de contrato",
          count: itens.length,
          items: itens.map((i: any) => i.itens_contrato?.nome).filter(Boolean),
        });
      }

      setDeleteRelatedItems(relatedItems);
    } catch (err: any) {
      console.error("Erro ao verificar vínculos:", err);
      setError("Erro ao verificar vínculos do contrato");
      return;
    }

    setDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setContratoToDelete(null);
    setDeleteRelatedItems([]);
  };

  const handleConfirmDelete = async () => {
    if (!contratoToDelete) return;

    try {
      setDeleting(true);
      const { error: deleteError } = await supabase
        .from("contratos")
        .delete()
        .eq("id", contratoToDelete.id);

      if (deleteError) throw deleteError;

      setSuccess("Contrato excluído com sucesso!");
      handleCloseDeleteDialog();
      loadContratos();
    } catch (err: any) {
      setError(err.message);
      handleCloseDeleteDialog();
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleAtivo = async (contrato: Contrato) => {
    try {
      const updateData: any = { ativo: !contrato.ativo };
      const { error: updateError } = await supabase
        .from("contratos")
        .update(updateData)
        .eq("id", contrato.id);

      if (updateError) throw updateError;

      setSuccess(
        `Contrato ${!contrato.ativo ? "ativado" : "desativado"} com sucesso!`
      );
      loadContratos();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const columns: GridColDef[] = [
    {
      field: "nome",
      headerName: "Objeto do Contrato",
      flex: 1,
      minWidth: 250,
      renderCell: (params) => (
        <Box>
          <Typography variant="body2" fontWeight={600}>
            {params.value}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {params.row.empresa}
          </Typography>
        </Box>
      ),
    },
    {
      field: "numero_contrato",
      headerName: "Número",
      width: 150,
      renderCell: (params) => params.value || "-",
    },
    {
      field: "data_inicio",
      headerName: "Início",
      width: 120,
      renderCell: (params) => format(parseISO(params.value), "dd/MM/yyyy"),
    },
    {
      field: "data_fim",
      headerName: "Fim",
      width: 120,
      renderCell: (params) =>
        params.value
          ? format(parseISO(params.value), "dd/MM/yyyy")
          : "Indeterminado",
    },
    {
      field: "ativo",
      headerName: "Status",
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value ? "Ativo" : "Inativo"}
          color={params.value ? "success" : "default"}
          size="small"
          onClick={isReadOnly ? undefined : () => handleToggleAtivo(params.row)}
          sx={{ cursor: isReadOnly ? "default" : "pointer" }}
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
        <Box>
          {isReadOnly ? (
            <IconButton
              size="small"
              color="primary"
              onClick={() => handleOpenDialog(params.row)}
              title="Visualizar"
            >
              <Visibility fontSize="small" />
            </IconButton>
          ) : (
            <>
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
            </>
          )}
        </Box>
      ),
    },
  ];

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ptBR}>
      <Box>
        <Box
          sx={{
            mb: 4,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Box>
            <Typography variant="h4" fontWeight={700} gutterBottom>
              {isReadOnly ? "Meus Contratos" : "Gestão de Contratos"}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {isReadOnly
                ? "Visualize os detalhes dos contratos vinculados à sua empresa"
                : "Cadastre e gerencie os contratos com empresas terceiras"}
            </Typography>
          </Box>
          {!isReadOnly && (
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
              Novo Contrato
            </Button>
          )}
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError("")}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert
            severity="success"
            sx={{ mb: 3 }}
            onClose={() => setSuccess("")}
          >
            {success}
          </Alert>
        )}

        <Card>
          <CardContent>
            <Box sx={{ height: 600, width: "100%" }}>
              <DataGrid
                rows={contratos}
                columns={columns}
                loading={loading}
                pageSizeOptions={[10, 25, 50]}
                initialState={{
                  pagination: { paginationModel: { pageSize: 25 } },
                }}
                slots={{ toolbar: GridToolbar }}
                slotProps={{
                  toolbar: {
                    showQuickFilter: true,
                  },
                }}
                disableRowSelectionOnClick
              />
            </Box>
          </CardContent>
        </Card>

        {/* Dialog de Cadastro/Edição */}
        <Dialog
          open={openDialog}
          onClose={handleCloseDialog}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Description color="primary" />
              {isReadOnly ? "Visualizar Contrato" : (editingContrato ? "Editar Contrato" : "Novo Contrato")}
            </Box>
          </DialogTitle>
          <DialogContent>
            <Box
              sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}
            >
              <TextField
                label="Objeto do Contrato"
                value={formData.nome}
                onChange={(e) =>
                  setFormData({ ...formData, nome: e.target.value })
                }
                fullWidth
                required
                disabled={isReadOnly}
                helperText={isReadOnly ? "" : "Ex: Contrato de Manutenção 2024"}
              />

              <TextField
                label="Número do Contrato"
                value={formData.numero_contrato}
                onChange={(e) =>
                  setFormData({ ...formData, numero_contrato: e.target.value })
                }
                fullWidth
                disabled={isReadOnly}
                helperText={isReadOnly ? "" : "Ex: 001/2024, CT-2024-001, etc."}
              />

              <Autocomplete
                value={
                  parceiros.find((p) => p.nome === formData.empresa) || null
                }
                onChange={(_, newValue) =>
                  setFormData({ ...formData, empresa: newValue?.nome || "" })
                }
                options={parceiros}
                getOptionLabel={(option) => option.nome}
                disabled={isReadOnly}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Empresa Contratada"
                    required
                    helperText={isReadOnly ? "" : "Selecione a empresa parceira"}
                  />
                )}
                fullWidth
              />

              <Autocomplete
                value={
                  unidades.find(
                    (u) => u.id === formData.unidade_hospitalar_id
                  ) || null
                }
                onChange={(_, newValue) =>
                  setFormData({
                    ...formData,
                    unidade_hospitalar_id: newValue?.id || null,
                  })
                }
                options={unidades}
                getOptionLabel={(option) => `${option.codigo} - ${option.nome}`}
                disabled={isAdminAgirPlanta || isReadOnly}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Unidade Hospitalar"
                    required
                    helperText={
                      isReadOnly
                        ? ""
                        : isAdminAgirPlanta
                        ? "Automaticamente vinculado à sua unidade"
                        : "Selecione a unidade hospitalar"
                    }
                  />
                )}
                fullWidth
              />

              <DatePicker
                label="Data de Início"
                value={formData.data_inicio}
                onChange={(newValue) =>
                  setFormData({ ...formData, data_inicio: newValue })
                }
                disabled={isReadOnly}
                slotProps={{ textField: { fullWidth: true, required: true } }}
              />

              <DatePicker
                label="Data de Fim (Opcional)"
                value={formData.data_fim}
                onChange={(newValue) =>
                  setFormData({ ...formData, data_fim: newValue })
                }
                disabled={isReadOnly}
                slotProps={{ textField: { fullWidth: true } }}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={formData.ativo}
                    onChange={(e) =>
                      setFormData({ ...formData, ativo: e.target.checked })
                    }
                    color="primary"
                    disabled={isReadOnly}
                  />
                }
                label="Contrato Ativo"
              />

              <Divider sx={{ my: 2 }} />

              {/* Seção de Itens do Contrato */}
              <Box>
                <Typography
                  variant="h6"
                  fontWeight={600}
                  gutterBottom
                  sx={{ display: "flex", alignItems: "center", gap: 1 }}
                >
                  <Inventory color="primary" />
                  Itens do Contrato
                </Typography>

                {!isReadOnly && (
                  <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
                    <Autocomplete
                      value={itemParaAdicionar}
                      onChange={(_, newValue) => setItemParaAdicionar(newValue)}
                      options={itensDisponiveis}
                      getOptionLabel={(option) =>
                        `${option.nome} (${option.unidade_medida})`
                      }
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Selecione um item"
                          size="small"
                        />
                      )}
                      sx={{ flex: 1 }}
                      size="small"
                    />
                    <Button
                      variant="contained"
                      onClick={handleAdicionarItem}
                      disabled={!itemParaAdicionar}
                      size="small"
                    >
                      Adicionar
                    </Button>
                  </Box>
                )}

                {itensSelecionados.length > 0 && (
                  <TableContainer
                    component={Paper}
                    variant="outlined"
                    sx={{ maxHeight: 400 }}
                  >
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: "action.hover" }}>
                          <TableCell>
                            <Typography variant="subtitle2" fontWeight={700}>
                              Item
                            </Typography>
                          </TableCell>
                          <TableCell width={250}>
                            <Typography variant="subtitle2" fontWeight={700}>
                              Quantidade
                            </Typography>
                          </TableCell>
                          <TableCell width={200}>
                            <Typography variant="subtitle2" fontWeight={700}>
                              Valor Unitário (R$)
                            </Typography>
                          </TableCell>
                          <TableCell width={150}>
                            <Typography variant="subtitle2" fontWeight={700}>
                              Valor Total (R$)
                            </Typography>
                          </TableCell>
                          {!isReadOnly && (
                            <TableCell width={60} align="center">
                              <Typography variant="subtitle2" fontWeight={700}>
                                Ações
                              </Typography>
                            </TableCell>
                          )}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {itensSelecionados.map((is) => {
                          const valorTotal = is.quantidade * is.valor_unitario;
                          return (
                            <TableRow
                              key={is.item.id}
                              sx={{
                                "&:hover": { bgcolor: "action.hover" },
                              }}
                            >
                              <TableCell>
                                <Typography variant="body2" fontWeight={600}>
                                  {is.item.nome}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {is.item.unidade_medida}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                {isReadOnly ? (
                                  <Typography variant="body2">
                                    {is.quantidade.toLocaleString("pt-BR", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </Typography>
                                ) : (
                                  <TextField
                                    type="number"
                                    value={is.quantidade}
                                    onChange={(e) =>
                                      handleUpdateItemQuantidade(
                                        is.item.id,
                                        parseFloat(e.target.value) || 0
                                      )
                                    }
                                    size="small"
                                    inputProps={{ min: 0, step: 0.01 }}
                                    fullWidth
                                    sx={{
                                      "& .MuiOutlinedInput-root": {
                                        bgcolor: "background.paper",
                                      },
                                    }}
                                  />
                                )}
                              </TableCell>
                              <TableCell>
                                {isReadOnly ? (
                                  <Typography variant="body2">
                                    {is.valor_unitario.toLocaleString("pt-BR", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </Typography>
                                ) : (
                                  <TextField
                                    type="number"
                                    value={is.valor_unitario}
                                    onChange={(e) =>
                                      handleUpdateItemValor(
                                        is.item.id,
                                        parseFloat(e.target.value) || 0
                                      )
                                    }
                                    size="small"
                                    inputProps={{
                                      min: 0,
                                      step: 0.01,
                                    }}
                                    required
                                    fullWidth
                                    sx={{
                                      "& .MuiOutlinedInput-root": {
                                        bgcolor: "background.paper",
                                      },
                                    }}
                                    placeholder="0,00"
                                  />
                                )}
                              </TableCell>
                              <TableCell>
                                <Box
                                  sx={{
                                    p: 1,
                                    borderRadius: 1,
                                    bgcolor: "success.50",
                                    border: "1px solid",
                                    borderColor: "success.200",
                                    textAlign: "right",
                                  }}
                                >
                                  <Typography
                                    variant="body2"
                                    fontWeight={700}
                                    color="success.dark"
                                  >
                                    {valorTotal.toLocaleString("pt-BR", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </Typography>
                                </Box>
                              </TableCell>
                              {!isReadOnly && (
                                <TableCell align="center">
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => handleRemoverItem(is.item.id)}
                                    sx={{
                                      "&:hover": {
                                        bgcolor: "error.50",
                                      },
                                    }}
                                  >
                                    <Remove fontSize="small" />
                                  </IconButton>
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                      <TableFooter>
                        <TableRow
                          sx={{
                            bgcolor: "primary.50",
                            borderTop: "2px solid",
                            borderColor: "primary.main",
                          }}
                        >
                          <TableCell colSpan={isReadOnly ? 3 : 3}>
                            <Typography
                              variant="subtitle1"
                              fontWeight={700}
                              color="primary"
                              align="center"
                            >
                              VALOR TOTAL DO CONTRATO:
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Box
                              sx={{
                                p: 1.5,
                                borderRadius: 1,
                                bgcolor: "primary.main",
                                textAlign: "center",
                              }}
                            >
                              <Typography
                                variant="h6"
                                fontWeight={700}
                                color="white"
                              >
                                R${" "}
                                {itensSelecionados
                                  .reduce(
                                    (total, is) =>
                                      total + is.quantidade * is.valor_unitario,
                                    0
                                  )
                                  .toLocaleString("pt-BR", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                              </Typography>
                            </Box>
                          </TableCell>
                          {!isReadOnly && <TableCell />}
                        </TableRow>
                      </TableFooter>
                    </Table>
                  </TableContainer>
                )}

                {itensSelecionados.length === 0 && (
                  <Alert severity="info">
                    Nenhum item adicionado ao contrato
                  </Alert>
                )}
              </Box>

              {/* Secao de Documentos do Contrato (apenas na edicao) */}
              {editingContrato && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Box>
                    <Typography
                      variant="h6"
                      fontWeight={600}
                      gutterBottom
                      sx={{ display: "flex", alignItems: "center", gap: 1 }}
                    >
                      <PictureAsPdf color="error" />
                      Documentos do Contrato
                    </Typography>

                    {!isReadOnly && (
                      <Box sx={{ display: "flex", gap: 1, mb: 2, alignItems: "center" }}>
                        <Button
                          variant="outlined"
                          component="label"
                          startIcon={
                            uploadingDoc ? (
                              <CircularProgress size={18} />
                            ) : (
                              <CloudUpload />
                            )
                          }
                          disabled={uploadingDoc}
                          size="small"
                        >
                          {uploadingDoc ? "Enviando..." : "Enviar PDF"}
                          <input
                            type="file"
                            hidden
                            accept="application/pdf"
                            onChange={(e) =>
                              handleUploadDocumento(e, editingContrato.id)
                            }
                          />
                        </Button>
                        <Typography variant="caption" color="text.secondary">
                          Limite: 20MB, apenas PDF
                        </Typography>
                      </Box>
                    )}

                    {documentos.length > 0 ? (
                      <TableContainer
                        component={Paper}
                        variant="outlined"
                        sx={{ maxHeight: 250 }}
                      >
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ bgcolor: "action.hover" }}>
                              <TableCell>
                                <Typography variant="subtitle2" fontWeight={700}>
                                  Documento
                                </Typography>
                              </TableCell>
                              <TableCell width={120}>
                                <Typography variant="subtitle2" fontWeight={700}>
                                  Status
                                </Typography>
                              </TableCell>
                              <TableCell width={120}>
                                <Typography variant="subtitle2" fontWeight={700}>
                                  Data
                                </Typography>
                              </TableCell>
                              <TableCell width={100} align="center">
                                <Typography variant="subtitle2" fontWeight={700}>
                                  Acoes
                                </Typography>
                              </TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {documentos.map((doc) => (
                              <TableRow key={doc.id}>
                                <TableCell>
                                  <Box display="flex" alignItems="center" gap={1}>
                                    <PictureAsPdf
                                      fontSize="small"
                                      color="error"
                                    />
                                    <Box>
                                      <Typography variant="body2" fontWeight={600}>
                                        {doc.nome_arquivo}
                                      </Typography>
                                      {doc.tamanho_bytes && (
                                        <Typography
                                          variant="caption"
                                          color="text.secondary"
                                        >
                                          {(
                                            doc.tamanho_bytes /
                                            1024 /
                                            1024
                                          ).toFixed(1)}{" "}
                                          MB
                                        </Typography>
                                      )}
                                    </Box>
                                  </Box>
                                </TableCell>
                                <TableCell>
                                  <Chip
                                    label={
                                      doc.status === "pronto"
                                        ? "Processado"
                                        : doc.status === "processando"
                                        ? "Processando"
                                        : doc.status === "erro"
                                        ? "Erro"
                                        : "Pendente"
                                    }
                                    size="small"
                                    color={
                                      doc.status === "pronto"
                                        ? "success"
                                        : doc.status === "processando"
                                        ? "warning"
                                        : doc.status === "erro"
                                        ? "error"
                                        : "default"
                                    }
                                  />
                                </TableCell>
                                <TableCell>
                                  <Typography variant="caption">
                                    {format(
                                      parseISO(doc.created_at),
                                      "dd/MM/yyyy"
                                    )}
                                  </Typography>
                                </TableCell>
                                <TableCell align="center">
                                  <IconButton
                                    size="small"
                                    onClick={() =>
                                      handleDownloadDocumento(doc)
                                    }
                                    title="Baixar"
                                  >
                                    <Download fontSize="small" />
                                  </IconButton>
                                  {!isReadOnly && (
                                    <IconButton
                                      size="small"
                                      color="error"
                                      onClick={() =>
                                        handleExcluirDocumento(doc)
                                      }
                                      title="Excluir"
                                    >
                                      <Delete fontSize="small" />
                                    </IconButton>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    ) : (
                      <Alert severity="info">
                        Nenhum documento enviado para este contrato
                      </Alert>
                    )}

                    {documentos.some((d) => d.status === "erro") && (
                      <Alert severity="warning" sx={{ mt: 1 }}>
                        Alguns documentos tiveram erro no processamento. Tente
                        excluir e enviar novamente.
                      </Alert>
                    )}
                  </Box>
                </>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>{isReadOnly ? "Fechar" : "Cancelar"}</Button>
            {!isReadOnly && (
              <Button onClick={handleSave} variant="contained">
                Salvar
              </Button>
            )}
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <DeleteConfirmDialog
          open={deleteDialogOpen}
          onClose={handleCloseDeleteDialog}
          onConfirm={handleConfirmDelete}
          title="Excluir Contrato"
          itemName={contratoToDelete?.nome || ""}
          severity="critical"
          isBlocked={false}
          relatedItems={deleteRelatedItems}
          warningMessage="A exclusão de um contrato é uma ação MUITO SÉRIA. Todos os vínculos, escalas médicas e dados relacionados serão permanentemente excluídos."
          loading={deleting}
        />
      </Box>
    </LocalizationProvider>
  );
};

export default Contratos;
