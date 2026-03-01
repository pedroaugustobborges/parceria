import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Autocomplete,
  Grid,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Divider,
  useTheme,
} from "@mui/material";
import { DataGrid, GridColDef, GridToolbar } from "@mui/x-data-grid";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { ptBR } from "date-fns/locale";
import {
  FilterList,
  Refresh,
  TrendingUp,
  AccessTime,
  People,
  Download,
  Close,
  LoginOutlined,
  LogoutOutlined,
  Warning,
  LocalHospital,
  CalendarMonth,
  Schedule,
  PersonOff,
  Assignment,
  Search,
  ArrowBackIos,
  ArrowForwardIos,
} from "@mui/icons-material";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { supabase } from "../lib/supabase";
import {
  Acesso,
  HorasCalculadas,
  Contrato,
  Produtividade,
  Usuario,
  UnidadeHospitalar,
  EscalaMedica,
} from "../types/database.types";
import { useAuth } from "../contexts/AuthContext";
import { format, parseISO, differenceInMinutes } from "date-fns";
import {
  usePersistentState,
  usePersistentArray,
  useClearDashboardState,
} from "../hooks/usePersistentState";
import {
  HeatmapChart,
  ProductivityBarChart,
  AccessLineChart,
} from "../features/dashboard/components/charts";
import {
  InconsistenciesSection,
  ScheduleIndicatorsSection,
  StatisticsCardsSection,
} from "../features/dashboard/components/sections";
import {
  AccessHistoryDialog,
  ProductivityHistoryDialog,
  InconsistencyDetailsDialog,
  ContractWarningDialog,
  PunctualityDetailsDialog,
  AbsenteismDetailsDialog,
  HoursDifferenceDialog,
  ScheduledHoursDialog,
  UnitHoursDialog,
} from "../features/dashboard/components/dialogs";

// ============================================================================
// UTILIDADES DE NORMALIZAÇÃO DE DADOS
// ============================================================================

/**
 * Normaliza CPF para formato consistente de 11 dígitos
 * Converte números para string e adiciona zeros à esquerda quando necessário
 * Remove pontos, traços e espaços
 *
 * Exemplos:
 *   12345678900 -> "12345678900" (número convertido)
 *   1234567890 -> "01234567890" (número com zero perdido)
 *   "123.456.789-00" -> "12345678900" (string formatada)
 */
const normalizeCPFUtil = (cpf: string | number | null | undefined): string => {
  if (cpf === null || cpf === undefined) return "";

  // Converter para string se for número
  let cpfStr = String(cpf);

  // Remover caracteres de formatação
  cpfStr = cpfStr.replace(/[.\-\s]/g, "");

  // Garantir 11 dígitos com zeros à esquerda
  return cpfStr.padStart(11, "0");
};

/**
 * Normaliza um objeto de dados aplicando normalizeCPFUtil ao campo 'cpf'
 */
const normalizeCPFInObject = <T extends { cpf?: string | number | null }>(
  obj: T,
): T => {
  if (obj.cpf !== undefined) {
    return {
      ...obj,
      cpf: normalizeCPFUtil(obj.cpf) as any,
    };
  }
  return obj;
};

/**
 * Extrai string de data consistente (ignora timezone)
 * Trata tanto "2024-01-15" (date) quanto "2024-01-15T10:30:00+00" (timestamptz)
 *
 * CRÍTICO: Resolve problema de timezone onde:
 *   - acessos.data_acesso: timestamptz (pode mudar de dia com timezone)
 *   - produtividade.data: date (sempre o mesmo dia)
 *
 * Solução: Extrai apenas YYYY-MM-DD antes de qualquer conversão de timezone
 */
const extractDateStringUtil = (
  dateValue: string | null | undefined,
): string => {
  if (!dateValue) return "";

  // Convert to string if needed
  const dateStr = String(dateValue);

  // Extract YYYY-MM-DD portion only (before 'T' if exists)
  const datePart = dateStr.split("T")[0];

  // Validate format and normalize padding
  const parts = datePart.split("-");
  if (parts.length !== 3) return "";

  const [year, month, day] = parts.map((p) => parseInt(p, 10));

  // Return normalized date string (always YYYY-MM-DD with proper padding)
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
};

// ============================================================================

const Dashboard: React.FC = () => {
  const { userProfile, isAdminTerceiro, isTerceiro, userContratoIds } =
    useAuth();
  const theme = useTheme();

  // Large data arrays - NOT persisted (too large for sessionStorage)
  // These will auto-reload when component mounts if filters are saved
  const [acessos, setAcessos] = useState<Acesso[]>([]);
  const [acessosFiltrados, setAcessosFiltrados] = useState<Acesso[]>([]);
  const [horasCalculadas, setHorasCalculadas] = useState<HorasCalculadas[]>([]);

  // Auxiliary data - persisted (smaller, ~100-500KB total)
  const [contratos, setContratos] = usePersistentArray<Contrato>(
    "dashboard_contratos",
  );
  const [contratoItems, setContratoItems] = usePersistentArray<ContratoItem>(
    "dashboard_contratoItems",
  );
  const [produtividade, setProdutividade] = usePersistentArray<Produtividade>(
    "dashboard_produtividade",
  );
  const [escalas, setEscalas] =
    usePersistentArray<EscalaMedica>("dashboard_escalas");
  const [usuarios, setUsuarios] =
    usePersistentArray<Usuario>("dashboard_usuarios");
  const [unidades, setUnidades] =
    usePersistentArray<UnidadeHospitalar>("dashboard_unidades");

  // Transient state - does not persist (loading, errors)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [buscaRealizada, setBuscaRealizada] = usePersistentState<boolean>(
    "dashboard_buscaRealizada",
    false,
  );

  // Persistent filters - preserve user selections across navigation
  const [filtroTipo, setFiltroTipo] = usePersistentArray<string>(
    "dashboard_filtroTipo",
  );
  const [filtroMatricula, setFiltroMatricula] = usePersistentArray<string>(
    "dashboard_filtroMatricula",
  );
  const [filtroNome, setFiltroNome] = usePersistentArray<string>(
    "dashboard_filtroNome",
  );
  const [filtroCpf, setFiltroCpf] = usePersistentArray<string>(
    "dashboard_filtroCpf",
  );
  const [filtroEspecialidade, setFiltroEspecialidade] =
    usePersistentArray<string>("dashboard_filtroEspecialidade");
  const [filtroContrato, setFiltroContrato] =
    usePersistentState<Contrato | null>("dashboard_filtroContrato", null);
  const [filtroUnidade, setFiltroUnidade] = usePersistentArray<string>(
    "dashboard_filtroUnidade",
  );
  const [filtroDataInicio, setFiltroDataInicio] =
    usePersistentState<Date | null>("dashboard_filtroDataInicio", null);
  const [filtroDataFim, setFiltroDataFim] = usePersistentState<Date | null>(
    "dashboard_filtroDataFim",
    null,
  );

  // CPFs vinculados ao contrato filtrado (para uso em useMemo)
  const [cpfsDoContratoFiltrado, setCpfsDoContratoFiltrado] = useState<
    string[]
  >([]);

  // Modal de detalhes
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<HorasCalculadas | null>(
    null,
  );
  const [personAcessos, setPersonAcessos] = useState<Acesso[]>([]);

  // Modal de produtividade
  const [produtividadeModalOpen, setProdutividadeModalOpen] = useState(false);
  const [selectedPersonProdutividade, setSelectedPersonProdutividade] =
    useState<HorasCalculadas | null>(null);
  const [personProdutividade, setPersonProdutividade] = useState<
    Produtividade[]
  >([]);

  // Modal de aviso de contrato
  const [contratoWarningOpen, setContratoWarningOpen] = useState(false);
  const [pendingContrato, setPendingContrato] = useState<Contrato | null>(null);

  // Modal de inconsistências
  const [inconsistenciaModalOpen, setInconsistenciaModalOpen] = useState(false);
  const [inconsistenciaSelecionada, setInconsistenciaSelecionada] = useState<{
    nome: string;
    tipo: "prodSemAcesso" | "acessoSemProd";
    datas: string[];
    detalhes?: Map<string, Produtividade[]>; // Mapa de data -> registros de produtividade
  } | null>(null);

  // Modal de pontualidade
  const [pontualidadeModalOpen, setPontualidadeModalOpen] = useState(false);
  const [pontualidadeSelecionada, setPontualidadeSelecionada] = useState<{
    nome: string;
    cpf: string;
    atrasos: Array<{
      data: string;
      horarioEscalado: string;
      horarioEntrada: string;
      atrasoMinutos: number;
    }>;
  } | null>(null);

  // Modal de absenteísmo
  const [absenteismoModalOpen, setAbsenteismoModalOpen] = useState(false);
  const [absenteismoSelecionado, setAbsenteismoSelecionado] = useState<{
    nome: string;
    cpf: string;
    ausencias: Array<{
      data: string;
      horarioEscalado: string;
    }>;
  } | null>(null);

  // Modal de diferença de horas
  const [diferencaHorasModalOpen, setDiferencaHorasModalOpen] = useState(false);
  const [diferencaHorasSelecionada, setDiferencaHorasSelecionada] = useState<{
    nome: string;
    cpf: string;
    totalHoras: number;
    cargaHorariaEscalada: number;
    diferenca: number;
    detalhamentoDiario: Array<{
      data: string;
      horasTrabalhadas: number;
      cargaEscalada: number;
      diferenca: number;
    }>;
  } | null>(null);

  // Modal de detalhes de Horas Escaladas
  const [horasEscaladasModalOpen, setHorasEscaladasModalOpen] = useState(false);
  const [horasEscaladasSelecionadas, setHorasEscaladasSelecionadas] = useState<{
    nome: string;
    cpf: string;
    totalHoras: number;
    detalhamento: Array<{
      data: string;
      horarioEntrada: string;
      horarioSaida: string;
      horas: number;
      observacoes: string | null;
      status: string;
    }>;
  } | null>(null);

  // Modal de detalhes de Horas na Unidade
  const [horasUnidadeModalOpen, setHorasUnidadeModalOpen] = useState(false);
  const [horasUnidadeSelecionadas, setHorasUnidadeSelecionadas] = useState<{
    nome: string;
    cpf: string;
    totalHoras: number;
    detalhamento: Array<{
      data: string;
      primeiraEntrada: string;
      ultimaSaida: string;
      horas: number;
      entradas: number;
      saidas: number;
    }>;
  } | null>(null);

  // Pagination state for each section
  const [pageProdSemAcesso, setPageProdSemAcesso] = useState(0);
  const [pageAcessoSemProd, setPageAcessoSemProd] = useState(0);
  const [pagePontualidade, setPagePontualidade] = useState(0);
  const [pageAbsenteismo, setPageAbsenteismo] = useState(0);
  const itemsPerPage = 10;

  useEffect(() => {
    // Load only auxiliary data (contracts, items, productivity, schedules, users, units)
    // Access data will be loaded only when user clicks "Buscar Acessos"
    loadAuxiliaryData();

    // Auto-reload acessos data if filters are saved and search was previously performed
    // This happens when user navigates back to Dashboard after leaving
    if (
      buscaRealizada &&
      filtroDataInicio &&
      filtroDataFim &&
      acessos.length === 0
    ) {
      console.log("🔄 Auto-reloading acessos data from saved filters...");
      handleBuscarAcessos();
    }
  }, []);

  useEffect(() => {
    if (acessos.length > 0) {
      calcularHoras();
    }
  }, [
    acessos,
    escalas,
    filtroTipo,
    filtroMatricula,
    filtroNome,
    filtroCpf,
    filtroEspecialidade,
    filtroContrato,
    filtroUnidade,
    filtroDataInicio,
    filtroDataFim,
    usuarios,
  ]);

  // Atualizar CPFs do contrato filtrado sempre que o filtro de contrato mudar
  // OU quando for administrador-terceiro (aplica automaticamente seus contratos)
  useEffect(() => {
    const fetchCpfsDoContrato = async () => {
      // Se não há filtro de contrato E não é administrador-terceiro, limpar
      if (!filtroContrato && !isAdminTerceiro) {
        setCpfsDoContratoFiltrado([]);
        return;
      }

      try {
        let cpfs: string[] = [];

        if (filtroContrato) {
          // Usuário selecionou um contrato específico
          const { data: usuariosContrato } = await supabase
            .from("usuario_contrato")
            .select("cpf")
            .eq("contrato_id", filtroContrato.id);

          if (usuariosContrato && usuariosContrato.length > 0) {
            cpfs = usuariosContrato.map((u: any) => u.cpf);
          }
        } else if (isAdminTerceiro && userContratoIds.length > 0) {
          // Administrador-terceiro: buscar CPFs de todos os seus contratos
          console.log(
            "🔒 Administrador-terceiro: aplicando filtro automático de contratos:",
            userContratoIds,
          );

          const { data: usuariosContrato } = await supabase
            .from("usuario_contrato")
            .select("cpf")
            .in("contrato_id", userContratoIds);

          if (usuariosContrato && usuariosContrato.length > 0) {
            cpfs = [...new Set(usuariosContrato.map((u: any) => u.cpf))]; // Remove duplicates
          }
        }

        if (cpfs.length === 0) {
          setCpfsDoContratoFiltrado([]);
          return;
        }

        // TAMBÉM buscar CPFs da tabela usuarios diretamente (para usuários importados via CSV)
        let usuariosDirectos;
        if (filtroContrato) {
          const { data } = await supabase
            .from("usuarios")
            .select("cpf")
            .eq("contrato_id", filtroContrato.id);
          usuariosDirectos = data;
        } else if (isAdminTerceiro && userContratoIds.length > 0) {
          const { data } = await supabase
            .from("usuarios")
            .select("cpf")
            .in("contrato_id", userContratoIds);
          usuariosDirectos = data;
        }

        if (usuariosDirectos && usuariosDirectos.length > 0) {
          const cpfsDirectos = usuariosDirectos.map((u: any) => u.cpf);
          // Combinar os dois arrays sem duplicatas
          cpfs = [...new Set([...cpfs, ...cpfsDirectos])];
        }

        // Normalizar CPFs
        const normalizedCpfs = cpfs.map((cpf) => normalizeCPFUtil(cpf));
        setCpfsDoContratoFiltrado(normalizedCpfs);

        if (isAdminTerceiro && !filtroContrato) {
          console.log(
            `✅ ${normalizedCpfs.length} CPFs carregados automaticamente para administrador-terceiro`,
          );
        }
      } catch (err) {
        console.error("Erro ao buscar CPFs do contrato:", err);
        setCpfsDoContratoFiltrado([]);
      }
    };

    fetchCpfsDoContrato();
  }, [filtroContrato, isAdminTerceiro, userProfile]);

  const loadContratos = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from("contratos")
        .select("*")
        .eq("ativo", true)
        .order("nome");

      if (fetchError) throw fetchError;
      setContratos(data || []);
    } catch (err: any) {
      console.error("Erro ao carregar contratos:", err);
    }
  };

  const loadContratoItems = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from("contrato_itens")
        .select("*");

      if (fetchError) throw fetchError;
      setContratoItems(data || []);
    } catch (err: any) {
      console.error("Erro ao carregar itens de contrato:", err);
    }
  };

  const loadProdutividade = async (dataInicio?: Date, dataFim?: Date) => {
    try {
      console.log("🔄 Carregando dados de produtividade...");

      // Se não houver filtros de data, carregar tudo com paginação
      const pageSize = 1000;
      let allProdutividade: Produtividade[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from("produtividade")
          .select("*")
          .order("data", { ascending: false })
          .range(from, from + pageSize - 1);

        // Aplicar filtros de data se fornecidos
        if (dataInicio) {
          const dataInicioFormatada = format(dataInicio, "yyyy-MM-dd");
          query = query.gte("data", dataInicioFormatada);
        }
        if (dataFim) {
          const dataFimFormatada = format(dataFim, "yyyy-MM-dd");
          query = query.lte("data", dataFimFormatada);
        }

        const { data, error: fetchError } = await query;

        if (fetchError) throw fetchError;

        if (data && data.length > 0) {
          allProdutividade = [...allProdutividade, ...data];
          from += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      console.log(
        `✅ Produtividade carregada: ${allProdutividade.length} registros`,
      );
      setProdutividade(allProdutividade);
    } catch (err: any) {
      console.error("❌ Erro ao carregar produtividade:", err);
    }
  };

  const loadEscalas = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from("escalas_medicas")
        .select("*")
        .eq("ativo", true)
        .order("data_inicio", { ascending: false });

      if (fetchError) throw fetchError;
      setEscalas(data || []);
    } catch (err: any) {
      console.error("Erro ao carregar escalas:", err);
    }
  };

  const loadUsuarios = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from("usuarios")
        .select("cpf, codigomv, especialidade, nome");

      if (fetchError) throw fetchError;

      // Normalizar CPFs para garantir formato consistente (11 dígitos)
      const normalizedData = (data || []).map(normalizeCPFInObject);
      console.log(
        `✅ Usuários carregados e CPFs normalizados: ${normalizedData.length} registros`,
      );

      setUsuarios(normalizedData);
    } catch (err: any) {
      console.error("Erro ao carregar usuarios:", err);
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

  const loadAuxiliaryData = async () => {
    try {
      await Promise.all([
        loadContratos(),
        loadContratoItems(),
        loadProdutividade(),
        loadEscalas(),
        loadUsuarios(),
        loadUnidades(),
      ]);
    } catch (err: any) {
      console.error("Erro ao carregar dados auxiliares:", err);
    }
  };

  const handleBuscarAcessos = async () => {
    // Validate required dates
    if (!filtroDataInicio || !filtroDataFim) {
      setError(
        "Por favor, selecione uma data de início e uma data de fim para buscar os acessos.",
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

      // Carregar registros de acesso com paginação e filtro de datas
      const pageSize = 1000;
      let allAcessos: Acesso[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from("acessos")
          .select("*")
          .gte("data_acesso", `${dataInicioFormatada}T00:00:00`)
          .lte("data_acesso", `${dataFimFormatada}T23:59:59`)
          .order("data_acesso", { ascending: false })
          .range(from, from + pageSize - 1);

        // Aplicar filtros baseados no tipo de usuário
        if (isTerceiro && userProfile) {
          query = query.eq("cpf", userProfile.cpf);
        } else if (isAdminTerceiro && userContratoIds.length > 0) {
          // Buscar CPFs dos usuários vinculados aos contratos do administrador
          const { data: usuariosContrato } = await supabase
            .from("usuario_contrato")
            .select("cpf")
            .in("contrato_id", userContratoIds);

          if (usuariosContrato && usuariosContrato.length > 0) {
            const cpfs = [...new Set(usuariosContrato.map((u: any) => u.cpf))]; // Remove duplicates
            query = query.in("cpf", cpfs);
          }
        }

        const { data, error: fetchError } = await query;

        if (fetchError) throw fetchError;

        if (data && data.length > 0) {
          allAcessos = [...allAcessos, ...data];
          from += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      // Normalizar CPFs para garantir formato consistente (11 dígitos)
      const normalizedAcessos = allAcessos.map(normalizeCPFInObject);
      console.log(
        `✅ Acessos carregados e CPFs normalizados: ${normalizedAcessos.length} registros`,
      );

      setAcessos(normalizedAcessos);

      // Carregar produtividade com os mesmos filtros de data
      await loadProdutividade(filtroDataInicio, filtroDataFim);

      setBuscaRealizada(true);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar acessos");
      console.error("Erro:", err);
    } finally {
      setLoading(false);
    }
  };

  const calcularHoras = async () => {
    // Se há filtro de contrato, buscar CPFs vinculados
    let cpfsDoContrato: string[] = [];
    if (filtroContrato) {
      try {
        // Buscar CPFs da tabela usuario_contrato (junction table)
        const { data: usuariosContrato } = await supabase
          .from("usuario_contrato")
          .select("cpf")
          .eq("contrato_id", filtroContrato.id);

        if (usuariosContrato && usuariosContrato.length > 0) {
          cpfsDoContrato = usuariosContrato.map((u: any) => u.cpf);
        }

        // TAMBÉM buscar CPFs da tabela usuarios diretamente (para usuários importados via CSV)
        const { data: usuariosDirectos } = await supabase
          .from("usuarios")
          .select("cpf")
          .eq("contrato_id", filtroContrato.id);

        if (usuariosDirectos && usuariosDirectos.length > 0) {
          const cpfsDirectos = usuariosDirectos.map((u: any) => u.cpf);
          // Combinar os dois arrays sem duplicatas
          cpfsDoContrato = [...new Set([...cpfsDoContrato, ...cpfsDirectos])];
        }
      } catch (err) {
        console.error("Erro ao buscar CPFs do contrato:", err);
      }
    }

    const acessosFiltradosLocal = acessos.filter((acesso) => {
      // Filtro de múltiplas seleções
      if (filtroTipo.length > 0 && !filtroTipo.includes(acesso.tipo))
        return false;
      if (
        filtroMatricula.length > 0 &&
        !filtroMatricula.includes(acesso.matricula)
      )
        return false;
      if (filtroNome.length > 0 && !filtroNome.includes(acesso.nome))
        return false;
      if (filtroCpf.length > 0 && !filtroCpf.includes(acesso.cpf)) return false;
      if (filtroEspecialidade.length > 0) {
        const usuario = usuarios.find((u) => u.cpf === acesso.cpf);
        if (
          !usuario ||
          !usuario.especialidade ||
          !usuario.especialidade.some((esp) =>
            filtroEspecialidade.includes(esp),
          )
        )
          return false;
      }

      // Filtro de contrato
      if (
        filtroContrato &&
        cpfsDoContrato.length > 0 &&
        !cpfsDoContrato.includes(acesso.cpf)
      )
        return false;

      // Filtro de unidade hospitalar
      if (filtroUnidade.length > 0 && !filtroUnidade.includes(acesso.planta))
        return false;

      // Filtros de data - normalizar para comparar apenas o dia (sem hora)
      if (filtroDataInicio) {
        const dataAcesso = new Date(acesso.data_acesso);
        dataAcesso.setHours(0, 0, 0, 0);
        const inicioNormalizado = new Date(filtroDataInicio);
        inicioNormalizado.setHours(0, 0, 0, 0);
        if (dataAcesso < inicioNormalizado) return false;
      }
      if (filtroDataFim) {
        const dataAcesso = new Date(acesso.data_acesso);
        dataAcesso.setHours(0, 0, 0, 0);
        const fimNormalizado = new Date(filtroDataFim);
        fimNormalizado.setHours(0, 0, 0, 0);
        if (dataAcesso > fimNormalizado) return false;
      }

      return true;
    });

    // Salvar acessos filtrados no state para uso no modal
    setAcessosFiltrados(acessosFiltradosLocal);

    // Agrupar por CPF
    const acessosPorCpf = acessosFiltradosLocal.reduce(
      (acc, acesso) => {
        if (!acc[acesso.cpf]) {
          acc[acesso.cpf] = [];
        }
        acc[acesso.cpf].push(acesso);
        return acc;
      },
      {} as Record<string, Acesso[]>,
    );

    // Calcular horas para cada CPF
    const resultado: HorasCalculadas[] = Object.entries(acessosPorCpf).map(
      ([cpf, acessosCpf]) => {
        // Ordenar todos os acessos por data
        const acessosOrdenados = acessosCpf.sort(
          (a, b) =>
            new Date(a.data_acesso).getTime() -
            new Date(b.data_acesso).getTime(),
        );

        // Agrupar por dia (YYYY-MM-DD)
        const acessosPorDia = acessosOrdenados.reduce(
          (acc, acesso) => {
            const data = format(parseISO(acesso.data_acesso), "yyyy-MM-dd");
            if (!acc[data]) {
              acc[data] = [];
            }
            acc[data].push(acesso);
            return acc;
          },
          {} as Record<string, Acesso[]>,
        );

        let totalMinutos = 0;
        let totalEntradas = 0;
        let totalSaidas = 0;
        const diasUnicos = new Set<string>(); // Para contar dias únicos

        // Para cada dia, calcular a diferença entre primeira entrada e última saída
        const diasOrdenados = Object.keys(acessosPorDia).sort();

        for (let i = 0; i < diasOrdenados.length; i++) {
          const dia = diasOrdenados[i];
          const acessosDia = acessosPorDia[dia];

          const entradasDia = acessosDia.filter((a) => a.sentido === "E");
          const saidasDia = acessosDia.filter((a) => a.sentido === "S");

          totalEntradas += entradasDia.length;
          totalSaidas += saidasDia.length;

          if (entradasDia.length > 0) {
            const primeiraEntrada = parseISO(entradasDia[0].data_acesso);

            // Se há saída no mesmo dia, usar a última saída do dia
            if (saidasDia.length > 0) {
              const ultimaSaida = parseISO(
                saidasDia[saidasDia.length - 1].data_acesso,
              );

              if (ultimaSaida > primeiraEntrada) {
                const minutos = differenceInMinutes(
                  ultimaSaida,
                  primeiraEntrada,
                );
                totalMinutos += minutos;
                diasUnicos.add(dia); // Adiciona o dia ao conjunto de dias únicos
              }
            } else {
              // Último registro do dia é entrada, buscar primeira saída do dia seguinte
              let saidaEncontrada = false;
              for (let j = i + 1; j < diasOrdenados.length; j++) {
                const proximoDia = diasOrdenados[j];
                const acessosProximoDia = acessosPorDia[proximoDia];
                const saidasProximoDia = acessosProximoDia.filter(
                  (a) => a.sentido === "S",
                );

                if (saidasProximoDia.length > 0) {
                  const primeiraSaidaProximoDia = parseISO(
                    saidasProximoDia[0].data_acesso,
                  );
                  const minutos = differenceInMinutes(
                    primeiraSaidaProximoDia,
                    primeiraEntrada,
                  );
                  totalMinutos += minutos;
                  diasUnicos.add(dia); // Adiciona o dia ao conjunto de dias únicos
                  saidaEncontrada = true;
                  break;
                }
              }

              // Se não encontrou saída em nenhum dia seguinte, não contabilizar essa entrada
              if (!saidaEncontrada) {
                // Não adiciona nada ao totalMinutos
              }
            }
          }
        }

        const totalHoras = totalMinutos / 60;
        const ultimoAcesso = acessosCpf.sort(
          (a, b) =>
            new Date(b.data_acesso).getTime() -
            new Date(a.data_acesso).getTime(),
        )[0];

        // Calcular carga horária escalada para este CPF (aplicando filtros de data)
        const escalasDoMedico = escalas.filter((escala) => {
          // Verificar se o médico está na escala
          if (!escala.medicos?.some((medico) => medico.cpf === cpf)) {
            return false;
          }

          // Aplicar filtros de data
          if (filtroDataInicio) {
            const dataEscala = new Date(escala.data_inicio);
            dataEscala.setHours(0, 0, 0, 0);
            const inicioNormalizado = new Date(filtroDataInicio);
            inicioNormalizado.setHours(0, 0, 0, 0);
            if (dataEscala < inicioNormalizado) return false;
          }
          if (filtroDataFim) {
            const dataEscala = new Date(escala.data_inicio);
            dataEscala.setHours(0, 0, 0, 0);
            const fimNormalizado = new Date(filtroDataFim);
            fimNormalizado.setHours(0, 0, 0, 0);
            if (dataEscala > fimNormalizado) return false;
          }

          return true;
        });

        const cargaHorariaEscaladaPorCpf = escalasDoMedico.reduce(
          (sum, escala) => {
            try {
              const [horaEntrada, minEntrada] = escala.horario_entrada
                .split(":")
                .map(Number);
              const [horaSaida, minSaida] = escala.horario_saida
                .split(":")
                .map(Number);

              let minutosTotais =
                horaSaida * 60 + minSaida - (horaEntrada * 60 + minEntrada);

              if (minutosTotais < 0) {
                minutosTotais += 24 * 60;
              }

              const horas = minutosTotais / 60;
              return sum + horas;
            } catch (err) {
              console.error("Erro ao calcular horas da escala para CPF:", err);
              return sum;
            }
          },
          0,
        );

        // Buscar especialidade do usuário
        const usuario = usuarios.find((u) => u.cpf === cpf);
        const especialidade = usuario?.especialidade?.[0] || "-";

        // Calcular produtividade para este CPF filtrada por data
        const produtividadeCpf = produtividade.filter((p) => {
          // Encontrar o usuário pelo código MV
          const usuarioProd = usuarios.find((u) => u.codigomv === p.codigo_mv);
          if (usuarioProd?.cpf !== cpf) return false;

          // Filtrar por data se houver filtros aplicados
          if (p.data && (filtroDataInicio || filtroDataFim)) {
            // Extract just the date part (YYYY-MM-DD) to avoid timezone issues
            const dataProdStr = p.data.split("T")[0]; // "2024-12-10"

            if (filtroDataInicio) {
              const dataInicioStr = format(filtroDataInicio, "yyyy-MM-dd");
              if (dataProdStr < dataInicioStr) return false;
            }

            if (filtroDataFim) {
              const dataFimStr = format(filtroDataFim, "yyyy-MM-dd");
              if (dataProdStr > dataFimStr) return false;
            }
          }

          return true;
        });

        // Somar cada tipo de produtividade separadamente
        const produtividade_procedimento = produtividadeCpf.reduce(
          (sum, item) => sum + (item.procedimento || 0),
          0,
        );
        const produtividade_parecer_solicitado = produtividadeCpf.reduce(
          (sum, item) => sum + (item.parecer_solicitado || 0),
          0,
        );
        const produtividade_parecer_realizado = produtividadeCpf.reduce(
          (sum, item) => sum + (item.parecer_realizado || 0),
          0,
        );
        const produtividade_cirurgia_realizada = produtividadeCpf.reduce(
          (sum, item) => sum + (item.cirurgia_realizada || 0),
          0,
        );
        const produtividade_prescricao = produtividadeCpf.reduce(
          (sum, item) => sum + (item.prescricao || 0),
          0,
        );
        const produtividade_evolucao = produtividadeCpf.reduce(
          (sum, item) => sum + (item.evolucao || 0),
          0,
        );
        const produtividade_urgencia = produtividadeCpf.reduce(
          (sum, item) => sum + (item.urgencia || 0),
          0,
        );
        const produtividade_ambulatorio = produtividadeCpf.reduce(
          (sum, item) => sum + (item.ambulatorio || 0),
          0,
        );
        const produtividade_auxiliar = produtividadeCpf.reduce(
          (sum, item) => sum + (item.auxiliar || 0),
          0,
        );
        const produtividade_encaminhamento = produtividadeCpf.reduce(
          (sum, item) => sum + (item.encaminhamento || 0),
          0,
        );
        const produtividade_folha_objetivo_diario = produtividadeCpf.reduce(
          (sum, item) => sum + (item.folha_objetivo_diario || 0),
          0,
        );
        const produtividade_evolucao_diurna_cti = produtividadeCpf.reduce(
          (sum, item) => sum + (item.evolucao_diurna_cti || 0),
          0,
        );
        const produtividade_evolucao_noturna_cti = produtividadeCpf.reduce(
          (sum, item) => sum + (item.evolucao_noturna_cti || 0),
          0,
        );

        return {
          cpf,
          nome: ultimoAcesso.nome,
          matricula: ultimoAcesso.matricula,
          tipo: ultimoAcesso.tipo,
          codigomv: usuario?.codigomv || "-",
          totalHoras: parseFloat(totalHoras.toFixed(2)),
          cargaHorariaEscalada: parseFloat(
            cargaHorariaEscaladaPorCpf.toFixed(2),
          ),
          diasComRegistro: diasUnicos.size,
          entradas: totalEntradas,
          saidas: totalSaidas,
          ultimoAcesso: ultimoAcesso.data_acesso,
          especialidade: especialidade,
          produtividade_procedimento,
          produtividade_parecer_solicitado,
          produtividade_parecer_realizado,
          produtividade_cirurgia_realizada,
          produtividade_prescricao,
          produtividade_evolucao,
          produtividade_urgencia,
          produtividade_ambulatorio,
          produtividade_auxiliar,
          produtividade_encaminhamento,
          produtividade_folha_objetivo_diario,
          produtividade_evolucao_diurna_cti,
          produtividade_evolucao_noturna_cti,
        };
      },
    );

    setHorasCalculadas(resultado.sort((a, b) => b.totalHoras - a.totalHoras));
  };

  // Clear all filters and data
  const clearDashboardState = useClearDashboardState();
  const handleClearFilters = () => {
    // Clear all filters
    setFiltroTipo([]);
    setFiltroMatricula([]);
    setFiltroNome([]);
    setFiltroCpf([]);
    setFiltroEspecialidade([]);
    setFiltroContrato(null);
    setFiltroUnidade([]);
    setFiltroDataInicio(null);
    setFiltroDataFim(null);

    // Clear data
    setAcessos([]);
    setAcessosFiltrados([]);
    setHorasCalculadas([]);
    setBuscaRealizada(false);

    // Clear sessionStorage
    clearDashboardState();

    setError("");
  };

  // Opções para autocomplete
  const tiposUnicos = useMemo(
    () => [...new Set(acessos.map((a) => a.tipo))].sort(),
    [acessos],
  );
  const matriculasUnicas = useMemo(
    () => [...new Set(acessos.map((a) => a.matricula))].sort(),
    [acessos],
  );
  const nomesUnicos = useMemo(
    () => [...new Set(acessos.map((a) => a.nome))].sort(),
    [acessos],
  );
  const cpfsUnicos = useMemo(
    () => [...new Set(acessos.map((a) => a.cpf))].sort(),
    [acessos],
  );
  const plantasUnicas = useMemo(
    () => [...new Set(acessos.map((a) => a.planta))].filter(Boolean).sort(),
    [acessos],
  );
  const especialidadesUnicas = useMemo(() => {
    const especialidades = new Set<string>();
    usuarios.forEach((u) => {
      if (u.especialidade && Array.isArray(u.especialidade)) {
        u.especialidade.forEach((esp) => {
          if (esp) especialidades.add(esp);
        });
      }
    });
    return [...especialidades].sort();
  }, [usuarios]);

  const handleOpenModal = (person: HorasCalculadas) => {
    setSelectedPerson(person);
    // Usar acessos filtrados ao invés de todos os acessos
    const personAccessHistory = acessosFiltrados
      .filter((a) => a.cpf === person.cpf)
      .sort(
        (a, b) =>
          new Date(b.data_acesso).getTime() - new Date(a.data_acesso).getTime(),
      );
    setPersonAcessos(personAccessHistory);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedPerson(null);
    setPersonAcessos([]);
  };

  const handleOpenProdutividadeModal = async (person: HorasCalculadas) => {
    console.log("=== INICIANDO BUSCA DE PRODUTIVIDADE ===");
    console.log(`Pessoa: ${person.nome} (CPF: ${person.cpf})`);
    console.log(
      `Período: ${
        filtroDataInicio ? format(filtroDataInicio, "dd/MM/yyyy") : "N/A"
      } a ${filtroDataFim ? format(filtroDataFim, "dd/MM/yyyy") : "N/A"}`,
    );

    setSelectedPersonProdutividade(person);
    setProdutividadeModalOpen(true);

    try {
      // Buscar o codigo_mv do usuário
      const usuario = usuarios.find((u) => u.cpf === person.cpf);

      let personProdHistory: Produtividade[] = [];

      // Buscar DIRETAMENTE no banco com os filtros de data (igual Escalas Médicas)
      if (filtroDataInicio && filtroDataFim) {
        console.log("🔍 Buscando diretamente no banco de dados...");

        const dataInicioFormatada = format(filtroDataInicio, "yyyy-MM-dd");
        const dataFimFormatada = format(filtroDataFim, "yyyy-MM-dd");

        let query = supabase
          .from("produtividade")
          .select("*")
          .gte("data", dataInicioFormatada)
          .lte("data", dataFimFormatada)
          .order("data", { ascending: false });

        // Estratégia 1: Buscar por codigo_mv (método preferencial)
        if (usuario?.codigomv) {
          console.log(`Buscando por codigo_mv: ${usuario.codigomv}`);
          query = query.eq("codigo_mv", usuario.codigomv);
        }
        // Estratégia 2: Buscar por nome com ilike (igual EscalasMedicas)
        else {
          console.log(`Buscando por nome: ${person.nome}`);
          query = query.ilike("nome", `%${person.nome}%`);
        }

        const { data, error } = await query;

        if (error) {
          console.error("❌ Erro ao buscar produtividade:", error);
          throw error;
        }

        personProdHistory = data || [];
        console.log(
          `✅ Busca direta no banco: ${personProdHistory.length} registros encontrados`,
        );
      } else {
        console.warn(
          "⚠️ Filtros de data não definidos, usando busca na memória...",
        );

        // Fallback: buscar na memória (dados já carregados)
        if (usuario?.codigomv) {
          personProdHistory = produtividade.filter(
            (p) => p.codigo_mv === usuario.codigomv,
          );
        } else {
          const nomeNormalizado = person.nome
            .toLowerCase()
            .trim()
            .replace(/\s+/g, " ");
          personProdHistory = produtividade.filter((p) => {
            const nomeProdNormalizado = p.nome
              .toLowerCase()
              .trim()
              .replace(/\s+/g, " ");
            return (
              nomeProdNormalizado.includes(nomeNormalizado) ||
              nomeNormalizado.includes(nomeProdNormalizado)
            );
          });
        }

        // Aplicar filtros de data manualmente se necessário
        if (filtroDataInicio) {
          const inicioNormalizado = new Date(filtroDataInicio);
          inicioNormalizado.setHours(0, 0, 0, 0);
          personProdHistory = personProdHistory.filter((p) => {
            if (!p.data) return false;
            const [year, month, day] = p.data
              .split("T")[0]
              .split("-")
              .map(Number);
            const dataProducao = new Date(year, month - 1, day);
            return dataProducao >= inicioNormalizado;
          });
        }

        if (filtroDataFim) {
          const fimNormalizado = new Date(filtroDataFim);
          fimNormalizado.setHours(0, 0, 0, 0);
          personProdHistory = personProdHistory.filter((p) => {
            if (!p.data) return false;
            const [year, month, day] = p.data
              .split("T")[0]
              .split("-")
              .map(Number);
            const dataProducao = new Date(year, month - 1, day);
            return dataProducao <= fimNormalizado;
          });
        }

        personProdHistory = personProdHistory.sort((a, b) => {
          if (!a.data || !b.data) return 0;
          return new Date(b.data).getTime() - new Date(a.data).getTime();
        });
      }

      // Log de diagnóstico
      if (personProdHistory.length === 0) {
        console.warn("=== DIAGNÓSTICO DE PRODUTIVIDADE ===");
        console.warn(`CPF: ${person.cpf}`);
        console.warn(`Nome: ${person.nome}`);
        console.warn(`Usuário encontrado: ${!!usuario}`);
        console.warn(`Codigo MV: ${usuario?.codigomv || "N/A"}`);
        console.warn(
          `Período de busca: ${
            filtroDataInicio ? format(filtroDataInicio, "dd/MM/yyyy") : "N/A"
          } a ${filtroDataFim ? format(filtroDataFim, "dd/MM/yyyy") : "N/A"}`,
        );
      } else {
        console.log(
          `✅ Sucesso! ${personProdHistory.length} registros de produtividade encontrados`,
        );
      }

      setPersonProdutividade(personProdHistory);
    } catch (err) {
      console.error("❌ Erro ao buscar produtividade:", err);
      setPersonProdutividade([]);
    }
  };

  const handleCloseProdutividadeModal = () => {
    setProdutividadeModalOpen(false);
    setSelectedPersonProdutividade(null);
    setPersonProdutividade([]);
  };

  const handleContratoChange = (_: any, newValue: Contrato | null) => {
    if (newValue && !filtroContrato) {
      // Se está selecionando um contrato pela primeira vez, mostrar aviso
      setPendingContrato(newValue);
      setContratoWarningOpen(true);
    } else {
      // Se está removendo o filtro de contrato
      setFiltroContrato(newValue);
    }
  };

  const handleContratoWarningAccept = () => {
    setFiltroContrato(pendingContrato);
    setContratoWarningOpen(false);
    setPendingContrato(null);
  };

  const handleContratoWarningClose = () => {
    setContratoWarningOpen(false);
    setPendingContrato(null);
  };

  // Calcular inconsistências entre produtividade e acessos
  const inconsistencias = useMemo(() => {
    // GUARD: Prevenir race condition - só calcular quando os dados estiverem carregados
    // Verifica se estamos em estado de loading ou se os dados essenciais ainda não foram carregados
    if (
      loading ||
      !buscaRealizada ||
      acessos.length === 0 ||
      usuarios.length === 0
    ) {
      console.log(
        "⏳ Aguardando carregamento completo dos dados antes de calcular inconsistências",
      );
      return {
        prodSemAcesso: [],
        acessoSemProd: [],
      };
    }

    // Usar a função utilitária de normalização de CPF
    const normalizeCPF = normalizeCPFUtil;

    // Helper function to normalize names for comparison
    const normalizeName = (name: string | null | undefined): string => {
      if (!name) return "";
      return name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ") // Remove extra spaces
        .normalize("NFD") // Decompose accented characters
        .replace(/[\u0300-\u036f]/g, ""); // Remove diacritics
    };

    // Usar a função utilitária de extração de data
    const extractDateString = extractDateStringUtil;

    // Mapear os usuarios para ter relação cpf <-> codigomv
    const cpfToCodigoMV = new Map<string, string>();
    const codigoMVToCPF = new Map<string, string>();
    const duplicateCodigoMV = new Map<string, string[]>(); // Track duplicates

    usuarios.forEach((u) => {
      if (u.cpf && u.codigomv) {
        const normalizedCPF = normalizeCPF(u.cpf);

        // Check for duplicate codigomv
        if (codigoMVToCPF.has(u.codigomv)) {
          const existingCPF = codigoMVToCPF.get(u.codigomv);
          if (!duplicateCodigoMV.has(u.codigomv)) {
            duplicateCodigoMV.set(u.codigomv, [existingCPF!]);
          }
          duplicateCodigoMV.get(u.codigomv)!.push(normalizedCPF);
          console.warn(
            `⚠️ codigomv duplicado: "${u.codigomv}" encontrado para CPFs: ${duplicateCodigoMV.get(u.codigomv)!.join(", ")}`,
          );
        }

        cpfToCodigoMV.set(normalizedCPF, u.codigomv);
        codigoMVToCPF.set(u.codigomv, normalizedCPF);
      }
    });

    if (duplicateCodigoMV.size > 0) {
      console.warn(
        `⚠️ Total de codigomv duplicados: ${duplicateCodigoMV.size}`,
      );
      console.warn(
        "⚠️ Isso pode causar inconsistências! Cada codigomv deveria ser único.",
      );
    }

    // Debug: Check CRISTINA in usuarios table
    const cristinaUsuario = usuarios.find((u) =>
      u.nome?.includes("CRISTINA CRUVINEL"),
    );
    if (cristinaUsuario) {
      console.log("👤 CRISTINA em usuarios:", {
        nome: cristinaUsuario.nome,
        cpf: cristinaUsuario.cpf,
        codigomv: cristinaUsuario.codigomv,
        cpf_length: cristinaUsuario.cpf?.length,
      });

      // Check what CPF is mapped for this codigomv
      const mappedCPF = codigoMVToCPF.get(cristinaUsuario.codigomv || "");
      console.log(
        `🔍 Mapeamento para codigomv "${cristinaUsuario.codigomv}": ${mappedCPF}`,
      );

      // Find all users with this codigomv
      const allWithSameCodigoMV = usuarios.filter(
        (u) => u.codigomv === cristinaUsuario.codigomv,
      );
      if (allWithSameCodigoMV.length > 1) {
        console.log(
          `⚠️ Encontrados ${allWithSameCodigoMV.length} usuários com codigomv "${cristinaUsuario.codigomv}":`,
        );
        allWithSameCodigoMV.forEach((u) => {
          console.log(`   - ${u.nome} (CPF: ${u.cpf})`);
        });
      }
    }

    console.log(
      `🗺️ Total de mapeamentos codigoMV → CPF: ${codigoMVToCPF.size}`,
    );

    // Aplicar filtros de data para normalização
    const dataInicioNormalizada = filtroDataInicio
      ? new Date(filtroDataInicio)
      : null;
    if (dataInicioNormalizada) dataInicioNormalizada.setHours(0, 0, 0, 0);

    const dataFimNormalizada = filtroDataFim ? new Date(filtroDataFim) : null;
    if (dataFimNormalizada) dataFimNormalizada.setHours(0, 0, 0, 0);

    // Agrupar acessos por pessoa e data (com filtros aplicados)
    const acessosPorPessoaData = new Map<string, Set<string>>();

    // Debug: Log sample CPFs from acessos to see format
    console.log("📋 Amostra de CPFs na tabela acessos (primeiros 10):");
    acessos.slice(0, 10).forEach((a) => {
      console.log(`  ${a.nome}: CPF="${a.cpf}" (length: ${a.cpf?.length})`);
    });

    // Check if CRISTINA exists in acessos
    const cristinaAcessos = acessos.filter((a) => a.nome?.includes("CRISTINA"));
    console.log(
      `📋 Registros de CRISTINA CRUVINEL FREITAS em acessos: ${cristinaAcessos.length}`,
    );
    if (cristinaAcessos.length > 0) {
      console.log("   Exemplo:", {
        nome: cristinaAcessos[0].nome,
        cpf: cristinaAcessos[0].cpf,
        data: cristinaAcessos[0].data_acesso,
      });
    }

    // Debug: Track filtered out acessos for specific CPF
    let totalAcessos = 0;
    let filteredByNome = 0;
    let filteredByUnidade = 0;
    let filteredByContrato = 0;
    let filteredByData = 0;

    acessos.forEach((acesso) => {
      totalAcessos++;

      // Normalize CPF for comparison
      const normalizedCPF = normalizeCPF(acesso.cpf);

      // Debug for specific CPF
      const isDebugCPF = normalizedCPF === "99282089134";
      if (isDebugCPF) {
        console.log("🔍 Acesso encontrado para CRISTINA:", {
          cpf_original: acesso.cpf,
          cpf_normalizado: normalizedCPF,
          nome: acesso.nome,
          data: acesso.data_acesso,
          planta: acesso.planta,
        });
      }

      // Aplicar filtros de nome
      if (filtroNome.length > 0 && !filtroNome.includes(acesso.nome)) {
        if (isDebugCPF) console.log("❌ Filtrado por NOME");
        filteredByNome++;
        return;
      }

      // Aplicar filtro de unidade hospitalar
      if (filtroUnidade.length > 0 && !filtroUnidade.includes(acesso.planta)) {
        if (isDebugCPF) console.log("❌ Filtrado por UNIDADE");
        filteredByUnidade++;
        return;
      }

      // Aplicar filtro de contrato (normalize CPFs for comparison)
      if (cpfsDoContratoFiltrado.length > 0) {
        const normalizedContratosCPFs =
          cpfsDoContratoFiltrado.map(normalizeCPF);
        if (!normalizedContratosCPFs.includes(normalizedCPF)) {
          if (isDebugCPF) console.log("❌ Filtrado por CONTRATO");
          filteredByContrato++;
          return;
        }
      }

      // Aplicar filtros de data
      const dataAcesso = new Date(acesso.data_acesso);
      dataAcesso.setHours(0, 0, 0, 0);

      if (dataInicioNormalizada && dataAcesso < dataInicioNormalizada) {
        if (isDebugCPF) console.log("❌ Filtrado por DATA (antes do início)");
        filteredByData++;
        return;
      }
      if (dataFimNormalizada && dataAcesso > dataFimNormalizada) {
        if (isDebugCPF) console.log("❌ Filtrado por DATA (depois do fim)");
        filteredByData++;
        return;
      }

      // Extract date string (handles timezone consistently)
      const dataStr = extractDateString(acesso.data_acesso);
      if (!dataStr) return; // Skip if invalid date

      // Use normalized CPF as key
      const key = normalizedCPF;
      if (!acessosPorPessoaData.has(key)) {
        acessosPorPessoaData.set(key, new Set());
      }
      acessosPorPessoaData.get(key)!.add(dataStr);

      if (isDebugCPF) {
        console.log("✅ Acesso ADICIONADO ao mapa:", {
          cpf_normalizado: key,
          data: dataStr,
        });
      }

      // Debug logging for first 3 entries
      if (
        acessosPorPessoaData.size <= 3 &&
        acessosPorPessoaData.get(key)!.size === 1
      ) {
        console.log("📥 Acesso adicionado:", {
          nome: acesso.nome,
          cpf: key,
          data: dataStr,
          data_original: acesso.data_acesso,
        });
      }
    });

    // Criar mapa de nome -> CPF dos acessos filtrados (para fallback de matching)
    const nomeParaCPFMap = new Map<string, string>();
    acessosPorPessoaData.forEach((datas, cpf) => {
      const acesso = acessos.find((a) => normalizeCPF(a.cpf) === cpf);
      if (acesso && acesso.nome) {
        const nomeNorm = normalizeName(acesso.nome);
        // Se houver duplicatas, mantenha o primeiro encontrado
        if (!nomeParaCPFMap.has(nomeNorm)) {
          nomeParaCPFMap.set(nomeNorm, cpf);
        }
      }
    });

    // Agrupar produtividade por pessoa e data (com filtros aplicados)
    // IMPORTANTE: Só considera como produtividade válida se a soma das atividades for > 0
    const produtividadePorPessoaData = new Map<string, Set<string>>();

    // Debug: Check CRISTINA in produtividade
    const cristinaProd = produtividade.filter((p) =>
      p.nome?.includes("CRISTINA"),
    );
    if (cristinaProd.length > 0) {
      const cristinaCPF = codigoMVToCPF.get(cristinaProd[0].codigo_mv);
      console.log("📊 CRISTINA em produtividade:", {
        nome: cristinaProd[0].nome,
        codigo_mv: cristinaProd[0].codigo_mv,
        cpf_mapeado: cristinaCPF,
        cpf_length: cristinaCPF?.length,
      });
    }

    // DEBUG: Contador para Cristina
    let cristinaTotal = 0;
    let cristinaFiltrados = {
      semData: 0,
      semCPF: 0,
      somaZero: 0,
      filtroNome: 0,
      filtroEspecialidade: 0,
      filtroUnidade: 0,
      filtroContrato: 0,
      filtroData: 0,
      adicionados: 0,
    };

    produtividade.forEach((prod) => {
      // DEBUG: Rastrear Cristina
      const isCristina = prod.nome?.includes("CRISTINA");
      if (isCristina) cristinaTotal++;

      if (!prod.data) {
        if (isCristina) cristinaFiltrados.semData++;
        return;
      }

      // Estratégia 1: Tentar mapear por codigo_mv
      let cpf = codigoMVToCPF.get(prod.codigo_mv);

      // Estratégia 2: Se não encontrou por codigo_mv, tentar encontrar por nome
      // Usa o mapa de nomes dos acessos FILTRADOS para garantir consistência
      if (!cpf && prod.nome) {
        const nomeNormalizado = normalizeName(prod.nome);
        cpf = nomeParaCPFMap.get(nomeNormalizado);
      }

      // Se ainda não encontrou CPF, pular este registro
      if (!cpf) {
        if (isCristina) {
          cristinaFiltrados.semCPF++;
          console.log("❌ CRISTINA: Registro SEM CPF:", {
            data: prod.data,
            codigo_mv: prod.codigo_mv,
            codigomv_existe: codigoMVToCPF.has(prod.codigo_mv),
            nome_no_mapa: nomeParaCPFMap.has(normalizeName(prod.nome)),
          });
        }
        return;
      }

      // Calcular soma de todas as atividades de produtividade
      const somaProdutividade =
        prod.procedimento +
        prod.parecer_solicitado +
        prod.parecer_realizado +
        prod.cirurgia_realizada +
        prod.prescricao +
        prod.evolucao +
        prod.urgencia +
        prod.ambulatorio +
        prod.auxiliar +
        prod.encaminhamento +
        prod.folha_objetivo_diario +
        prod.evolucao_diurna_cti +
        prod.evolucao_noturna_cti;

      // Se a soma for 0, não é considerado produtividade válida
      if (somaProdutividade === 0) {
        if (isCristina) cristinaFiltrados.somaZero++;
        return;
      }

      // Aplicar filtros de nome
      if (filtroNome.length > 0 && !filtroNome.includes(prod.nome)) {
        if (isCristina) cristinaFiltrados.filtroNome++;
        return;
      }

      // Aplicar filtro de especialidade
      if (filtroEspecialidade.length > 0) {
        const usuario = usuarios.find((u) => normalizeCPF(u.cpf) === cpf);
        if (
          !usuario ||
          !usuario.especialidade ||
          !usuario.especialidade.some((esp) =>
            filtroEspecialidade.includes(esp),
          )
        ) {
          if (isCristina) cristinaFiltrados.filtroEspecialidade++;
          return;
        }
      }

      // Aplicar filtro de unidade hospitalar
      if (filtroUnidade.length > 0 && prod.unidade_hospitalar_id) {
        const unidadeItem = unidades.find(
          (u) => u.id === prod.unidade_hospitalar_id,
        );
        if (!unidadeItem || !filtroUnidade.includes(unidadeItem.codigo)) {
          if (isCristina) cristinaFiltrados.filtroUnidade++;
          return;
        }
      }

      // Aplicar filtro de contrato
      if (
        cpfsDoContratoFiltrado.length > 0 &&
        !cpfsDoContratoFiltrado.includes(cpf)
      ) {
        if (isCristina) cristinaFiltrados.filtroContrato++;
        return;
      }

      // Aplicar filtros de data
      const dataStr = extractDateString(prod.data);
      if (!dataStr) {
        if (isCristina) cristinaFiltrados.filtroData++;
        return; // Skip if invalid date
      }

      // Parse for date comparison (using string parts to avoid timezone issues)
      const [year, month, day] = dataStr.split("-").map(Number);
      const dataProd = new Date(year, month - 1, day);

      if (dataInicioNormalizada && dataProd < dataInicioNormalizada) {
        if (isCristina) cristinaFiltrados.filtroData++;
        return;
      }
      if (dataFimNormalizada && dataProd > dataFimNormalizada) {
        if (isCristina) cristinaFiltrados.filtroData++;
        return;
      }
      const key = `${cpf}`;
      if (!produtividadePorPessoaData.has(key)) {
        produtividadePorPessoaData.set(key, new Set());
      }
      produtividadePorPessoaData.get(key)!.add(dataStr);

      // DEBUG: Contador de adicionados
      if (isCristina) cristinaFiltrados.adicionados++;

      // Debug logging expandido
      if (produtividadePorPessoaData.size <= 5) {
        console.log("📊 Produtividade adicionada:", {
          nome: prod.nome,
          cpf: key,
          cpf_length: key.length,
          data: dataStr,
          data_original: prod.data,
          codigo_mv: prod.codigo_mv,
          fonte:
            cpf === codigoMVToCPF.get(prod.codigo_mv) ? "codigo_mv" : "nome",
        });
      }
    });

    // DEBUG: Resumo da Cristina
    if (cristinaTotal > 0) {
      console.log("🔍 RESUMO CRISTINA - Processamento de Produtividade:");
      console.log("  📊 Total de registros:", cristinaTotal);
      console.log("  ✅ Adicionados ao mapa:", cristinaFiltrados.adicionados);
      console.log("  ❌ Filtrados:");
      console.log("    - Sem data:", cristinaFiltrados.semData);
      console.log("    - Sem CPF:", cristinaFiltrados.semCPF);
      console.log("    - Soma = 0:", cristinaFiltrados.somaZero);
      console.log("    - Filtro nome:", cristinaFiltrados.filtroNome);
      console.log(
        "    - Filtro especialidade:",
        cristinaFiltrados.filtroEspecialidade,
      );
      console.log("    - Filtro unidade:", cristinaFiltrados.filtroUnidade);
      console.log("    - Filtro contrato:", cristinaFiltrados.filtroContrato);
      console.log("    - Filtro data:", cristinaFiltrados.filtroData);
      console.log("  ---");
    }

    // DEBUG: Resumo dos dados processados
    console.log("📊 RESUMO DO PROCESSAMENTO:");
    console.log("  Total de CPFs com ACESSO:", acessosPorPessoaData.size);
    console.log(
      "  Total de CPFs com PRODUTIVIDADE:",
      produtividadePorPessoaData.size,
    );
    console.log("  ---");

    // Encontrar produtividade sem acesso
    const prodSemAcesso = new Map<string, string[]>();
    produtividadePorPessoaData.forEach((datas, cpf) => {
      const datasAcesso = acessosPorPessoaData.get(cpf) || new Set();
      const datasSemAcesso: string[] = [];
      datas.forEach((data) => {
        if (!datasAcesso.has(data)) {
          datasSemAcesso.push(data);
        }
      });
      if (datasSemAcesso.length > 0) {
        // Encontrar o nome da pessoa a partir dos registros de produtividade
        const prod = produtividade.find(
          (p) => codigoMVToCPF.get(p.codigo_mv) === cpf,
        );
        const nome = prod?.nome || cpf;

        // Debug logging
        console.log("🔍 Produtividade sem Acesso detectada:");
        console.log("  Nome:", nome);
        console.log("  CPF:", cpf);
        console.log("  Datas com produtividade:", Array.from(datas));
        console.log("  Datas com acesso:", Array.from(datasAcesso));
        console.log("  Datas SEM acesso:", datasSemAcesso);

        prodSemAcesso.set(nome, datasSemAcesso);
      }
    });

    // Encontrar acesso sem produtividade
    const acessoSemProd = new Map<string, string[]>();
    acessosPorPessoaData.forEach((datas, cpf) => {
      const datasProd = produtividadePorPessoaData.get(cpf) || new Set();
      const datasSemProd: string[] = [];
      datas.forEach((data) => {
        if (!datasProd.has(data)) {
          datasSemProd.push(data);
        }
      });
      if (datasSemProd.length > 0) {
        // Encontrar o nome da pessoa a partir dos registros de acesso
        const acesso = acessos.find((a) => normalizeCPF(a.cpf) === cpf);
        const nome = acesso?.nome || cpf;

        // DEBUG: Log detalhado para identificar problema
        console.log("🔍 ACESSO SEM PRODUTIVIDADE DETECTADO:");
        console.log("  👤 Nome:", nome);
        console.log("  🆔 CPF:", cpf);
        console.log("  📅 Datas com ACESSO:", Array.from(datas).sort());
        console.log(
          "  ✅ Datas com PRODUTIVIDADE:",
          Array.from(datasProd).sort(),
        );
        console.log("  ❌ Datas SEM produtividade:", datasSemProd.sort());
        console.log("  ---");

        acessoSemProd.set(nome, datasSemProd);
      }
    });

    // Converter para arrays ordenados
    const prodSemAcessoArray = Array.from(prodSemAcesso.entries())
      .map(([nome, datas]) => ({ nome, count: datas.length, datas }))
      .sort((a, b) => b.count - a.count);

    const acessoSemProdArray = Array.from(acessoSemProd.entries())
      .map(([nome, datas]) => ({ nome, count: datas.length, datas }))
      .sort((a, b) => b.count - a.count);

    return {
      prodSemAcesso: prodSemAcessoArray,
      acessoSemProd: acessoSemProdArray,
    };
  }, [
    loading,
    buscaRealizada,
    acessos,
    produtividade,
    usuarios,
    filtroNome,
    filtroEspecialidade,
    filtroUnidade,
    filtroDataInicio,
    filtroDataFim,
    unidades,
    cpfsDoContratoFiltrado,
  ]);

  // Cálculo de Pontualidade e Absenteísmo
  const indicadoresEscalas = useMemo(() => {
    // Aplicar filtros de data para normalização
    const dataInicioNormalizada = filtroDataInicio
      ? new Date(filtroDataInicio)
      : null;
    if (dataInicioNormalizada) dataInicioNormalizada.setHours(0, 0, 0, 0);

    const dataFimNormalizada = filtroDataFim ? new Date(filtroDataFim) : null;
    if (dataFimNormalizada) dataFimNormalizada.setHours(0, 0, 0, 0);

    // Filtrar escalas por data
    const escalasFiltr = escalas.filter((escala) => {
      if (dataInicioNormalizada) {
        // Usa parseISO para evitar problemas de timezone
        const dataEscala = parseISO(escala.data_inicio);
        dataEscala.setHours(0, 0, 0, 0);
        if (dataEscala < dataInicioNormalizada) return false;
      }
      if (dataFimNormalizada) {
        // Usa parseISO para evitar problemas de timezone
        const dataEscala = parseISO(escala.data_inicio);
        dataEscala.setHours(0, 0, 0, 0);
        if (dataEscala > dataFimNormalizada) return false;
      }
      return true;
    });

    // Mapear médicos por CPF com detalhes
    const pontualidadePorMedico = new Map<
      string,
      {
        nome: string;
        totalEscalas: number;
        atrasos: number;
        detalhesAtrasos: Array<{
          data: string;
          horarioEscalado: string;
          horarioEntrada: string;
          atrasoMinutos: number;
        }>;
      }
    >();
    const absenteismoPorMedico = new Map<
      string,
      {
        nome: string;
        totalEscalas: number;
        ausencias: number;
        detalhesAusencias: Array<{ data: string; horarioEscalado: string }>;
      }
    >();

    escalasFiltr.forEach((escala) => {
      escala.medicos?.forEach((medico) => {
        // Extrair data da escala (formato: YYYY-MM-DD)
        const dataStr = escala.data_inicio.split("T")[0];

        // Aplicar filtro de nome
        if (filtroNome.length > 0 && !filtroNome.includes(medico.nome)) return;

        // Aplicar filtro de contrato
        if (
          cpfsDoContratoFiltrado.length > 0 &&
          !cpfsDoContratoFiltrado.includes(medico.cpf)
        )
          return;

        // Inicializar contadores de pontualidade
        if (!pontualidadePorMedico.has(medico.cpf)) {
          pontualidadePorMedico.set(medico.cpf, {
            nome: medico.nome,
            totalEscalas: 0,
            atrasos: 0,
            detalhesAtrasos: [],
          });
        }
        const pontInfo = pontualidadePorMedico.get(medico.cpf)!;
        pontInfo.totalEscalas++;

        // Inicializar contadores de absenteísmo
        if (!absenteismoPorMedico.has(medico.cpf)) {
          absenteismoPorMedico.set(medico.cpf, {
            nome: medico.nome,
            totalEscalas: 0,
            ausencias: 0,
            detalhesAusencias: [],
          });
        }
        const absentInfo = absenteismoPorMedico.get(medico.cpf)!;
        absentInfo.totalEscalas++;

        // Detectar se a escala atravessa meia-noite
        const [horaE, minE] = escala.horario_entrada.split(":").map(Number);
        const [horaS, minS] = escala.horario_saida.split(":").map(Number);
        const minutosEntrada = horaE * 60 + minE;
        const minutosSaida = horaS * 60 + minS;
        const atravessaMeiaNoite = minutosSaida < minutosEntrada;

        // Determinar as datas onde buscar acessos
        const datasParaBuscar = [dataStr];
        if (atravessaMeiaNoite) {
          // Se cruza meia-noite, também buscar no dia seguinte
          const diaSeguinte = parseISO(dataStr);
          diaSeguinte.setDate(diaSeguinte.getDate() + 1);
          const diaSeguinteStr = format(diaSeguinte, "yyyy-MM-dd");
          datasParaBuscar.push(diaSeguinteStr);
        }

        // Verificar acessos do médico nas datas relevantes
        const acessosDoDia = acessos.filter((acesso) => {
          if (acesso.cpf !== medico.cpf) return false;
          if (acesso.sentido !== "E") return false;
          // Extrair data do acesso (formato: YYYY-MM-DD)
          const acessoDataStr = acesso.data_acesso.split("T")[0];
          return datasParaBuscar.includes(acessoDataStr);
        });

        // Se não há acesso nas datas relevantes, conta como ausência
        if (acessosDoDia.length === 0) {
          absentInfo.ausencias++;
          absentInfo.detalhesAusencias.push({
            data: dataStr,
            horarioEscalado: escala.horario_entrada,
          });
        } else {
          // Verificar pontualidade (primeira entrada do dia)
          const primeiraEntrada = acessosDoDia.sort(
            (a, b) =>
              new Date(a.data_acesso).getTime() -
              new Date(b.data_acesso).getTime(),
          )[0];

          const horaEntrada = new Date(primeiraEntrada.data_acesso);
          const [horaEscalada, minEscalada] = escala.horario_entrada
            .split(":")
            .map(Number);
          // Usa parseISO para criar a data base corretamente
          const horaEscaladaDate = parseISO(dataStr);
          horaEscaladaDate.setHours(horaEscalada, minEscalada, 0, 0);

          // Tolerância de 10 minutos APÓS o horário escalado
          // Só conta atraso se chegou DEPOIS do horário + 10 min
          const diferencaMinutos =
            (horaEntrada.getTime() - horaEscaladaDate.getTime()) / (1000 * 60);
          if (diferencaMinutos > 10) {
            pontInfo.atrasos++;
            pontInfo.detalhesAtrasos.push({
              data: dataStr,
              horarioEscalado: escala.horario_entrada,
              horarioEntrada: format(horaEntrada, "HH:mm"),
              atrasoMinutos: Math.round(diferencaMinutos),
            });
          }
        }
      });
    });

    // Calcular índices e ordenar
    const pontualidadeArray = Array.from(pontualidadePorMedico.entries())
      .map(([cpf, info]) => ({
        cpf,
        nome: info.nome,
        totalEscalas: info.totalEscalas,
        atrasos: info.atrasos,
        detalhesAtrasos: info.detalhesAtrasos,
        indice:
          info.totalEscalas > 0
            ? (
                ((info.totalEscalas - info.atrasos) / info.totalEscalas) *
                100
              ).toFixed(1)
            : "0.0",
      }))
      .sort((a, b) => b.atrasos - a.atrasos);

    const absenteismoArray = Array.from(absenteismoPorMedico.entries())
      .map(([cpf, info]) => ({
        cpf,
        nome: info.nome,
        totalEscalas: info.totalEscalas,
        ausencias: info.ausencias,
        detalhesAusencias: info.detalhesAusencias,
        indice:
          info.totalEscalas > 0
            ? ((info.ausencias / info.totalEscalas) * 100).toFixed(1)
            : "0.0",
      }))
      .sort((a, b) => b.ausencias - a.ausencias);

    return {
      pontualidade: pontualidadeArray,
      absenteismo: absenteismoArray,
    };
  }, [
    escalas,
    acessos,
    filtroNome,
    filtroDataInicio,
    filtroDataFim,
    cpfsDoContratoFiltrado,
  ]);

  // NOTE: heatmapData and getHeatmapColor moved to HeatmapChart component

  const handleExportCSV = () => {
    if (!selectedPerson || personAcessos.length === 0) return;

    // Prepare CSV header
    const headers = [
      "Data/Hora",
      "Tipo",
      "Matrícula",
      "Nome",
      "CPF",
      "Sentido",
      "Local",
    ];

    // Prepare CSV rows
    const rows = personAcessos.map((acesso) => [
      format(parseISO(acesso.data_acesso), "dd/MM/yyyy HH:mm:ss", {
        locale: ptBR,
      }),
      acesso.tipo,
      acesso.matricula,
      acesso.nome,
      acesso.cpf,
      acesso.sentido === "E" ? "Entrada" : "Saída",
      "", // Local field (not available in current schema)
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    // Create blob and download
    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `acessos_${selectedPerson.nome.replace(/\s+/g, "_")}_${format(
        new Date(),
        "yyyyMMdd_HHmmss",
      )}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportProdutividadeCSV = () => {
    if (!selectedPersonProdutividade || personProdutividade.length === 0)
      return;

    // Prepare CSV header
    const headers = [
      "Data",
      "Código MV",
      "Nome",
      "Especialidade",
      "Vínculo",
      "Procedimentos",
      "Pareceres Solicitados",
      "Pareceres Realizados",
      "Cirurgias Realizadas",
      "Prescrições",
      "Evoluções",
      "Urgências",
      "Ambulatórios",
    ];

    // Prepare CSV rows
    const rows = personProdutividade.map((prod) => [
      prod.data
        ? format(parseISO(prod.data), "dd/MM/yyyy", { locale: ptBR })
        : "",
      prod.codigo_mv,
      prod.nome,
      prod.especialidade || "",
      prod.vinculo || "",
      prod.procedimento,
      prod.parecer_solicitado,
      prod.parecer_realizado,
      prod.cirurgia_realizada,
      prod.prescricao,
      prod.evolucao,
      prod.urgencia,
      prod.ambulatorio,
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    // Create blob and download
    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `produtividade_${selectedPersonProdutividade.matricula}_${format(
        new Date(),
        "yyyyMMdd_HHmmss",
      )}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenInconsistenciaModal = (
    nome: string,
    tipo: "prodSemAcesso" | "acessoSemProd",
    datas: string[],
  ) => {
    // Se for "produtividade sem acesso", buscar os detalhes de produtividade
    if (tipo === "prodSemAcesso") {
      const detalhesMap = new Map<string, Produtividade[]>();

      datas.forEach((data) => {
        // Buscar todos os registros de produtividade para esta data e pessoa
        const registrosDoDia = produtividade.filter((prod) => {
          if (!prod.data || prod.nome !== nome) return false;
          const dataStr = extractDateStringUtil(prod.data);
          return dataStr === data;
        });

        if (registrosDoDia.length > 0) {
          detalhesMap.set(data, registrosDoDia);
        }
      });

      setInconsistenciaSelecionada({
        nome,
        tipo,
        datas,
        detalhes: detalhesMap,
      });
    } else {
      setInconsistenciaSelecionada({ nome, tipo, datas });
    }

    setInconsistenciaModalOpen(true);
  };

  const handleCloseInconsistenciaModal = () => {
    setInconsistenciaModalOpen(false);
    setInconsistenciaSelecionada(null);
  };

  const handleOpenPontualidadeModal = (cpf: string, nome: string) => {
    const medicoData = indicadoresEscalas.pontualidade.find(
      (p) => p.cpf === cpf,
    );
    if (medicoData) {
      setPontualidadeSelecionada({
        nome,
        cpf,
        atrasos: medicoData.detalhesAtrasos,
      });
      setPontualidadeModalOpen(true);
    }
  };

  const handleClosePontualidadeModal = () => {
    setPontualidadeModalOpen(false);
    setPontualidadeSelecionada(null);
  };

  const handleOpenAbsenteismoModal = (cpf: string, nome: string) => {
    const medicoData = indicadoresEscalas.absenteismo.find(
      (a) => a.cpf === cpf,
    );
    if (medicoData) {
      setAbsenteismoSelecionado({
        nome,
        cpf,
        ausencias: medicoData.detalhesAusencias,
      });
      setAbsenteismoModalOpen(true);
    }
  };

  const handleCloseAbsenteismoModal = () => {
    setAbsenteismoModalOpen(false);
    setAbsenteismoSelecionado(null);
  };

  const handleOpenDiferencaHorasModal = (
    cpf: string,
    nome: string,
    totalHoras: number,
    cargaHorariaEscalada: number,
  ) => {
    // Calcular detalhamento diário
    const acessosPessoa = acessosFiltrados.filter((a) => a.cpf === cpf);
    const escalasPessoa = escalas.filter(
      (e) =>
        e.medicos.some((m) => m.cpf === cpf) &&
        (!filtroDataInicio ||
          parseISO(e.data_inicio) >= new Date(filtroDataInicio)) &&
        (!filtroDataFim || parseISO(e.data_inicio) <= new Date(filtroDataFim)),
    );

    // Agrupar acessos por dia
    const acessosPorDia = acessosPessoa.reduce(
      (acc, acesso) => {
        const dataStr = format(parseISO(acesso.data_acesso), "yyyy-MM-dd");
        if (!acc[dataStr]) {
          acc[dataStr] = [];
        }
        acc[dataStr].push(acesso);
        return acc;
      },
      {} as Record<string, Acesso[]>,
    );

    // Calcular horas por dia usando a mesma lógica do cálculo principal
    const diasOrdenados = Object.keys(acessosPorDia).sort();
    const detalhamentoDiario = diasOrdenados.map((dataStr, i) => {
      const acessosDia = acessosPorDia[dataStr];

      // IMPORTANTE: Ordenar os acessos do dia por horário
      const acessosDiaOrdenados = acessosDia.sort(
        (a, b) =>
          new Date(a.data_acesso).getTime() - new Date(b.data_acesso).getTime(),
      );

      const entradasDia = acessosDiaOrdenados.filter((a) => a.sentido === "E");
      const saidasDia = acessosDiaOrdenados.filter((a) => a.sentido === "S");

      let horasTrabalhadas = 0;

      if (entradasDia.length > 0) {
        const primeiraEntrada = parseISO(entradasDia[0].data_acesso);

        // Se há saída no mesmo dia, usar a última saída do dia
        if (saidasDia.length > 0) {
          const ultimaSaida = parseISO(
            saidasDia[saidasDia.length - 1].data_acesso,
          );

          if (ultimaSaida > primeiraEntrada) {
            const minutos =
              (ultimaSaida.getTime() - primeiraEntrada.getTime()) / (1000 * 60);
            horasTrabalhadas = minutos / 60;
          }
        } else {
          // Último registro do dia é entrada, buscar primeira saída do dia seguinte
          for (let j = i + 1; j < diasOrdenados.length; j++) {
            const proximoDia = diasOrdenados[j];
            const acessosProximoDia = acessosPorDia[proximoDia];
            const saidasProximoDia = acessosProximoDia.filter(
              (a) => a.sentido === "S",
            );

            if (saidasProximoDia.length > 0) {
              const primeiraSaidaProximoDia = parseISO(
                saidasProximoDia[0].data_acesso,
              );
              const minutos =
                (primeiraSaidaProximoDia.getTime() -
                  primeiraEntrada.getTime()) /
                (1000 * 60);
              horasTrabalhadas = minutos / 60;
              break;
            }
          }
        }
      }

      // Calcular carga escalada para este dia
      const escalaDia = escalasPessoa.find(
        (e) => format(parseISO(e.data_inicio), "yyyy-MM-dd") === dataStr,
      );
      let cargaEscalada = 0;
      if (escalaDia) {
        const [horaEntrada, minEntrada] = escalaDia.horario_entrada
          .split(":")
          .map(Number);
        const [horaSaida, minSaida] = escalaDia.horario_saida
          .split(":")
          .map(Number);
        let minutosTotais =
          horaSaida * 60 + minSaida - (horaEntrada * 60 + minEntrada);
        if (minutosTotais < 0) {
          minutosTotais += 24 * 60;
        }
        cargaEscalada = minutosTotais / 60;
      }

      return {
        data: dataStr,
        horasTrabalhadas: parseFloat(horasTrabalhadas.toFixed(2)),
        cargaEscalada: parseFloat(cargaEscalada.toFixed(2)),
        diferenca: parseFloat((horasTrabalhadas - cargaEscalada).toFixed(2)),
      };
    });

    setDiferencaHorasSelecionada({
      nome,
      cpf,
      totalHoras,
      cargaHorariaEscalada,
      diferenca: totalHoras - cargaHorariaEscalada,
      detalhamentoDiario,
    });
    setDiferencaHorasModalOpen(true);
  };

  const handleCloseDiferencaHorasModal = () => {
    setDiferencaHorasModalOpen(false);
    setDiferencaHorasSelecionada(null);
  };

  const handleOpenHorasEscaladasModal = (cpf: string, nome: string) => {
    // Filter escalas for this person within the date range
    const escalasPessoa = escalas.filter(
      (e) =>
        e.medicos.some((m) => m.cpf === cpf) &&
        (!filtroDataInicio ||
          parseISO(e.data_inicio) >= new Date(filtroDataInicio)) &&
        (!filtroDataFim || parseISO(e.data_inicio) <= new Date(filtroDataFim)),
    );

    // Calculate details for each escala
    const detalhamento = escalasPessoa.map((escala) => {
      const [horaEntrada, minEntrada] = escala.horario_entrada
        .split(":")
        .map(Number);
      const [horaSaida, minSaida] = escala.horario_saida.split(":").map(Number);
      let minutosTotais =
        horaSaida * 60 + minSaida - (horaEntrada * 60 + minEntrada);
      if (minutosTotais < 0) {
        minutosTotais += 24 * 60;
      }
      const horas = minutosTotais / 60;

      return {
        data: escala.data_inicio,
        horarioEntrada: escala.horario_entrada,
        horarioSaida: escala.horario_saida,
        horas: parseFloat(horas.toFixed(2)),
        observacoes: escala.observacoes,
        status: escala.status,
      };
    });

    // Calculate total hours
    const totalHoras = detalhamento.reduce((sum, item) => sum + item.horas, 0);

    setHorasEscaladasSelecionadas({
      nome,
      cpf,
      totalHoras: parseFloat(totalHoras.toFixed(2)),
      detalhamento: detalhamento.sort((a, b) => b.data.localeCompare(a.data)),
    });
    setHorasEscaladasModalOpen(true);
  };

  const handleCloseHorasEscaladasModal = () => {
    setHorasEscaladasModalOpen(false);
    setHorasEscaladasSelecionadas(null);
  };

  const handleOpenHorasUnidadeModal = (cpf: string, nome: string) => {
    // Filter accesses for this person
    const acessosPessoa = acessosFiltrados.filter((a) => a.cpf === cpf);

    // Group accesses by day
    const acessosPorDia = acessosPessoa.reduce(
      (acc, acesso) => {
        const dataStr = format(parseISO(acesso.data_acesso), "yyyy-MM-dd");
        if (!acc[dataStr]) {
          acc[dataStr] = [];
        }
        acc[dataStr].push(acesso);
        return acc;
      },
      {} as Record<string, Acesso[]>,
    );

    // Calculate hours per day
    const diasOrdenados = Object.keys(acessosPorDia).sort();
    const detalhamento = diasOrdenados.map((dataStr, i) => {
      const acessosDia = acessosPorDia[dataStr];
      const acessosDiaOrdenados = acessosDia.sort(
        (a, b) =>
          new Date(a.data_acesso).getTime() - new Date(b.data_acesso).getTime(),
      );

      const entradasDia = acessosDiaOrdenados.filter((a) => a.sentido === "E");
      const saidasDia = acessosDiaOrdenados.filter((a) => a.sentido === "S");

      let horasTrabalhadas = 0;
      let primeiraEntradaStr = "-";
      let ultimaSaidaStr = "-";

      if (entradasDia.length > 0) {
        const primeiraEntrada = parseISO(entradasDia[0].data_acesso);
        primeiraEntradaStr = format(primeiraEntrada, "HH:mm");

        if (saidasDia.length > 0) {
          const ultimaSaida = parseISO(
            saidasDia[saidasDia.length - 1].data_acesso,
          );
          ultimaSaidaStr = format(ultimaSaida, "HH:mm");

          if (ultimaSaida > primeiraEntrada) {
            const minutos =
              (ultimaSaida.getTime() - primeiraEntrada.getTime()) / (1000 * 60);
            horasTrabalhadas = minutos / 60;
          }
        } else {
          // Look for exit on next day
          for (let j = i + 1; j < diasOrdenados.length; j++) {
            const proximoDia = diasOrdenados[j];
            const acessosProximoDia = acessosPorDia[proximoDia];
            const saidasProximoDia = acessosProximoDia.filter(
              (a) => a.sentido === "S",
            );

            if (saidasProximoDia.length > 0) {
              const primeiraSaidaProximoDia = parseISO(
                saidasProximoDia[0].data_acesso,
              );
              ultimaSaidaStr =
                format(primeiraSaidaProximoDia, "dd/MM") +
                " " +
                format(primeiraSaidaProximoDia, "HH:mm");
              const minutos =
                (primeiraSaidaProximoDia.getTime() -
                  primeiraEntrada.getTime()) /
                (1000 * 60);
              horasTrabalhadas = minutos / 60;
              break;
            }
          }
        }
      }

      return {
        data: dataStr,
        primeiraEntrada: primeiraEntradaStr,
        ultimaSaida: ultimaSaidaStr,
        horas: parseFloat(horasTrabalhadas.toFixed(2)),
        entradas: entradasDia.length,
        saidas: saidasDia.length,
      };
    });

    // Calculate total hours
    const totalHoras = detalhamento.reduce((sum, item) => sum + item.horas, 0);

    setHorasUnidadeSelecionadas({
      nome,
      cpf,
      totalHoras: parseFloat(totalHoras.toFixed(2)),
      detalhamento: detalhamento.reverse(), // Most recent first
    });
    setHorasUnidadeModalOpen(true);
  };

  const handleCloseHorasUnidadeModal = () => {
    setHorasUnidadeModalOpen(false);
    setHorasUnidadeSelecionadas(null);
  };

  const handleExportInconsistenciaCSV = () => {
    if (!inconsistenciaSelecionada) return;

    const { nome, tipo, datas, detalhes } = inconsistenciaSelecionada;
    const tipoTexto =
      tipo === "prodSemAcesso"
        ? "Produtividade sem Acesso"
        : "Acesso sem Produtividade";

    // Prepare CSV com colunas adicionais para produtividade
    let headers: string[];
    let rows: string[][];

    if (tipo === "prodSemAcesso" && detalhes) {
      headers = [
        "Data",
        "Nome",
        "Tipo de Inconsistência",
        "Procedimentos",
        "Pareceres Sol.",
        "Pareceres Real.",
        "Cirurgias",
        "Prescrições",
        "Evoluções",
        "Urgências",
        "Ambulatórios",
        "Total Atividades",
      ];

      rows = datas.map((data) => {
        const registros = detalhes.get(data) || [];

        // Somar todas as atividades do dia
        const totais = registros.reduce(
          (acc, reg) => ({
            procedimento: acc.procedimento + reg.procedimento,
            parecer_solicitado: acc.parecer_solicitado + reg.parecer_solicitado,
            parecer_realizado: acc.parecer_realizado + reg.parecer_realizado,
            cirurgia: acc.cirurgia + reg.cirurgia_realizada,
            prescricao: acc.prescricao + reg.prescricao,
            evolucao: acc.evolucao + reg.evolucao,
            urgencia: acc.urgencia + reg.urgencia,
            ambulatorio: acc.ambulatorio + reg.ambulatorio,
          }),
          {
            procedimento: 0,
            parecer_solicitado: 0,
            parecer_realizado: 0,
            cirurgia: 0,
            prescricao: 0,
            evolucao: 0,
            urgencia: 0,
            ambulatorio: 0,
          },
        );

        const totalAtividades =
          totais.procedimento +
          totais.parecer_solicitado +
          totais.parecer_realizado +
          totais.cirurgia +
          totais.prescricao +
          totais.evolucao +
          totais.urgencia +
          totais.ambulatorio;

        return [
          format(parseISO(data), "dd/MM/yyyy", { locale: ptBR }),
          nome,
          tipoTexto,
          totais.procedimento.toString(),
          totais.parecer_solicitado.toString(),
          totais.parecer_realizado.toString(),
          totais.cirurgia.toString(),
          totais.prescricao.toString(),
          totais.evolucao.toString(),
          totais.urgencia.toString(),
          totais.ambulatorio.toString(),
          totalAtividades.toString(),
        ];
      });
    } else {
      headers = ["Data", "Nome", "Tipo de Inconsistência"];
      rows = datas.map((data) => [
        format(parseISO(data), "dd/MM/yyyy", { locale: ptBR }),
        nome,
        tipoTexto,
      ]);
    }

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `inconsistencia_${nome.replace(/\s+/g, "_")}_${format(
        new Date(),
        "yyyyMMdd_HHmmss",
      )}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const columns: GridColDef[] = [
    {
      field: "nome",
      headerName: "Nome",
      width: 250,
      renderCell: (params) => (
        <Box
          sx={{
            cursor: "pointer",
            "&:hover": {
              "& .MuiTypography-root": {
                color: "primary.main",
              },
            },
          }}
          onClick={() => handleOpenModal(params.row)}
        >
          <Typography variant="body2" fontWeight={600}>
            {params.value}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {params.row.matricula}
          </Typography>
        </Box>
      ),
    },
    { field: "cpf", headerName: "CPF", width: 140 },
    { field: "codigomv", headerName: "Código MV", width: 120 },
    {
      field: "tipo",
      headerName: "Tipo",
      width: 100,
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
      field: "cargaHorariaEscalada",
      headerName: "Horas Escaladas",
      width: 160,
      type: "number",
      filterable: true,
      sortable: true,
      headerAlign: "center",
      align: "center",
      renderCell: (params) => (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 0.5,
            width: "100%",
            cursor: "pointer",
            padding: "4px 8px",
            borderRadius: "6px",
            transition: "all 0.2s",
            "&:hover": {
              bgcolor: "rgba(237, 108, 2, 0.08)",
              transform: "scale(1.05)",
              "& .MuiSvgIcon-root": {
                color: "warning.main",
              },
              "& .MuiTypography-root": {
                color: "warning.dark",
              },
            },
          }}
          onClick={() =>
            handleOpenHorasEscaladasModal(params.row.cpf, params.row.nome)
          }
        >
          <CalendarMonth fontSize="small" color="action" />
          <Typography variant="body2" fontWeight={600} color="warning.main">
            {params.value}h
          </Typography>
        </Box>
      ),
    },
    {
      field: "totalHoras",
      headerName: "Horas na Unidade",
      width: 130,
      type: "number",
      renderCell: (params) => (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            cursor: "pointer",
            padding: "4px 8px",
            borderRadius: "6px",
            transition: "all 0.2s",
            "&:hover": {
              bgcolor: "rgba(59, 130, 246, 0.08)",
              transform: "scale(1.05)",
              "& .MuiSvgIcon-root": {
                color: "primary.main",
              },
              "& .MuiTypography-root": {
                color: "primary.dark",
              },
            },
          }}
          onClick={() =>
            handleOpenHorasUnidadeModal(params.row.cpf, params.row.nome)
          }
        >
          <AccessTime fontSize="small" color="action" />
          <Typography variant="body2" fontWeight={600} color="primary">
            {params.value}h
          </Typography>
        </Box>
      ),
    },
    {
      field: "diferenca",
      headerName: "Diferença",
      width: 110,
      type: "number",
      renderCell: (params) => {
        const row = params.row as HorasCalculadas;
        const diferenca = row.totalHoras - row.cargaHorariaEscalada;
        const isPositive = diferenca > 0;
        const isNegative = diferenca < 0;

        return (
          <Chip
            label={`${diferenca > 0 ? "+" : ""}${diferenca.toFixed(1)}h`}
            size="small"
            onClick={() =>
              handleOpenDiferencaHorasModal(
                row.cpf,
                row.nome,
                row.totalHoras,
                row.cargaHorariaEscalada,
              )
            }
            sx={{
              cursor: "pointer",
              bgcolor: isPositive
                ? "rgba(34, 197, 94, 0.1)"
                : isNegative
                  ? "rgba(239, 68, 68, 0.1)"
                  : "rgba(156, 163, 175, 0.1)",
              color: isPositive
                ? "#16a34a"
                : isNegative
                  ? "#dc2626"
                  : "#6b7280",
              fontWeight: 600,
              "&:hover": {
                bgcolor: isPositive
                  ? "rgba(34, 197, 94, 0.2)"
                  : isNegative
                    ? "rgba(239, 68, 68, 0.2)"
                    : "rgba(156, 163, 175, 0.2)",
                transform: "scale(1.05)",
              },
              transition: "all 0.2s",
            }}
          />
        );
      },
    },
    {
      field: "entradas",
      headerName: "Entradas",
      width: 100,
      type: "number",
      renderCell: (params) => (
        <Chip label={params.value} size="small" color="success" />
      ),
    },
    {
      field: "saidas",
      headerName: "Saídas",
      width: 100,
      type: "number",
      renderCell: (params) => (
        <Chip label={params.value} size="small" color="error" />
      ),
    },
    {
      field: "ultimoAcesso",
      headerName: "Último Acesso",
      width: 180,
      renderCell: (params) => (
        <Typography variant="body2">
          {format(parseISO(params.value), "dd/MM/yyyy HH:mm", { locale: ptBR })}
        </Typography>
      ),
    },
    {
      field: "especialidade",
      headerName: "Especialidade",
      width: 150,
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          sx={{
            bgcolor: "primary.50",
            color: "primary.700",
            fontWeight: 500,
          }}
        />
      ),
    },
    {
      field: "produtividade_procedimento",
      headerName: "Procedimento",
      width: 110,
      type: "number",
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color={params.value > 0 ? "success" : "default"}
        />
      ),
    },
    {
      field: "produtividade_parecer_solicitado",
      headerName: "Parecer Sol.",
      width: 110,
      type: "number",
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color={params.value > 0 ? "success" : "default"}
        />
      ),
    },
    {
      field: "produtividade_parecer_realizado",
      headerName: "Parecer Real.",
      width: 110,
      type: "number",
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color={params.value > 0 ? "success" : "default"}
        />
      ),
    },
    {
      field: "produtividade_cirurgia_realizada",
      headerName: "Cirurgia",
      width: 100,
      type: "number",
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color={params.value > 0 ? "success" : "default"}
        />
      ),
    },
    {
      field: "produtividade_prescricao",
      headerName: "Prescrição",
      width: 100,
      type: "number",
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color={params.value > 0 ? "success" : "default"}
        />
      ),
    },
    {
      field: "produtividade_evolucao",
      headerName: "Evolução",
      width: 100,
      type: "number",
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color={params.value > 0 ? "success" : "default"}
        />
      ),
    },
    {
      field: "produtividade_urgencia",
      headerName: "Urgência",
      width: 100,
      type: "number",
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color={params.value > 0 ? "success" : "default"}
        />
      ),
    },
    {
      field: "produtividade_ambulatorio",
      headerName: "Ambulatório",
      width: 110,
      type: "number",
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color={params.value > 0 ? "success" : "default"}
        />
      ),
    },
    {
      field: "produtividade_auxiliar",
      headerName: "Auxiliar",
      width: 100,
      type: "number",
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color={params.value > 0 ? "success" : "default"}
        />
      ),
    },
    {
      field: "produtividade_encaminhamento",
      headerName: "Encaminh.",
      width: 110,
      type: "number",
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color={params.value > 0 ? "success" : "default"}
        />
      ),
    },
    {
      field: "produtividade_folha_objetivo_diario",
      headerName: "Folha Obj.",
      width: 100,
      type: "number",
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color={params.value > 0 ? "success" : "default"}
        />
      ),
    },
    {
      field: "produtividade_evolucao_diurna_cti",
      headerName: "Evol. Diurna CTI",
      width: 130,
      type: "number",
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color={params.value > 0 ? "success" : "default"}
        />
      ),
    },
    {
      field: "produtividade_evolucao_noturna_cti",
      headerName: "Evol. Noturna CTI",
      width: 130,
      type: "number",
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color={params.value > 0 ? "success" : "default"}
        />
      ),
    },
  ];

  // Estatísticas
  const totalPessoas = horasCalculadas.length;
  const totalHorasGeral = horasCalculadas.reduce(
    (sum, item) => sum + item.totalHoras,
    0,
  );
  const totalDiasUnicos = horasCalculadas.reduce(
    (sum, item) => sum + item.diasComRegistro,
    0,
  );
  const mediaHoras =
    totalDiasUnicos > 0 ? (totalHorasGeral / totalDiasUnicos).toFixed(2) : "0";

  // Cálculo da Produtividade Médica
  // Soma de todas as colunas de produtividade (procedimento até evolucao_noturna_cti) dividido pelo Total de Horas na Unidade
  const totalProdutividade = produtividade.reduce((sum, item) => {
    return (
      sum +
      item.procedimento +
      item.parecer_solicitado +
      item.parecer_realizado +
      item.cirurgia_realizada +
      item.prescricao +
      item.evolucao +
      item.urgencia +
      item.ambulatorio +
      item.auxiliar +
      item.encaminhamento +
      item.folha_objetivo_diario +
      item.evolucao_diurna_cti +
      item.evolucao_noturna_cti
    );
  }, 0);
  const produtividadeMedia =
    totalHorasGeral > 0
      ? (totalProdutividade / totalHorasGeral).toFixed(2)
      : "0";

  // Cálculo da Carga Horária Contratada (com filtros de data e nome aplicados)
  const cargaHorariaContratada = useMemo(() => {
    let totalHoras = 0;

    // Se há filtro de nome, pegar CPFs das pessoas filtradas para buscar seus contratos
    const cpfsFiltrados =
      filtroNome.length > 0 ? horasCalculadas.map((h) => h.cpf) : null;

    contratoItems.forEach((item) => {
      // Filtro de contrato
      if (filtroContrato && item.contrato_id !== filtroContrato.id) {
        return;
      }

      // Encontrar o contrato associado
      const contrato = contratos.find((c) => c.id === item.contrato_id);
      if (!contrato) return;

      // Filtro de nome: verificar se algum usuário filtrado tem esse contrato
      if (cpfsFiltrados) {
        // Buscar se há algum usuário com CPF filtrado que tem esse contrato
        const usuariosDoContrato = usuarios.filter(
          (u) => u.contrato_id === contrato.id,
        );
        const temUsuarioFiltrado = usuariosDoContrato.some((u) =>
          cpfsFiltrados.includes(u.cpf),
        );
        if (!temUsuarioFiltrado) return;
      }

      // Parsear datas de vigência do contrato
      const dataInicioContrato = parseISO(contrato.data_inicio);
      const dataFimContrato = contrato.data_fim
        ? parseISO(contrato.data_fim)
        : new Date(2099, 11, 31);

      // Calcular total de dias de vigência do contrato
      const diasVigenciaTotal =
        Math.ceil(
          (dataFimContrato.getTime() - dataInicioContrato.getTime()) /
            (1000 * 60 * 60 * 24),
        ) + 1;

      // Determinar o período para calcular (interseção entre filtro e vigência)
      let dataInicioCalculo = dataInicioContrato;
      let dataFimCalculo = dataFimContrato;

      // Se há filtro de data início, usar o maior entre filtro e início do contrato
      if (filtroDataInicio) {
        const filtroInicio = new Date(filtroDataInicio);
        filtroInicio.setHours(0, 0, 0, 0);
        if (filtroInicio > dataInicioCalculo) {
          dataInicioCalculo = filtroInicio;
        }
      }

      // Se há filtro de data fim, usar o menor entre filtro e fim do contrato
      if (filtroDataFim) {
        const filtroFim = new Date(filtroDataFim);
        filtroFim.setHours(0, 0, 0, 0);
        if (filtroFim < dataFimCalculo) {
          dataFimCalculo = filtroFim;
        }
      }

      // Verificar se há interseção entre o período do filtro e a vigência
      if (dataInicioCalculo > dataFimCalculo) {
        // Não há interseção
        return;
      }

      // Calcular dias no período filtrado (que interceptam com vigência)
      const diasFiltrados =
        Math.ceil(
          (dataFimCalculo.getTime() - dataInicioCalculo.getTime()) /
            (1000 * 60 * 60 * 24),
        ) + 1;

      // Calcular horas por dia: quantidade total / dias de vigência
      const horasPorDia = item.quantidade / diasVigenciaTotal;

      // Calcular horas no período filtrado
      const horasPeriodo = horasPorDia * diasFiltrados;

      totalHoras += horasPeriodo;
    });

    return totalHoras;
  }, [
    contratoItems,
    contratos,
    filtroDataInicio,
    filtroDataFim,
    filtroContrato,
    filtroNome,
    horasCalculadas,
    usuarios,
  ]);

  // Cálculo da Carga Horária Escalada (com filtros de data e nome aplicados)
  // Soma de (horario_saida - horario_entrada) × número de médicos para cada escala
  const cargaHorariaEscalada = escalas.reduce((sum, escala) => {
    try {
      // Aplicar filtros de data
      if (filtroDataInicio) {
        const dataEscala = new Date(escala.data_inicio);
        dataEscala.setHours(0, 0, 0, 0);
        const inicioNormalizado = new Date(filtroDataInicio);
        inicioNormalizado.setHours(0, 0, 0, 0);
        if (dataEscala < inicioNormalizado) return sum;
      }
      if (filtroDataFim) {
        const dataEscala = new Date(escala.data_inicio);
        dataEscala.setHours(0, 0, 0, 0);
        const fimNormalizado = new Date(filtroDataFim);
        fimNormalizado.setHours(0, 0, 0, 0);
        if (dataEscala > fimNormalizado) return sum;
      }

      // Filtro de nome: contar apenas médicos que estão no filtro
      let medicosParaContar = escala.medicos || [];
      if (filtroNome.length > 0) {
        medicosParaContar = medicosParaContar.filter((medico) =>
          filtroNome.includes(medico.nome),
        );
        // Se nenhum médico desta escala está no filtro, pular
        if (medicosParaContar.length === 0) return sum;
      }

      // Filtro de contrato: contar apenas médicos que estão no contrato filtrado
      if (cpfsDoContratoFiltrado.length > 0) {
        medicosParaContar = medicosParaContar.filter((medico) =>
          cpfsDoContratoFiltrado.includes(medico.cpf),
        );
        // Se nenhum médico desta escala está no contrato, pular
        if (medicosParaContar.length === 0) return sum;
      }

      // Parse dos horários (formato: "HH:mm")
      const [horaEntrada, minEntrada] = escala.horario_entrada
        .split(":")
        .map(Number);
      const [horaSaida, minSaida] = escala.horario_saida.split(":").map(Number);

      // Calcular diferença em minutos
      let minutosTotais =
        horaSaida * 60 + minSaida - (horaEntrada * 60 + minEntrada);

      // Se horário de saída é menor que entrada, significa que passou da meia-noite
      if (minutosTotais < 0) {
        minutosTotais += 24 * 60; // Adicionar 24 horas em minutos
      }

      // Converter para horas
      const horas = minutosTotais / 60;

      // Multiplicar pela quantidade de médicos filtrados
      const numMedicos = medicosParaContar.length;

      return sum + horas * numMedicos;
    } catch (err) {
      console.error("Erro ao calcular horas da escala:", err);
      return sum;
    }
  }, 0);

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ptBR}>
      <Box>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Dashboard Gerencial
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Acompanhe e analise os acessos e horas trabalhadas
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Filtros */}
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
              <Box sx={{ flexGrow: 1 }} />
            </Box>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={4}>
                <Autocomplete
                  multiple
                  value={filtroTipo}
                  onChange={(_, newValue) => setFiltroTipo(newValue)}
                  options={tiposUnicos}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Tipo"
                      placeholder="Selecione um ou mais"
                    />
                  )}
                  size="small"
                  limitTags={2}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <Autocomplete
                  multiple
                  value={filtroMatricula}
                  onChange={(_, newValue) => setFiltroMatricula(newValue)}
                  options={matriculasUnicas}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Matrícula"
                      placeholder="Selecione uma ou mais"
                    />
                  )}
                  size="small"
                  limitTags={2}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
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

              <Grid item xs={12} sm={6} md={4}>
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

              <Grid item xs={12} sm={6} md={4}>
                <Autocomplete
                  multiple
                  value={filtroEspecialidade}
                  onChange={(_, newValue) => setFiltroEspecialidade(newValue)}
                  options={especialidadesUnicas}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Especialidade"
                      placeholder="Selecione uma ou mais"
                    />
                  )}
                  size="small"
                  limitTags={2}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <Autocomplete
                  multiple
                  value={filtroUnidade}
                  onChange={(_, newValue) => setFiltroUnidade(newValue)}
                  options={plantasUnicas}
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

              <Grid item xs={12} sm={6} md={4}>
                <Autocomplete
                  value={filtroContrato}
                  onChange={handleContratoChange}
                  options={contratos}
                  getOptionLabel={(option) =>
                    `${option.nome} - ${option.empresa}`
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Contrato"
                      placeholder="Selecione um contrato"
                    />
                  )}
                  size="small"
                />
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
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

              <Grid item xs={12} sm={6} md={4}>
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
              sx={{ display: "flex", gap: 2, mt: 3, justifyContent: "center" }}
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
                onClick={handleBuscarAcessos}
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
                {loading ? "Buscando..." : "Buscar Acessos"}
              </Button>

              {buscaRealizada && (
                <>
                  <Button
                    variant="outlined"
                    size="large"
                    startIcon={<Refresh />}
                    onClick={handleBuscarAcessos}
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

        {/* Empty State quando nenhuma busca foi realizada */}
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
            <AccessTime
              sx={{ fontSize: 120, color: "primary.main", opacity: 0.3, mb: 3 }}
            />
            <Typography variant="h5" fontWeight={700} gutterBottom>
              Nenhuma busca realizada
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              Para visualizar os acessos e estatísticas, selecione uma data de
              início e uma data de fim nos filtros acima e clique em "Buscar
              Acessos".
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
                  Clique em "Buscar Acessos"
                </Typography>
              </Box>
            </Box>
          </Card>
        ) : (
          <Box>
            {/* Estatísticas */}
            <StatisticsCardsSection
              totalPessoas={totalPessoas}
              totalHorasGeral={totalHorasGeral}
              mediaHoras={mediaHoras}
              produtividadeMedia={produtividadeMedia}
              cargaHorariaContratada={cargaHorariaContratada}
              cargaHorariaEscalada={cargaHorariaEscalada}
            />

            {/* Mapa de Calor */}
            <HeatmapChart
              acessos={acessos}
              usuarios={usuarios}
              filtroTipo={filtroTipo}
              filtroMatricula={filtroMatricula}
              filtroNome={filtroNome}
              filtroCpf={filtroCpf}
              filtroEspecialidade={filtroEspecialidade}
              filtroUnidade={filtroUnidade}
              filtroDataInicio={filtroDataInicio}
              filtroDataFim={filtroDataFim}
              cpfsDoContratoFiltrado={cpfsDoContratoFiltrado}
            />

            {/* Gráfico de Produtividade */}
            <ProductivityBarChart
              produtividade={produtividade}
              usuarios={usuarios}
              unidades={unidades}
              filtroNome={filtroNome}
              filtroUnidade={filtroUnidade}
              filtroDataInicio={filtroDataInicio}
              filtroDataFim={filtroDataFim}
              cpfsDoContratoFiltrado={cpfsDoContratoFiltrado}
            />

            {/* Gráfico de Linha: Acesso de Médicos ao Longo do Tempo */}
            <AccessLineChart
              acessos={acessos}
              usuarios={usuarios}
              filtroNome={filtroNome}
              filtroCpf={filtroCpf}
              filtroUnidade={filtroUnidade}
              filtroEspecialidade={filtroEspecialidade}
              filtroDataInicio={filtroDataInicio}
              filtroDataFim={filtroDataFim}
              cpfsDoContratoFiltrado={cpfsDoContratoFiltrado}
            />

            {/* Seções de Inconsistências */}
            <InconsistenciesSection
              inconsistencias={inconsistencias}
              pageProdSemAcesso={pageProdSemAcesso}
              setPageProdSemAcesso={setPageProdSemAcesso}
              pageAcessoSemProd={pageAcessoSemProd}
              setPageAcessoSemProd={setPageAcessoSemProd}
              itemsPerPage={itemsPerPage}
              onOpenInconsistenciaModal={handleOpenInconsistenciaModal}
              filtroNome={filtroNome}
              filtroDataInicio={filtroDataInicio}
              filtroDataFim={filtroDataFim}
            />

            {/* Indicadores de Escalas */}
            <ScheduleIndicatorsSection
              indicadoresEscalas={indicadoresEscalas}
              pagePontualidade={pagePontualidade}
              setPagePontualidade={setPagePontualidade}
              pageAbsenteismo={pageAbsenteismo}
              setPageAbsenteismo={setPageAbsenteismo}
              itemsPerPage={itemsPerPage}
              onOpenPontualidadeModal={handleOpenPontualidadeModal}
              onOpenAbsenteismoModal={handleOpenAbsenteismoModal}
              filtroNome={filtroNome}
              filtroDataInicio={filtroDataInicio}
              filtroDataFim={filtroDataFim}
            />

            {/* Tabela */}
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
                      rows={horasCalculadas}
                      columns={columns}
                      getRowId={(row) => row.cpf}
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
                        "& .MuiDataGrid-columnHeader": {
                          paddingLeft: "8px",
                          paddingRight: "8px",
                        },
                        "& .MuiDataGrid-cell": {
                          paddingLeft: "8px",
                          paddingRight: "8px",
                        },
                      }}
                    />
                  )}
                </Box>
              </CardContent>
            </Card>

            {/* Modal de Detalhes de Acessos */}
            <AccessHistoryDialog
              open={modalOpen}
              onClose={handleCloseModal}
              selectedPerson={selectedPerson}
              personAcessos={personAcessos}
              onOpenProdutividade={handleOpenProdutividadeModal}
              produtividadeAvailable={produtividade.length > 0}
            />

            {/* Modal de Histórico de Produtividade */}
            <ProductivityHistoryDialog
              open={produtividadeModalOpen}
              onClose={handleCloseProdutividadeModal}
              selectedPerson={selectedPersonProdutividade}
              personProdutividade={personProdutividade}
              onOpenAccessHistory={handleOpenModal}
            />

            {/* Modal de Detalhes de Inconsistência */}
            <InconsistencyDetailsDialog
              open={inconsistenciaModalOpen}
              onClose={handleCloseInconsistenciaModal}
              data={inconsistenciaSelecionada}
            />

            {/* Modal de Aviso de Contrato */}
            <ContractWarningDialog
              open={contratoWarningOpen}
              onClose={handleContratoWarningClose}
              onAccept={handleContratoWarningAccept}
            />

            {/* Modal de Pontualidade */}
            <PunctualityDetailsDialog
              open={pontualidadeModalOpen}
              onClose={handleClosePontualidadeModal}
              data={pontualidadeSelecionada}
            />

            {/* Modal de Absenteísmo */}
            <AbsenteismDetailsDialog
              open={absenteismoModalOpen}
              onClose={handleCloseAbsenteismoModal}
              data={absenteismoSelecionado}
            />

            {/* Modal de Diferença de Horas */}
            <HoursDifferenceDialog
              open={diferencaHorasModalOpen}
              onClose={handleCloseDiferencaHorasModal}
              data={diferencaHorasSelecionada}
            />

            {/* Modal de Detalhes de Horas Escaladas */}
            <ScheduledHoursDialog
              open={horasEscaladasModalOpen}
              onClose={handleCloseHorasEscaladasModal}
              data={horasEscaladasSelecionadas}
            />

            {/* Modal de Detalhes de Horas na Unidade */}
            <UnitHoursDialog
              open={horasUnidadeModalOpen}
              onClose={handleCloseHorasUnidadeModal}
              data={horasUnidadeSelecionadas}
            />
          </Box>
        )}
      </Box>
    </LocalizationProvider>
  );
};

export default Dashboard;
