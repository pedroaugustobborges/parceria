import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  useTheme,
  Tooltip,
} from "@mui/material";
import {
  Add,
  Edit,
  Check,
  Close,
  BusinessCenter,
  Delete,
  ExpandMore,
  ExpandLess,
  CloudUpload,
  Download,
  PictureAsPdf,
  Description,
} from "@mui/icons-material";
import { format, parseISO } from "date-fns";
import { supabase } from "../lib/supabase";
import { UnidadeHospitalar, DocumentoGestao } from "../types/database.types";
import { useAuth } from "../contexts/AuthContext";
import DeleteConfirmDialog from "../components/DeleteConfirmDialog";

const UnidadesHospitalares: React.FC = () => {
  const { isAdminAgirCorporativo, userProfile } = useAuth();
  const theme = useTheme();
  const [unidades, setUnidades] = useState<UnidadeHospitalar[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUnidade, setEditingUnidade] =
    useState<UnidadeHospitalar | null>(null);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [unidadeToDelete, setUnidadeToDelete] = useState<UnidadeHospitalar | null>(null);
  const [deleteBlocked, setDeleteBlocked] = useState(false);
  const [deleteBlockReason, setDeleteBlockReason] = useState("");
  const [deleteRelatedItems, setDeleteRelatedItems] = useState<any[]>([]);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    codigo: "",
    nome: "",
    endereco: "",
    ativo: true,
  });

  // Contrato de Gestao state
  const [documentosGestao, setDocumentosGestao] = useState<Record<string, DocumentoGestao[]>>({});
  const [expandedUnidade, setExpandedUnidade] = useState<string | null>(null);
  const [uploadingUnidade, setUploadingUnidade] = useState<string | null>(null);
  const [loadingDocs, setLoadingDocs] = useState<string | null>(null);

  useEffect(() => {
    carregarUnidades();
  }, []);

  const carregarUnidades = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("unidades_hospitalares")
        .select("*")
        .order("codigo", { ascending: true });

      if (error) throw error;
      setUnidades(data || []);
    } catch (error) {
      console.error("Erro ao carregar unidades:", error);
      setErro("Erro ao carregar unidades hospitalares");
    } finally {
      setLoading(false);
    }
  };

  const loadDocumentosGestao = async (unidadeId: string) => {
    try {
      setLoadingDocs(unidadeId);
      const { data, error } = await supabase
        .from("documentos_gestao")
        .select("*")
        .eq("unidade_hospitalar_id", unidadeId)
        .order("versao", { ascending: false });

      if (error) throw error;
      setDocumentosGestao((prev) => ({ ...prev, [unidadeId]: data || [] }));
    } catch (error) {
      console.error("Erro ao carregar documentos de gestao:", error);
    } finally {
      setLoadingDocs(null);
    }
  };

  const handleToggleExpand = async (unidadeId: string) => {
    if (expandedUnidade === unidadeId) {
      setExpandedUnidade(null);
    } else {
      setExpandedUnidade(unidadeId);
      if (!documentosGestao[unidadeId]) {
        await loadDocumentosGestao(unidadeId);
      }
    }
  };

  const handleUploadGestao = async (
    event: React.ChangeEvent<HTMLInputElement>,
    unidadeId: string
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validacoes
    if (file.type !== "application/pdf") {
      setErro("Apenas arquivos PDF sao permitidos");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setErro("Arquivo muito grande. Limite: 20MB");
      return;
    }

    try {
      setUploadingUnidade(unidadeId);
      setErro("");

      // Obter proxima versao
      const existingDocs = documentosGestao[unidadeId] || [];
      const maxVersion = existingDocs.reduce((max, d) => Math.max(max, d.versao), 0);
      const novaVersao = maxVersion + 1;

      // Sanitizar nome do arquivo
      const nomeArquivoSeguro = file.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]/g, "_");
      const caminho = `${unidadeId}/${Date.now()}_v${novaVersao}_${nomeArquivoSeguro}`;

      // Upload para storage
      const { error: uploadError } = await supabase.storage
        .from("documentos-gestao")
        .upload(caminho, file, { cacheControl: "3600", upsert: false });

      if (uploadError) throw uploadError;

      // Marcar versoes anteriores como inativas
      if (existingDocs.length > 0) {
        await supabase
          .from("documentos_gestao")
          .update({ ativo: false })
          .eq("unidade_hospitalar_id", unidadeId);
      }

      // Inserir registro do documento
      const { data: doc, error: insertError } = await supabase
        .from("documentos_gestao")
        .insert({
          unidade_hospitalar_id: unidadeId,
          nome_arquivo: file.name,
          caminho_storage: caminho,
          tamanho_bytes: file.size,
          mime_type: file.type,
          enviado_por: userProfile?.id,
          status: "pendente",
          versao: novaVersao,
          ativo: true,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Disparar processamento async
      supabase.functions
        .invoke("processar-documento", {
          body: {
            documento_id: doc.id,
            tabela: "documentos_gestao",
          },
        })
        .catch((err) => console.error("Erro ao disparar processamento:", err));

      setSucesso("Contrato de Gestao enviado! Processamento iniciado.");
      setTimeout(() => setSucesso(""), 5000);
      await loadDocumentosGestao(unidadeId);
    } catch (err: any) {
      console.error("Erro ao enviar documento:", err);
      setErro(err.message || "Erro ao enviar documento");
    } finally {
      setUploadingUnidade(null);
      event.target.value = "";
    }
  };

  const handleDownloadGestao = async (doc: DocumentoGestao) => {
    try {
      const { data, error } = await supabase.storage
        .from("documentos-gestao")
        .download(doc.caminho_storage);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.nome_arquivo;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Erro ao baixar documento:", err);
      setErro("Erro ao baixar documento");
    }
  };

  const handleDeleteGestao = async (doc: DocumentoGestao) => {
    if (!confirm(`Excluir documento "${doc.nome_arquivo}"?`)) return;

    try {
      // Deletar do storage
      await supabase.storage
        .from("documentos-gestao")
        .remove([doc.caminho_storage]);

      // Deletar registro
      await supabase.from("documentos_gestao").delete().eq("id", doc.id);

      setSucesso("Documento excluido com sucesso");
      setTimeout(() => setSucesso(""), 3000);
      await loadDocumentosGestao(doc.unidade_hospitalar_id);
    } catch (err: any) {
      console.error("Erro ao excluir documento:", err);
      setErro("Erro ao excluir documento");
    }
  };

  const handleOpenDialog = (unidade?: UnidadeHospitalar) => {
    if (unidade) {
      setEditingUnidade(unidade);
      setFormData({
        codigo: unidade.codigo,
        nome: unidade.nome,
        endereco: unidade.endereco || "",
        ativo: unidade.ativo,
      });
    } else {
      setEditingUnidade(null);
      setFormData({
        codigo: "",
        nome: "",
        endereco: "",
        ativo: true,
      });
    }
    setDialogOpen(true);
    setErro("");
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingUnidade(null);
    setFormData({
      codigo: "",
      nome: "",
      endereco: "",
      ativo: true,
    });
  };

  const handleSave = async () => {
    try {
      setErro("");

      if (!formData.codigo || !formData.nome) {
        setErro("Codigo e Nome sao obrigatorios");
        return;
      }

      if (editingUnidade) {
        // Update
        const { error } = await supabase
          .from("unidades_hospitalares")
          .update({
            nome: formData.nome,
            endereco: formData.endereco || null,
            ativo: formData.ativo,
          })
          .eq("id", editingUnidade.id);

        if (error) throw error;
        setSucesso("Unidade atualizada com sucesso!");
      } else {
        // Insert
        const { error } = await supabase.from("unidades_hospitalares").insert({
          codigo: formData.codigo,
          nome: formData.nome,
          endereco: formData.endereco || null,
          ativo: formData.ativo,
        });

        if (error) throw error;
        setSucesso("Unidade criada com sucesso!");
      }

      handleCloseDialog();
      carregarUnidades();

      // Clear success message after 3 seconds
      setTimeout(() => setSucesso(""), 3000);
    } catch (error: any) {
      console.error("Erro ao salvar unidade:", error);
      setErro(error.message || "Erro ao salvar unidade");
    }
  };

  const handleToggleAtivo = async (unidade: UnidadeHospitalar) => {
    try {
      const { error } = await supabase
        .from("unidades_hospitalares")
        .update({ ativo: !unidade.ativo })
        .eq("id", unidade.id);

      if (error) throw error;

      setSucesso(
        `Unidade ${!unidade.ativo ? "ativada" : "desativada"} com sucesso!`
      );
      carregarUnidades();
      setTimeout(() => setSucesso(""), 3000);
    } catch (error: any) {
      console.error("Erro ao alterar status:", error);
      setErro(error.message || "Erro ao alterar status da unidade");
    }
  };

  const handleOpenDeleteDialog = async (unidade: UnidadeHospitalar) => {
    setUnidadeToDelete(unidade);
    setDeleteBlocked(false);
    setDeleteBlockReason("");
    setDeleteRelatedItems([]);

    try {
      // Verificar vinculos com contratos
      const { data: contratos, error: contratosError } = await supabase
        .from("contratos")
        .select("nome")
        .eq("unidade_hospitalar_id", unidade.id);

      if (contratosError) throw contratosError;

      // Verificar vinculos com usuarios
      const { data: usuarios, error: usuariosError } = await supabase
        .from("usuarios")
        .select("nome")
        .eq("unidade_hospitalar_id", unidade.id);

      if (usuariosError) throw usuariosError;

      const relatedItems = [];

      if (contratos && contratos.length > 0) {
        relatedItems.push({
          type: "Contrato(s) vinculado(s)",
          count: contratos.length,
          items: contratos.map((c: any) => c.nome),
        });
      }

      if (usuarios && usuarios.length > 0) {
        relatedItems.push({
          type: "Usuario(s) vinculado(s)",
          count: usuarios.length,
          items: usuarios.map((u: any) => u.nome),
        });
      }

      if (relatedItems.length > 0) {
        setDeleteBlocked(true);
        setDeleteBlockReason(
          "Esta unidade hospitalar nao pode ser excluida pois possui itens vinculados. Remova os vinculos antes de excluir."
        );
        setDeleteRelatedItems(relatedItems);
      }
    } catch (err: any) {
      console.error("Erro ao verificar vinculos:", err);
      setErro("Erro ao verificar vinculos da unidade");
      return;
    }

    setDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setUnidadeToDelete(null);
    setDeleteBlocked(false);
    setDeleteBlockReason("");
    setDeleteRelatedItems([]);
  };

  const handleConfirmDelete = async () => {
    if (!unidadeToDelete || deleteBlocked) return;

    try {
      setDeleting(true);
      const { error: deleteError } = await supabase
        .from("unidades_hospitalares")
        .delete()
        .eq("id", unidadeToDelete.id);

      if (deleteError) throw deleteError;

      setSucesso("Unidade excluida com sucesso!");
      handleCloseDeleteDialog();
      carregarUnidades();
      setTimeout(() => setSucesso(""), 3000);
    } catch (error: any) {
      console.error("Erro ao excluir unidade:", error);
      setErro(error.message || "Erro ao excluir unidade");
      handleCloseDeleteDialog();
    } finally {
      setDeleting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pronto":
        return "success";
      case "processando":
        return "warning";
      case "erro":
        return "error";
      default:
        return "default";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pronto":
        return "Processado";
      case "processando":
        return "Processando";
      case "erro":
        return "Erro";
      default:
        return "Pendente";
    }
  };

  if (!isAdminAgirCorporativo) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">
          Acesso negado. Apenas administradores corporativos podem gerenciar
          unidades hospitalares.
        </Alert>
      </Container>
    );
  }

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="60vh"
        >
          <CircularProgress size={60} />
        </Box>
      </Container>
    );
  }

  return (
    <Box>
      {/* Header */}
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
            Unidades Hospitalares
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Gerencie as unidades hospitalares do sistema
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
          Nova Unidade
        </Button>
      </Box>

      {/* Messages */}
      {erro && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setErro("")}>
          {erro}
        </Alert>
      )}
      {sucesso && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSucesso("")}>
          {sucesso}
        </Alert>
      )}

      {/* Table */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          <TableContainer component={Paper} elevation={0}>
            <Table>
              <TableHead>
                <TableRow
                  sx={{
                    bgcolor: theme.palette.mode === 'dark'
                      ? 'rgba(255, 255, 255, 0.05)'
                      : 'grey.50'
                  }}
                >
                  <TableCell sx={{ fontWeight: 600, width: 50 }}></TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Codigo</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Nome</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Endereco</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">
                    Acoes
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {unidades.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        Nenhuma unidade cadastrada
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  unidades.map((unidade) => (
                    <React.Fragment key={unidade.id}>
                      <TableRow
                        sx={{
                          "&:hover": { bgcolor: "action.hover" },
                        }}
                      >
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={() => handleToggleExpand(unidade.id)}
                          >
                            {expandedUnidade === unidade.id ? (
                              <ExpandLess />
                            ) : (
                              <ExpandMore />
                            )}
                          </IconButton>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={unidade.codigo}
                            size="small"
                            color="primary"
                            variant="outlined"
                            sx={{ fontWeight: 600 }}
                          />
                        </TableCell>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={1}>
                            <BusinessCenter
                              sx={{ fontSize: 20, color: "primary.main" }}
                            />
                            <Typography variant="body2" fontWeight={600}>
                              {unidade.nome}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {unidade.endereco || "-"}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={unidade.ativo ? "Ativo" : "Inativo"}
                            size="small"
                            color={unidade.ativo ? "success" : "default"}
                            icon={unidade.ativo ? <Check /> : <Close />}
                            sx={{ fontWeight: 600 }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenDialog(unidade)}
                            sx={{ mr: 1 }}
                          >
                            <Edit fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleOpenDeleteDialog(unidade)}
                            sx={{ mr: 1 }}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                          <Button
                            size="small"
                            variant="outlined"
                            color={unidade.ativo ? "error" : "success"}
                            onClick={() => handleToggleAtivo(unidade)}
                          >
                            {unidade.ativo ? "Desativar" : "Ativar"}
                          </Button>
                        </TableCell>
                      </TableRow>
                      {/* Expandable row for Contrato de Gestao */}
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          sx={{ py: 0, borderBottom: expandedUnidade === unidade.id ? undefined : 'none' }}
                        >
                          <Collapse
                            in={expandedUnidade === unidade.id}
                            timeout="auto"
                            unmountOnExit
                          >
                            <Box
                              sx={{
                                py: 2,
                                px: 2,
                                bgcolor: theme.palette.mode === 'dark'
                                  ? 'rgba(255, 255, 255, 0.02)'
                                  : 'grey.50',
                                borderRadius: 1,
                                my: 1,
                              }}
                            >
                              <Box
                                display="flex"
                                justifyContent="space-between"
                                alignItems="center"
                                mb={2}
                              >
                                <Box display="flex" alignItems="center" gap={1}>
                                  <Description color="primary" />
                                  <Typography variant="subtitle1" fontWeight={600}>
                                    Contrato de Gestao
                                  </Typography>
                                </Box>
                                <Button
                                  variant="outlined"
                                  component="label"
                                  startIcon={
                                    uploadingUnidade === unidade.id ? (
                                      <CircularProgress size={18} />
                                    ) : (
                                      <CloudUpload />
                                    )
                                  }
                                  disabled={uploadingUnidade === unidade.id}
                                  size="small"
                                >
                                  {uploadingUnidade === unidade.id
                                    ? "Enviando..."
                                    : "Enviar PDF"}
                                  <input
                                    type="file"
                                    hidden
                                    accept="application/pdf"
                                    onChange={(e) =>
                                      handleUploadGestao(e, unidade.id)
                                    }
                                  />
                                </Button>
                              </Box>

                              {loadingDocs === unidade.id ? (
                                <Box display="flex" justifyContent="center" py={2}>
                                  <CircularProgress size={24} />
                                </Box>
                              ) : documentosGestao[unidade.id]?.length > 0 ? (
                                <TableContainer
                                  component={Paper}
                                  variant="outlined"
                                  sx={{ maxHeight: 300 }}
                                >
                                  <Table size="small">
                                    <TableHead>
                                      <TableRow sx={{ bgcolor: "action.hover" }}>
                                        <TableCell>Documento</TableCell>
                                        <TableCell width={80}>Versao</TableCell>
                                        <TableCell width={100}>Status</TableCell>
                                        <TableCell width={100}>Data</TableCell>
                                        <TableCell width={100} align="center">
                                          Acoes
                                        </TableCell>
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      {documentosGestao[unidade.id].map((doc) => (
                                        <TableRow key={doc.id}>
                                          <TableCell>
                                            <Box
                                              display="flex"
                                              alignItems="center"
                                              gap={1}
                                            >
                                              <PictureAsPdf
                                                fontSize="small"
                                                color="error"
                                              />
                                              <Box>
                                                <Typography
                                                  variant="body2"
                                                  fontWeight={doc.ativo ? 600 : 400}
                                                  sx={{
                                                    color: doc.ativo
                                                      ? "text.primary"
                                                      : "text.secondary",
                                                  }}
                                                >
                                                  {doc.nome_arquivo}
                                                  {doc.ativo && (
                                                    <Chip
                                                      label="Atual"
                                                      size="small"
                                                      color="primary"
                                                      sx={{ ml: 1, height: 18, fontSize: '0.65rem' }}
                                                    />
                                                  )}
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
                                              label={`v${doc.versao}`}
                                              size="small"
                                              variant="outlined"
                                            />
                                          </TableCell>
                                          <TableCell>
                                            <Chip
                                              label={getStatusLabel(doc.status)}
                                              size="small"
                                              color={getStatusColor(doc.status) as any}
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
                                            <Tooltip title="Baixar">
                                              <IconButton
                                                size="small"
                                                onClick={() =>
                                                  handleDownloadGestao(doc)
                                                }
                                              >
                                                <Download fontSize="small" />
                                              </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Excluir">
                                              <IconButton
                                                size="small"
                                                color="error"
                                                onClick={() =>
                                                  handleDeleteGestao(doc)
                                                }
                                              >
                                                <Delete fontSize="small" />
                                              </IconButton>
                                            </Tooltip>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </TableContainer>
                              ) : (
                                <Alert severity="info" sx={{ mt: 1 }}>
                                  Nenhum Contrato de Gestao enviado para esta
                                  unidade.
                                </Alert>
                              )}
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
          },
        }}
      >
        <DialogTitle>
          <Typography variant="h6" fontWeight={700}>
            {editingUnidade ? "Editar Unidade" : "Nova Unidade"}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 3 }}>
            <TextField
              label="Sigla/abreviacao"
              value={formData.codigo}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  codigo: e.target.value.toUpperCase(),
                })
              }
              disabled={!!editingUnidade}
              required
              fullWidth
              helperText="Sigla/abreviacao unica da unidade (ex: HUGOL, HECAD, CRER)"
            />
            <TextField
              label="Nome"
              value={formData.nome}
              onChange={(e) =>
                setFormData({ ...formData, nome: e.target.value })
              }
              required
              fullWidth
              helperText="Nome completo da unidade hospitalar"
            />
            <TextField
              label="Endereco"
              value={formData.endereco}
              onChange={(e) =>
                setFormData({ ...formData, endereco: e.target.value })
              }
              fullWidth
              multiline
              rows={3}
              helperText="Endereco completo (opcional)"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={handleCloseDialog} variant="outlined">
            Cancelar
          </Button>
          <Button onClick={handleSave} variant="contained">
            {editingUnidade ? "Salvar" : "Criar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
        onConfirm={handleConfirmDelete}
        title="Excluir Unidade Hospitalar"
        itemName={unidadeToDelete?.nome || ""}
        severity="warning"
        isBlocked={deleteBlocked}
        blockReason={deleteBlockReason}
        relatedItems={deleteRelatedItems}
        warningMessage={
          !deleteBlocked
            ? "Esta acao nao podera ser desfeita. Todos os dados relacionados a esta unidade serao permanentemente removidos."
            : undefined
        }
        loading={deleting}
      />
    </Box>
  );
};

export default UnidadesHospitalares;
