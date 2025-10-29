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
  Autocomplete,
  Grid,
  Chip,
  Alert,
  Paper,
  Stepper,
  Step,
  StepLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { ptBR } from "date-fns/locale";
import {
  Add,
  CalendarMonth,
  Edit,
  Delete,
  Check,
  ArrowBack,
  Schedule,
  Person,
  FilterList,
  Refresh,
} from "@mui/icons-material";
import { supabase } from "../lib/supabase";
import {
  EscalaMedica,
  MedicoEscala,
  Contrato,
  Usuario,
  UnidadeHospitalar,
  ItemContrato,
  ContratoItem,
} from "../types/database.types";
import { format, parseISO } from "date-fns";

const EscalasMedicas: React.FC = () => {
  const [escalas, setEscalas] = useState<EscalaMedica[]>([]);
  const [escalasFiltradas, setEscalasFiltradas] = useState<EscalaMedica[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [unidades, setUnidades] = useState<UnidadeHospitalar[]>([]);
  const [itensContrato, setItensContrato] = useState<ItemContrato[]>([]);
  const [todosItensContrato, setTodosItensContrato] = useState<ItemContrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Filtros
  const [filtroParceiro, setFiltroParceiro] = useState<string[]>([]);
  const [filtroContrato, setFiltroContrato] = useState<string[]>([]);
  const [filtroUnidade, setFiltroUnidade] = useState<string[]>([]);
  const [filtroNome, setFiltroNome] = useState<string[]>([]);
  const [filtroCpf, setFiltroCpf] = useState<string[]>([]);
  const [filtroDataInicio, setFiltroDataInicio] = useState<Date | null>(null);
  const [filtroDataFim, setFiltroDataFim] = useState<Date | null>(null);

  // Wizard state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [editingEscala, setEditingEscala] = useState<EscalaMedica | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    contrato_id: "",
    item_contrato_id: "",
    data_inicio: null as Date | null,
    horario_entrada: null as Date | null,
    horario_saida: null as Date | null,
    medicos_selecionados: [] as Usuario[],
    observacoes: "",
  });

  // Preview calendar state
  const [previewData, setPreviewData] = useState<{
    contrato: Contrato | null;
    medicos: MedicoEscala[];
  }>({
    contrato: null,
    medicos: [],
  });

  const steps = ["Dados Básicos", "Visualizar Escala", "Confirmar"];

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    aplicarFiltros();
  }, [
    escalas,
    filtroParceiro,
    filtroContrato,
    filtroUnidade,
    filtroNome,
    filtroCpf,
    filtroDataInicio,
    filtroDataFim,
  ]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [{ data: escal }, { data: contr }, { data: unid }, { data: itens }] =
        await Promise.all([
          supabase
            .from("escalas_medicas")
            .select("*")
            .order("data_inicio", { ascending: false }),
          supabase.from("contratos").select("*").eq("ativo", true),
          supabase
            .from("unidades_hospitalares")
            .select("*")
            .eq("ativo", true)
            .order("codigo"),
          supabase
            .from("itens_contrato")
            .select("*")
            .eq("ativo", true),
        ]);

      setEscalas(escal || []);
      setContratos(contr || []);
      setUnidades(unid || []);
      setTodosItensContrato(itens || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadUsuariosByContrato = async (contratoId: string) => {
    try {
      const { data: usuarioContratos } = await supabase
        .from("usuario_contrato")
        .select("usuario_id")
        .eq("contrato_id", contratoId);

      if (!usuarioContratos || usuarioContratos.length === 0) {
        setUsuarios([]);
        return;
      }

      const usuarioIds = usuarioContratos.map((uc) => uc.usuario_id);

      const { data: usuariosData } = await supabase
        .from("usuarios")
        .select("*")
        .in("id", usuarioIds)
        .eq("tipo", "terceiro");

      setUsuarios(usuariosData || []);
    } catch (err: any) {
      console.error("Erro ao carregar usuários:", err);
    }
  };

  const loadItensContrato = async (contratoId: string) => {
    try {
      const { data: contratoItens, error } = await supabase
        .from("contrato_itens")
        .select("*, item:itens_contrato(*)")
        .eq("contrato_id", contratoId);

      if (error) {
        console.error("Erro ao carregar itens do contrato:", error);
        setItensContrato([]);
        return;
      }

      if (!contratoItens || contratoItens.length === 0) {
        setItensContrato([]);
        return;
      }

      const itens = contratoItens.map((ci: any) => ci.item);
      setItensContrato(itens || []);
    } catch (err: any) {
      console.error("Erro ao carregar itens do contrato:", err);
      setItensContrato([]);
    }
  };

  const aplicarFiltros = () => {
    let filtered = [...escalas];

    // Filtro por parceiro (empresa)
    if (filtroParceiro.length > 0) {
      filtered = filtered.filter((escala) => {
        const contrato = contratos.find((c) => c.id === escala.contrato_id);
        return contrato && filtroParceiro.includes(contrato.empresa);
      });
    }

    // Filtro por contrato
    if (filtroContrato.length > 0) {
      filtered = filtered.filter((escala) =>
        filtroContrato.includes(escala.contrato_id)
      );
    }

    // Filtro por unidade hospitalar
    if (filtroUnidade.length > 0) {
      filtered = filtered.filter((escala) => {
        const contrato = contratos.find((c) => c.id === escala.contrato_id);
        if (!contrato || !contrato.unidade_hospitalar_id) return false;
        const unidade = unidades.find(
          (u) => u.id === contrato.unidade_hospitalar_id
        );
        return unidade && filtroUnidade.includes(unidade.codigo);
      });
    }

    // Filtro por nome de médico
    if (filtroNome.length > 0) {
      filtered = filtered.filter((escala) => {
        return escala.medicos.some((medico) =>
          filtroNome.includes(medico.nome)
        );
      });
    }

    // Filtro por CPF
    if (filtroCpf.length > 0) {
      filtered = filtered.filter((escala) => {
        return escala.medicos.some((medico) => filtroCpf.includes(medico.cpf));
      });
    }

    // Filtro por data início
    if (filtroDataInicio) {
      const dataInicio = new Date(filtroDataInicio);
      dataInicio.setHours(0, 0, 0, 0);
      filtered = filtered.filter((escala) => {
        const dataEscala = new Date(escala.data_inicio);
        dataEscala.setHours(0, 0, 0, 0);
        return dataEscala >= dataInicio;
      });
    }

    // Filtro por data fim
    if (filtroDataFim) {
      const dataFim = new Date(filtroDataFim);
      dataFim.setHours(0, 0, 0, 0);
      filtered = filtered.filter((escala) => {
        const dataEscala = new Date(escala.data_inicio);
        dataEscala.setHours(0, 0, 0, 0);
        return dataEscala <= dataFim;
      });
    }

    setEscalasFiltradas(filtered);
  };

  // Opções únicas para filtros
  const parceirosUnicos = Array.from(
    new Set(contratos.map((c) => c.empresa))
  ).sort();
  const contratosUnicos = contratos.map((c) => ({
    id: c.id,
    label: `${c.nome} - ${c.empresa}`,
  }));
  const unidadesUnicas = unidades.map((u) => u.codigo).sort();

  // Extrair nomes e CPFs únicos de todos os médicos nas escalas
  const nomesUnicos = Array.from(
    new Set(escalas.flatMap((e) => e.medicos.map((m) => m.nome)))
  ).sort();
  const cpfsUnicos = Array.from(
    new Set(escalas.flatMap((e) => e.medicos.map((m) => m.cpf)))
  ).sort();

  const handleContratoChange = (contrato: Contrato | null) => {
    setFormData({
      ...formData,
      contrato_id: contrato?.id || "",
      item_contrato_id: "",
      medicos_selecionados: [],
    });
    if (contrato) {
      loadUsuariosByContrato(contrato.id);
      loadItensContrato(contrato.id);
    } else {
      setUsuarios([]);
      setItensContrato([]);
    }
  };

  const handleNext = () => {
    if (activeStep === 0) {
      // Validar dados básicos
      if (
        !formData.contrato_id ||
        !formData.item_contrato_id ||
        !formData.data_inicio ||
        !formData.horario_entrada ||
        !formData.horario_saida
      ) {
        setError("Preencha todos os campos obrigatórios");
        return;
      }
      if (formData.medicos_selecionados.length === 0) {
        setError("Selecione pelo menos um médico");
        return;
      }

      // Preparar preview
      const contrato = contratos.find((c) => c.id === formData.contrato_id);
      const medicos: MedicoEscala[] = formData.medicos_selecionados.map(
        (u) => ({
          nome: u.nome,
          cpf: u.cpf,
        })
      );

      setPreviewData({ contrato: contrato || null, medicos });
      setError("");
    }

    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleSave = async () => {
    try {
      setError("");
      setSuccess("");

      const escalaMedica = {
        contrato_id: formData.contrato_id,
        item_contrato_id: formData.item_contrato_id,
        data_inicio: format(formData.data_inicio!, "yyyy-MM-dd"),
        horario_entrada: format(formData.horario_entrada!, "HH:mm:ss"),
        horario_saida: format(formData.horario_saida!, "HH:mm:ss"),
        medicos: previewData.medicos,
        observacoes: formData.observacoes || null,
      };

      if (editingEscala) {
        const { error: updateError } = await supabase
          .from("escalas_medicas")
          .update(escalaMedica)
          .eq("id", editingEscala.id);

        if (updateError) throw updateError;
        setSuccess("Escala atualizada com sucesso!");
      } else {
        const { error: insertError } = await supabase
          .from("escalas_medicas")
          .insert(escalaMedica);

        if (insertError) throw insertError;
        setSuccess("Escala criada com sucesso!");
      }

      handleCloseDialog();
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleOpenDialog = (escala?: EscalaMedica) => {
    if (escala) {
      setEditingEscala(escala);
      // TODO: Populate form for editing
    } else {
      setEditingEscala(null);
      setFormData({
        contrato_id: "",
        item_contrato_id: "",
        data_inicio: null,
        horario_entrada: null,
        horario_saida: null,
        medicos_selecionados: [],
        observacoes: "",
      });
      setPreviewData({ contrato: null, medicos: [] });
    }
    setActiveStep(0);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingEscala(null);
    setActiveStep(0);
    setError("");
  };

  const handleDelete = async (escala: EscalaMedica) => {
    if (!window.confirm("Tem certeza que deseja excluir esta escala?")) return;

    try {
      const { error: deleteError } = await supabase
        .from("escalas_medicas")
        .delete()
        .eq("id", escala.id);

      if (deleteError) throw deleteError;
      setSuccess("Escala excluída com sucesso!");
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ptBR}>
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
              Escalas Médicas
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Gerencie as escalas médicas por contrato
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
            Nova Escala
          </Button>
        </Box>

        {/* Messages */}
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

        {/* Filtros Avançados */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: "flex", alignItems: "center", mb: 3, gap: 1 }}>
              <FilterList color="primary" />
              <Typography variant="h6" fontWeight={600}>
                Filtros Avançados
              </Typography>
              <Box sx={{ flexGrow: 1 }} />
              <Tooltip title="Atualizar dados">
                <IconButton onClick={loadData} color="primary">
                  <Refresh />
                </IconButton>
              </Tooltip>
            </Box>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <Autocomplete
                  multiple
                  value={filtroParceiro}
                  onChange={(_, newValue) => setFiltroParceiro(newValue)}
                  options={parceirosUnicos}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Parceiro"
                      placeholder="Selecione um ou mais"
                    />
                  )}
                  size="small"
                  limitTags={2}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Autocomplete
                  multiple
                  value={filtroContrato}
                  onChange={(_, newValue) => setFiltroContrato(newValue)}
                  options={contratosUnicos.map((c) => c.id)}
                  getOptionLabel={(option) =>
                    contratosUnicos.find((c) => c.id === option)?.label || ""
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Contrato"
                      placeholder="Selecione um ou mais"
                    />
                  )}
                  size="small"
                  limitTags={2}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Autocomplete
                  multiple
                  value={filtroUnidade}
                  onChange={(_, newValue) => setFiltroUnidade(newValue)}
                  options={unidadesUnicas}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Unidade Hospitalar"
                      placeholder="Selecione uma ou mais"
                    />
                  )}
                  size="small"
                  limitTags={2}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Autocomplete
                  multiple
                  value={filtroNome}
                  onChange={(_, newValue) => setFiltroNome(newValue)}
                  options={nomesUnicos}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Nome"
                      placeholder="Selecione um ou mais"
                    />
                  )}
                  size="small"
                  limitTags={2}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Autocomplete
                  multiple
                  value={filtroCpf}
                  onChange={(_, newValue) => setFiltroCpf(newValue)}
                  options={cpfsUnicos}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="CPF"
                      placeholder="Selecione um ou mais"
                    />
                  )}
                  size="small"
                  limitTags={2}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <DatePicker
                  label="Data Início"
                  value={filtroDataInicio}
                  onChange={(newValue) => setFiltroDataInicio(newValue)}
                  slotProps={{ textField: { size: "small", fullWidth: true } }}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <DatePicker
                  label="Data Fim"
                  value={filtroDataFim}
                  onChange={(newValue) => setFiltroDataFim(newValue)}
                  slotProps={{ textField: { size: "small", fullWidth: true } }}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Escalas List */}
        <Grid container spacing={3}>
          {escalasFiltradas.map((escala) => {
            const contrato = contratos.find((c) => c.id === escala.contrato_id);
            return (
              <Grid item xs={12} md={6} lg={4} key={escala.id}>
                <Card
                  sx={{
                    height: "100%",
                    transition: "all 0.3s",
                    "&:hover": {
                      transform: "translateY(-4px)",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                    },
                  }}
                >
                  <CardContent>
                    <Box
                      display="flex"
                      justifyContent="space-between"
                      alignItems="start"
                      mb={2}
                    >
                      <Chip
                        icon={<CalendarMonth />}
                        label={format(
                          parseISO(escala.data_inicio),
                          "dd/MM/yyyy"
                        )}
                        size="small"
                        sx={{
                          bgcolor: (theme) =>
                            theme.palette.mode === "dark"
                              ? "#1e3a8a"
                              : "#dbeafe",
                          color: (theme) =>
                            theme.palette.mode === "dark"
                              ? "#93c5fd"
                              : "#1e40af",
                          "& .MuiChip-icon": {
                            color: (theme) =>
                              theme.palette.mode === "dark"
                                ? "#93c5fd"
                                : "#1e40af",
                          },
                        }}
                      />
                      <Box>
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDialog(escala)}
                        >
                          <Edit fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDelete(escala)}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>

                    <Typography variant="h6" fontWeight={600} gutterBottom>
                      {contrato?.nome || "Contrato não encontrado"}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      gutterBottom
                    >
                      {contrato?.empresa}
                    </Typography>

                    <Box display="flex" gap={1} my={2} flexWrap="wrap">
                      <Chip
                        icon={<Schedule />}
                        label={`${escala.horario_entrada.substring(
                          0,
                          5
                        )} - ${escala.horario_saida.substring(0, 5)}`}
                        size="small"
                        variant="outlined"
                      />
                    </Box>

                    <Box mb={2}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                        gutterBottom
                      >
                        Item de Contrato:
                      </Typography>
                      <Chip
                        label={
                          todosItensContrato.find((i) => i.id === escala.item_contrato_id)?.nome ||
                          "Item não encontrado"
                        }
                        size="small"
                        color="secondary"
                        variant="outlined"
                      />
                    </Box>

                    <Box>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        gutterBottom
                        display="block"
                      >
                        Médicos ({escala.medicos.length}):
                      </Typography>
                      <Box display="flex" flexWrap="wrap" gap={0.5}>
                        {escala.medicos.slice(0, 3).map((medico, idx) => (
                          <Chip
                            key={idx}
                            icon={<Person />}
                            label={medico.nome.split(" ")[0]}
                            size="small"
                            sx={{ fontSize: "0.7rem" }}
                          />
                        ))}
                        {escala.medicos.length > 3 && (
                          <Chip
                            label={`+${escala.medicos.length - 3}`}
                            size="small"
                            sx={{ fontSize: "0.7rem" }}
                          />
                        )}
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>

        {/* Dialog - Wizard Form */}
        <Dialog
          open={dialogOpen}
          onClose={handleCloseDialog}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <Typography variant="h6" fontWeight={700}>
              {editingEscala ? "Editar Escala Médica" : "Nova Escala Médica"}
            </Typography>
          </DialogTitle>

          <DialogContent>
            <Stepper activeStep={activeStep} sx={{ mb: 4, mt: 2 }}>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>

            {/* Step 0: Dados Básicos */}
            {activeStep === 0 && (
              <Box
                sx={{ display: "flex", flexDirection: "column", gap: 3, mt: 2 }}
              >
                <Autocomplete
                  value={
                    contratos.find((c) => c.id === formData.contrato_id) || null
                  }
                  onChange={(_, newValue) => handleContratoChange(newValue)}
                  options={contratos}
                  getOptionLabel={(option) =>
                    `${option.nome} - ${option.empresa}`
                  }
                  renderInput={(params) => (
                    <TextField {...params} label="Contrato" required />
                  )}
                  fullWidth
                />

                <Autocomplete
                  value={
                    itensContrato.find((i) => i.id === formData.item_contrato_id) || null
                  }
                  onChange={(_, newValue) =>
                    setFormData({ ...formData, item_contrato_id: newValue?.id || "" })
                  }
                  options={itensContrato}
                  getOptionLabel={(option) =>
                    `${option.nome} (${option.unidade_medida})`
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Item de Contrato"
                      required
                      helperText="Selecione o item de contrato relacionado a esta escala"
                    />
                  )}
                  disabled={!formData.contrato_id}
                  fullWidth
                />

                <DatePicker
                  label="Data de Início"
                  value={formData.data_inicio}
                  onChange={(newValue) =>
                    setFormData({ ...formData, data_inicio: newValue })
                  }
                  slotProps={{ textField: { fullWidth: true, required: true } }}
                />

                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <TimePicker
                      label="Horário de Entrada"
                      value={formData.horario_entrada}
                      onChange={(newValue) =>
                        setFormData({ ...formData, horario_entrada: newValue })
                      }
                      slotProps={{
                        textField: { fullWidth: true, required: true },
                      }}
                      ampm={false}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TimePicker
                      label="Horário de Saída"
                      value={formData.horario_saida}
                      onChange={(newValue) =>
                        setFormData({ ...formData, horario_saida: newValue })
                      }
                      slotProps={{
                        textField: { fullWidth: true, required: true },
                      }}
                      ampm={false}
                    />
                  </Grid>
                </Grid>

                <Autocomplete
                  multiple
                  value={formData.medicos_selecionados}
                  onChange={(_, newValue) =>
                    setFormData({ ...formData, medicos_selecionados: newValue })
                  }
                  options={usuarios}
                  getOptionLabel={(option) =>
                    `${option.nome} - CPF: ${option.cpf}`
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Médicos"
                      required
                      helperText="Selecione um ou mais médicos vinculados a este contrato"
                    />
                  )}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip
                        label={option.nome}
                        {...getTagProps({ index })}
                        size="small"
                        color="primary"
                      />
                    ))
                  }
                  disabled={!formData.contrato_id}
                  fullWidth
                />

                <TextField
                  label="Observações"
                  value={formData.observacoes}
                  onChange={(e) =>
                    setFormData({ ...formData, observacoes: e.target.value })
                  }
                  multiline
                  rows={3}
                  fullWidth
                />
              </Box>
            )}

            {/* Step 1: Visualizar Escala */}
            {activeStep === 1 && (
              <Box sx={{ mt: 2 }}>
                <Card
                  sx={{
                    mb: 3,
                    bgcolor: "primary.50",
                    borderLeft: "4px solid",
                    borderColor: "primary.main",
                  }}
                >
                  <CardContent>
                    <Typography variant="h6" fontWeight={600} gutterBottom>
                      {previewData.contrato?.nome}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      gutterBottom
                    >
                      {previewData.contrato?.empresa}
                    </Typography>
                    <Box display="flex" gap={2} mt={2} flexWrap="wrap">
                      <Chip
                        icon={<CalendarMonth />}
                        label={
                          formData.data_inicio
                            ? format(formData.data_inicio, "dd/MM/yyyy")
                            : ""
                        }
                        color="primary"
                      />
                      <Chip
                        icon={<Schedule />}
                        label={`${
                          formData.horario_entrada
                            ? format(formData.horario_entrada, "HH:mm")
                            : ""
                        } - ${
                          formData.horario_saida
                            ? format(formData.horario_saida, "HH:mm")
                            : ""
                        }`}
                        color="primary"
                      />
                      <Chip
                        label={
                          itensContrato.find((i) => i.id === formData.item_contrato_id)
                            ?.nome || "Item não encontrado"
                        }
                        color="secondary"
                        variant="outlined"
                      />
                    </Box>
                  </CardContent>
                </Card>

                <Typography variant="h6" fontWeight={600} gutterBottom>
                  Médicos Escalados ({previewData.medicos.length})
                </Typography>

                <TableContainer
                  component={Paper}
                  elevation={0}
                  sx={{ border: "1px solid #e0e0e0" }}
                >
                  <Table>
                    <TableHead>
                      <TableRow sx={{ bgcolor: "grey.50" }}>
                        <TableCell>
                          <strong>Nome</strong>
                        </TableCell>
                        <TableCell>
                          <strong>CPF</strong>
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {previewData.medicos.map((medico, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <Box display="flex" alignItems="center" gap={1}>
                              <Person color="primary" />
                              {medico.nome}
                            </Box>
                          </TableCell>
                          <TableCell>{medico.cpf}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                {formData.observacoes && (
                  <Box mt={3}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      gutterBottom
                    >
                      <strong>Observações:</strong>
                    </Typography>
                    <Paper sx={{ p: 2, bgcolor: "grey.50" }}>
                      <Typography variant="body2">
                        {formData.observacoes}
                      </Typography>
                    </Paper>
                  </Box>
                )}
              </Box>
            )}

            {/* Step 2: Confirmar */}
            {activeStep === 2 && (
              <Box sx={{ mt: 2, textAlign: "center", py: 4 }}>
                <Check sx={{ fontSize: 64, color: "success.main", mb: 2 }} />
                <Typography variant="h5" fontWeight={600} gutterBottom>
                  Pronto para Salvar!
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Clique em "Salvar" para confirmar a criação da escala médica.
                </Typography>
              </Box>
            )}
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={handleCloseDialog}>Cancelar</Button>
            {activeStep > 0 && (
              <Button onClick={handleBack} startIcon={<ArrowBack />}>
                Voltar
              </Button>
            )}
            {activeStep < steps.length - 1 && (
              <Button onClick={handleNext} variant="contained">
                Próximo
              </Button>
            )}
            {activeStep === steps.length - 1 && (
              <Button
                onClick={handleSave}
                variant="contained"
                color="success"
                startIcon={<Check />}
              >
                Salvar
              </Button>
            )}
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default EscalasMedicas;
