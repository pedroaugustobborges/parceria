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
  CheckCircle,
  Cancel,
  HourglassEmpty,
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
  StatusEscala,
} from "../types/database.types";
import { format, parseISO } from "date-fns";
import { useAuth } from "../contexts/AuthContext";

const EscalasMedicas: React.FC = () => {
  const { isAdminAgir, userProfile } = useAuth();
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

  // Status dialog state
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [escalaParaStatus, setEscalaParaStatus] = useState<EscalaMedica | null>(null);
  const [novoStatus, setNovoStatus] = useState<StatusEscala>("Programado");
  const [novaJustificativa, setNovaJustificativa] = useState("");

  // Details dialog state
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [escalaDetalhes, setEscalaDetalhes] = useState<EscalaMedica | null>(null);
  const [usuarioAlterouStatus, setUsuarioAlterouStatus] = useState<Usuario | null>(null);

  // Filtros
  const [filtroParceiro, setFiltroParceiro] = useState<string[]>([]);
  const [filtroContrato, setFiltroContrato] = useState<string[]>([]);
  const [filtroUnidade, setFiltroUnidade] = useState<string[]>([]);
  const [filtroNome, setFiltroNome] = useState<string[]>([]);
  const [filtroCpf, setFiltroCpf] = useState<string[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<StatusEscala[]>([]);
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
    filtroStatus,
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

    // Filtro por Status
    if (filtroStatus.length > 0) {
      filtered = filtered.filter((escala) =>
        filtroStatus.includes(escala.status)
      );
    }

    // Filtro por data início
    if (filtroDataInicio) {
      const dataInicio = new Date(filtroDataInicio);
      dataInicio.setHours(0, 0, 0, 0);
      filtered = filtered.filter((escala) => {
        // Usa parseISO para evitar problemas de timezone
        const dataEscala = parseISO(escala.data_inicio);
        dataEscala.setHours(0, 0, 0, 0);
        return dataEscala >= dataInicio;
      });
    }

    // Filtro por data fim
    if (filtroDataFim) {
      const dataFim = new Date(filtroDataFim);
      dataFim.setHours(0, 0, 0, 0);
      filtered = filtered.filter((escala) => {
        // Usa parseISO para evitar problemas de timezone
        const dataEscala = parseISO(escala.data_inicio);
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
        status: "Programado" as StatusEscala,
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

  const handleOpenDialog = async (escala?: EscalaMedica) => {
    if (escala) {
      // Bloquear edição se status não for "Programado"
      if (escala.status !== "Programado") {
        setError(
          `Não é possível editar uma escala com status "${escala.status}". Apenas escalas com status "Programado" podem ser editadas.`
        );
        return;
      }

      setEditingEscala(escala);

      // Find associated contract
      const contratoAssociado = contratos.find(c => c.id === escala.contrato_id);

      // Load usuarios for this contract inline to use immediately
      let medicosUsuarios: Usuario[] = [];
      if (contratoAssociado) {
        try {
          const { data: usuarioContratos } = await supabase
            .from("usuario_contrato")
            .select("usuario_id")
            .eq("contrato_id", escala.contrato_id);

          if (usuarioContratos && usuarioContratos.length > 0) {
            const usuarioIds = usuarioContratos.map((uc) => uc.usuario_id);

            const { data: usuariosData } = await supabase
              .from("usuarios")
              .select("*")
              .in("id", usuarioIds)
              .eq("tipo", "terceiro");

            medicosUsuarios = usuariosData || [];
            setUsuarios(medicosUsuarios);
          }
        } catch (err: any) {
          console.error("Erro ao carregar usuários:", err);
        }

        // Also load contract items
        await loadItensContrato(contratoAssociado.id);
      }

      // Map medicos from escala to Usuario objects
      const medicosEscalados = escala.medicos.map(medicoEscala => {
        return medicosUsuarios.find(u => u.cpf === medicoEscala.cpf);
      }).filter(Boolean) as Usuario[];

      // Parse date using parseISO to avoid timezone issues
      const dataInicio = parseISO(escala.data_inicio);

      // Parse time strings (format "HH:mm:ss") to Date objects
      const [horaE, minE] = escala.horario_entrada.split(':').map(Number);
      const [horaS, minS] = escala.horario_saida.split(':').map(Number);

      const horarioEntrada = new Date();
      horarioEntrada.setHours(horaE, minE, 0, 0);

      const horarioSaida = new Date();
      horarioSaida.setHours(horaS, minS, 0, 0);

      // Populate form with escala data
      setFormData({
        contrato_id: escala.contrato_id,
        item_contrato_id: escala.item_contrato_id,
        data_inicio: dataInicio,
        horario_entrada: horarioEntrada,
        horario_saida: horarioSaida,
        medicos_selecionados: medicosEscalados,
        observacoes: escala.observacoes || "",
      });

      // Set preview data
      setPreviewData({
        contrato: contratoAssociado || null,
        medicos: escala.medicos,
      });
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
    // Bloquear exclusão se status não for "Programado"
    if (escala.status !== "Programado") {
      setError(
        `Não é possível excluir uma escala com status "${escala.status}". Apenas escalas com status "Programado" podem ser excluídas.`
      );
      return;
    }

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

  // Funções auxiliares para Status
  const getStatusConfig = (status: StatusEscala) => {
    const configs = {
      Programado: {
        color: "info" as const,
        icon: <HourglassEmpty />,
        label: "Programado",
      },
      Aprovado: {
        color: "success" as const,
        icon: <CheckCircle />,
        label: "Aprovado",
      },
      Reprovado: {
        color: "error" as const,
        icon: <Cancel />,
        label: "Reprovado",
      },
    };
    return configs[status] || configs.Programado;
  };

  const handleOpenStatusDialog = (escala: EscalaMedica) => {
    // Bloquear alteração de status se já estiver Aprovado ou Reprovado
    if (escala.status !== "Programado") {
      setError(
        `Não é possível alterar o status. A escala já está ${escala.status.toLowerCase()}. Apenas escalas com status "Programado" podem ter o status alterado.`
      );
      return;
    }

    setEscalaParaStatus(escala);
    setNovoStatus(escala.status);
    setNovaJustificativa(escala.justificativa || "");
    setStatusDialogOpen(true);
  };

  const handleCloseStatusDialog = () => {
    setStatusDialogOpen(false);
    setEscalaParaStatus(null);
    setNovoStatus("Programado");
    setNovaJustificativa("");
  };

  const handleSaveStatus = async () => {
    try {
      // Validar justificativa obrigatória para status "Reprovado"
      if (novoStatus === "Reprovado" && !novaJustificativa.trim()) {
        setError("Justificativa é obrigatória para status Reprovado");
        return;
      }

      const { error: updateError } = await supabase
        .from("escalas_medicas")
        .update({
          status: novoStatus,
          justificativa: novaJustificativa.trim() || null,
          status_alterado_por: userProfile?.id || null,
          status_alterado_em: new Date().toISOString(),
        })
        .eq("id", escalaParaStatus!.id);

      if (updateError) throw updateError;

      setSuccess("Status atualizado com sucesso!");
      handleCloseStatusDialog();
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Funções para Details Dialog
  const handleOpenDetailsDialog = async (escala: EscalaMedica) => {
    setEscalaDetalhes(escala);

    // Carregar usuário que alterou o status (se houver)
    if (escala.status_alterado_por) {
      try {
        const { data: usuario, error } = await supabase
          .from("usuarios")
          .select("*")
          .eq("id", escala.status_alterado_por)
          .single();

        if (!error && usuario) {
          setUsuarioAlterouStatus(usuario);
        }
      } catch (err) {
        console.error("Erro ao carregar usuário:", err);
      }
    } else {
      setUsuarioAlterouStatus(null);
    }

    setDetailsDialogOpen(true);
  };

  const handleCloseDetailsDialog = () => {
    setDetailsDialogOpen(false);
    setEscalaDetalhes(null);
    setUsuarioAlterouStatus(null);
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
                <Autocomplete
                  multiple
                  value={filtroStatus}
                  onChange={(_, newValue) => setFiltroStatus(newValue as StatusEscala[])}
                  options={["Programado", "Aprovado", "Reprovado"] as StatusEscala[]}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Status"
                      placeholder="Selecione um ou mais"
                    />
                  )}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => {
                      const config = getStatusConfig(option);
                      return (
                        <Chip
                          {...getTagProps({ index })}
                          label={config.label}
                          color={config.color}
                          size="small"
                          icon={config.icon}
                        />
                      );
                    })
                  }
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
                    cursor: "pointer",
                    "&:hover": {
                      transform: "translateY(-4px)",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                    },
                  }}
                  onClick={() => handleOpenDetailsDialog(escala)}
                >
                  <CardContent>
                    <Box
                      display="flex"
                      justifyContent="space-between"
                      alignItems="start"
                      mb={2}
                    >
                      <Box display="flex" flexDirection="column" gap={1}>
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
                        <Tooltip
                          title={
                            isAdminAgir && escala.status === "Programado"
                              ? "Clique para alterar o status"
                              : isAdminAgir && escala.status !== "Programado"
                              ? `Status bloqueado. Escalas ${escala.status.toLowerCase()}s não podem ter o status alterado.`
                              : escala.justificativa
                              ? `Justificativa: ${escala.justificativa}`
                              : ""
                          }
                        >
                          <Chip
                            icon={getStatusConfig(escala.status).icon}
                            label={getStatusConfig(escala.status).label}
                            color={getStatusConfig(escala.status).color}
                            size="small"
                            onClick={
                              isAdminAgir && escala.status === "Programado"
                                ? (e) => {
                                    e.stopPropagation();
                                    handleOpenStatusDialog(escala);
                                  }
                                : undefined
                            }
                            sx={{
                              cursor: isAdminAgir && escala.status === "Programado" ? "pointer" : "default",
                              opacity: escala.status !== "Programado" && isAdminAgir ? 0.9 : 1,
                              transition: "all 0.2s",
                              "&:hover": isAdminAgir && escala.status === "Programado"
                                ? {
                                    transform: "scale(1.05)",
                                    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                                  }
                                : {},
                            }}
                          />
                        </Tooltip>
                      </Box>
                      <Box>
                        <Tooltip
                          title={
                            escala.status !== "Programado"
                              ? `Não é possível editar. Escala está ${escala.status.toLowerCase()}.`
                              : "Editar escala"
                          }
                        >
                          <span>
                            <IconButton
                              size="small"
                              disabled={escala.status !== "Programado"}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenDialog(escala);
                              }}
                              sx={{
                                opacity: escala.status !== "Programado" ? 0.5 : 1,
                              }}
                            >
                              <Edit fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip
                          title={
                            escala.status !== "Programado"
                              ? `Não é possível excluir. Escala está ${escala.status.toLowerCase()}.`
                              : "Excluir escala"
                          }
                        >
                          <span>
                            <IconButton
                              size="small"
                              color="error"
                              disabled={escala.status !== "Programado"}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(escala);
                              }}
                              sx={{
                                opacity: escala.status !== "Programado" ? 0.5 : 1,
                              }}
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
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

        {/* Dialog - Alterar Status */}
        <Dialog
          open={statusDialogOpen}
          onClose={handleCloseStatusDialog}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            <Typography variant="h6" fontWeight={700}>
              Alterar Status da Escala
            </Typography>
          </DialogTitle>

          <DialogContent>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 3, mt: 2 }}>
              {/* Informações da Escala */}
              {escalaParaStatus && (
                <Card
                  sx={{
                    bgcolor: "primary.50",
                    borderLeft: "4px solid",
                    borderColor: "primary.main",
                  }}
                >
                  <CardContent>
                    <Typography variant="subtitle2" fontWeight={600}>
                      {contratos.find((c) => c.id === escalaParaStatus.contrato_id)?.nome}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Data:{" "}
                      {format(parseISO(escalaParaStatus.data_inicio), "dd/MM/yyyy")}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Médicos: {escalaParaStatus.medicos.length}
                    </Typography>
                  </CardContent>
                </Card>
              )}

              {/* Seletor de Status */}
              <Box>
                <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                  Novo Status
                </Typography>
                <Box display="flex" gap={1} flexWrap="wrap">
                  {(["Programado", "Aprovado", "Reprovado"] as StatusEscala[]).map(
                    (status) => {
                      const config = getStatusConfig(status);
                      return (
                        <Chip
                          key={status}
                          icon={config.icon}
                          label={config.label}
                          color={config.color}
                          variant={novoStatus === status ? "filled" : "outlined"}
                          onClick={() => setNovoStatus(status)}
                          sx={{
                            cursor: "pointer",
                            transition: "all 0.2s",
                            "&:hover": {
                              transform: "scale(1.05)",
                            },
                          }}
                        />
                      );
                    }
                  )}
                </Box>
              </Box>

              {/* Campo de Justificativa */}
              <TextField
                label="Justificativa"
                value={novaJustificativa}
                onChange={(e) => setNovaJustificativa(e.target.value)}
                multiline
                rows={4}
                fullWidth
                required={novoStatus === "Reprovado"}
                error={novoStatus === "Reprovado" && !novaJustificativa.trim()}
                helperText={
                  novoStatus === "Reprovado"
                    ? "Justificativa obrigatória para status Reprovado"
                    : "Opcional para outros status"
                }
                placeholder="Digite a justificativa para a alteração de status..."
              />

              {/* Exibir status atual */}
              {escalaParaStatus && (
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 1,
                    bgcolor: "background.default",
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    Status Atual
                  </Typography>
                  <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                    <Chip
                      icon={getStatusConfig(escalaParaStatus.status).icon}
                      label={getStatusConfig(escalaParaStatus.status).label}
                      color={getStatusConfig(escalaParaStatus.status).color}
                      size="small"
                    />
                    {escalaParaStatus.justificativa && (
                      <Typography variant="caption" color="text.secondary">
                        {escalaParaStatus.justificativa}
                      </Typography>
                    )}
                  </Box>
                </Box>
              )}
            </Box>
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={handleCloseStatusDialog}>Cancelar</Button>
            <Button
              onClick={handleSaveStatus}
              variant="contained"
              color="primary"
              startIcon={<Check />}
              disabled={novoStatus === "Reprovado" && !novaJustificativa.trim()}
            >
              Salvar Status
            </Button>
          </DialogActions>
        </Dialog>

        {/* Dialog - Detalhes Completos da Escala */}
        <Dialog
          open={detailsDialogOpen}
          onClose={handleCloseDetailsDialog}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="h6" fontWeight={700}>
                Detalhes da Escala Médica
              </Typography>
              {escalaDetalhes && (
                <Chip
                  icon={getStatusConfig(escalaDetalhes.status).icon}
                  label={getStatusConfig(escalaDetalhes.status).label}
                  color={getStatusConfig(escalaDetalhes.status).color}
                  size="small"
                />
              )}
            </Box>
          </DialogTitle>

          <DialogContent>
            {escalaDetalhes && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 3, mt: 2 }}>
                {/* Informações do Contrato */}
                <Card
                  sx={{
                    bgcolor: "primary.50",
                    borderLeft: "4px solid",
                    borderColor: "primary.main",
                  }}
                >
                  <CardContent>
                    <Typography variant="overline" color="text.secondary">
                      Contrato
                    </Typography>
                    <Typography variant="h6" fontWeight={600} gutterBottom>
                      {contratos.find((c) => c.id === escalaDetalhes.contrato_id)
                        ?.nome || "Não encontrado"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Empresa:{" "}
                      {contratos.find((c) => c.id === escalaDetalhes.contrato_id)
                        ?.empresa || "Não encontrado"}
                    </Typography>
                    {contratos.find((c) => c.id === escalaDetalhes.contrato_id)
                      ?.numero_contrato && (
                      <Typography variant="body2" color="text.secondary">
                        Nº Contrato:{" "}
                        {
                          contratos.find((c) => c.id === escalaDetalhes.contrato_id)
                            ?.numero_contrato
                        }
                      </Typography>
                    )}
                  </CardContent>
                </Card>

                {/* Informações da Escala */}
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="overline" color="text.secondary">
                          Data da Escala
                        </Typography>
                        <Box display="flex" alignItems="center" gap={1} mt={1}>
                          <CalendarMonth color="primary" />
                          <Typography variant="h6">
                            {format(
                              parseISO(escalaDetalhes.data_inicio),
                              "dd/MM/yyyy"
                            )}
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="overline" color="text.secondary">
                          Horário
                        </Typography>
                        <Box display="flex" alignItems="center" gap={1} mt={1}>
                          <Schedule color="primary" />
                          <Typography variant="h6">
                            {escalaDetalhes.horario_entrada.substring(0, 5)} -{" "}
                            {escalaDetalhes.horario_saida.substring(0, 5)}
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="overline" color="text.secondary">
                          Item de Contrato
                        </Typography>
                        <Typography variant="body1" fontWeight={600} mt={1}>
                          {todosItensContrato.find(
                            (i) => i.id === escalaDetalhes.item_contrato_id
                          )?.nome || "Não encontrado"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Unidade de medida:{" "}
                          {todosItensContrato.find(
                            (i) => i.id === escalaDetalhes.item_contrato_id
                          )?.unidade_medida || "N/A"}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                {/* Médicos Escalados */}
                <Box>
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    Médicos Escalados ({escalaDetalhes.medicos.length})
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
                        {escalaDetalhes.medicos.map((medico, idx) => (
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
                </Box>

                {/* Status e Aprovação */}
                <Card
                  sx={{
                    bgcolor: "background.default",
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <CardContent>
                    <Typography variant="h6" fontWeight={600} gutterBottom>
                      Informações de Status
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="text.secondary">
                          Status Atual
                        </Typography>
                        <Box mt={1}>
                          <Chip
                            icon={getStatusConfig(escalaDetalhes.status).icon}
                            label={getStatusConfig(escalaDetalhes.status).label}
                            color={getStatusConfig(escalaDetalhes.status).color}
                          />
                        </Box>
                      </Grid>

                      {usuarioAlterouStatus && (
                        <Grid item xs={12} sm={6}>
                          <Typography variant="caption" color="text.secondary">
                            Alterado por
                          </Typography>
                          <Typography variant="body1" fontWeight={600} mt={1}>
                            {usuarioAlterouStatus.nome}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {usuarioAlterouStatus.email}
                          </Typography>
                        </Grid>
                      )}

                      {escalaDetalhes.status_alterado_em && (
                        <Grid item xs={12} sm={6}>
                          <Typography variant="caption" color="text.secondary">
                            Data da Alteração
                          </Typography>
                          <Typography variant="body1" mt={1}>
                            {format(
                              parseISO(escalaDetalhes.status_alterado_em),
                              "dd/MM/yyyy 'às' HH:mm",
                              { locale: ptBR }
                            )}
                          </Typography>
                        </Grid>
                      )}

                      {escalaDetalhes.justificativa && (
                        <Grid item xs={12}>
                          <Typography variant="caption" color="text.secondary">
                            Justificativa
                          </Typography>
                          <Paper
                            sx={{
                              p: 2,
                              mt: 1,
                              bgcolor: "grey.50",
                              border: "1px solid",
                              borderColor: "divider",
                            }}
                          >
                            <Typography variant="body2">
                              {escalaDetalhes.justificativa}
                            </Typography>
                          </Paper>
                        </Grid>
                      )}
                    </Grid>
                  </CardContent>
                </Card>

                {/* Observações */}
                {escalaDetalhes.observacoes && (
                  <Box>
                    <Typography variant="h6" fontWeight={600} gutterBottom>
                      Observações
                    </Typography>
                    <Paper
                      sx={{
                        p: 2,
                        bgcolor: "grey.50",
                        border: "1px solid",
                        borderColor: "divider",
                      }}
                    >
                      <Typography variant="body2">
                        {escalaDetalhes.observacoes}
                      </Typography>
                    </Paper>
                  </Box>
                )}

                {/* Metadados */}
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 1,
                    bgcolor: "grey.50",
                    border: "1px dashed",
                    borderColor: "divider",
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    <strong>Criado em:</strong>{" "}
                    {format(
                      parseISO(escalaDetalhes.created_at),
                      "dd/MM/yyyy 'às' HH:mm"
                    )}
                  </Typography>
                  {escalaDetalhes.updated_at && (
                    <>
                      {" • "}
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        component="span"
                      >
                        <strong>Atualizado em:</strong>{" "}
                        {format(
                          parseISO(escalaDetalhes.updated_at),
                          "dd/MM/yyyy 'às' HH:mm"
                        )}
                      </Typography>
                    </>
                  )}
                </Box>
              </Box>
            )}
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={handleCloseDetailsDialog} variant="outlined">
              Fechar
            </Button>
            {isAdminAgir && escalaDetalhes && (
              <>
                <Tooltip
                  title={
                    escalaDetalhes.status !== "Programado"
                      ? `Não é possível editar. Escala está ${escalaDetalhes.status.toLowerCase()}.`
                      : ""
                  }
                >
                  <span>
                    <Button
                      onClick={() => {
                        handleCloseDetailsDialog();
                        handleOpenDialog(escalaDetalhes);
                      }}
                      variant="outlined"
                      startIcon={<Edit />}
                      disabled={escalaDetalhes.status !== "Programado"}
                    >
                      Editar
                    </Button>
                  </span>
                </Tooltip>
                <Tooltip
                  title={
                    escalaDetalhes.status !== "Programado"
                      ? `Status bloqueado. Escalas ${escalaDetalhes.status.toLowerCase()}s não podem ter o status alterado.`
                      : ""
                  }
                >
                  <span>
                    <Button
                      onClick={() => {
                        handleCloseDetailsDialog();
                        handleOpenStatusDialog(escalaDetalhes);
                      }}
                      variant="contained"
                      color="primary"
                      disabled={escalaDetalhes.status !== "Programado"}
                    >
                      Alterar Status
                    </Button>
                  </span>
                </Tooltip>
              </>
            )}
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default EscalasMedicas;
