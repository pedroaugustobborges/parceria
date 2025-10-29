import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
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
} from "@mui/material";
import {
  Add,
  Edit,
  LocalHospital,
  Check,
  Close,
  BusinessCenter,
} from "@mui/icons-material";
import { supabase } from "../lib/supabase";
import { UnidadeHospitalar } from "../types/database.types";
import { useAuth } from "../contexts/AuthContext";

const UnidadesHospitalares: React.FC = () => {
  const { isAdminAgirCorporativo } = useAuth();
  const [unidades, setUnidades] = useState<UnidadeHospitalar[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUnidade, setEditingUnidade] =
    useState<UnidadeHospitalar | null>(null);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  // Form state
  const [formData, setFormData] = useState({
    codigo: "",
    nome: "",
    endereco: "",
    ativo: true,
  });

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
        setErro("Código e Nome são obrigatórios");
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
                <TableRow sx={{ bgcolor: "grey.50" }}>
                  <TableCell sx={{ fontWeight: 600 }}>Código</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Nome</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Endereço</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">
                    Ações
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {unidades.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        Nenhuma unidade cadastrada
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  unidades.map((unidade) => (
                    <TableRow
                      key={unidade.id}
                      sx={{
                        "&:hover": { bgcolor: "action.hover" },
                        "&:last-child td": { border: 0 },
                      }}
                    >
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
              label="Sigla/abreviação"
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
              helperText="Sigla/abreviação única da unidade (ex: HUGOL, HECAD, CRER)"
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
              label="Endereço"
              value={formData.endereco}
              onChange={(e) =>
                setFormData({ ...formData, endereco: e.target.value })
              }
              fullWidth
              multiline
              rows={3}
              helperText="Endereço completo (opcional)"
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
    </Box>
  );
};

export default UnidadesHospitalares;
