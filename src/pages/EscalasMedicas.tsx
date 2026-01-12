import React, { useState, useEffect, useMemo, useRef } from "react";
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
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Divider,
  useTheme,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { ptBR } from "date-fns/locale";
import MultiDatePicker from "react-multi-date-picker";
import "react-multi-date-picker/styles/backgrounds/bg-dark.css";
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
  FileDownload,
  PictureAsPdf,
  ThumbUpAlt,
  Warning,
  Analytics,
  Search,
  AttachMoney,
  AccessTime,
  UploadFile,
  CloudUpload,
  Info,
  Close,
  HowToReg,
  CheckBox as CheckBoxIcon,
  CheckBoxOutlineBlank,
  IndeterminateCheckBox,
  DoneAll,
  ThumbDown,
} from "@mui/icons-material";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Papa from "papaparse";
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
import { recalcularStatusEscalas } from "../services/statusAnalysisService";
import { usePersistentState, usePersistentArray } from "../hooks/usePersistentState";

const EscalasMedicas: React.FC = () => {
  const { isAdminAgir, isAdminTerceiro, isTerceiro, userProfile, userContratoIds } = useAuth();
  const theme = useTheme();

  // Large data arrays - NOT persisted (might be large)
  const [escalas, setEscalas] = useState<EscalaMedica[]>([]);
  const [escalasFiltradas, setEscalasFiltradas] = useState<EscalaMedica[]>([]);

  // Auxiliary data - persisted (smaller, useful for autocomplete)
  const [contratos, setContratos] = usePersistentArray<Contrato>("escalas_contratos");
  const [usuarios, setUsuarios] = usePersistentArray<Usuario>("escalas_usuarios");
  const [unidades, setUnidades] = usePersistentArray<UnidadeHospitalar>("escalas_unidades");
  const [itensContrato, setItensContrato] = usePersistentArray<ItemContrato>("escalas_itensContrato");
  const [todosItensContrato, setTodosItensContrato] = usePersistentArray<ItemContrato>("escalas_todosItensContrato");
  const [contratoItens, setContratoItens] = usePersistentArray<ContratoItem>("escalas_contratoItens");
  const [loading, setLoading] = useState(false);
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [recalculando, setRecalculando] = useState(false);

  // Status dialog state
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [escalaParaStatus, setEscalaParaStatus] = useState<EscalaMedica | null>(
    null
  );
  const [novoStatus, setNovoStatus] = useState<StatusEscala>("Programado");
  const [novaJustificativa, setNovaJustificativa] = useState("");

  // Details dialog state
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [escalaDetalhes, setEscalaDetalhes] = useState<EscalaMedica | null>(
    null
  );
  const [usuarioAlterouStatus, setUsuarioAlterouStatus] =
    useState<Usuario | null>(null);
  const [acessosMedico, setAcessosMedico] = useState<any[]>([]);
  const [produtividadeMedico, setProdutividadeMedico] = useState<any | null>(
    null
  );
  const [loadingDetalhes, setLoadingDetalhes] = useState(false);

  // Bulk selection state
  const [selectedEscalas, setSelectedEscalas] = useState<Set<number>>(new Set());
  const [bulkStatusDialogOpen, setBulkStatusDialogOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<StatusEscala>("Aprovado");
  const [bulkJustificativa, setBulkJustificativa] = useState("");

  // Persistent filters - survive navigation between tabs
  const [filtroParceiro, setFiltroParceiro] = usePersistentArray<string>("escalas_filtroParceiro");
  const [filtroContrato, setFiltroContrato] = usePersistentArray<string>("escalas_filtroContrato");
  const [filtroUnidade, setFiltroUnidade] = usePersistentArray<string>("escalas_filtroUnidade");
  const [filtroNome, setFiltroNome] = usePersistentArray<string>("escalas_filtroNome");
  const [filtroCpf, setFiltroCpf] = usePersistentArray<string>("escalas_filtroCpf");
  const [filtroStatus, setFiltroStatus] = usePersistentArray<StatusEscala>("escalas_filtroStatus");
  const [filtroDataInicio, setFiltroDataInicio] = usePersistentState<Date | null>("escalas_filtroDataInicio", null);
  const [filtroDataFim, setFiltroDataFim] = usePersistentState<Date | null>("escalas_filtroDataFim", null);
  const [buscaRealizada, setBuscaRealizada] = usePersistentState<boolean>("escalas_buscaRealizada", false);

  // Wizard state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [editingEscala, setEditingEscala] = useState<EscalaMedica | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    contrato_id: "",
    item_contrato_id: "",
    data_inicio: [] as Date[],
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

  // CSV Import state
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [csvPreviewData, setCsvPreviewData] = useState<Array<{
    cpf: string;
    nome: string;
    data_inicio: string;
    horario_entrada: string;
    horario_saida: string;
  }>>([]);
  const [csvPreviewOpen, setCsvPreviewOpen] = useState(false);
  const [importingCsv, setImportingCsv] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const steps = ["Dados Básicos", "Visualizar Escala", "Confirmar"];

  useEffect(() => {
    // Carregar apenas dados auxiliares (contratos, unidades, itens)
    loadAuxiliaryData();

    // Auto-reload escalas data if filters are saved and search was previously performed
    // This happens when user navigates back to Escalas Médicas after leaving
    if (buscaRealizada && filtroDataInicio && filtroDataFim && escalas.length === 0) {
      console.log('🔄 Auto-reloading escalas data from saved filters...');
      handleBuscarEscalas();
    }
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

  // Calcular métricas dos scorecards
  const scorecardMetrics = useMemo(() => {
    const metrics = {
      aprovado: { valor: 0, horas: 0 },
      preAprovado: { valor: 0, horas: 0 },
      aprovacaoParcial: { valor: 0, horas: 0 },
      programado: { valor: 0, horas: 0 },
      atencao: { valor: 0, horas: 0 },
    };

    escalasFiltradas.forEach((escala) => {
      // Buscar o item de contrato para obter o valor
      const contratoItem = contratoItens.find(
        (ci) => ci.item_id === escala.item_contrato_id
      );

      if (!contratoItem || !contratoItem.valor_unitario) return;

      // Calcular horas da escala
      const [horaE, minE] = escala.horario_entrada.split(":").map(Number);
      const [horaS, minS] = escala.horario_saida.split(":").map(Number);
      const minutosEntrada = horaE * 60 + minE;
      const minutosSaida = horaS * 60 + minS;

      let horas = 0;
      if (minutosSaida >= minutosEntrada) {
        horas = (minutosSaida - minutosEntrada) / 60;
      } else {
        // Atravessa meia-noite
        horas = ((1440 - minutosEntrada) + minutosSaida) / 60;
      }

      // Multiplicar pelo número de médicos
      const totalHoras = horas * escala.medicos.length;
      const valor = contratoItem.valor_unitario * totalHoras;

      // Acumular por status
      switch (escala.status) {
        case "Aprovado":
          metrics.aprovado.valor += valor;
          metrics.aprovado.horas += totalHoras;
          break;
        case "Pré-Aprovado":
          metrics.preAprovado.valor += valor;
          metrics.preAprovado.horas += totalHoras;
          break;
        case "Aprovação Parcial":
          metrics.aprovacaoParcial.valor += valor;
          metrics.aprovacaoParcial.horas += totalHoras;
          break;
        case "Programado":
          metrics.programado.valor += valor;
          metrics.programado.horas += totalHoras;
          break;
        case "Atenção":
          metrics.atencao.valor += valor;
          metrics.atencao.horas += totalHoras;
          break;
      }
    });

    return metrics;
  }, [escalasFiltradas, contratoItens]);

  // Carregar apenas dados auxiliares (contratos, unidades, itens)
  const loadAuxiliaryData = async () => {
    try {
      const [{ data: contr }, { data: unid }, { data: itens }, { data: contrItens }] =
        await Promise.all([
          supabase.from("contratos").select("*").eq("ativo", true),
          supabase
            .from("unidades_hospitalares")
            .select("*")
            .eq("ativo", true)
            .order("codigo"),
          supabase.from("itens_contrato").select("*").eq("ativo", true),
          supabase.from("contrato_itens").select("*"),
        ]);

      // Filtrar contratos para administrador-terceiro
      let contratosDisponiveis = contr || [];
      if (isAdminTerceiro && userContratoIds.length > 0) {
        contratosDisponiveis = contratosDisponiveis.filter(
          (contrato) => userContratoIds.includes(contrato.id)
        );
      }

      setContratos(contratosDisponiveis);
      setUnidades(unid || []);
      setTodosItensContrato(itens || []);
      setContratoItens(contrItens || []);
    } catch (err: any) {
      console.error("Erro ao carregar dados auxiliares:", err);
    }
  };

  // Buscar escalas com filtro de datas obrigatório
  // Clear all filters and data
  const handleClearFilters = () => {
    // Clear all filters
    setFiltroParceiro([]);
    setFiltroContrato([]);
    setFiltroUnidade([]);
    setFiltroNome([]);
    setFiltroCpf([]);
    setFiltroStatus([]);
    setFiltroDataInicio(null);
    setFiltroDataFim(null);

    // Clear data
    setEscalas([]);
    setEscalasFiltradas([]);
    setBuscaRealizada(false);

    // Clear sessionStorage
    const escalasKeys = Object.keys(sessionStorage).filter(k => k.startsWith('escalas_'));
    escalasKeys.forEach(k => sessionStorage.removeItem(k));

    setError("");
    setSuccess("Filtros limpos com sucesso!");
    setTimeout(() => setSuccess(""), 3000);
  };

  const handleBuscarEscalas = async () => {
    // Validar datas obrigatórias
    if (!filtroDataInicio || !filtroDataFim) {
      setError(
        "Por favor, selecione uma data de início e uma data de fim para buscar as escalas."
      );
      return;
    }

    if (filtroDataInicio > filtroDataFim) {
      setError("A data de início não pode ser maior que a data de fim.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const dataInicioFormatada = format(filtroDataInicio, "yyyy-MM-dd");
      const dataFimFormatada = format(filtroDataFim, "yyyy-MM-dd");

      const { data: escal, error: escalasError } = await supabase
        .from("escalas_medicas")
        .select("*")
        .gte("data_inicio", dataInicioFormatada)
        .lte("data_inicio", dataFimFormatada)
        .order("data_inicio", { ascending: false });

      if (escalasError) throw escalasError;

      let escalasParaExibir = escal || [];

      // Aplicar filtros baseados no tipo de usuário
      if (isAdminTerceiro && userContratoIds.length > 0) {
        // Administrador-terceiro: mostrar apenas escalas de contratos vinculados
        escalasParaExibir = escalasParaExibir.filter(
          (escala) => userContratoIds.includes(escala.contrato_id)
        );
      } else if (isTerceiro && userProfile?.cpf) {
        // Terceiro: mostrar apenas escalas onde seu CPF está na lista de médicos
        escalasParaExibir = escalasParaExibir.filter((escala) =>
          escala.medicos.some((medico) => medico.cpf === userProfile.cpf)
        );
      }

      setEscalas(escalasParaExibir);
      setBuscaRealizada(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadUsuariosByContrato = async (contratoId: string) => {
    setLoadingUsuarios(true);
    try {
      console.log("Carregando usuários para o contrato:", contratoId);

      const { data: usuariosData, error: usuariosError } = await supabase
        .from("usuarios")
        .select("*")
        .eq("contrato_id", contratoId)
        .eq("tipo", "terceiro");

      if (usuariosError) {
        console.error("Erro ao buscar usuários:", usuariosError);
        setError("Erro ao carregar dados dos médicos");
        setUsuarios([]);
        return;
      }

      console.log("Usuários encontrados:", usuariosData);

      if (!usuariosData || usuariosData.length === 0) {
        console.warn("Nenhum médico vinculado a este contrato");
        setUsuarios([]);
        return;
      }

      setUsuarios(usuariosData);
    } catch (err: any) {
      console.error("Erro ao carregar usuários:", err);
      setError("Erro inesperado ao carregar médicos");
      setUsuarios([]);
    } finally {
      setLoadingUsuarios(false);
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
        formData.data_inicio.length === 0 ||
        !formData.horario_entrada ||
        !formData.horario_saida
      ) {
        setError("Preencha todos os campos obrigatórios");
        return;
      }
      if (!formData.medicos_selecionados || formData.medicos_selecionados.length === 0) {
        setError("Selecione pelo menos um médico");
        return;
      }

      // Preparar preview
      const contrato = contratos.find((c) => c.id === formData.contrato_id);
      const medicos: MedicoEscala[] = formData.medicos_selecionados.map(medico => ({
        nome: medico.nome,
        cpf: medico.cpf,
      }));

      setPreviewData({ contrato: contrato || null, medicos });
      setError("");
    }

    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  // Função auxiliar para verificar sobreposição de horários
  const checkTimeOverlap = (
    start1: string,
    end1: string,
    start2: string,
    end2: string
  ): boolean => {
    // Converter strings de horário (HH:mm ou HH:mm:ss) para minutos
    const timeToMinutes = (time: string): number => {
      const [hours, minutes] = time.split(":").map(Number);
      return hours * 60 + minutes;
    };

    const start1Min = timeToMinutes(start1);
    const end1Min = timeToMinutes(end1);
    const start2Min = timeToMinutes(start2);
    const end2Min = timeToMinutes(end2);

    // Ajustar horários que atravessam meia-noite
    const end1Adjusted = end1Min < start1Min ? end1Min + 1440 : end1Min;
    const end2Adjusted = end2Min < start2Min ? end2Min + 1440 : end2Min;
    const start2Adjusted = start2Min;

    // Se o horário 2 cruza meia-noite, precisamos verificar dois cenários
    if (end2Min < start2Min) {
      // Cenário 1: comparar com a parte do horário 2 que vai até meia-noite
      const overlap1 =
        (start1Min < 1440 && start2Min < 1440) &&
        (start1Min < 1440 && end1Adjusted > start2Min);

      // Cenário 2: comparar com a parte do horário 2 após meia-noite (0 até end2Min)
      const overlap2 =
        (start1Min < end2Min || end1Min < end2Min) ||
        (start1Min === 0 && end1Min > 0);

      if (overlap1 || overlap2) return true;
    }

    // Se o horário 1 cruza meia-noite, precisamos verificar dois cenários
    if (end1Min < start1Min) {
      // Cenário 1: comparar com a parte do horário 1 que vai até meia-noite
      const overlap1 =
        (start2Min < 1440 && start1Min < 1440) &&
        (start2Min < 1440 && end2Adjusted > start1Min);

      // Cenário 2: comparar com a parte do horário 1 após meia-noite (0 até end1Min)
      const overlap2 =
        (start2Min < end1Min || end2Min < end1Min) ||
        (start2Min === 0 && end2Min > 0);

      if (overlap1 || overlap2) return true;
    }

    // Caso padrão: nenhum horário cruza meia-noite
    // Há sobreposição se: start1 < end2 E end1 > start2
    return start1Min < end2Adjusted && end1Adjusted > start2Min;
  };

  // Função para verificar conflitos de agendamento
  const checkConflictingSchedules = async (
    cpf: string,
    dataInicio: string,
    horarioEntrada: string,
    horarioSaida: string,
    excludeEscalaId?: string
  ): Promise<{ hasConflict: boolean; conflictDetails?: string }> => {
    try {
      // Buscar todas as escalas para o mesmo CPF na mesma data
      let query = supabase
        .from("escalas_medicas")
        .select("*")
        .eq("data_inicio", dataInicio);

      // Se estiver editando, excluir a escala atual da verificação
      if (excludeEscalaId) {
        query = query.neq("id", excludeEscalaId);
      }

      const { data: escalasExistentes, error } = await query;

      if (error) throw error;

      if (!escalasExistentes || escalasExistentes.length === 0) {
        return { hasConflict: false };
      }

      // Verificar se alguma escala existente tem o mesmo CPF
      for (const escala of escalasExistentes) {
        const medicosComCpf = escala.medicos.filter(
          (medico: MedicoEscala) => medico.cpf === cpf
        );

        if (medicosComCpf.length > 0) {
          // Verificar se há sobreposição de horários
          const hasOverlap = checkTimeOverlap(
            horarioEntrada,
            horarioSaida,
            escala.horario_entrada,
            escala.horario_saida
          );

          if (hasOverlap) {
            const medico = medicosComCpf[0];
            return {
              hasConflict: true,
              conflictDetails: `O médico ${medico.nome} (CPF: ${cpf}) já possui um agendamento no dia ${format(
                parseISO(dataInicio),
                "dd/MM/yyyy"
              )} das ${escala.horario_entrada.substring(0, 5)} às ${escala.horario_saida.substring(
                0,
                5
              )}, que conflita com o horário ${horarioEntrada.substring(0, 5)} às ${horarioSaida.substring(0, 5)}.`,
            };
          }
        }
      }

      return { hasConflict: false };
    } catch (err: any) {
      console.error("Erro ao verificar conflitos:", err);
      throw new Error("Erro ao verificar conflitos de agendamento");
    }
  };

  const handleSave = async () => {
    try {
      setError("");
      setSuccess("");

      // Define o status inicial baseado no tipo de usuário
      // Admin-Agir cria com "Programado", Admin-Terceiro cria com "Pré-Agendado"
      const statusInicial = isAdminAgir ? "Programado" : "Pré-Agendado";

      const horarioEntrada = format(formData.horario_entrada!, "HH:mm:ss");
      const horarioSaida = format(formData.horario_saida!, "HH:mm:ss");

      if (editingEscala) {
        // When editing, use the first date from the array (or keep single date logic)
        const escalaMedica = {
          contrato_id: formData.contrato_id,
          item_contrato_id: formData.item_contrato_id,
          data_inicio: format(formData.data_inicio[0], "yyyy-MM-dd"),
          horario_entrada: horarioEntrada,
          horario_saida: horarioSaida,
          medicos: previewData.medicos,
          observacoes: formData.observacoes || null,
          status: statusInicial as StatusEscala,
        };

        // Verificar conflitos de agendamento para cada médico
        for (const medico of previewData.medicos) {
          const conflictCheck = await checkConflictingSchedules(
            medico.cpf,
            escalaMedica.data_inicio,
            escalaMedica.horario_entrada,
            escalaMedica.horario_saida,
            editingEscala?.id
          );

          if (conflictCheck.hasConflict) {
            setError(conflictCheck.conflictDetails || "Conflito de agendamento detectado.");
            return;
          }
        }

        const { error: updateError } = await supabase
          .from("escalas_medicas")
          .update(escalaMedica)
          .eq("id", editingEscala.id);

        if (updateError) throw updateError;
        setSuccess("Escala atualizada com sucesso!");
      } else {
        // When creating new, create one escala for each date-doctor combination
        const escalasToCreate = [];
        const conflictErrors = [];

        // Loop through each date
        for (const dataInicio of formData.data_inicio) {
          const dataInicioFormatada = format(dataInicio, "yyyy-MM-dd");

          // Loop through each doctor
          for (const medico of previewData.medicos) {
            // Check conflict for this specific doctor on this specific date
            const conflictCheck = await checkConflictingSchedules(
              medico.cpf,
              dataInicioFormatada,
              horarioEntrada,
              horarioSaida
            );

            if (conflictCheck.hasConflict) {
              conflictErrors.push(conflictCheck.conflictDetails);
            } else {
              // No conflict - create individual escala for this doctor on this date
              escalasToCreate.push({
                contrato_id: formData.contrato_id,
                item_contrato_id: formData.item_contrato_id,
                data_inicio: dataInicioFormatada,
                horario_entrada: horarioEntrada,
                horario_saida: horarioSaida,
                medicos: [medico], // Only this one doctor
                observacoes: formData.observacoes || null,
                status: statusInicial as StatusEscala,
              });
            }
          }
        }

        // Se nenhuma escala foi criada devido a conflitos, mostrar erro
        if (escalasToCreate.length === 0 && conflictErrors.length > 0) {
          setError(conflictErrors.join("\n"));
          return;
        }

        // Inserir todas as escalas (pode haver algumas com conflitos que foram puladas)
        if (escalasToCreate.length > 0) {
          const { error: insertError } = await supabase
            .from("escalas_medicas")
            .insert(escalasToCreate);

          if (insertError) throw insertError;

          const numEscalas = escalasToCreate.length;
          const numDates = formData.data_inicio.length;
          const numDoctors = previewData.medicos.length;
          let successMessage = `${numEscalas} escala${numEscalas > 1 ? 's' : ''} criada${numEscalas > 1 ? 's' : ''} com sucesso! (${numDates} data${numDates > 1 ? 's' : ''} × ${numDoctors} médico${numDoctors > 1 ? 's' : ''})`;

          // Se houve conflitos mas algumas escalas foram criadas, avisar
          if (conflictErrors.length > 0) {
            successMessage += `\n\nAtenção: ${conflictErrors.length} combinação${conflictErrors.length > 1 ? 'ões' : ''} foi${conflictErrors.length > 1 ? 'ram' : ''} ignorada${conflictErrors.length > 1 ? 's' : ''} devido a conflitos:\n${conflictErrors.join("\n")}`;
          }

          setSuccess(successMessage);
        }
      }

      handleCloseDialog();
      handleBuscarEscalas();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleOpenDialog = async (escala?: EscalaMedica) => {
    if (escala) {
      // Bloquear edição baseado no tipo de usuário e status
      const canEditStatus = isAdminTerceiro
        ? escala.status === "Programado" || escala.status === "Pré-Agendado" || escala.status === "Atenção"
        : escala.status === "Programado" || escala.status === "Pré-Agendado";

      if (!canEditStatus) {
        const allowedStatuses = isAdminTerceiro
          ? '"Programado", "Pré-Agendado" ou "Atenção"'
          : '"Programado" ou "Pré-Agendado"';
        setError(
          `Não é possível editar uma escala com status "${escala.status}". Apenas escalas com status ${allowedStatuses} podem ser editadas.`
        );
        return;
      }

      // Bloquear edição para administrador-terceiro se não for do seu contrato
      if (isAdminTerceiro && userContratoIds.length > 0 && !userContratoIds.includes(escala.contrato_id)) {
        setError(
          "Você não tem permissão para editar escalas de outros contratos."
        );
        return;
      }

      setEditingEscala(escala);

      // Find associated contract
      const contratoAssociado = contratos.find(
        (c) => c.id === escala.contrato_id
      );

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

      // Get the first (and only) medico from escala
      const medicoEscalado = escala.medicos[0]
        ? medicosUsuarios.find((u) => u.cpf === escala.medicos[0].cpf)
        : null;

      // Parse date using parseISO to avoid timezone issues
      const dataInicio = parseISO(escala.data_inicio);

      // Parse time strings (format "HH:mm:ss") to Date objects
      const [horaE, minE] = escala.horario_entrada.split(":").map(Number);
      const [horaS, minS] = escala.horario_saida.split(":").map(Number);

      const horarioEntrada = new Date();
      horarioEntrada.setHours(horaE, minE, 0, 0);

      const horarioSaida = new Date();
      horarioSaida.setHours(horaS, minS, 0, 0);

      // Populate form with escala data
      // Map all medicos from the escala to the medicos_selecionados
      const medicosEscalados = escala.medicos
        .map(m => medicosUsuarios.find(u => u.cpf === m.cpf))
        .filter(u => u !== undefined) as Usuario[];

      setFormData({
        contrato_id: escala.contrato_id,
        item_contrato_id: escala.item_contrato_id,
        data_inicio: [dataInicio],
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
        data_inicio: [],
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
    // Bloquear exclusão se status não for "Programado" ou "Pré-Agendado"
    if (escala.status !== "Programado" && escala.status !== "Pré-Agendado") {
      setError(
        `Não é possível excluir uma escala com status "${escala.status}". Apenas escalas com status "Programado" ou "Pré-Agendado" podem ser excluídas.`
      );
      return;
    }

    // Bloquear exclusão para administrador-terceiro se não for do seu contrato
    if (isAdminTerceiro && userContratoIds.length > 0 && !userContratoIds.includes(escala.contrato_id)) {
      setError(
        "Você não tem permissão para excluir escalas de outros contratos."
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
      handleBuscarEscalas();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRecalcularStatus = async () => {
    if (
      !window.confirm(
        "Deseja recalcular automaticamente o status de todas as escalas não finalizadas com base nos registros de acesso?"
      )
    )
      return;

    try {
      setRecalculando(true);
      setError("");
      setSuccess("");

      const resultado = await recalcularStatusEscalas();

      if (resultado.success) {
        setSuccess(resultado.mensagem);
        handleBuscarEscalas(); // Recarregar os dados
      } else {
        setError(resultado.mensagem);
      }
    } catch (err: any) {
      setError(`Erro ao recalcular status: ${err.message}`);
    } finally {
      setRecalculando(false);
    }
  };

  // Funções auxiliares para Status
  const getStatusConfig = (status: StatusEscala) => {
    const configs = {
      "Pré-Agendado": {
        color: "default" as const,
        icon: <Schedule />,
        label: "Pré-Agendado",
      },
      Programado: {
        color: "info" as const,
        icon: <HourglassEmpty />,
        label: "Programado",
      },
      "Pré-Aprovado": {
        color: "warning" as const,
        icon: <ThumbUpAlt />,
        label: "Pré-Aprovado",
      },
      "Aprovação Parcial": {
        color: "warning" as const,
        icon: <HowToReg />,
        label: "Aprovação Parcial",
      },
      Atenção: {
        color: "error" as const,
        icon: <Warning />,
        label: "Atenção",
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
    // Bloquear alteração de status se já estiver Aprovado ou Reprovado (finalizados)
    if (escala.status === "Aprovado" || escala.status === "Reprovado") {
      setError(
        `Não é possível alterar o status. A escala já está ${escala.status.toLowerCase()}. Apenas escalas não finalizadas podem ter o status alterado.`
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
      handleBuscarEscalas();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Bulk selection functions
  const handleToggleSelection = (escalaId: number, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedEscalas((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(escalaId)) {
        newSet.delete(escalaId);
      } else {
        newSet.add(escalaId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    // Only select escalas that can have status changed (not Aprovado or Reprovado)
    const selectableEscalas = escalasFiltradas.filter(
      (e) => e.status !== "Aprovado" && e.status !== "Reprovado"
    );
    setSelectedEscalas(new Set(selectableEscalas.map((e) => e.id)));
  };

  const handleDeselectAll = () => {
    setSelectedEscalas(new Set());
  };

  const handleOpenBulkStatusDialog = () => {
    if (selectedEscalas.size === 0) {
      setError("Selecione pelo menos uma escala");
      return;
    }
    setBulkStatusDialogOpen(true);
  };

  const handleCloseBulkStatusDialog = () => {
    setBulkStatusDialogOpen(false);
    setBulkStatus("Aprovado");
    setBulkJustificativa("");
  };

  const handleBulkStatusUpdate = async () => {
    try {
      // Validar justificativa obrigatória para status "Reprovado"
      if (bulkStatus === "Reprovado" && !bulkJustificativa.trim()) {
        setError("Justificativa é obrigatória para status Reprovado");
        return;
      }

      // Filter out escalas that are already Aprovado or Reprovado
      const escalasToUpdate = Array.from(selectedEscalas).filter((id) => {
        const escala = escalas.find((e) => e.id === id);
        return escala && escala.status !== "Aprovado" && escala.status !== "Reprovado";
      });

      if (escalasToUpdate.length === 0) {
        setError("Nenhuma escala válida selecionada para atualização");
        return;
      }

      setLoading(true);

      // Update all selected escalas
      const { error: updateError } = await supabase
        .from("escalas_medicas")
        .update({
          status: bulkStatus,
          justificativa: bulkJustificativa.trim() || null,
          status_alterado_por: userProfile?.id || null,
          status_alterado_em: new Date().toISOString(),
        })
        .in("id", escalasToUpdate);

      if (updateError) throw updateError;

      setSuccess(
        `${escalasToUpdate.length} escala${
          escalasToUpdate.length > 1 ? "s atualizadas" : " atualizada"
        } com sucesso!`
      );
      handleCloseBulkStatusDialog();
      handleDeselectAll();
      handleBuscarEscalas();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Funções para Details Dialog
  const handleOpenDetailsDialog = async (escala: EscalaMedica) => {
    setEscalaDetalhes(escala);
    setLoadingDetalhes(true);
    setDetailsDialogOpen(true);

    try {
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

      // Buscar CPF do médico (primeiro médico da escala)
      const medicoCPF = escala.medicos[0]?.cpf;
      if (!medicoCPF) {
        setLoadingDetalhes(false);
        return;
      }

      // Formatar data da escala
      const dataEscala = format(parseISO(escala.data_inicio), "yyyy-MM-dd");

      // Verificar se a escala atravessa meia-noite
      const [horaE, minE] = escala.horario_entrada.split(":").map(Number);
      const [horaS, minS] = escala.horario_saida.split(":").map(Number);
      const minutosEntrada = horaE * 60 + minE;
      const minutosSaida = horaS * 60 + minS;
      const atravessaMeiaNoite = minutosSaida < minutosEntrada;

      // Buscar acessos do médico - considerar dois dias se atravessa meia-noite
      let acessos: any[] = [];

      if (atravessaMeiaNoite) {
        // Buscar acessos de dois dias
        const diaSeguinte = new Date(parseISO(escala.data_inicio));
        diaSeguinte.setDate(diaSeguinte.getDate() + 1);
        const diaSeguinteFormatado = format(diaSeguinte, "yyyy-MM-dd");

        const { data: acessosDia1, error: error1 } = await supabase
          .from("acessos")
          .select("*")
          .eq("cpf", medicoCPF)
          .gte("data_acesso", `${dataEscala}T00:00:00`)
          .lte("data_acesso", `${dataEscala}T23:59:59`)
          .order("data_acesso", { ascending: true });

        const { data: acessosDia2, error: error2 } = await supabase
          .from("acessos")
          .select("*")
          .eq("cpf", medicoCPF)
          .gte("data_acesso", `${diaSeguinteFormatado}T00:00:00`)
          .lte("data_acesso", `${diaSeguinteFormatado}T23:59:59`)
          .order("data_acesso", { ascending: true });

        if (!error1 && !error2) {
          acessos = [...(acessosDia1 || []), ...(acessosDia2 || [])];
        }
      } else {
        // Buscar acessos de um único dia
        const { data: acessosData, error: acessosError } = await supabase
          .from("acessos")
          .select("*")
          .eq("cpf", medicoCPF)
          .gte("data_acesso", `${dataEscala}T00:00:00`)
          .lte("data_acesso", `${dataEscala}T23:59:59`)
          .order("data_acesso", { ascending: true });

        if (!acessosError && acessosData) {
          acessos = acessosData;
        }
      }

      setAcessosMedico(acessos);

      // Buscar produtividade do médico no dia
      const { data: produtividade, error: prodError } = await supabase
        .from("produtividade")
        .select("*")
        .eq("data", dataEscala)
        .ilike("nome", `%${escala.medicos[0].nome}%`)
        .maybeSingle();

      if (!prodError && produtividade) {
        setProdutividadeMedico(produtividade);
      } else {
        setProdutividadeMedico(null);
      }
    } catch (err) {
      console.error("Erro ao carregar detalhes:", err);
    } finally {
      setLoadingDetalhes(false);
    }
  };

  const handleCloseDetailsDialog = () => {
    setDetailsDialogOpen(false);
  };

  // Funções de Exportação
  const exportarCSV = () => {
    try {
      if (escalasFiltradas.length === 0) {
        setError("Nenhuma escala filtrada para exportar");
        return;
      }

      // Criar cabeçalho CSV
      const headers = [
        "Data",
        "Horário Entrada",
        "Horário Saída",
        "Contrato",
        "Parceiro",
        "Unidade",
        "Item Contrato",
        "Status",
        "Médicos",
        "CPFs",
        "Observações",
        "Justificativa",
        "Alterado Por",
        "Data Alteração",
      ];

      // Criar linhas CSV
      const linhas = escalasFiltradas.map((escala) => {
        const contrato = contratos.find((c) => c.id === escala.contrato_id);
        const unidade = unidades.find(
          (u) => u.id === contrato?.unidade_hospitalar_id
        );
        const itemContrato = todosItensContrato.find(
          (i) => i.id === escala.item_contrato_id
        );
        const medicos = escala.medicos.map((m) => m.nome).join("; ");
        const cpfs = escala.medicos.map((m) => m.cpf).join("; ");

        return [
          format(parseISO(escala.data_inicio), "dd/MM/yyyy"),
          escala.horario_entrada.substring(0, 5),
          escala.horario_saida.substring(0, 5),
          contrato?.nome || "N/A",
          contrato?.empresa || "N/A",
          unidade?.nome || "N/A",
          itemContrato?.nome || "N/A",
          escala.status,
          medicos,
          cpfs,
          escala.observacoes || "",
          escala.justificativa || "",
          escala.status_alterado_por || "",
          escala.status_alterado_em
            ? format(parseISO(escala.status_alterado_em), "dd/MM/yyyy HH:mm")
            : "",
        ];
      });

      // Criar conteúdo CSV
      const csvContent = [
        headers.join(","),
        ...linhas.map((linha) => linha.map((campo) => `"${campo}"`).join(",")),
      ].join("\n");

      // Download CSV
      const blob = new Blob(["\ufeff" + csvContent], {
        type: "text/csv;charset=utf-8;",
      });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `escalas_medicas_${format(new Date(), "yyyy-MM-dd_HHmmss")}.csv`
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setSuccess(
        `${escalasFiltradas.length} escala(s) exportada(s) com sucesso!`
      );
    } catch (err: any) {
      setError("Erro ao exportar CSV: " + err.message);
    }
  };

  // CSV Import Functions
  const handleOpenCsvDialog = () => {
    setCsvDialogOpen(true);
    setCsvFile(null);
    setCsvErrors([]);
    setCsvPreviewData([]);
  };

  const handleCloseCsvDialog = () => {
    setCsvDialogOpen(false);
    setCsvFile(null);
    setCsvErrors([]);
    setCsvPreviewData([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setCsvFile(file);
      setCsvErrors([]);
    }
  };

  const handleProcessCsv = async () => {
    if (!csvFile) {
      setCsvErrors(["Nenhum arquivo selecionado"]);
      return;
    }

    setImportingCsv(true);
    setCsvErrors([]);

    try {
      Papa.parse(csvFile, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const errors: string[] = [];
          const previewData: Array<{
            cpf: string;
            nome: string;
            data_inicio: string;
            horario_entrada: string;
            horario_saida: string;
          }> = [];

          // Validar colunas obrigatórias
          const requiredColumns = ["cpf", "data_inicio", "horario_entrada", "horario_saida"];
          const headers = results.meta.fields || [];
          const missingColumns = requiredColumns.filter(col => !headers.includes(col));

          if (missingColumns.length > 0) {
            errors.push(`Colunas obrigatórias ausentes: ${missingColumns.join(", ")}`);
            setCsvErrors(errors);
            setImportingCsv(false);
            return;
          }

          // Validar cada linha
          for (let i = 0; i < results.data.length; i++) {
            const row: any = results.data[i];
            const lineNumber = i + 2; // +2 porque tem header e índice começa em 0

            // Validar CPF
            const cpf = row.cpf?.toString().trim();
            if (!cpf) {
              errors.push(`Linha ${lineNumber}: CPF não informado`);
              continue;
            }

            // Validar formato de CPF (8 a 13 dígitos numéricos)
            const cpfLimpo = cpf.replace(/\D/g, "");
            if (cpfLimpo.length < 8 || cpfLimpo.length > 13) {
              errors.push(`Linha ${lineNumber}: CPF "${cpf}" em formato inválido (deve ter entre 8 e 13 dígitos)`);
              continue;
            }

            // Buscar médico no banco
            const { data: usuario, error: userError } = await supabase
              .from("usuarios")
              .select("nome, cpf")
              .eq("cpf", cpfLimpo)
              .single();

            if (userError || !usuario) {
              errors.push(`Linha ${lineNumber}: CPF "${cpf}" não encontrado na base de usuários`);
              continue;
            }

            // Validar data_inicio (formato YYYY-MM-DD)
            const dataInicio = row.data_inicio?.toString().trim();
            if (!dataInicio) {
              errors.push(`Linha ${lineNumber}: data_inicio não informada`);
              continue;
            }

            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(dataInicio)) {
              errors.push(`Linha ${lineNumber}: data_inicio "${dataInicio}" em formato inválido (use YYYY-MM-DD)`);
              continue;
            }

            // Validar se é uma data válida
            const dataParsed = parseISO(dataInicio);
            if (isNaN(dataParsed.getTime())) {
              errors.push(`Linha ${lineNumber}: data_inicio "${dataInicio}" é uma data inválida`);
              continue;
            }

            // Validar horario_entrada (formato HH:MM ou HH:MM:SS)
            const horarioEntrada = row.horario_entrada?.toString().trim();
            if (!horarioEntrada) {
              errors.push(`Linha ${lineNumber}: horario_entrada não informado`);
              continue;
            }

            const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
            if (!timeRegex.test(horarioEntrada)) {
              errors.push(`Linha ${lineNumber}: horario_entrada "${horarioEntrada}" em formato inválido (use HH:MM ou HH:MM:SS)`);
              continue;
            }

            // Normalizar para HH:MM (remover segundos se existirem)
            const horarioEntradaNormalizado = horarioEntrada.substring(0, 5);

            // Validar horario_saida (formato HH:MM ou HH:MM:SS)
            const horarioSaida = row.horario_saida?.toString().trim();
            if (!horarioSaida) {
              errors.push(`Linha ${lineNumber}: horario_saida não informado`);
              continue;
            }

            if (!timeRegex.test(horarioSaida)) {
              errors.push(`Linha ${lineNumber}: horario_saida "${horarioSaida}" em formato inválido (use HH:MM ou HH:MM:SS)`);
              continue;
            }

            // Normalizar para HH:MM (remover segundos se existirem)
            const horarioSaidaNormalizado = horarioSaida.substring(0, 5);

            // Verificar conflitos com agendamentos existentes no banco de dados
            const conflictCheck = await checkConflictingSchedules(
              cpfLimpo,
              dataInicio,
              horarioEntradaNormalizado + ":00",
              horarioSaidaNormalizado + ":00"
            );

            if (conflictCheck.hasConflict) {
              errors.push(`Linha ${lineNumber}: ${conflictCheck.conflictDetails}`);
              continue;
            }

            // Verificar conflitos com outras linhas do CSV já validadas
            const conflitoDentroCsv = previewData.find((prev) => {
              if (prev.cpf === cpfLimpo && prev.data_inicio === dataInicio) {
                return checkTimeOverlap(
                  horarioEntradaNormalizado + ":00",
                  horarioSaidaNormalizado + ":00",
                  prev.horario_entrada + ":00",
                  prev.horario_saida + ":00"
                );
              }
              return false;
            });

            if (conflitoDentroCsv) {
              errors.push(
                `Linha ${lineNumber}: Conflito detectado dentro do CSV. O médico ${usuario.nome} (CPF: ${cpfLimpo}) já possui outro agendamento no mesmo arquivo para o dia ${format(
                  parseISO(dataInicio),
                  "dd/MM/yyyy"
                )} das ${conflitoDentroCsv.horario_entrada} às ${conflitoDentroCsv.horario_saida}.`
              );
              continue;
            }

            // Se chegou aqui, linha está válida
            previewData.push({
              cpf: cpfLimpo,
              nome: usuario.nome,
              data_inicio: dataInicio,
              horario_entrada: horarioEntradaNormalizado,
              horario_saida: horarioSaidaNormalizado,
            });
          }

          if (errors.length > 0) {
            setCsvErrors(errors);
            setImportingCsv(false);
            return;
          }

          if (previewData.length === 0) {
            setCsvErrors(["Nenhum dado válido encontrado no arquivo"]);
            setImportingCsv(false);
            return;
          }

          // Tudo válido, mostrar preview
          setCsvPreviewData(previewData);
          setCsvDialogOpen(false);
          setCsvPreviewOpen(true);
          setImportingCsv(false);
        },
        error: (error) => {
          setCsvErrors([`Erro ao processar arquivo: ${error.message}`]);
          setImportingCsv(false);
        },
      });
    } catch (err: any) {
      setCsvErrors([`Erro inesperado: ${err.message}`]);
      setImportingCsv(false);
    }
  };

  const handleConfirmCsvImport = async () => {
    if (!formData.contrato_id || !formData.item_contrato_id) {
      setError("Contrato e item do contrato devem estar selecionados");
      return;
    }

    setImportingCsv(true);

    try {
      // Verificação final de conflitos antes de inserir (safety check)
      const conflictErrors: string[] = [];
      for (let i = 0; i < csvPreviewData.length; i++) {
        const row = csvPreviewData[i];
        const conflictCheck = await checkConflictingSchedules(
          row.cpf,
          row.data_inicio,
          row.horario_entrada + ":00",
          row.horario_saida + ":00"
        );

        if (conflictCheck.hasConflict) {
          conflictErrors.push(`Linha ${i + 1}: ${conflictCheck.conflictDetails}`);
        }

        // Verificar conflitos dentro do próprio lote de importação
        for (let j = 0; j < i; j++) {
          const prevRow = csvPreviewData[j];
          if (prevRow.cpf === row.cpf && prevRow.data_inicio === row.data_inicio) {
            const hasOverlap = checkTimeOverlap(
              row.horario_entrada + ":00",
              row.horario_saida + ":00",
              prevRow.horario_entrada + ":00",
              prevRow.horario_saida + ":00"
            );

            if (hasOverlap) {
              conflictErrors.push(
                `Conflito detectado entre linhas ${j + 1} e ${i + 1}: O médico ${row.nome} (CPF: ${row.cpf}) possui agendamentos conflitantes no dia ${format(
                  parseISO(row.data_inicio),
                  "dd/MM/yyyy"
                )}.`
              );
            }
          }
        }
      }

      if (conflictErrors.length > 0) {
        setError(
          "Conflitos detectados na importação:\n" + conflictErrors.join("\n")
        );
        setImportingCsv(false);
        return;
      }

      // Define o status inicial baseado no tipo de usuário
      // Admin-Agir cria com "Programado", Admin-Terceiro cria com "Pré-Agendado"
      const statusInicial = isAdminAgir ? "Programado" : "Pré-Agendado";

      // Preparar escalas para inserção
      const escalasParaInserir = csvPreviewData.map((row) => ({
        contrato_id: formData.contrato_id,
        item_contrato_id: formData.item_contrato_id,
        data_inicio: row.data_inicio,
        horario_entrada: row.horario_entrada,
        horario_saida: row.horario_saida,
        medicos: [{ nome: row.nome, cpf: row.cpf }],
        observacoes: null,
        status: statusInicial as StatusEscala,
        justificativa: null,
        status_alterado_por: null,
        status_alterado_em: null,
        ativo: true,
        created_by: userProfile?.id || null,
      }));

      // Inserir todas as escalas
      const { error: insertError } = await supabase
        .from("escalas_medicas")
        .insert(escalasParaInserir);

      if (insertError) {
        throw insertError;
      }

      setSuccess(`${csvPreviewData.length} escala(s) importada(s) com sucesso!`);
      setCsvPreviewOpen(false);
      setCsvPreviewData([]);
      setCsvFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      // Recarregar escalas
      await handleBuscarEscalas();

      // Fechar dialog de nova escala
      handleCloseDialog();
    } catch (err: any) {
      console.error("Erro ao importar escalas:", err);
      setError(`Erro ao importar escalas: ${err.message}`);
    } finally {
      setImportingCsv(false);
    }
  };

  const handleCancelCsvImport = () => {
    setCsvPreviewOpen(false);
    setCsvPreviewData([]);
    setCsvFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setCsvDialogOpen(true); // Voltar para o dialog de upload
  };

  const exportarPDF = async () => {
    try {
      if (escalasFiltradas.length === 0) {
        setError("Nenhuma escala filtrada para exportar");
        return;
      }

      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      // Cores do tema da aplicação
      const primaryColor = [14, 165, 233]; // #0ea5e9
      const secondaryColor = [139, 92, 246]; // #8b5cf6
      const goldColor = [251, 191, 36]; // #fbbf24

      // Header do PDF
      const pageWidth = doc.internal.pageSize.getWidth();

      // Gradiente simulado com retângulos
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, pageWidth, 35, "F");

      // Logo/Nome da aplicação
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.text("Parcer", 15, 15);

      doc.setTextColor(goldColor[0], goldColor[1], goldColor[2]);

      doc.text("IA", 42, 15);

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Gestão Inteligente de Acessos e Parcerias", 15, 22);

      // Título do relatório
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Relatório de Escalas Médicas", 15, 32);

      // Informações do relatório
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(255, 255, 255);
      const dataRelatorio = format(new Date(), "dd/MM/yyyy 'às' HH:mm", {
        locale: ptBR,
      });
      doc.text(`Gerado em: ${dataRelatorio}`, pageWidth - 15, 15, {
        align: "right",
      });
      doc.text(
        `Total de escalas: ${escalasFiltradas.length}`,
        pageWidth - 15,
        22,
        { align: "right" }
      );
      doc.text(`Powered by Daher.lab - Agir`, pageWidth - 15, 29, {
        align: "right",
      });

      // Preparar dados da tabela
      const tableData = escalasFiltradas.map((escala) => {
        const contrato = contratos.find((c) => c.id === escala.contrato_id);
        const unidade = unidades.find(
          (u) => u.id === contrato?.unidade_hospitalar_id
        );
        const itemContrato = todosItensContrato.find(
          (i) => i.id === escala.item_contrato_id
        );
        const medicos = escala.medicos.map((m) => m.nome).join("\n");

        return [
          format(parseISO(escala.data_inicio), "dd/MM/yyyy"),
          `${escala.horario_entrada.substring(
            0,
            5
          )} - ${escala.horario_saida.substring(0, 5)}`,
          contrato?.nome || "N/A",
          contrato?.empresa || "N/A",
          unidade?.nome || "N/A",
          itemContrato?.nome || "N/A",
          medicos,
          escala.status,
        ];
      });

      // Criar tabela
      autoTable(doc, {
        startY: 40,
        head: [
          [
            "Data",
            "Horário",
            "Contrato",
            "Parceiro",
            "Unidade",
            "Item",
            "Médicos",
            "Status",
          ],
        ],
        body: tableData,
        theme: "grid",
        headStyles: {
          fillColor: primaryColor,
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 9,
          halign: "center",
        },
        styles: {
          fontSize: 8,
          cellPadding: 3,
          overflow: "linebreak",
        },
        columnStyles: {
          0: { cellWidth: 22, halign: "center" },
          1: { cellWidth: 25, halign: "center" },
          2: { cellWidth: 40 },
          3: { cellWidth: 35 },
          4: { cellWidth: 35 },
          5: { cellWidth: 35 },
          6: { cellWidth: 45 },
          7: { cellWidth: 20, halign: "center" },
        },
        alternateRowStyles: {
          fillColor: [245, 247, 250],
        },
        margin: { left: 15, right: 15 },
      });

      // Calcular valor total das escalas aprovadas
      const calcularValorTotal = async () => {
        let valorTotal = 0;

        for (const escala of escalasFiltradas) {
          if (escala.status === "Aprovado") {
            try {
              // Buscar valor unitário do item de contrato
              const { data: contratoItens } = await supabase
                .from("contrato_itens")
                .select("valor_unitario, quantidade")
                .eq("contrato_id", escala.contrato_id)
                .eq("item_id", escala.item_contrato_id)
                .single();

              if (contratoItens && contratoItens.valor_unitario) {
                // Calcular duração da escala em horas
                const [horaE, minE] = escala.horario_entrada
                  .split(":")
                  .map(Number);
                const [horaS, minS] = escala.horario_saida
                  .split(":")
                  .map(Number);

                const minutosEntrada = horaE * 60 + minE;
                const minutosSaida = horaS * 60 + minS;

                // Se horário de saída é menor, passou da meia-noite
                const duracaoMinutos =
                  minutosSaida >= minutosEntrada
                    ? minutosSaida - minutosEntrada
                    : 1440 - minutosEntrada + minutosSaida;

                const duracaoHoras = duracaoMinutos / 60;

                // Multiplicar duração pelo valor unitário e número de médicos
                const valorEscala =
                  duracaoHoras *
                  contratoItens.valor_unitario *
                  escala.medicos.length;
                valorTotal += valorEscala;
              }
            } catch (error) {
              console.error("Erro ao calcular valor da escala:", error);
            }
          }
        }

        return valorTotal;
      };

      // Executar cálculo antes de gerar o PDF
      const valorTotalAprovadas = await calcularValorTotal();
      const escalasAprovadas = escalasFiltradas.filter(
        (e) => e.status === "Aprovado"
      );

      // Footer com numeração de páginas
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.text(
          `Página ${i} de ${pageCount}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: "center" }
        );

        // Adicionar valor total apenas na última página
        if (i === pageCount && escalasAprovadas.length > 0) {
          const pageHeight = doc.internal.pageSize.getHeight();

          // Box com informações das escalas aprovadas
          doc.setFillColor(46, 204, 113); // Verde para aprovadas
          doc.roundedRect(pageWidth - 110, pageHeight - 25, 95, 20, 3, 3, "F");

          doc.setTextColor(255, 255, 255);
          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.text("ESCALAS APROVADAS", pageWidth - 62.5, pageHeight - 19, {
            align: "center",
          });

          doc.setFontSize(9);
          doc.setFont("helvetica", "normal");
          doc.text(
            `Quantidade: ${escalasAprovadas.length} escala${
              escalasAprovadas.length !== 1 ? "s" : ""
            }`,
            pageWidth - 62.5,
            pageHeight - 14.5,
            { align: "center" }
          );

          // Valor total formatado
          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          const valorFormatado = valorTotalAprovadas.toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
          doc.text(
            `Valor Total: R$ ${valorFormatado}`,
            pageWidth - 62.5,
            pageHeight - 9,
            { align: "center" }
          );

          // Nota explicativa
          doc.setFontSize(7);
          doc.setTextColor(100, 100, 100);
          doc.setFont("helvetica", "italic");
          doc.text(
            "* Cálculo: Horas trabalhadas × Valor unitário × Número de médicos",
            15,
            pageHeight - 18
          );
        }
      }

      // Download PDF
      doc.save(
        `escalas_medicas_${format(new Date(), "yyyy-MM-dd_HHmmss")}.pdf`
      );

      setSuccess(`PDF gerado com ${escalasFiltradas.length} escala(s)!`);
    } catch (err: any) {
      setError("Erro ao gerar PDF: " + err.message);
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
          <Box sx={{ display: "flex", gap: 1 }}>
            <Tooltip title="Exportar dados filtrados em CSV">
              <Button
                variant="outlined"
                startIcon={<FileDownload />}
                onClick={exportarCSV}
                disabled={escalasFiltradas.length === 0}
                sx={{
                  height: 42,
                  borderColor: "primary.main",
                  color: "primary.main",
                  "&:hover": {
                    borderColor: "primary.dark",
                    bgcolor: "primary.50",
                  },
                }}
              >
                CSV
              </Button>
            </Tooltip>

            <Tooltip title="Exportar dados filtrados em PDF">
              <Button
                variant="outlined"
                startIcon={<PictureAsPdf />}
                onClick={exportarPDF}
                disabled={escalasFiltradas.length === 0}
                sx={{
                  height: 42,
                  borderColor: "error.main",
                  color: "error.main",
                  "&:hover": {
                    borderColor: "error.dark",
                    bgcolor: "error.50",
                  },
                }}
              >
                PDF
              </Button>
            </Tooltip>

            {isAdminAgir && (
              <Tooltip title="Recalcular status automaticamente baseado nos registros de acesso">
                <Button
                  variant="outlined"
                  startIcon={
                    recalculando ? (
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Refresh
                          sx={{
                            animation: "spin 1s linear infinite",
                            "@keyframes spin": {
                              "0%": {
                                transform: "rotate(0deg)",
                              },
                              "100%": {
                                transform: "rotate(360deg)",
                              },
                            },
                          }}
                        />
                      </Box>
                    ) : (
                      <Analytics />
                    )
                  }
                  onClick={handleRecalcularStatus}
                  disabled={recalculando}
                  sx={{
                    height: 42,
                    borderColor: "primary.main",
                    color: "primary.main",
                    "&:hover": {
                      borderColor: "primary.dark",
                      bgcolor: "primary.50",
                    },
                  }}
                >
                  {recalculando ? "Recalculando..." : "Recalcular Status"}
                </Button>
              </Tooltip>
            )}

            {!isTerceiro && (
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => handleOpenDialog()}
                sx={{
                  height: 42,
                  background: "linear-gradient(135deg, #0ea5e9 0%, #8b5cf6 100%)",
                  color: "white",
                  "&:hover": {
                    background:
                      "linear-gradient(135deg, #0284c7 0%, #7c3aed 100%)",
                  },
                }}
              >
                Nova Escala
              </Button>
            )}
          </Box>
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
              <Chip
                label="Datas obrigatórias"
                size="small"
                color="warning"
                sx={{ ml: 1 }}
              />
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
                  onChange={(_, newValue) =>
                    setFiltroStatus(newValue as StatusEscala[])
                  }
                  options={
                    [
                      "Pré-Agendado",
                      "Programado",
                      "Pré-Aprovado",
                      "Aprovação Parcial",
                      "Atenção",
                      "Aprovado",
                      "Reprovado",
                    ] as StatusEscala[]
                  }
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
                  label="Data Início *"
                  value={filtroDataInicio}
                  onChange={(newValue) => setFiltroDataInicio(newValue)}
                  slotProps={{
                    textField: {
                      size: "small",
                      fullWidth: true,
                      required: true,
                      error: !filtroDataInicio && buscaRealizada,
                      helperText:
                        !filtroDataInicio && buscaRealizada
                          ? "Campo obrigatório"
                          : "",
                    },
                  }}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <DatePicker
                  label="Data Fim *"
                  value={filtroDataFim}
                  onChange={(newValue) => setFiltroDataFim(newValue)}
                  slotProps={{
                    textField: {
                      size: "small",
                      fullWidth: true,
                      required: true,
                      error: !filtroDataFim && buscaRealizada,
                      helperText:
                        !filtroDataFim && buscaRealizada
                          ? "Campo obrigatório"
                          : "",
                    },
                  }}
                />
              </Grid>
            </Grid>

            {/* Botão de Busca */}
            <Box
              sx={{ mt: 3, display: "flex", justifyContent: "center", gap: 2 }}
            >
              <Button
                variant="contained"
                size="large"
                startIcon={
                  loading ? (
                    <CircularProgress size={20} sx={{ color: "white" }} />
                  ) : (
                    <Search />
                  )
                }
                onClick={handleBuscarEscalas}
                disabled={loading}
                sx={{
                  minWidth: 200,
                  background:
                    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  color: "white !important",
                  fontWeight: 600,
                  "&:hover": {
                    background:
                      "linear-gradient(135deg, #5568d3 0%, #63397d 100%)",
                  },
                  "&.Mui-disabled": {
                    background:
                      "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    color: "white !important",
                    opacity: 0.8,
                  },
                }}
              >
                {loading ? "Buscando..." : "Buscar Escalas"}
              </Button>

              {buscaRealizada && (
                <>
                  <Button
                    variant="outlined"
                    size="large"
                    startIcon={<Refresh />}
                    onClick={handleBuscarEscalas}
                    disabled={loading}
                  >
                    Atualizar
                  </Button>

                  <Button
                    variant="outlined"
                    size="large"
                    startIcon={<Close />}
                    onClick={handleClearFilters}
                    disabled={loading}
                    color="error"
                  >
                    Limpar Filtros
                  </Button>
                </>
              )}
            </Box>
          </CardContent>
        </Card>

        {/* Tela de Estado Vazio */}
        {!buscaRealizada ? (
          <Card
            sx={{
              textAlign: "center",
              py: 8,
              px: 4,
              background:
                "linear-gradient(135deg, #667eea15 0%, #764ba215 100%)",
            }}
          >
            <CalendarMonth
              sx={{ fontSize: 120, color: "primary.main", opacity: 0.3, mb: 3 }}
            />
            <Typography variant="h5" fontWeight={700} gutterBottom>
              Nenhuma busca realizada
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              Para visualizar as escalas médicas, selecione uma data de início e
              uma data de fim nos filtros acima e clique em "Buscar Escalas".
            </Typography>
            <Box
              sx={{ display: "flex", gap: 2, justifyContent: "center", mt: 4 }}
            >
              <Box
                sx={{
                  bgcolor: "background.paper",
                  p: 2,
                  borderRadius: 2,
                  boxShadow: 1,
                  flex: 1,
                }}
              >
                <Typography variant="body2" fontWeight={600} color="primary">
                  Passo 1
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Selecione as datas
                </Typography>
              </Box>
              <Box
                sx={{
                  bgcolor: "background.paper",
                  p: 2,
                  borderRadius: 2,
                  boxShadow: 1,
                  flex: 1,
                }}
              >
                <Typography variant="body2" fontWeight={600} color="primary">
                  Passo 2
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Clique em "Buscar Escalas"
                </Typography>
              </Box>
            </Box>
          </Card>
        ) : (
          <Box>
            {/* Scorecards de Métricas */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
              {/* Aprovado */}
              <Grid item xs={12} sm={6} md={3}>
                <Card
                  sx={{
                    position: "relative",
                    overflow: "hidden",
                    borderLeft: "4px solid #10b981",
                    transition: "all 0.3s",
                    "&:hover": {
                      boxShadow: "0 8px 24px rgba(16, 185, 129, 0.15)",
                      transform: "translateY(-2px)",
                    },
                  }}
                >
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                      <Box>
                        <Typography
                          variant="caption"
                          sx={{
                            color: "#6b7280",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                          }}
                        >
                          Aprovado
                        </Typography>
                        <Box display="flex" alignItems="baseline" gap={0.5} mt={0.5}>
                          <Typography
                            variant="h4"
                            sx={{
                              fontWeight: 700,
                              color: "#10b981",
                            }}
                          >
                            R$
                          </Typography>
                          <Typography
                            variant="h4"
                            sx={{
                              fontWeight: 700,
                              color: "#10b981",
                            }}
                          >
                            {scorecardMetrics.aprovado.valor.toLocaleString(
                              "pt-BR",
                              { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                            )}
                          </Typography>
                        </Box>
                      </Box>
                      <Box
                        sx={{
                          bgcolor: "#ecfdf5",
                          borderRadius: "50%",
                          p: 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <CheckCircle sx={{ color: "#10b981", fontSize: 28 }} />
                      </Box>
                    </Box>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <AccessTime sx={{ fontSize: 16, color: "#9ca3af" }} />
                      <Typography variant="body2" color="text.secondary">
                        {scorecardMetrics.aprovado.horas.toFixed(1)}h
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Pré-Aprovado */}
              <Grid item xs={12} sm={6} md={3}>
                <Card
                  sx={{
                    position: "relative",
                    overflow: "hidden",
                    borderLeft: "4px solid #3b82f6",
                    transition: "all 0.3s",
                    "&:hover": {
                      boxShadow: "0 8px 24px rgba(59, 130, 246, 0.15)",
                      transform: "translateY(-2px)",
                    },
                  }}
                >
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                      <Box>
                        <Typography
                          variant="caption"
                          sx={{
                            color: "#6b7280",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                          }}
                        >
                          Pré-Aprovado
                        </Typography>
                        <Box display="flex" alignItems="baseline" gap={0.5} mt={0.5}>
                          <Typography
                            variant="h4"
                            sx={{
                              fontWeight: 700,
                              color: "#3b82f6",
                            }}
                          >
                            R$
                          </Typography>
                          <Typography
                            variant="h4"
                            sx={{
                              fontWeight: 700,
                              color: "#3b82f6",
                            }}
                          >
                            {scorecardMetrics.preAprovado.valor.toLocaleString(
                              "pt-BR",
                              { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                            )}
                          </Typography>
                        </Box>
                      </Box>
                      <Box
                        sx={{
                          bgcolor: "#eff6ff",
                          borderRadius: "50%",
                          p: 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <ThumbUpAlt sx={{ color: "#3b82f6", fontSize: 28 }} />
                      </Box>
                    </Box>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <AccessTime sx={{ fontSize: 16, color: "#9ca3af" }} />
                      <Typography variant="body2" color="text.secondary">
                        {scorecardMetrics.preAprovado.horas.toFixed(1)}h
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Programado */}
              <Grid item xs={12} sm={6} md={3}>
                <Card
                  sx={{
                    position: "relative",
                    overflow: "hidden",
                    borderLeft: "4px solid #8b5cf6",
                    transition: "all 0.3s",
                    "&:hover": {
                      boxShadow: "0 8px 24px rgba(139, 92, 246, 0.15)",
                      transform: "translateY(-2px)",
                    },
                  }}
                >
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                      <Box>
                        <Typography
                          variant="caption"
                          sx={{
                            color: "#6b7280",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                          }}
                        >
                          Programado
                        </Typography>
                        <Box display="flex" alignItems="baseline" gap={0.5} mt={0.5}>
                          <Typography
                            variant="h4"
                            sx={{
                              fontWeight: 700,
                              color: "#8b5cf6",
                            }}
                          >
                            R$
                          </Typography>
                          <Typography
                            variant="h4"
                            sx={{
                              fontWeight: 700,
                              color: "#8b5cf6",
                            }}
                          >
                            {scorecardMetrics.programado.valor.toLocaleString(
                              "pt-BR",
                              { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                            )}
                          </Typography>
                        </Box>
                      </Box>
                      <Box
                        sx={{
                          bgcolor: "#f5f3ff",
                          borderRadius: "50%",
                          p: 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <HourglassEmpty sx={{ color: "#8b5cf6", fontSize: 28 }} />
                      </Box>
                    </Box>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <AccessTime sx={{ fontSize: 16, color: "#9ca3af" }} />
                      <Typography variant="body2" color="text.secondary">
                        {scorecardMetrics.programado.horas.toFixed(1)}h
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Atenção */}
              <Grid item xs={12} sm={6} md={3}>
                <Card
                  sx={{
                    position: "relative",
                    overflow: "hidden",
                    borderLeft: "4px solid #f59e0b",
                    transition: "all 0.3s",
                    "&:hover": {
                      boxShadow: "0 8px 24px rgba(245, 158, 11, 0.15)",
                      transform: "translateY(-2px)",
                    },
                  }}
                >
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                      <Box>
                        <Typography
                          variant="caption"
                          sx={{
                            color: "#6b7280",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                          }}
                        >
                          Atenção
                        </Typography>
                        <Box display="flex" alignItems="baseline" gap={0.5} mt={0.5}>
                          <Typography
                            variant="h4"
                            sx={{
                              fontWeight: 700,
                              color: "#f59e0b",
                            }}
                          >
                            R$
                          </Typography>
                          <Typography
                            variant="h4"
                            sx={{
                              fontWeight: 700,
                              color: "#f59e0b",
                            }}
                          >
                            {scorecardMetrics.atencao.valor.toLocaleString(
                              "pt-BR",
                              { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                            )}
                          </Typography>
                        </Box>
                      </Box>
                      <Box
                        sx={{
                          bgcolor: "#fffbeb",
                          borderRadius: "50%",
                          p: 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Warning sx={{ color: "#f59e0b", fontSize: 28 }} />
                      </Box>
                    </Box>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <AccessTime sx={{ fontSize: 16, color: "#9ca3af" }} />
                      <Typography variant="body2" color="text.secondary">
                        {scorecardMetrics.atencao.horas.toFixed(1)}h
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Bulk Actions */}
            {(isAdminAgir || isAdminTerceiro) && escalasFiltradas.length > 0 && (
              <Box sx={{ mb: 3, display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
                <Button
                  variant={selectedEscalas.size === 0 ? "outlined" : "contained"}
                  startIcon={
                    selectedEscalas.size === 0 ? (
                      <CheckBoxOutlineBlank />
                    ) : selectedEscalas.size === escalasFiltradas.filter(e => e.status !== "Aprovado" && e.status !== "Reprovado").length ? (
                      <CheckBoxIcon />
                    ) : (
                      <IndeterminateCheckBox />
                    )
                  }
                  onClick={
                    selectedEscalas.size === escalasFiltradas.filter(e => e.status !== "Aprovado" && e.status !== "Reprovado").length
                      ? handleDeselectAll
                      : handleSelectAll
                  }
                  size="small"
                >
                  {selectedEscalas.size === escalasFiltradas.filter(e => e.status !== "Aprovado" && e.status !== "Reprovado").length
                    ? "Desselecionar Todos"
                    : `Selecionar Todos (${escalasFiltradas.filter(e => e.status !== "Aprovado" && e.status !== "Reprovado").length})`}
                </Button>

                {selectedEscalas.size > 0 && (
                  <>
                    <Chip
                      label={`${selectedEscalas.size} selecionada${selectedEscalas.size > 1 ? "s" : ""}`}
                      color="primary"
                      onDelete={handleDeselectAll}
                    />
                    {isAdminAgir && (
                      <>
                        <Button
                          variant="contained"
                          color="success"
                          startIcon={<DoneAll />}
                          onClick={() => {
                            setBulkStatus("Aprovado");
                            handleOpenBulkStatusDialog();
                          }}
                          size="small"
                        >
                          Aprovar Selecionadas
                        </Button>
                        <Button
                          variant="contained"
                          color="error"
                          startIcon={<ThumbDown />}
                          onClick={() => {
                            setBulkStatus("Reprovado");
                            handleOpenBulkStatusDialog();
                          }}
                          size="small"
                        >
                          Reprovar Selecionadas
                        </Button>
                        <Button
                          variant="outlined"
                          startIcon={<Edit />}
                          onClick={handleOpenBulkStatusDialog}
                          size="small"
                        >
                          Alterar Status
                        </Button>
                      </>
                    )}
                  </>
                )}
              </Box>
            )}

            {/* Escalas List */}
            <Grid container spacing={3}>
              {escalasFiltradas.map((escala) => {
                const contrato = contratos.find(
                  (c) => c.id === escala.contrato_id
                );
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
                      <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
                        {/* First Row: Checkbox + Date on left, Status + Actions on right */}
                        <Box
                          display="flex"
                          justifyContent="space-between"
                          alignItems="center"
                          mb={1.5}
                          gap={2}
                        >
                          <Box display="flex" alignItems="center" gap={1}>
                            {(isAdminAgir || isAdminTerceiro) && escala.status !== "Aprovado" && escala.status !== "Reprovado" && (
                              <Tooltip title="Selecionar para ação em massa">
                                <IconButton
                                  size="small"
                                  onClick={(e) => handleToggleSelection(escala.id, e)}
                                  sx={{
                                    ml: -0.5,
                                    color: selectedEscalas.has(escala.id) ? "primary.main" : "action.disabled",
                                  }}
                                >
                                  {selectedEscalas.has(escala.id) ? (
                                    <CheckBoxIcon />
                                  ) : (
                                    <CheckBoxOutlineBlank />
                                  )}
                                </IconButton>
                              </Tooltip>
                            )}
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
                          </Box>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Tooltip
                              title={
                                isAdminAgir &&
                                escala.status !== "Aprovado" &&
                                escala.status !== "Reprovado"
                                  ? "Clique para alterar o status"
                                  : isAdminAgir &&
                                    (escala.status === "Aprovado" ||
                                      escala.status === "Reprovado")
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
                                  isAdminAgir &&
                                  escala.status !== "Aprovado" &&
                                  escala.status !== "Reprovado"
                                    ? (e) => {
                                        e.stopPropagation();
                                        handleOpenStatusDialog(escala);
                                      }
                                    : undefined
                                }
                                sx={{
                                  cursor:
                                    isAdminAgir &&
                                    escala.status !== "Aprovado" &&
                                    escala.status !== "Reprovado"
                                      ? "pointer"
                                      : "default",
                                  opacity:
                                    (escala.status === "Aprovado" ||
                                      escala.status === "Reprovado") &&
                                    isAdminAgir
                                      ? 0.9
                                      : 1,
                                  transition: "all 0.2s",
                                  "&:hover":
                                    isAdminAgir &&
                                    escala.status !== "Aprovado" &&
                                    escala.status !== "Reprovado"
                                      ? {
                                          transform: "scale(1.05)",
                                          boxShadow:
                                            "0 2px 8px rgba(0,0,0,0.15)",
                                        }
                                      : {},
                                }}
                              />
                            </Tooltip>
                            {!isTerceiro && (
                            <Box sx={{ mr: -1 }}>
                              <Tooltip
                                title={
                                  (() => {
                                    const canEdit = isAdminTerceiro
                                      ? escala.status === "Programado" || escala.status === "Pré-Agendado" || escala.status === "Atenção"
                                      : escala.status === "Programado" || escala.status === "Pré-Agendado";
                                    if (canEdit) return "Editar escala";
                                    const allowedStatuses = isAdminTerceiro
                                      ? '"Programado", "Pré-Agendado" ou "Atenção"'
                                      : '"Programado" ou "Pré-Agendado"';
                                    return `Não é possível editar. Apenas escalas com status ${allowedStatuses} podem ser editadas.`;
                                  })()
                                }
                              >
                                <span>
                                  <IconButton
                                    size="small"
                                    disabled={
                                      isAdminTerceiro
                                        ? escala.status !== "Programado" && escala.status !== "Pré-Agendado" && escala.status !== "Atenção"
                                        : escala.status !== "Programado" && escala.status !== "Pré-Agendado"
                                    }
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenDialog(escala);
                                    }}
                                    sx={{
                                      opacity:
                                        escala.status === "Aprovado" ||
                                        escala.status === "Reprovado"
                                          ? 0.5
                                          : 1,
                                    }}
                                  >
                                    <Edit fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                              <Tooltip
                                title={
                                  escala.status !== "Programado" &&
                                  escala.status !== "Pré-Agendado"
                                    ? `Não é possível excluir. Apenas escalas com status "Programado" ou "Pré-Agendado" podem ser excluídas.`
                                    : "Excluir escala"
                                }
                              >
                                <span>
                                  <IconButton
                                    size="small"
                                    color="error"
                                    disabled={
                                      escala.status !== "Programado" &&
                                      escala.status !== "Pré-Agendado"
                                    }
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete(escala);
                                    }}
                                    sx={{
                                      opacity:
                                        escala.status === "Aprovado" ||
                                        escala.status === "Reprovado"
                                          ? 0.5
                                          : 1,
                                    }}
                                  >
                                    <Delete fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </Box>
                            )}
                          </Box>
                        </Box>

                        {/* Second Row: Schedule on left, Doctors on right */}
                        <Box
                          display="flex"
                          justifyContent="space-between"
                          alignItems="center"
                          mb={1.5}
                          gap={1}
                        >
                          <Chip
                            icon={<Schedule />}
                            label={`${escala.horario_entrada.substring(
                              0,
                              5
                            )} - ${escala.horario_saida.substring(0, 5)}`}
                            size="small"
                            variant="outlined"
                          />
                          <Box display="flex" alignItems="center" gap={0.5} flexWrap="wrap" justifyContent="flex-end">
                            {escala.medicos.slice(0, 2).map((medico, idx) => (
                              <Chip
                                key={idx}
                                icon={<Person />}
                                label={medico.nome.split(" ")[0]}
                                size="small"
                                sx={{ fontSize: "0.7rem" }}
                              />
                            ))}
                            {escala.medicos.length > 2 && (
                              <Chip
                                label={`+${escala.medicos.length - 2}`}
                                size="small"
                                sx={{ fontSize: "0.7rem" }}
                              />
                            )}
                          </Box>
                        </Box>

                        {/* Item de Contrato */}
                        <Box mb={1.5}>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            display="block"
                            sx={{ mb: 0.5 }}
                          >
                            Item de Contrato:
                          </Typography>
                          <Chip
                            label={
                              todosItensContrato.find(
                                (i) => i.id === escala.item_contrato_id
                              )?.nome || "Item não encontrado"
                            }
                            size="small"
                            color="secondary"
                            variant="outlined"
                          />
                        </Box>

                        {/* Company/Partner Name */}
                        <Box>
                          <Typography
                            variant="body2"
                            color="text.primary"
                            fontWeight={500}
                          >
                            {contrato?.empresa || "Empresa não encontrada"}
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          </Box>
        )}

        {/* Dialog - Wizard Form */}
        <Dialog
          open={dialogOpen}
          onClose={handleCloseDialog}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle sx={{ fontWeight: 700 }}>
            {editingEscala ? "Editar Escala Médica" : "Nova Escala Médica"}
          </DialogTitle>

          <DialogContent>
            <Stepper activeStep={activeStep} sx={{ mb: 4, mt: 2 }}>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>

            {/* Error message inside dialog */}
            {error && (
              <Alert
                severity="error"
                sx={{ mb: 3 }}
                onClose={() => setError("")}
              >
                {error}
              </Alert>
            )}

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
                    itensContrato.find(
                      (i) => i.id === formData.item_contrato_id
                    ) || null
                  }
                  onChange={(_, newValue) =>
                    setFormData({
                      ...formData,
                      item_contrato_id: newValue?.id || "",
                    })
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

                {/* Botão Importar CSV - Aparece após selecionar contrato e item */}
                {!editingEscala &&
                  !isTerceiro &&
                  formData.contrato_id &&
                  formData.item_contrato_id && (
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        bgcolor: "#f0f9ff",
                        border: "1px dashed #0ea5e9",
                      }}
                    >
                      <Box
                        display="flex"
                        alignItems="center"
                        justifyContent="space-between"
                        gap={2}
                      >
                        <Box display="flex" alignItems="center" gap={1}>
                          <Info sx={{ color: "#0ea5e9" }} />
                          <Typography variant="body2" color="text.secondary">
                            Deseja importar múltiplas escalas de uma vez?
                          </Typography>
                        </Box>
                        <Button
                          variant="outlined"
                          startIcon={<UploadFile />}
                          onClick={handleOpenCsvDialog}
                          sx={{
                            borderColor: "#0ea5e9",
                            color: "#0ea5e9",
                            "&:hover": {
                              borderColor: "#0284c7",
                              bgcolor: "#f0f9ff",
                            },
                          }}
                        >
                          Importar CSV
                        </Button>
                      </Box>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ mt: 1, display: "block" }}
                      >
                        Formato do CSV: cpf (8-13 dígitos), data_inicio (YYYY-MM-DD), horario_entrada, horario_saida (HH:MM ou HH:MM:SS)
                      </Typography>
                    </Box>
                  )}

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                    Datas de Início *
                  </Typography>
                  <Box
                    sx={{
                      border: "1px solid",
                      borderColor: theme.palette.mode === "dark" ? "rgba(255, 255, 255, 0.23)" : "rgba(0, 0, 0, 0.23)",
                      borderRadius: 1,
                      padding: 2,
                      "&:hover": {
                        borderColor: theme.palette.mode === "dark" ? "rgba(255, 255, 255, 0.87)" : "rgba(0, 0, 0, 0.87)",
                      },
                    }}
                  >
                    <MultiDatePicker
                      value={formData.data_inicio}
                      onChange={(dates: any) => {
                        // Convert DateObject to Date[]
                        const dateArray = Array.isArray(dates)
                          ? dates.map((d: any) => d.toDate?.() || d)
                          : [];
                        setFormData({ ...formData, data_inicio: dateArray });
                      }}
                      multiple
                      format="DD/MM/YYYY"
                      placeholder="Selecione uma ou mais datas"
                      style={{
                        width: "100%",
                        height: "40px",
                        fontSize: "16px",
                        padding: "8px",
                      }}
                      containerStyle={{
                        width: "100%",
                      }}
                      calendarPosition="bottom"
                    />
                    {formData.data_inicio.length > 0 && (
                      <Box sx={{ mt: 1, display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                        {formData.data_inicio.map((date, index) => (
                          <Chip
                            key={index}
                            label={format(date, "dd/MM/yyyy")}
                            size="small"
                            onDelete={() => {
                              const newDates = formData.data_inicio.filter((_, i) => i !== index);
                              setFormData({ ...formData, data_inicio: newDates });
                            }}
                          />
                        ))}
                      </Box>
                    )}
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                    Clique nas datas no calendário para selecionar múltiplas datas
                  </Typography>
                </Box>

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
                  isOptionEqualToValue={(option, value) =>
                    option.id === value.id
                  }
                  loading={loadingUsuarios}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Médicos"
                      required
                      helperText={
                        !formData.contrato_id
                          ? "Selecione um contrato primeiro"
                          : loadingUsuarios
                          ? "Carregando médicos..."
                          : usuarios.length === 0
                          ? "Nenhum médico vinculado a este contrato"
                          : "Selecione o médico vinculado a este contrato"
                      }
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {loadingUsuarios ? <CircularProgress color="inherit" size={20} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                  disabled={!formData.contrato_id || loadingUsuarios}
                  noOptionsText="Nenhum médico encontrado para este contrato"
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
                      {formData.data_inicio.length > 0 ? (
                        formData.data_inicio.map((date, index) => (
                          <Chip
                            key={index}
                            icon={<CalendarMonth />}
                            label={format(date, "dd/MM/yyyy")}
                            color="primary"
                          />
                        ))
                      ) : (
                        <Chip
                          icon={<CalendarMonth />}
                          label="Nenhuma data selecionada"
                          color="default"
                        />
                      )}
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
                          itensContrato.find(
                            (i) => i.id === formData.item_contrato_id
                          )?.nome || "Item não encontrado"
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
          <DialogTitle sx={{ fontWeight: 700 }}>
            Alterar Status da Escala
          </DialogTitle>

          <DialogContent>
            <Box
              sx={{ display: "flex", flexDirection: "column", gap: 3, mt: 2 }}
            >
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
                      {
                        contratos.find(
                          (c) => c.id === escalaParaStatus.contrato_id
                        )?.nome
                      }
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Data:{" "}
                      {format(
                        parseISO(escalaParaStatus.data_inicio),
                        "dd/MM/yyyy"
                      )}
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
                  {(
                    [
                      "Programado",
                      "Pré-Aprovado",
                      "Aprovação Parcial",
                      "Atenção",
                      "Aprovado",
                      "Reprovado",
                    ] as StatusEscala[]
                  ).map((status) => {
                    const config = getStatusConfig(status);

                    // Verificar se a escala é no passado
                    const dataEscala = escalaParaStatus
                      ? parseISO(escalaParaStatus.data_inicio)
                      : new Date();
                    const hoje = new Date();
                    hoje.setHours(0, 0, 0, 0);
                    dataEscala.setHours(0, 0, 0, 0);
                    const escalaNoPassado = dataEscala < hoje;

                    // "Programado" só pode ser usado para datas futuras
                    const isDisabled =
                      status === "Programado" && escalaNoPassado;

                    const chip = (
                      <Chip
                        key={status}
                        icon={config.icon}
                        label={config.label}
                        color={config.color}
                        variant={novoStatus === status ? "filled" : "outlined"}
                        onClick={() => !isDisabled && setNovoStatus(status)}
                        disabled={isDisabled}
                        sx={{
                          cursor: isDisabled ? "not-allowed" : "pointer",
                          transition: "all 0.2s",
                          opacity: isDisabled ? 0.5 : 1,
                          "&:hover": {
                            transform: isDisabled ? "none" : "scale(1.05)",
                          },
                        }}
                      />
                    );

                    // Adicionar Tooltip para explicar por que está desabilitado
                    if (isDisabled) {
                      return (
                        <Tooltip
                          key={status}
                          title="Status 'Programado' só pode ser usado para escalas futuras"
                        >
                          <span>{chip}</span>
                        </Tooltip>
                      );
                    }

                    return chip;
                  })}
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

        {/* Dialog - Alterar Status em Massa */}
        <Dialog
          open={bulkStatusDialogOpen}
          onClose={handleCloseBulkStatusDialog}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ fontWeight: 700 }}>
            Alterar Status em Massa
          </DialogTitle>

          <DialogContent>
            <Box
              sx={{ display: "flex", flexDirection: "column", gap: 3, mt: 2 }}
            >
              {/* Informações sobre a seleção */}
              <Alert severity="info" icon={<Info />}>
                <Typography variant="body2">
                  Você está alterando o status de{" "}
                  <strong>{selectedEscalas.size}</strong> escala
                  {selectedEscalas.size > 1 ? "s" : ""} selecionada
                  {selectedEscalas.size > 1 ? "s" : ""}.
                </Typography>
              </Alert>

              {/* Seletor de Status */}
              <Box>
                <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                  Novo Status
                </Typography>
                <Box display="flex" gap={1} flexWrap="wrap">
                  {(
                    [
                      "Programado",
                      "Pré-Aprovado",
                      "Aprovação Parcial",
                      "Atenção",
                      "Aprovado",
                      "Reprovado",
                    ] as StatusEscala[]
                  ).map((status) => {
                    const config = getStatusConfig(status);
                    return (
                      <Chip
                        key={status}
                        icon={config.icon}
                        label={config.label}
                        color={config.color}
                        variant={bulkStatus === status ? "filled" : "outlined"}
                        onClick={() => setBulkStatus(status)}
                        sx={{
                          cursor: "pointer",
                          transition: "all 0.2s",
                          "&:hover": {
                            transform: "scale(1.05)",
                          },
                        }}
                      />
                    );
                  })}
                </Box>
              </Box>

              {/* Campo de Justificativa */}
              <TextField
                label="Justificativa"
                value={bulkJustificativa}
                onChange={(e) => setBulkJustificativa(e.target.value)}
                multiline
                rows={4}
                fullWidth
                required={bulkStatus === "Reprovado"}
                error={bulkStatus === "Reprovado" && !bulkJustificativa.trim()}
                helperText={
                  bulkStatus === "Reprovado"
                    ? "Justificativa obrigatória para status Reprovado"
                    : "Opcional para outros status"
                }
                placeholder="Digite a justificativa para a alteração de status em massa..."
              />
            </Box>
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={handleCloseBulkStatusDialog}>Cancelar</Button>
            <Button
              onClick={handleBulkStatusUpdate}
              variant="contained"
              color="primary"
              startIcon={<DoneAll />}
              disabled={
                (bulkStatus === "Reprovado" && !bulkJustificativa.trim()) ||
                loading
              }
            >
              {loading ? (
                <CircularProgress size={20} sx={{ color: "white" }} />
              ) : (
                `Atualizar ${selectedEscalas.size} Escala${
                  selectedEscalas.size > 1 ? "s" : ""
                }`
              )}
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
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
            >
              <span style={{ fontWeight: 700 }}>
                Detalhes da Escala Médica
              </span>
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
              <Box
                sx={{ display: "flex", flexDirection: "column", gap: 3, mt: 2 }}
              >
                {/* Informações do Contrato */}
                <Card
                  sx={{
                    bgcolor: theme.palette.mode === 'dark'
                      ? 'rgba(59, 130, 246, 0.1)'
                      : 'primary.50',
                    borderLeft: "4px solid",
                    borderColor: "primary.main",
                  }}
                >
                  <CardContent>
                    <Typography variant="overline" color="text.secondary">
                      Contrato
                    </Typography>
                    <Typography variant="h6" fontWeight={600} gutterBottom>
                      {contratos.find(
                        (c) => c.id === escalaDetalhes.contrato_id
                      )?.nome || "Não encontrado"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Empresa:{" "}
                      {contratos.find(
                        (c) => c.id === escalaDetalhes.contrato_id
                      )?.empresa || "Não encontrado"}
                    </Typography>
                    {contratos.find((c) => c.id === escalaDetalhes.contrato_id)
                      ?.numero_contrato && (
                      <Typography variant="body2" color="text.secondary">
                        Nº Contrato:{" "}
                        {
                          contratos.find(
                            (c) => c.id === escalaDetalhes.contrato_id
                          )?.numero_contrato
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
                    sx={{
                      border: theme.palette.mode === 'dark'
                        ? '1px solid rgba(255, 255, 255, 0.12)'
                        : '1px solid #e0e0e0'
                    }}
                  >
                    <Table>
                      <TableHead>
                        <TableRow
                          sx={{
                            bgcolor: theme.palette.mode === 'dark'
                              ? 'rgba(255, 255, 255, 0.05)'
                              : 'grey.50'
                          }}
                        >
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

                {/* Acessos do Médico */}
                {loadingDetalhes ? (
                  <Box display="flex" justifyContent="center" py={4}>
                    <CircularProgress />
                  </Box>
                ) : (
                  <>
                    <Card
                      sx={{
                        background:
                          "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                        color: "white",
                      }}
                    >
                      <CardContent>
                        <Typography variant="h6" fontWeight={700} gutterBottom>
                          Registros de Acesso do Médico
                        </Typography>
                        {acessosMedico.length > 0 ? (
                          <TableContainer
                            component={Paper}
                            sx={{ mt: 2, borderRadius: "8px" }}
                          >
                            <Table size="small">
                              <TableHead>
                                <TableRow
                                  sx={{
                                    bgcolor: theme.palette.mode === 'dark'
                                      ? 'rgba(255, 255, 255, 0.05)'
                                      : 'grey.100'
                                  }}
                                >
                                  <TableCell>
                                    <strong>Data</strong>
                                  </TableCell>
                                  <TableCell>
                                    <strong>Horário</strong>
                                  </TableCell>
                                  <TableCell>
                                    <strong>Sentido</strong>
                                  </TableCell>
                                  <TableCell>
                                    <strong>Planta</strong>
                                  </TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {acessosMedico.map((acesso, idx) => (
                                  <TableRow key={idx}>
                                    <TableCell>
                                      {format(
                                        parseISO(acesso.data_acesso),
                                        "dd/MM/yyyy"
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      {format(
                                        parseISO(acesso.data_acesso),
                                        "HH:mm:ss"
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      <Chip
                                        label={
                                          acesso.sentido === "E"
                                            ? "Entrada"
                                            : "Saída"
                                        }
                                        size="small"
                                        color={
                                          acesso.sentido === "E"
                                            ? "success"
                                            : "error"
                                        }
                                      />
                                    </TableCell>
                                    <TableCell>
                                      {acesso.planta || "N/A"}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        ) : (
                          <Paper
                            sx={{
                              p: 3,
                              mt: 2,
                              textAlign: "center",
                              bgcolor: "rgba(255,255,255,0.1)",
                              color: "white",
                            }}
                          >
                            <Typography>
                              Nenhum registro de acesso encontrado para este
                              médico nesta data
                            </Typography>
                          </Paper>
                        )}
                      </CardContent>
                    </Card>

                    {/* Produtividade do Médico */}
                    <Card
                      sx={{
                        background:
                          "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
                        color: "white",
                      }}
                    >
                      <CardContent>
                        <Typography variant="h6" fontWeight={700} gutterBottom>
                          Produtividade do Médico
                        </Typography>
                        {produtividadeMedico ? (
                          <Grid container spacing={2} sx={{ mt: 1 }}>
                            <Grid item xs={6} sm={4}>
                              <Paper sx={{ p: 2, textAlign: "center" }}>
                                <Typography
                                  variant="h4"
                                  color="primary"
                                  fontWeight={700}
                                >
                                  {produtividadeMedico.procedimento}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  Procedimentos
                                </Typography>
                              </Paper>
                            </Grid>
                            <Grid item xs={6} sm={4}>
                              <Paper sx={{ p: 2, textAlign: "center" }}>
                                <Typography
                                  variant="h4"
                                  color="primary"
                                  fontWeight={700}
                                >
                                  {produtividadeMedico.cirurgia_realizada}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  Cirurgias
                                </Typography>
                              </Paper>
                            </Grid>
                            <Grid item xs={6} sm={4}>
                              <Paper sx={{ p: 2, textAlign: "center" }}>
                                <Typography
                                  variant="h4"
                                  color="primary"
                                  fontWeight={700}
                                >
                                  {produtividadeMedico.evolucao}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  Evoluções
                                </Typography>
                              </Paper>
                            </Grid>
                            <Grid item xs={6} sm={4}>
                              <Paper sx={{ p: 2, textAlign: "center" }}>
                                <Typography
                                  variant="h4"
                                  color="primary"
                                  fontWeight={700}
                                >
                                  {produtividadeMedico.parecer_realizado}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  Pareceres
                                </Typography>
                              </Paper>
                            </Grid>
                            <Grid item xs={6} sm={4}>
                              <Paper sx={{ p: 2, textAlign: "center" }}>
                                <Typography
                                  variant="h4"
                                  color="primary"
                                  fontWeight={700}
                                >
                                  {produtividadeMedico.urgencia}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  Urgências
                                </Typography>
                              </Paper>
                            </Grid>
                            <Grid item xs={6} sm={4}>
                              <Paper sx={{ p: 2, textAlign: "center" }}>
                                <Typography
                                  variant="h4"
                                  color="primary"
                                  fontWeight={700}
                                >
                                  {produtividadeMedico.ambulatorio}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  Ambulatórios
                                </Typography>
                              </Paper>
                            </Grid>
                            <Grid item xs={6} sm={4}>
                              <Paper sx={{ p: 2, textAlign: "center" }}>
                                <Typography
                                  variant="h4"
                                  color="primary"
                                  fontWeight={700}
                                >
                                  {produtividadeMedico.prescricao}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  Prescrição
                                </Typography>
                              </Paper>
                            </Grid>
                            <Grid item xs={6} sm={4}>
                              <Paper sx={{ p: 2, textAlign: "center" }}>
                                <Typography
                                  variant="h4"
                                  color="primary"
                                  fontWeight={700}
                                >
                                  {produtividadeMedico.encaminhamento}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  Encaminhamento
                                </Typography>
                              </Paper>
                            </Grid>
                            <Grid item xs={6} sm={4}>
                              <Paper sx={{ p: 2, textAlign: "center" }}>
                                <Typography
                                  variant="h4"
                                  color="primary"
                                  fontWeight={700}
                                >
                                  {produtividadeMedico.auxiliar}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  Auxiliar
                                </Typography>
                              </Paper>
                            </Grid>
                          </Grid>
                        ) : (
                          <Paper
                            sx={{
                              p: 3,
                              mt: 2,
                              textAlign: "center",
                              bgcolor: "rgba(255,255,255,0.1)",
                              color: "white",
                            }}
                          >
                            <Typography>
                              Nenhum registro de produtividade encontrado para
                              este médico nesta data
                            </Typography>
                          </Paper>
                        )}
                      </CardContent>
                    </Card>
                  </>
                )}

                {/* Metadados */}
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 1,
                    bgcolor: theme.palette.mode === 'dark'
                      ? 'rgba(255, 255, 255, 0.03)'
                      : 'grey.50',
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
            {(isAdminAgir || isAdminTerceiro) && escalaDetalhes && (
              <>
                <Tooltip
                  title={
                    (() => {
                      const canEdit = isAdminTerceiro
                        ? escalaDetalhes.status === "Programado" || escalaDetalhes.status === "Pré-Agendado" || escalaDetalhes.status === "Atenção"
                        : escalaDetalhes.status === "Programado" || escalaDetalhes.status === "Pré-Agendado";
                      if (canEdit) return "";
                      const allowedStatuses = isAdminTerceiro
                        ? '"Programado", "Pré-Agendado" ou "Atenção"'
                        : '"Programado" ou "Pré-Agendado"';
                      return `Não é possível editar. Apenas escalas com status ${allowedStatuses} podem ser editadas.`;
                    })()
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
                      disabled={
                        isAdminTerceiro
                          ? escalaDetalhes.status !== "Programado" && escalaDetalhes.status !== "Pré-Agendado" && escalaDetalhes.status !== "Atenção"
                          : escalaDetalhes.status !== "Programado" && escalaDetalhes.status !== "Pré-Agendado"
                      }
                    >
                      Editar
                    </Button>
                  </span>
                </Tooltip>
                {isAdminAgir && (
                  <Tooltip
                    title={
                      escalaDetalhes.status === "Aprovado" ||
                      escalaDetalhes.status === "Reprovado"
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
                        disabled={
                          escalaDetalhes.status === "Aprovado" ||
                          escalaDetalhes.status === "Reprovado"
                        }
                      >
                        Alterar Status
                      </Button>
                    </span>
                  </Tooltip>
                )}
              </>
            )}
          </DialogActions>
        </Dialog>

        {/* Dialog de Upload CSV */}
        <Dialog
          open={csvDialogOpen}
          onClose={handleCloseCsvDialog}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            <Box display="flex" alignItems="center" gap={1}>
              <CloudUpload sx={{ color: "primary.main" }} />
              <span style={{ fontWeight: 700 }}>
                Importar Escalas via CSV
              </span>
            </Box>
          </DialogTitle>

          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="body2" fontWeight={600} gutterBottom>
                  Formato do arquivo CSV:
                </Typography>
                <Typography variant="body2" component="div">
                  <strong>Colunas obrigatórias:</strong> cpf, data_inicio,
                  horario_entrada, horario_saida
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  <strong>Formatos:</strong>
                </Typography>
                <List dense>
                  <ListItem sx={{ py: 0 }}>
                    <ListItemText
                      primary="• CPF: 8 a 13 dígitos numéricos (deve existir na base de usuários)"
                      primaryTypographyProps={{ variant: "body2" }}
                    />
                  </ListItem>
                  <ListItem sx={{ py: 0 }}>
                    <ListItemText
                      primary="• data_inicio: YYYY-MM-DD (ex: 2025-01-15)"
                      primaryTypographyProps={{ variant: "body2" }}
                    />
                  </ListItem>
                  <ListItem sx={{ py: 0 }}>
                    <ListItemText
                      primary="• horario_entrada e horario_saida: HH:MM ou HH:MM:SS (ex: 08:00 ou 08:00:00)"
                      primaryTypographyProps={{ variant: "body2" }}
                    />
                  </ListItem>
                </List>
              </Alert>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                style={{ display: "none" }}
                onChange={handleFileSelect}
              />

              {/* Upload area */}
              <Box
                sx={{
                  border: "2px dashed",
                  borderColor: csvFile ? "success.main" : "grey.300",
                  borderRadius: 2,
                  p: 4,
                  textAlign: "center",
                  bgcolor: csvFile ? "success.50" : "grey.50",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  "&:hover": {
                    borderColor: "primary.main",
                    bgcolor: "primary.50",
                  },
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <CloudUpload
                  sx={{
                    fontSize: 48,
                    color: csvFile ? "success.main" : "grey.400",
                    mb: 1,
                  }}
                />
                <Typography variant="body1" fontWeight={600}>
                  {csvFile ? csvFile.name : "Clique para selecionar um arquivo"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {csvFile ? "Arquivo selecionado" : "Formatos aceitos: .csv"}
                </Typography>
              </Box>

              {/* Error messages */}
              {csvErrors.length > 0 && (
                <Alert severity="error" sx={{ mt: 3 }}>
                  <Typography variant="body2" fontWeight={600} gutterBottom>
                    Erros encontrados:
                  </Typography>
                  <List dense>
                    {csvErrors.map((error, index) => (
                      <ListItem key={index} sx={{ py: 0 }}>
                        <ListItemText
                          primary={`• ${error}`}
                          primaryTypographyProps={{ variant: "body2" }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Alert>
              )}
            </Box>
          </DialogContent>

          <DialogActions>
            <Button onClick={handleCloseCsvDialog} disabled={importingCsv}>
              Cancelar
            </Button>
            <Button
              onClick={handleProcessCsv}
              variant="contained"
              disabled={!csvFile || importingCsv}
              startIcon={
                importingCsv ? (
                  <CircularProgress size={20} sx={{ color: "white" }} />
                ) : (
                  <Analytics />
                )
              }
            >
              {importingCsv ? "Validando..." : "Validar e Continuar"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Dialog de Preview das Escalas */}
        <Dialog
          open={csvPreviewOpen}
          onClose={handleCancelCsvImport}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle>
            <Box display="flex" alignItems="center" gap={1}>
              <Analytics sx={{ color: "primary.main" }} />
              <span style={{ fontWeight: 700 }}>
                Confirmar Importação - {csvPreviewData.length} Escala(s)
              </span>
            </Box>
          </DialogTitle>

          <DialogContent>
            <Alert severity="success" sx={{ mb: 3 }}>
              <Typography variant="body2">
                <strong>Validação concluída!</strong> Os dados abaixo serão
                importados para o contrato e item selecionados. Revise as
                informações antes de confirmar.
              </Typography>
            </Alert>

            {/* Informações do contrato e item */}
            <Card sx={{ mb: 3, bgcolor: "primary.50" }}>
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary">
                      Contrato:
                    </Typography>
                    <Typography variant="body1" fontWeight={600}>
                      {contratos.find((c) => c.id === formData.contrato_id)
                        ?.nome || "-"}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary">
                      Item de Contrato:
                    </Typography>
                    <Typography variant="body1" fontWeight={600}>
                      {itensContrato.find(
                        (i) => i.id === formData.item_contrato_id
                      )?.nome || "-"}
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Tabela de preview */}
            <TableContainer
              component={Paper}
              sx={{ maxHeight: "400px", overflow: "auto" }}
            >
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>Médico</TableCell>
                    <TableCell>CPF</TableCell>
                    <TableCell>Data</TableCell>
                    <TableCell>Horário Entrada</TableCell>
                    <TableCell>Horário Saída</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {csvPreviewData.map((row, index) => (
                    <TableRow
                      key={index}
                      sx={{
                        "&:nth-of-type(odd)": { bgcolor: "grey.50" },
                      }}
                    >
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{row.nome}</TableCell>
                      <TableCell>{row.cpf}</TableCell>
                      <TableCell>
                        {format(parseISO(row.data_inicio), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell>{row.horario_entrada}</TableCell>
                      <TableCell>{row.horario_saida}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </DialogContent>

          <DialogActions>
            <Button
              onClick={handleCancelCsvImport}
              disabled={importingCsv}
              startIcon={<Close />}
            >
              Voltar
            </Button>
            <Button
              onClick={handleConfirmCsvImport}
              variant="contained"
              disabled={importingCsv}
              startIcon={
                importingCsv ? (
                  <CircularProgress size={20} sx={{ color: "white" }} />
                ) : (
                  <CheckCircle />
                )
              }
            >
              {importingCsv
                ? "Importando..."
                : `Confirmar Importação (${csvPreviewData.length})`}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default EscalasMedicas;
