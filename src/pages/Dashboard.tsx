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
} from "@mui/icons-material";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { supabase } from "../lib/supabase";
import { Acesso, HorasCalculadas, Contrato, Produtividade, Usuario, UnidadeHospitalar, EscalaMedica } from "../types/database.types";
import { useAuth } from "../contexts/AuthContext";
import { format, parseISO, differenceInMinutes } from "date-fns";

const Dashboard: React.FC = () => {
  const { userProfile, isAdminTerceiro, isTerceiro } = useAuth();
  const [acessos, setAcessos] = useState<Acesso[]>([]);
  const [acessosFiltrados, setAcessosFiltrados] = useState<Acesso[]>([]); // Novo state para acessos filtrados
  const [horasCalculadas, setHorasCalculadas] = useState<HorasCalculadas[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [contratoItems, setContratoItems] = useState<ContratoItem[]>([]);
  const [produtividade, setProdutividade] = useState<Produtividade[]>([]);
  const [escalas, setEscalas] = useState<EscalaMedica[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [unidades, setUnidades] = useState<UnidadeHospitalar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filtros - Agora com múltiplas seleções
  const [filtroTipo, setFiltroTipo] = useState<string[]>([]);
  const [filtroMatricula, setFiltroMatricula] = useState<string[]>([]);
  const [filtroNome, setFiltroNome] = useState<string[]>([]);
  const [filtroCpf, setFiltroCpf] = useState<string[]>([]);
  const [filtroSentido, setFiltroSentido] = useState<string[]>([]);
  const [filtroContrato, setFiltroContrato] = useState<Contrato | null>(null);
  const [filtroUnidade, setFiltroUnidade] = useState<string[]>([]);
  const [filtroDataInicio, setFiltroDataInicio] = useState<Date | null>(null);
  const [filtroDataFim, setFiltroDataFim] = useState<Date | null>(null);

  // Modal de detalhes
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<HorasCalculadas | null>(
    null
  );
  const [personAcessos, setPersonAcessos] = useState<Acesso[]>([]);

  // Modal de produtividade
  const [produtividadeModalOpen, setProdutividadeModalOpen] = useState(false);
  const [selectedPersonProdutividade, setSelectedPersonProdutividade] = useState<HorasCalculadas | null>(null);
  const [personProdutividade, setPersonProdutividade] = useState<Produtividade[]>([]);

  // Modal de aviso de contrato
  const [contratoWarningOpen, setContratoWarningOpen] = useState(false);
  const [pendingContrato, setPendingContrato] = useState<Contrato | null>(null);

  // Modal de inconsistências
  const [inconsistenciaModalOpen, setInconsistenciaModalOpen] = useState(false);
  const [inconsistenciaSelecionada, setInconsistenciaSelecionada] = useState<{
    nome: string;
    tipo: 'prodSemAcesso' | 'acessoSemProd';
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

  useEffect(() => {
    loadAcessos();
    loadContratos();
    loadContratoItems();
    loadProdutividade();
    loadEscalas();
    loadUsuarios();
    loadUnidades();
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
    filtroSentido,
    filtroContrato,
    filtroUnidade,
    filtroDataInicio,
    filtroDataFim,
  ]);

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

  const loadProdutividade = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from("produtividade")
        .select("*")
        .order("data", { ascending: false });

      if (fetchError) throw fetchError;
      setProdutividade(data || []);
    } catch (err: any) {
      console.error("Erro ao carregar produtividade:", err);
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
        .select("cpf, codigomv");

      if (fetchError) throw fetchError;
      setUsuarios(data || []);
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

  const loadAcessos = async () => {
    try {
      setLoading(true);
      setError("");

      // Carregar todos os registros usando paginação
      const pageSize = 1000;
      let allAcessos: Acesso[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from("acessos")
          .select("*")
          .order("data_acesso", { ascending: false })
          .range(from, from + pageSize - 1);

        // Aplicar filtros baseados no tipo de usuário
        if (isTerceiro && userProfile) {
          query = query.eq("cpf", userProfile.cpf);
        } else if (isAdminTerceiro && userProfile?.contrato_id) {
          // Buscar CPFs dos usuários vinculados ao contrato do administrador
          const { data: usuariosContrato } = await supabase
            .from("usuario_contrato")
            .select("cpf")
            .eq("contrato_id", userProfile.contrato_id);

          if (usuariosContrato && usuariosContrato.length > 0) {
            const cpfs = usuariosContrato.map((u: any) => u.cpf);
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

      setAcessos(allAcessos);
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
        const { data: usuariosContrato } = await supabase
          .from("usuario_contrato")
          .select("cpf")
          .eq("contrato_id", filtroContrato.id);

        if (usuariosContrato && usuariosContrato.length > 0) {
          cpfsDoContrato = usuariosContrato.map((u: any) => u.cpf);
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
      if (filtroSentido.length > 0 && !filtroSentido.includes(acesso.sentido))
        return false;

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
    const acessosPorCpf = acessosFiltradosLocal.reduce((acc, acesso) => {
      if (!acc[acesso.cpf]) {
        acc[acesso.cpf] = [];
      }
      acc[acesso.cpf].push(acesso);
      return acc;
    }, {} as Record<string, Acesso[]>);

    // Calcular horas para cada CPF
    const resultado: HorasCalculadas[] = Object.entries(acessosPorCpf).map(
      ([cpf, acessosCpf]) => {
        // Ordenar todos os acessos por data
        const acessosOrdenados = acessosCpf.sort(
          (a, b) =>
            new Date(a.data_acesso).getTime() -
            new Date(b.data_acesso).getTime()
        );

        // Agrupar por dia (YYYY-MM-DD)
        const acessosPorDia = acessosOrdenados.reduce((acc, acesso) => {
          const data = format(parseISO(acesso.data_acesso), "yyyy-MM-dd");
          if (!acc[data]) {
            acc[data] = [];
          }
          acc[data].push(acesso);
          return acc;
        }, {} as Record<string, Acesso[]>);

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
                saidasDia[saidasDia.length - 1].data_acesso
              );

              if (ultimaSaida > primeiraEntrada) {
                const minutos = differenceInMinutes(
                  ultimaSaida,
                  primeiraEntrada
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
                  (a) => a.sentido === "S"
                );

                if (saidasProximoDia.length > 0) {
                  const primeiraSaidaProximoDia = parseISO(
                    saidasProximoDia[0].data_acesso
                  );
                  const minutos = differenceInMinutes(
                    primeiraSaidaProximoDia,
                    primeiraEntrada
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
            new Date(a.data_acesso).getTime()
        )[0];

        // Calcular carga horária escalada para este CPF (aplicando filtros de data)
        const escalasDoMedico = escalas.filter(escala => {
          // Verificar se o médico está na escala
          if (!escala.medicos?.some(medico => medico.cpf === cpf)) {
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

        const cargaHorariaEscaladaPorCpf = escalasDoMedico.reduce((sum, escala) => {
          try {
            const [horaEntrada, minEntrada] = escala.horario_entrada.split(":").map(Number);
            const [horaSaida, minSaida] = escala.horario_saida.split(":").map(Number);

            let minutosTotais = (horaSaida * 60 + minSaida) - (horaEntrada * 60 + minEntrada);

            if (minutosTotais < 0) {
              minutosTotais += 24 * 60;
            }

            const horas = minutosTotais / 60;
            return sum + horas;
          } catch (err) {
            console.error("Erro ao calcular horas da escala para CPF:", err);
            return sum;
          }
        }, 0);

        return {
          cpf,
          nome: ultimoAcesso.nome,
          matricula: ultimoAcesso.matricula,
          tipo: ultimoAcesso.tipo,
          totalHoras: parseFloat(totalHoras.toFixed(2)),
          cargaHorariaEscalada: parseFloat(cargaHorariaEscaladaPorCpf.toFixed(2)),
          diasComRegistro: diasUnicos.size,
          entradas: totalEntradas,
          saidas: totalSaidas,
          ultimoAcesso: ultimoAcesso.data_acesso,
        };
      }
    );

    setHorasCalculadas(resultado.sort((a, b) => b.totalHoras - a.totalHoras));
  };

  // Opções para autocomplete
  const tiposUnicos = useMemo(
    () => [...new Set(acessos.map((a) => a.tipo))].sort(),
    [acessos]
  );
  const matriculasUnicas = useMemo(
    () => [...new Set(acessos.map((a) => a.matricula))].sort(),
    [acessos]
  );
  const nomesUnicos = useMemo(
    () => [...new Set(acessos.map((a) => a.nome))].sort(),
    [acessos]
  );
  const cpfsUnicos = useMemo(
    () => [...new Set(acessos.map((a) => a.cpf))].sort(),
    [acessos]
  );
  const plantasUnicas = useMemo(
    () => [...new Set(acessos.map((a) => a.planta))].filter(Boolean).sort(),
    [acessos]
  );

  const handleOpenModal = (person: HorasCalculadas) => {
    setSelectedPerson(person);
    // Usar acessos filtrados ao invés de todos os acessos
    const personAccessHistory = acessosFiltrados
      .filter((a) => a.cpf === person.cpf)
      .sort(
        (a, b) =>
          new Date(b.data_acesso).getTime() - new Date(a.data_acesso).getTime()
      );
    setPersonAcessos(personAccessHistory);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedPerson(null);
    setPersonAcessos([]);
  };

  const handleOpenProdutividadeModal = (person: HorasCalculadas) => {
    setSelectedPersonProdutividade(person);

    // Encontrar o codigomv da pessoa através do CPF na tabela usuarios
    const usuario = usuarios.find((u) => u.cpf === person.cpf);

    if (!usuario || !usuario.codigomv) {
      console.warn(`Nenhum codigomv encontrado para CPF ${person.cpf}`);
      setPersonProdutividade([]);
      setProdutividadeModalOpen(true);
      return;
    }

    // Filtrar produtividade por CODIGO_MV encontrado na tabela usuarios
    let personProdHistory = produtividade
      .filter((p) => p.codigo_mv === usuario.codigomv);

    // Aplicar filtros de data se estiverem definidos
    // Normalizar as datas para comparar apenas o dia (sem hora)
    if (filtroDataInicio) {
      const inicioNormalizado = new Date(filtroDataInicio);
      inicioNormalizado.setHours(0, 0, 0, 0);

      personProdHistory = personProdHistory.filter((p) => {
        if (!p.data) return false;
        // Parse ISO date string (YYYY-MM-DD) correctly
        const [year, month, day] = p.data.split('T')[0].split('-').map(Number);
        const dataProducao = new Date(year, month - 1, day);
        return dataProducao >= inicioNormalizado;
      });
    }

    if (filtroDataFim) {
      const fimNormalizado = new Date(filtroDataFim);
      fimNormalizado.setHours(0, 0, 0, 0);

      personProdHistory = personProdHistory.filter((p) => {
        if (!p.data) return false;
        // Parse ISO date string (YYYY-MM-DD) correctly
        const [year, month, day] = p.data.split('T')[0].split('-').map(Number);
        const dataProducao = new Date(year, month - 1, day);
        return dataProducao <= fimNormalizado;
      });
    }

    // Ordenar por data
    personProdHistory = personProdHistory.sort((a, b) => {
      if (!a.data || !b.data) return 0;
      return new Date(b.data).getTime() - new Date(a.data).getTime();
    });

    setPersonProdutividade(personProdHistory);
    setProdutividadeModalOpen(true);
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

  // Calcular dados do gráfico de produtividade (com filtros aplicados)
  const chartDataProdutividade = useMemo(() => {
    if (produtividade.length === 0) return [];

    // Filtrar dados de produtividade baseado nos filtros avançados
    const produtividadeFiltrada = produtividade.filter((item) => {
      // Filtro de Nome
      if (filtroNome.length > 0 && !filtroNome.includes(item.nome))
        return false;

      // Filtro de Unidade Hospitalar
      if (filtroUnidade.length > 0 && item.unidade_hospitalar_id) {
        const unidadeItem = unidades.find(u => u.id === item.unidade_hospitalar_id);
        if (!unidadeItem || !filtroUnidade.includes(unidadeItem.codigo)) {
          return false;
        }
      }

      // Filtros de data (usando a coluna 'data' da tabela produtividade)
      // Parse ISO date string (YYYY-MM-DD) correctly to avoid timezone issues
      if (filtroDataInicio && item.data) {
        const [year, month, day] = item.data.split('T')[0].split('-').map(Number);
        const dataProd = new Date(year, month - 1, day);
        const inicioNormalizado = new Date(filtroDataInicio);
        inicioNormalizado.setHours(0, 0, 0, 0);
        if (dataProd < inicioNormalizado) return false;
      }
      if (filtroDataFim && item.data) {
        const [year, month, day] = item.data.split('T')[0].split('-').map(Number);
        const dataProd = new Date(year, month - 1, day);
        const fimNormalizado = new Date(filtroDataFim);
        fimNormalizado.setHours(0, 0, 0, 0);
        if (dataProd > fimNormalizado) return false;
      }

      return true;
    });

    const totais = {
      procedimento: 0,
      parecer_solicitado: 0,
      parecer_realizado: 0,
      cirurgia_realizada: 0,
      prescricao: 0,
      evolucao: 0,
      urgencia: 0,
      ambulatorio: 0,
      auxiliar: 0,
      encaminhamento: 0,
      folha_objetivo_diario: 0,
      evolucao_diurna_cti: 0,
      evolucao_noturna_cti: 0,
    };

    produtividadeFiltrada.forEach((item) => {
      totais.procedimento += item.procedimento || 0;
      totais.parecer_solicitado += item.parecer_solicitado || 0;
      totais.parecer_realizado += item.parecer_realizado || 0;
      totais.cirurgia_realizada += item.cirurgia_realizada || 0;
      totais.prescricao += item.prescricao || 0;
      totais.evolucao += item.evolucao || 0;
      totais.urgencia += item.urgencia || 0;
      totais.ambulatorio += item.ambulatorio || 0;
      totais.auxiliar += item.auxiliar || 0;
      totais.encaminhamento += item.encaminhamento || 0;
      totais.folha_objetivo_diario += item.folha_objetivo_diario || 0;
      totais.evolucao_diurna_cti += item.evolucao_diurna_cti || 0;
      totais.evolucao_noturna_cti += item.evolucao_noturna_cti || 0;
    });

    // Criar array de dados para o gráfico (apenas com valores > 0)
    const data = [
      { name: "Procedimento", value: totais.procedimento, color: "#0ea5e9" },
      {
        name: "Parecer Solicitado",
        value: totais.parecer_solicitado,
        color: "#8b5cf6",
      },
      {
        name: "Parecer Realizado",
        value: totais.parecer_realizado,
        color: "#10b981",
      },
      {
        name: "Cirurgia Realizada",
        value: totais.cirurgia_realizada,
        color: "#f59e0b",
      },
      { name: "Prescrição", value: totais.prescricao, color: "#ec4899" },
      { name: "Evolução", value: totais.evolucao, color: "#06b6d4" },
      { name: "Urgência", value: totais.urgencia, color: "#ef4444" },
      { name: "Ambulatório", value: totais.ambulatorio, color: "#6366f1" },
      { name: "Auxiliar", value: totais.auxiliar, color: "#14b8a6" },
      {
        name: "Encaminhamento",
        value: totais.encaminhamento,
        color: "#f97316",
      },
      {
        name: "Folha Objetivo Diário",
        value: totais.folha_objetivo_diario,
        color: "#a855f7",
      },
      {
        name: "Evolução Diurna CTI",
        value: totais.evolucao_diurna_cti,
        color: "#22c55e",
      },
      {
        name: "Evolução Noturna CTI",
        value: totais.evolucao_noturna_cti,
        color: "#3b82f6",
      },
    ].filter((item) => item.value > 0); // Filtrar apenas valores maiores que 0

    return data;
  }, [produtividade, filtroNome, filtroUnidade, filtroDataInicio, filtroDataFim, unidades]);

  // Calcular inconsistências entre produtividade e acessos
  const inconsistencias = useMemo(() => {
    // Mapear os usuarios para ter relação cpf <-> codigomv
    const cpfToCodigoMV = new Map<string, string>();
    const codigoMVToCPF = new Map<string, string>();
    usuarios.forEach((u) => {
      if (u.cpf && u.codigomv) {
        cpfToCodigoMV.set(u.cpf, u.codigomv);
        codigoMVToCPF.set(u.codigomv, u.cpf);
      }
    });

    // Aplicar filtros de data para normalização
    const dataInicioNormalizada = filtroDataInicio ? new Date(filtroDataInicio) : null;
    if (dataInicioNormalizada) dataInicioNormalizada.setHours(0, 0, 0, 0);

    const dataFimNormalizada = filtroDataFim ? new Date(filtroDataFim) : null;
    if (dataFimNormalizada) dataFimNormalizada.setHours(0, 0, 0, 0);

    // Agrupar acessos por pessoa e data (com filtros aplicados)
    const acessosPorPessoaData = new Map<string, Set<string>>();
    acessos.forEach((acesso) => {
      // Aplicar filtros de nome
      if (filtroNome.length > 0 && !filtroNome.includes(acesso.nome)) return;

      // Aplicar filtro de unidade hospitalar
      if (filtroUnidade.length > 0 && !filtroUnidade.includes(acesso.planta)) return;

      // Aplicar filtros de data
      const dataAcesso = new Date(acesso.data_acesso);
      dataAcesso.setHours(0, 0, 0, 0);

      if (dataInicioNormalizada && dataAcesso < dataInicioNormalizada) return;
      if (dataFimNormalizada && dataAcesso > dataFimNormalizada) return;

      const [year, month, day] = acesso.data_acesso.split('T')[0].split('-');
      const dataStr = `${year}-${month}-${day}`;
      const key = `${acesso.cpf}`;
      if (!acessosPorPessoaData.has(key)) {
        acessosPorPessoaData.set(key, new Set());
      }
      acessosPorPessoaData.get(key)!.add(dataStr);
    });

    // Agrupar produtividade por pessoa e data (com filtros aplicados)
    // IMPORTANTE: Só considera como produtividade válida se a soma das atividades for > 0
    const produtividadePorPessoaData = new Map<string, Set<string>>();
    produtividade.forEach((prod) => {
      if (!prod.data) return;
      const cpf = codigoMVToCPF.get(prod.codigo_mv);
      if (!cpf) return;

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
      if (somaProdutividade === 0) return;

      // Aplicar filtros de nome
      if (filtroNome.length > 0 && !filtroNome.includes(prod.nome)) return;

      // Aplicar filtro de unidade hospitalar
      if (filtroUnidade.length > 0 && prod.unidade_hospitalar_id) {
        const unidadeItem = unidades.find(u => u.id === prod.unidade_hospitalar_id);
        if (!unidadeItem || !filtroUnidade.includes(unidadeItem.codigo)) {
          return;
        }
      }

      // Aplicar filtros de data
      const [year, month, day] = prod.data.split('T')[0].split('-').map(Number);
      const dataProd = new Date(year, month - 1, day);

      if (dataInicioNormalizada && dataProd < dataInicioNormalizada) return;
      if (dataFimNormalizada && dataProd > dataFimNormalizada) return;

      const dataStr = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      const key = `${cpf}`;
      if (!produtividadePorPessoaData.has(key)) {
        produtividadePorPessoaData.set(key, new Set());
      }
      produtividadePorPessoaData.get(key)!.add(dataStr);
    });

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
        // Encontrar o nome da pessoa
        const acesso = acessos.find((a) => a.cpf === cpf);
        const nome = acesso?.nome || cpf;
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
        const acesso = acessos.find((a) => a.cpf === cpf);
        const nome = acesso?.nome || cpf;
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
  }, [acessos, produtividade, usuarios, filtroNome, filtroUnidade, filtroDataInicio, filtroDataFim, unidades]);

  // Cálculo de Pontualidade e Absenteísmo
  const indicadoresEscalas = useMemo(() => {
    // Aplicar filtros de data para normalização
    const dataInicioNormalizada = filtroDataInicio ? new Date(filtroDataInicio) : null;
    if (dataInicioNormalizada) dataInicioNormalizada.setHours(0, 0, 0, 0);

    const dataFimNormalizada = filtroDataFim ? new Date(filtroDataFim) : null;
    if (dataFimNormalizada) dataFimNormalizada.setHours(0, 0, 0, 0);

    // Filtrar escalas por data
    const escalasFiltr = escalas.filter(escala => {
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
    const pontualidadePorMedico = new Map<string, {
      nome: string;
      totalEscalas: number;
      atrasos: number;
      detalhesAtrasos: Array<{ data: string; horarioEscalado: string; horarioEntrada: string; atrasoMinutos: number }>;
    }>();
    const absenteismoPorMedico = new Map<string, {
      nome: string;
      totalEscalas: number;
      ausencias: number;
      detalhesAusencias: Array<{ data: string; horarioEscalado: string }>;
    }>();

    escalasFiltr.forEach(escala => {
      escala.medicos?.forEach(medico => {
        // Extrair data da escala (formato: YYYY-MM-DD)
        const dataStr = escala.data_inicio.split('T')[0];

        // Aplicar filtro de nome
        if (filtroNome.length > 0 && !filtroNome.includes(medico.nome)) return;

        // Inicializar contadores de pontualidade
        if (!pontualidadePorMedico.has(medico.cpf)) {
          pontualidadePorMedico.set(medico.cpf, { nome: medico.nome, totalEscalas: 0, atrasos: 0, detalhesAtrasos: [] });
        }
        const pontInfo = pontualidadePorMedico.get(medico.cpf)!;
        pontInfo.totalEscalas++;

        // Inicializar contadores de absenteísmo
        if (!absenteismoPorMedico.has(medico.cpf)) {
          absenteismoPorMedico.set(medico.cpf, { nome: medico.nome, totalEscalas: 0, ausencias: 0, detalhesAusencias: [] });
        }
        const absentInfo = absenteismoPorMedico.get(medico.cpf)!;
        absentInfo.totalEscalas++;

        // Verificar acessos do médico nesta data
        const acessosDoDia = acessos.filter(acesso => {
          if (acesso.cpf !== medico.cpf) return false;
          // Extrair data do acesso (formato: YYYY-MM-DD)
          const acessoDataStr = acesso.data_acesso.split('T')[0];
          return acessoDataStr === dataStr && acesso.sentido === 'E';
        });

        // Se não há acesso neste dia, conta como ausência
        if (acessosDoDia.length === 0) {
          absentInfo.ausencias++;
          absentInfo.detalhesAusencias.push({
            data: dataStr,
            horarioEscalado: escala.horario_entrada
          });
        } else {
          // Verificar pontualidade (primeira entrada do dia)
          const primeiraEntrada = acessosDoDia.sort((a, b) =>
            new Date(a.data_acesso).getTime() - new Date(b.data_acesso).getTime()
          )[0];

          const horaEntrada = new Date(primeiraEntrada.data_acesso);
          const [horaEscalada, minEscalada] = escala.horario_entrada.split(':').map(Number);
          // Usa parseISO para criar a data base corretamente
          const horaEscaladaDate = parseISO(dataStr);
          horaEscaladaDate.setHours(horaEscalada, minEscalada, 0, 0);

          // Tolerância de 10 minutos APÓS o horário escalado
          // Só conta atraso se chegou DEPOIS do horário + 10 min
          const diferencaMinutos = (horaEntrada.getTime() - horaEscaladaDate.getTime()) / (1000 * 60);
          if (diferencaMinutos > 10) {
            pontInfo.atrasos++;
            pontInfo.detalhesAtrasos.push({
              data: dataStr,
              horarioEscalado: escala.horario_entrada,
              horarioEntrada: format(horaEntrada, 'HH:mm'),
              atrasoMinutos: Math.round(diferencaMinutos)
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
        indice: info.totalEscalas > 0 ? ((info.totalEscalas - info.atrasos) / info.totalEscalas * 100).toFixed(1) : '0.0'
      }))
      .sort((a, b) => b.atrasos - a.atrasos);

    const absenteismoArray = Array.from(absenteismoPorMedico.entries())
      .map(([cpf, info]) => ({
        cpf,
        nome: info.nome,
        totalEscalas: info.totalEscalas,
        ausencias: info.ausencias,
        detalhesAusencias: info.detalhesAusencias,
        indice: info.totalEscalas > 0 ? (info.ausencias / info.totalEscalas * 100).toFixed(1) : '0.0'
      }))
      .sort((a, b) => b.ausencias - a.ausencias);

    return {
      pontualidade: pontualidadeArray,
      absenteismo: absenteismoArray
    };
  }, [escalas, acessos, filtroNome, filtroDataInicio, filtroDataFim]);

  // Calcular dados do heatmap baseado nos acessos filtrados
  const heatmapData = useMemo(() => {
    // Filtrar acessos
    const acessosFiltrados = acessos.filter((acesso) => {
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
      if (filtroSentido.length > 0 && !filtroSentido.includes(acesso.sentido))
        return false;
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

    // Dias da semana
    const diasSemana = [
      "Segunda-feira",
      "Terça-feira",
      "Quarta-feira",
      "Quinta-feira",
      "Sexta-feira",
      "Sábado",
      "Domingo",
    ];

    // Horários (intervalos de 1 hora)
    const horarios = [
      "00:00",
      "01:00",
      "02:00",
      "03:00",
      "04:00",
      "05:00",
      "06:00",
      "07:00",
      "08:00",
      "09:00",
      "10:00",
      "11:00",
      "12:00",
      "13:00",
      "14:00",
      "15:00",
      "16:00",
      "17:00",
      "18:00",
      "19:00",
      "20:00",
      "21:00",
      "22:00",
      "23:00",
    ];

    // Matriz para contar acessos
    const matriz: number[][] = diasSemana.map(() => horarios.map(() => 0));

    // Contar acessos por dia da semana e horário
    acessosFiltrados.forEach((acesso) => {
      const data = parseISO(acesso.data_acesso);
      const diaSemana = data.getDay(); // 0=Domingo, 1=Segunda, ...
      const hora = data.getHours();

      // Ajustar índice do dia (Segunda=0, Domingo=6)
      const diaIndex = diaSemana === 0 ? 6 : diaSemana - 1;

      // Hora exata (0-23)
      const horaIndex = hora;

      if (diaIndex >= 0 && diaIndex < 7 && horaIndex >= 0 && horaIndex < 24) {
        matriz[diaIndex][horaIndex]++;
      }
    });

    // Encontrar valor máximo para normalização
    const maxValue = Math.max(...matriz.flat());

    // Transformar em formato para renderização
    return diasSemana.map((dia, diaIndex) => ({
      dia,
      valores: horarios.map((horario, horaIndex) => ({
        horario,
        count: matriz[diaIndex][horaIndex],
        intensity: maxValue > 0 ? matriz[diaIndex][horaIndex] / maxValue : 0,
      })),
    }));
  }, [
    acessos,
    filtroTipo,
    filtroMatricula,
    filtroNome,
    filtroCpf,
    filtroSentido,
    filtroUnidade,
    filtroDataInicio,
    filtroDataFim,
  ]);

  // Função para obter cor do heatmap baseado na intensidade
  const getHeatmapColor = (intensity: number): string => {
    // Paleta de azuis (quanto mais intenso, mais escuro)
    if (intensity === 0) return "#f0f9ff"; // Azul muito claro
    if (intensity < 0.2) return "#e0f2fe";
    if (intensity < 0.4) return "#bae6fd";
    if (intensity < 0.6) return "#7dd3fc";
    if (intensity < 0.8) return "#38bdf8";
    return "#0284c7"; // Azul escuro
  };

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
        "yyyyMMdd_HHmmss"
      )}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportProdutividadeCSV = () => {
    if (!selectedPersonProdutividade || personProdutividade.length === 0) return;

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
      prod.data ? format(parseISO(prod.data), "dd/MM/yyyy", { locale: ptBR }) : "",
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
        "yyyyMMdd_HHmmss"
      )}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenInconsistenciaModal = (
    nome: string,
    tipo: 'prodSemAcesso' | 'acessoSemProd',
    datas: string[]
  ) => {
    // Se for "produtividade sem acesso", buscar os detalhes de produtividade
    if (tipo === 'prodSemAcesso') {
      const detalhesMap = new Map<string, Produtividade[]>();

      datas.forEach((data) => {
        // Buscar todos os registros de produtividade para esta data e pessoa
        const registrosDoDia = produtividade.filter((prod) => {
          if (!prod.data || prod.nome !== nome) return false;
          const [year, month, day] = prod.data.split('T')[0].split('-');
          const dataStr = `${year}-${month}-${day}`;
          return dataStr === data;
        });

        if (registrosDoDia.length > 0) {
          detalhesMap.set(data, registrosDoDia);
        }
      });

      setInconsistenciaSelecionada({ nome, tipo, datas, detalhes: detalhesMap });
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
    const medicoData = indicadoresEscalas.pontualidade.find(p => p.cpf === cpf);
    if (medicoData) {
      setPontualidadeSelecionada({
        nome,
        cpf,
        atrasos: medicoData.detalhesAtrasos
      });
      setPontualidadeModalOpen(true);
    }
  };

  const handleClosePontualidadeModal = () => {
    setPontualidadeModalOpen(false);
    setPontualidadeSelecionada(null);
  };

  const handleOpenAbsenteismoModal = (cpf: string, nome: string) => {
    const medicoData = indicadoresEscalas.absenteismo.find(a => a.cpf === cpf);
    if (medicoData) {
      setAbsenteismoSelecionado({
        nome,
        cpf,
        ausencias: medicoData.detalhesAusencias
      });
      setAbsenteismoModalOpen(true);
    }
  };

  const handleCloseAbsenteismoModal = () => {
    setAbsenteismoModalOpen(false);
    setAbsenteismoSelecionado(null);
  };

  const handleExportInconsistenciaCSV = () => {
    if (!inconsistenciaSelecionada) return;

    const { nome, tipo, datas, detalhes } = inconsistenciaSelecionada;
    const tipoTexto = tipo === 'prodSemAcesso'
      ? 'Produtividade sem Acesso'
      : 'Acesso sem Produtividade';

    // Prepare CSV com colunas adicionais para produtividade
    let headers: string[];
    let rows: string[][];

    if (tipo === 'prodSemAcesso' && detalhes) {
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
        "Total Atividades"
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
          }
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
      `inconsistencia_${nome.replace(/\s+/g, '_')}_${format(
        new Date(),
        "yyyyMMdd_HHmmss"
      )}.csv`
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
      headerName: "Carga Horária Escalada",
      width: 160,
      type: "number",
      filterable: true,
      sortable: true,
      headerAlign: "center",
      align: "center",
      renderCell: (params) => (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5, width: "100%" }}>
          <CalendarMonth fontSize="small" color="action" />
          <Typography variant="body2" fontWeight={600} color="warning.main">
            {params.value}h
          </Typography>
        </Box>
      ),
    },
    {
      field: "totalHoras",
      headerName: "Total de Horas",
      width: 130,
      type: "number",
      renderCell: (params) => (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <AccessTime fontSize="small" color="action" />
          <Typography variant="body2" fontWeight={600} color="primary">
            {params.value}h
          </Typography>
        </Box>
      ),
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
  ];

  // Estatísticas
  const totalPessoas = horasCalculadas.length;
  const totalHorasGeral = horasCalculadas.reduce(
    (sum, item) => sum + item.totalHoras,
    0
  );
  const totalDiasUnicos = horasCalculadas.reduce(
    (sum, item) => sum + item.diasComRegistro,
    0
  );
  const mediaHoras =
    totalDiasUnicos > 0 ? (totalHorasGeral / totalDiasUnicos).toFixed(2) : "0";

  // Cálculo da Produtividade Médica
  // Soma de todas as colunas de produtividade (procedimento até evolucao_noturna_cti) dividido pelo Total de Horas
  const totalProdutividade = produtividade.reduce((sum, item) => {
    return sum +
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
      item.evolucao_noturna_cti;
  }, 0);
  const produtividadeMedia = totalHorasGeral > 0 ? (totalProdutividade / totalHorasGeral).toFixed(2) : "0";

  // Cálculo da Carga Horária Contratada (com filtros de data aplicados)
  const cargaHorariaContratada = useMemo(() => {
    let totalHoras = 0;

    contratoItems.forEach((item) => {
      // Filtro de contrato
      if (filtroContrato && item.contrato_id !== filtroContrato.id) {
        return;
      }

      // Encontrar o contrato associado
      const contrato = contratos.find((c) => c.id === item.contrato_id);
      if (!contrato) return;

      // Parsear datas de vigência do contrato
      const dataInicioContrato = parseISO(contrato.data_inicio);
      const dataFimContrato = contrato.data_fim ? parseISO(contrato.data_fim) : new Date(2099, 11, 31);

      // Calcular total de dias de vigência do contrato
      const diasVigenciaTotal = Math.ceil(
        (dataFimContrato.getTime() - dataInicioContrato.getTime()) / (1000 * 60 * 60 * 24)
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
      const diasFiltrados = Math.ceil(
        (dataFimCalculo.getTime() - dataInicioCalculo.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;

      // Calcular horas por dia: quantidade total / dias de vigência
      const horasPorDia = item.quantidade / diasVigenciaTotal;

      // Calcular horas no período filtrado
      const horasPeriodo = horasPorDia * diasFiltrados;

      totalHoras += horasPeriodo;
    });

    return totalHoras;
  }, [contratoItems, contratos, filtroDataInicio, filtroDataFim, filtroContrato]);

  // Cálculo da Carga Horária Escalada (com filtros de data aplicados)
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

      // Parse dos horários (formato: "HH:mm")
      const [horaEntrada, minEntrada] = escala.horario_entrada.split(":").map(Number);
      const [horaSaida, minSaida] = escala.horario_saida.split(":").map(Number);

      // Calcular diferença em minutos
      let minutosTotais = (horaSaida * 60 + minSaida) - (horaEntrada * 60 + minEntrada);

      // Se horário de saída é menor que entrada, significa que passou da meia-noite
      if (minutosTotais < 0) {
        minutosTotais += 24 * 60; // Adicionar 24 horas em minutos
      }

      // Converter para horas
      const horas = minutosTotais / 60;

      // Multiplicar pela quantidade de médicos
      const numMedicos = escala.medicos?.length || 0;

      return sum + (horas * numMedicos);
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
            Dashboard de Acessos
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
              <Box sx={{ flexGrow: 1 }} />
              <Tooltip title="Atualizar dados">
                <IconButton onClick={loadAcessos} color="primary">
                  <Refresh />
                </IconButton>
              </Tooltip>
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
                  value={filtroSentido}
                  onChange={(_, newValue) => setFiltroSentido(newValue)}
                  options={["E", "S"]}
                  getOptionLabel={(option) =>
                    option === "E" ? "Entrada" : "Saída"
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Sentido"
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
                  label="Data Início"
                  value={filtroDataInicio}
                  onChange={(newValue) => setFiltroDataInicio(newValue)}
                  slotProps={{ textField: { size: "small", fullWidth: true } }}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
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

        {/* Estatísticas */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={4}>
            <Card
              sx={{
                height: "100%",
                background: "linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)",
              }}
            >
              <CardContent>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    color: "white",
                  }}
                >
                  <Box>
                    <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                      Total de Pessoas
                    </Typography>
                    <Typography variant="h3" fontWeight={700}>
                      {totalPessoas}
                    </Typography>
                  </Box>
                  <People sx={{ fontSize: 48, opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <Card
              sx={{
                height: "100%",
                background: "linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)",
              }}
            >
              <CardContent>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    color: "white",
                  }}
                >
                  <Box>
                    <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                      Total de Horas
                    </Typography>
                    <Typography variant="h3" fontWeight={700}>
                      {totalHorasGeral.toFixed(0)}h
                    </Typography>
                  </Box>
                  <AccessTime sx={{ fontSize: 48, opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <Card
              sx={{
                height: "100%",
                background: "linear-gradient(135deg, #10b981 0%, #34d399 100%)",
              }}
            >
              <CardContent>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    color: "white",
                  }}
                >
                  <Box>
                    <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                      Média de Horas por Dia
                    </Typography>
                    <Typography variant="h3" fontWeight={700}>
                      {mediaHoras}h
                    </Typography>
                  </Box>
                  <TrendingUp sx={{ fontSize: 48, opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={6}>
            <Card
              sx={{
                height: "100%",
                background: "linear-gradient(135deg, #ec4899 0%, #f472b6 100%)",
              }}
            >
              <CardContent>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    color: "white",
                  }}
                >
                  <Box>
                    <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                      Produtividade Médica
                    </Typography>
                    <Typography variant="h3" fontWeight={700}>
                      {produtividadeMedia}
                    </Typography>
                  </Box>
                  <LocalHospital sx={{ fontSize: 48, opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={6}>
            <Card
              sx={{
                height: "100%",
                background: "linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)",
              }}
            >
              <CardContent>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    color: "white",
                  }}
                >
                  <Box>
                    <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                      Carga Horária Contratada
                    </Typography>
                    <Typography variant="h3" fontWeight={700}>
                      {cargaHorariaContratada.toFixed(0)}h
                    </Typography>
                  </Box>
                  <Assignment sx={{ fontSize: 48, opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={6}>
            <Card
              sx={{
                height: "100%",
                background: "linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)",
              }}
            >
              <CardContent>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    color: "white",
                  }}
                >
                  <Box>
                    <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                      Carga Horária Escalada
                    </Typography>
                    <Typography variant="h3" fontWeight={700}>
                      {cargaHorariaEscalada.toFixed(0)}h
                    </Typography>
                  </Box>
                  <CalendarMonth sx={{ fontSize: 48, opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Mapa de Calor */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Horário de Registros da Facial na Catraca
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Análise de densidade de acessos por período
            </Typography>

            {/* Heatmap Grid */}
            <Box
              sx={{
                overflowX: "auto",
                pb: 2,
              }}
            >
              <Box
                sx={{
                  minWidth: 1200,
                  display: "flex",
                  flexDirection: "column",
                  gap: 0.5,
                }}
              >
                {/* Header com horários */}
                <Box sx={{ display: "flex", gap: 0.5, mb: 1 }}>
                  <Box
                    sx={{
                      width: 120,
                      minWidth: 120,
                      fontSize: 11,
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      pl: 1,
                    }}
                  >
                    Dia da Semana
                  </Box>
                  {heatmapData[0]?.valores.map((v, idx) => (
                    <Box
                      key={idx}
                      sx={{
                        flex: 1,
                        minWidth: 30,
                        fontSize: 9,
                        fontWeight: 600,
                        textAlign: "center",
                        color: "text.secondary",
                      }}
                    >
                      {v.horario.split(":")[0]}h
                    </Box>
                  ))}
                </Box>

                {/* Linhas do heatmap */}
                {heatmapData.map((row, rowIdx) => (
                  <Box
                    key={rowIdx}
                    sx={{ display: "flex", gap: 0.5, alignItems: "center" }}
                  >
                    <Box
                      sx={{
                        width: 120,
                        minWidth: 120,
                        fontSize: 12,
                        fontWeight: 500,
                        pl: 1,
                      }}
                    >
                      {row.dia}
                    </Box>
                    {row.valores.map((cell, cellIdx) => (
                      <Tooltip
                        key={cellIdx}
                        title={`${row.dia} - ${cell.horario}: ${cell.count} acessos`}
                        arrow
                      >
                        <Box
                          sx={{
                            flex: 1,
                            minWidth: 30,
                            height: 32,
                            backgroundColor: getHeatmapColor(cell.intensity),
                            borderRadius: 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 9,
                            fontWeight: 600,
                            color:
                              cell.intensity > 0.5 ? "white" : "text.primary",
                            cursor: "pointer",
                            transition: "all 0.2s",
                            "&:hover": {
                              transform: "scale(1.05)",
                              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                              zIndex: 1,
                            },
                          }}
                        >
                          {cell.count > 0 ? cell.count : ""}
                        </Box>
                      </Tooltip>
                    ))}
                  </Box>
                ))}
              </Box>
            </Box>

            {/* Legenda */}
            <Box sx={{ mt: 3, display: "flex", alignItems: "center", gap: 2 }}>
              <Typography variant="caption" fontWeight={600}>
                Legenda:
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box
                  sx={{
                    width: 20,
                    height: 20,
                    backgroundColor: "#f0f9ff",
                    borderRadius: 0.5,
                    border: "1px solid #e0e0e0",
                  }}
                />
                <Typography variant="caption">Baixo</Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box
                  sx={{
                    width: 20,
                    height: 20,
                    backgroundColor: "#7dd3fc",
                    borderRadius: 0.5,
                  }}
                />
                <Typography variant="caption">Médio</Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box
                  sx={{
                    width: 20,
                    height: 20,
                    backgroundColor: "#0284c7",
                    borderRadius: 0.5,
                  }}
                />
                <Typography variant="caption">Alto</Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Gráfico de Produtividade */}
        {chartDataProdutividade.length > 0 && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Produtividade Médica - Distribuição de Atividades
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Total acumulado de cada tipo de atividade registrada
              </Typography>
              {(filtroNome.length > 0 || filtroDataInicio || filtroDataFim) && (
                <Typography
                  variant="caption"
                  sx={{
                    display: "block",
                    mb: 2,
                    color: "primary.main",
                    fontStyle: "italic",
                  }}
                >
                  ℹ️ Gráfico filtrado pelos filtros avançados (Nome e/ou Data)
                </Typography>
              )}
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={chartDataProdutividade}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis type="number" />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={180}
                    style={{ fontSize: 12 }}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: "rgba(255, 255, 255, 0.95)",
                      border: "1px solid #e0e0e0",
                      borderRadius: 8,
                      boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                    }}
                    formatter={(value: any) => [value, "Total"]}
                  />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                    {chartDataProdutividade.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Seções de Inconsistências */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          {/* Produtividade sem Acesso */}
          <Grid item xs={12} md={6}>
            <Card
              sx={{
                background: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)",
                borderRadius: 3,
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
                border: "1px solid #bae6fd",
                height: "100%",
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box display="flex" alignItems="center" gap={2} mb={2}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: "12px",
                      bgcolor: "#3b82f6",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Warning sx={{ color: "white", fontSize: 28 }} />
                  </Box>
                  <Box>
                    <Typography variant="h6" fontWeight={700} color="#1e40af">
                      Produtividade sem Acesso
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Registros de produção sem entrada/saída
                    </Typography>
                  </Box>
                </Box>

                {(filtroNome.length > 0 || filtroDataInicio || filtroDataFim) && (
                  <Box sx={{ mb: 2 }}>
                    <Chip
                      icon={<FilterList />}
                      label="Filtros ativos"
                      size="small"
                      sx={{
                        bgcolor: "rgba(59, 130, 246, 0.15)",
                        color: "#1e40af",
                        fontWeight: 600,
                      }}
                    />
                  </Box>
                )}

                <Divider sx={{ mb: 2 }} />

                {inconsistencias.prodSemAcesso.length === 0 ? (
                  <Box
                    sx={{
                      textAlign: "center",
                      py: 4,
                      opacity: 0.6,
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      ✓ Nenhuma inconsistência encontrada
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ maxHeight: 400, overflow: "auto" }}>
                    {inconsistencias.prodSemAcesso.slice(0, 10).map((item, index) => (
                      <Paper
                        key={index}
                        sx={{
                          p: 2,
                          mb: 1.5,
                          cursor: "pointer",
                          transition: "all 0.2s",
                          "&:hover": {
                            transform: "translateX(4px)",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                            bgcolor: "info.50",
                          },
                        }}
                        onClick={() =>
                          handleOpenInconsistenciaModal(
                            item.nome,
                            "prodSemAcesso",
                            item.datas
                          )
                        }
                      >
                        <Box
                          display="flex"
                          justifyContent="space-between"
                          alignItems="center"
                        >
                          <Box display="flex" alignItems="center" gap={1.5}>
                            <Box
                              sx={{
                                width: 32,
                                height: 32,
                                borderRadius: "8px",
                                bgcolor: "#3b82f6",
                                color: "white",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 700,
                                fontSize: 14,
                              }}
                            >
                              {index + 1}
                            </Box>
                            <Typography
                              variant="body2"
                              fontWeight={600}
                              sx={{
                                maxWidth: 200,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {item.nome}
                            </Typography>
                          </Box>
                          <Chip
                            label={`${item.count} ${item.count === 1 ? "dia" : "dias"}`}
                            size="small"
                            sx={{
                              bgcolor: "#3b82f6",
                              color: "white",
                              fontWeight: 600,
                            }}
                          />
                        </Box>
                      </Paper>
                    ))}
                    {inconsistencias.prodSemAcesso.length > 10 && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block", textAlign: "center", mt: 2 }}
                      >
                        +{inconsistencias.prodSemAcesso.length - 10} profissionais
                      </Typography>
                    )}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Acesso sem Produtividade */}
          <Grid item xs={12} md={6}>
            <Card
              sx={{
                background: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)",
                borderRadius: 3,
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
                border: "1px solid #bae6fd",
                height: "100%",
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box display="flex" alignItems="center" gap={2} mb={2}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: "12px",
                      bgcolor: "#3b82f6",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <AccessTime sx={{ color: "white", fontSize: 28 }} />
                  </Box>
                  <Box>
                    <Typography variant="h6" fontWeight={700} color="#1e40af">
                      Acesso sem Produtividade
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Entrada/saída sem registro de produção
                    </Typography>
                  </Box>
                </Box>

                {(filtroNome.length > 0 || filtroDataInicio || filtroDataFim) && (
                  <Box sx={{ mb: 2 }}>
                    <Chip
                      icon={<FilterList />}
                      label="Filtros ativos"
                      size="small"
                      sx={{
                        bgcolor: "rgba(59, 130, 246, 0.15)",
                        color: "#1e40af",
                        fontWeight: 600,
                      }}
                    />
                  </Box>
                )}

                <Divider sx={{ mb: 2 }} />

                {inconsistencias.acessoSemProd.length === 0 ? (
                  <Box
                    sx={{
                      textAlign: "center",
                      py: 4,
                      opacity: 0.6,
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      ✓ Nenhuma inconsistência encontrada
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ maxHeight: 400, overflow: "auto" }}>
                    {inconsistencias.acessoSemProd.slice(0, 10).map((item, index) => (
                      <Paper
                        key={index}
                        sx={{
                          p: 2,
                          mb: 1.5,
                          cursor: "pointer",
                          transition: "all 0.2s",
                          "&:hover": {
                            transform: "translateX(4px)",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                            bgcolor: "info.50",
                          },
                        }}
                        onClick={() =>
                          handleOpenInconsistenciaModal(
                            item.nome,
                            "acessoSemProd",
                            item.datas
                          )
                        }
                      >
                        <Box
                          display="flex"
                          justifyContent="space-between"
                          alignItems="center"
                        >
                          <Box display="flex" alignItems="center" gap={1.5}>
                            <Box
                              sx={{
                                width: 32,
                                height: 32,
                                borderRadius: "8px",
                                bgcolor: "#3b82f6",
                                color: "white",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 700,
                                fontSize: 14,
                              }}
                            >
                              {index + 1}
                            </Box>
                            <Typography
                              variant="body2"
                              fontWeight={600}
                              sx={{
                                maxWidth: 200,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {item.nome}
                            </Typography>
                          </Box>
                          <Chip
                            label={`${item.count} ${item.count === 1 ? "dia" : "dias"}`}
                            size="small"
                            sx={{
                              bgcolor: "#3b82f6",
                              color: "white",
                              fontWeight: 600,
                            }}
                          />
                        </Box>
                      </Paper>
                    ))}
                    {inconsistencias.acessoSemProd.length > 10 && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block", textAlign: "center", mt: 2 }}
                      >
                        +{inconsistencias.acessoSemProd.length - 10} profissionais
                      </Typography>
                    )}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Indicadores de Escalas */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          {/* Índice de Pontualidade */}
          <Grid item xs={12} md={6}>
            <Card
              sx={{
                background: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)",
                borderRadius: 3,
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
                border: "1px solid #bae6fd",
                height: "100%",
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box display="flex" alignItems="center" gap={2} mb={2}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: "12px",
                      bgcolor: "#3b82f6",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Schedule sx={{ color: "white", fontSize: 28 }} />
                  </Box>
                  <Box>
                    <Typography variant="h6" fontWeight={700} color="#1e40af">
                      Índice de Pontualidade
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Médicos com mais atrasos (acima de 10min)
                    </Typography>
                  </Box>
                </Box>

                {(filtroNome.length > 0 || filtroDataInicio || filtroDataFim) && (
                  <Box sx={{ mb: 2 }}>
                    <Chip
                      icon={<FilterList />}
                      label="Filtros ativos"
                      size="small"
                      sx={{
                        bgcolor: "rgba(59, 130, 246, 0.15)",
                        color: "#1e40af",
                        fontWeight: 600,
                      }}
                    />
                  </Box>
                )}

                <Divider sx={{ mb: 2 }} />

                {indicadoresEscalas.pontualidade.length === 0 ? (
                  <Box
                    sx={{
                      textAlign: "center",
                      py: 4,
                      opacity: 0.6,
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      ✓ Sem dados de escalas no período
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ maxHeight: 400, overflow: "auto" }}>
                    {indicadoresEscalas.pontualidade.slice(0, 10).map((item, index) => (
                      <Paper
                        key={item.cpf}
                        sx={{
                          p: 2,
                          mb: 1.5,
                          cursor: "pointer",
                          transition: "all 0.2s",
                          "&:hover": {
                            transform: "translateX(4px)",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                            bgcolor: "info.50",
                          },
                        }}
                        onClick={() => handleOpenPontualidadeModal(item.cpf, item.nome)}
                      >
                        <Box
                          display="flex"
                          justifyContent="space-between"
                          alignItems="center"
                        >
                          <Box display="flex" alignItems="center" gap={1.5} flex={1}>
                            <Box
                              sx={{
                                width: 32,
                                height: 32,
                                borderRadius: "8px",
                                bgcolor: "#3b82f6",
                                color: "white",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 700,
                                fontSize: 14,
                              }}
                            >
                              {index + 1}
                            </Box>
                            <Box flex={1}>
                              <Typography
                                variant="body2"
                                fontWeight={600}
                                sx={{
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {item.nome}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Pontualidade: {item.indice}%
                              </Typography>
                            </Box>
                          </Box>
                          <Chip
                            label={`${item.atrasos} ${item.atrasos === 1 ? "atraso" : "atrasos"}`}
                            size="small"
                            sx={{
                              bgcolor: "#3b82f6",
                              color: "white",
                              fontWeight: 600,
                            }}
                          />
                        </Box>
                      </Paper>
                    ))}
                    {indicadoresEscalas.pontualidade.length > 10 && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block", textAlign: "center", mt: 2 }}
                      >
                        +{indicadoresEscalas.pontualidade.length - 10} médicos
                      </Typography>
                    )}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Índice de Absenteísmo */}
          <Grid item xs={12} md={6}>
            <Card
              sx={{
                background: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)",
                borderRadius: 3,
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
                border: "1px solid #bae6fd",
                height: "100%",
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box display="flex" alignItems="center" gap={2} mb={2}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: "12px",
                      bgcolor: "#3b82f6",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <PersonOff sx={{ color: "white", fontSize: 28 }} />
                  </Box>
                  <Box>
                    <Typography variant="h6" fontWeight={700} color="#1e40af">
                      Índice de Absenteísmo
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Escalas sem registro de acesso
                    </Typography>
                  </Box>
                </Box>

                {(filtroNome.length > 0 || filtroDataInicio || filtroDataFim) && (
                  <Box sx={{ mb: 2 }}>
                    <Chip
                      icon={<FilterList />}
                      label="Filtros ativos"
                      size="small"
                      sx={{
                        bgcolor: "rgba(59, 130, 246, 0.15)",
                        color: "#1e40af",
                        fontWeight: 600,
                      }}
                    />
                  </Box>
                )}

                <Divider sx={{ mb: 2 }} />

                {indicadoresEscalas.absenteismo.length === 0 ? (
                  <Box
                    sx={{
                      textAlign: "center",
                      py: 4,
                      opacity: 0.6,
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      ✓ Sem dados de escalas no período
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ maxHeight: 400, overflow: "auto" }}>
                    {indicadoresEscalas.absenteismo.slice(0, 10).map((item, index) => (
                      <Paper
                        key={item.cpf}
                        sx={{
                          p: 2,
                          mb: 1.5,
                          cursor: "pointer",
                          transition: "all 0.2s",
                          "&:hover": {
                            transform: "translateX(4px)",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                            bgcolor: "info.50",
                          },
                        }}
                        onClick={() => handleOpenAbsenteismoModal(item.cpf, item.nome)}
                      >
                        <Box
                          display="flex"
                          justifyContent="space-between"
                          alignItems="center"
                        >
                          <Box display="flex" alignItems="center" gap={1.5} flex={1}>
                            <Box
                              sx={{
                                width: 32,
                                height: 32,
                                borderRadius: "8px",
                                bgcolor: "#3b82f6",
                                color: "white",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 700,
                                fontSize: 14,
                              }}
                            >
                              {index + 1}
                            </Box>
                            <Box flex={1}>
                              <Typography
                                variant="body2"
                                fontWeight={600}
                                sx={{
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {item.nome}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Absenteísmo: {item.indice}%
                              </Typography>
                            </Box>
                          </Box>
                          <Chip
                            label={`${item.ausencias} ${item.ausencias === 1 ? "ausência" : "ausências"}`}
                            size="small"
                            sx={{
                              bgcolor: "#3b82f6",
                              color: "white",
                              fontWeight: 600,
                            }}
                          />
                        </Box>
                      </Paper>
                    ))}
                    {indicadoresEscalas.absenteismo.length > 10 && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block", textAlign: "center", mt: 2 }}
                      >
                        +{indicadoresEscalas.absenteismo.length - 10} médicos
                      </Typography>
                    )}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>

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
        <Dialog
          open={modalOpen}
          onClose={handleCloseModal}
          maxWidth="lg"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 2,
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            },
          }}
        >
          <DialogTitle sx={{ pb: 1 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Box>
                <Typography variant="h5" fontWeight={700}>
                  Histórico de Acessos
                </Typography>
                {selectedPerson && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 0.5 }}
                  >
                    {selectedPerson.nome}
                  </Typography>
                )}
              </Box>
              <IconButton onClick={handleCloseModal} size="small">
                <Close />
              </IconButton>
            </Box>
          </DialogTitle>

          <Divider />

          <DialogContent sx={{ pt: 3 }}>
            {selectedPerson && (
              <>
                {/* Informações do Colaborador */}
                <Grid container spacing={3} sx={{ mb: 3 }}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card
                      sx={{
                        bgcolor: "primary.50",
                        border: "1px solid",
                        borderColor: "primary.200",
                      }}
                    >
                      <CardContent sx={{ py: 2 }}>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          gutterBottom
                        >
                          CPF
                        </Typography>
                        <Typography variant="h6" fontWeight={600}>
                          {selectedPerson.cpf}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card
                      sx={{
                        bgcolor: "success.50",
                        border: "1px solid",
                        borderColor: "success.200",
                      }}
                    >
                      <CardContent sx={{ py: 2 }}>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          gutterBottom
                        >
                          Matrícula
                        </Typography>
                        <Typography variant="h6" fontWeight={600}>
                          {selectedPerson.matricula}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card
                      sx={{
                        bgcolor: "warning.50",
                        border: "1px solid",
                        borderColor: "warning.200",
                      }}
                    >
                      <CardContent sx={{ py: 2 }}>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          gutterBottom
                        >
                          Tipo
                        </Typography>
                        <Typography variant="h6" fontWeight={600}>
                          {selectedPerson.tipo}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card
                      sx={{
                        bgcolor: "info.50",
                        border: "1px solid",
                        borderColor: "info.200",
                      }}
                    >
                      <CardContent sx={{ py: 2 }}>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          gutterBottom
                        >
                          Total de Horas
                        </Typography>
                        <Typography variant="h6" fontWeight={600}>
                          {selectedPerson.totalHoras}h
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                {/* Tabela de Acessos */}
                <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                  Registros de Acesso ({personAcessos.length})
                </Typography>

                <TableContainer
                  component={Paper}
                  sx={{
                    maxHeight: 400,
                    boxShadow: "none",
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                  }}
                >
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600, bgcolor: "grey.50" }}>
                          Data/Hora
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600, bgcolor: "grey.50" }}>
                          Sentido
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600, bgcolor: "grey.50" }}>
                          Tipo
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600, bgcolor: "grey.50" }}>
                          Matrícula
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {personAcessos.map((acesso, index) => (
                        <TableRow
                          key={index}
                          sx={{
                            "&:hover": { bgcolor: "action.hover" },
                            "&:last-child td": { border: 0 },
                          }}
                        >
                          <TableCell>
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                              }}
                            >
                              <AccessTime fontSize="small" color="action" />
                              <Typography variant="body2">
                                {format(
                                  parseISO(acesso.data_acesso),
                                  "dd/MM/yyyy HH:mm:ss",
                                  {
                                    locale: ptBR,
                                  }
                                )}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip
                              icon={
                                acesso.sentido === "E" ? (
                                  <LoginOutlined fontSize="small" />
                                ) : (
                                  <LogoutOutlined fontSize="small" />
                                )
                              }
                              label={
                                acesso.sentido === "E" ? "Entrada" : "Saída"
                              }
                              size="small"
                              color={
                                acesso.sentido === "E" ? "success" : "error"
                              }
                              sx={{ fontWeight: 600 }}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {acesso.tipo}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {acesso.matricula}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </DialogContent>

          <Divider />

          <DialogActions sx={{ px: 3, py: 2 }}>
            <Box sx={{ flexGrow: 1 }}>
              <Button
                onClick={() => {
                  if (selectedPerson) {
                    handleCloseModal();
                    handleOpenProdutividadeModal(selectedPerson);
                  }
                }}
                variant="outlined"
                color="secondary"
                startIcon={<TrendingUp />}
              >
                Ver Produtividade
              </Button>
            </Box>
            <Button onClick={handleCloseModal} variant="outlined">
              Fechar
            </Button>
            <Button
              onClick={handleExportCSV}
              variant="contained"
              startIcon={<Download />}
              sx={{ ml: 1 }}
            >
              Exportar CSV
            </Button>
          </DialogActions>
        </Dialog>

        {/* Modal de Histórico de Produtividade */}
        <Dialog
          open={produtividadeModalOpen}
          onClose={handleCloseProdutividadeModal}
          maxWidth="xl"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 2,
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            },
          }}
        >
          <DialogTitle sx={{ pb: 1 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Box>
                <Typography variant="h5" fontWeight={700}>
                  Histórico de Produtividade
                </Typography>
                {selectedPersonProdutividade && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 0.5 }}
                  >
                    {selectedPersonProdutividade.nome}
                  </Typography>
                )}
              </Box>
              <IconButton onClick={handleCloseProdutividadeModal} size="small">
                <Close />
              </IconButton>
            </Box>
          </DialogTitle>

          <Divider />

          <DialogContent sx={{ pt: 3 }}>
            {selectedPersonProdutividade && (
              <>
                {/* Informações do Colaborador */}
                <Grid container spacing={3} sx={{ mb: 3 }}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card
                      sx={{
                        bgcolor: "primary.50",
                        border: "1px solid",
                        borderColor: "primary.200",
                      }}
                    >
                      <CardContent sx={{ py: 2 }}>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          gutterBottom
                        >
                          CPF
                        </Typography>
                        <Typography variant="h6" fontWeight={600}>
                          {selectedPersonProdutividade.cpf}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card
                      sx={{
                        bgcolor: "success.50",
                        border: "1px solid",
                        borderColor: "success.200",
                      }}
                    >
                      <CardContent sx={{ py: 2 }}>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          gutterBottom
                        >
                          Matrícula
                        </Typography>
                        <Typography variant="h6" fontWeight={600}>
                          {selectedPersonProdutividade.matricula}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card
                      sx={{
                        bgcolor: "warning.50",
                        border: "1px solid",
                        borderColor: "warning.200",
                      }}
                    >
                      <CardContent sx={{ py: 2 }}>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          gutterBottom
                        >
                          Tipo
                        </Typography>
                        <Typography variant="h6" fontWeight={600}>
                          {selectedPersonProdutividade.tipo}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card
                      sx={{
                        bgcolor: "info.50",
                        border: "1px solid",
                        borderColor: "info.200",
                      }}
                    >
                      <CardContent sx={{ py: 2 }}>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          gutterBottom
                        >
                          Registros
                        </Typography>
                        <Typography variant="h6" fontWeight={600}>
                          {personProdutividade.length}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                {/* Tabela de Produtividade */}
                <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                  Registros de Produtividade ({personProdutividade.length})
                </Typography>

                <TableContainer
                  component={Paper}
                  sx={{
                    maxHeight: 500,
                    boxShadow: "none",
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                  }}
                >
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600, bgcolor: "grey.50" }}>
                          Data
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600, bgcolor: "grey.50" }}>
                          Código MV
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600, bgcolor: "grey.50" }}>
                          Especialidade
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600, bgcolor: "grey.50", textAlign: "center" }}>
                          Proced.
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600, bgcolor: "grey.50", textAlign: "center" }}>
                          Pareceres Sol.
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600, bgcolor: "grey.50", textAlign: "center" }}>
                          Pareceres Real.
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600, bgcolor: "grey.50", textAlign: "center" }}>
                          Cirurgias
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600, bgcolor: "grey.50", textAlign: "center" }}>
                          Prescrições
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600, bgcolor: "grey.50", textAlign: "center" }}>
                          Evoluções
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600, bgcolor: "grey.50", textAlign: "center" }}>
                          Urgências
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600, bgcolor: "grey.50", textAlign: "center" }}>
                          Ambulatórios
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {personProdutividade.map((prod, index) => (
                        <TableRow
                          key={index}
                          sx={{
                            "&:hover": { bgcolor: "action.hover" },
                            "&:last-child td": { border: 0 },
                          }}
                        >
                          <TableCell>
                            <Typography variant="body2">
                              {prod.data ? format(parseISO(prod.data), "dd/MM/yyyy", {
                                locale: ptBR,
                              }) : "-"}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={prod.codigo_mv}
                              size="small"
                              color="primary"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {prod.especialidade || "-"}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ textAlign: "center" }}>
                            <Typography variant="body2" fontWeight={600}>
                              {prod.procedimento}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ textAlign: "center" }}>
                            <Typography variant="body2" fontWeight={600}>
                              {prod.parecer_solicitado}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ textAlign: "center" }}>
                            <Typography variant="body2" fontWeight={600}>
                              {prod.parecer_realizado}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ textAlign: "center" }}>
                            <Typography variant="body2" fontWeight={600}>
                              {prod.cirurgia_realizada}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ textAlign: "center" }}>
                            <Typography variant="body2" fontWeight={600}>
                              {prod.prescricao}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ textAlign: "center" }}>
                            <Typography variant="body2" fontWeight={600}>
                              {prod.evolucao}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ textAlign: "center" }}>
                            <Typography variant="body2" fontWeight={600}>
                              {prod.urgencia}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ textAlign: "center" }}>
                            <Typography variant="body2" fontWeight={600}>
                              {prod.ambulatorio}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </DialogContent>

          <Divider />

          <DialogActions sx={{ px: 3, py: 2 }}>
            <Box sx={{ flexGrow: 1 }}>
              <Button
                onClick={() => {
                  if (selectedPersonProdutividade) {
                    handleCloseProdutividadeModal();
                    handleOpenModal(selectedPersonProdutividade);
                  }
                }}
                variant="outlined"
                color="secondary"
                startIcon={<AccessTime />}
              >
                Ver Acessos
              </Button>
            </Box>
            <Button onClick={handleCloseProdutividadeModal} variant="outlined">
              Fechar
            </Button>
            <Button
              onClick={handleExportProdutividadeCSV}
              variant="contained"
              startIcon={<Download />}
              sx={{ ml: 1 }}
            >
              Exportar CSV
            </Button>
          </DialogActions>
        </Dialog>

        {/* Modal de Detalhes de Inconsistência */}
        <Dialog
          open={inconsistenciaModalOpen}
          onClose={handleCloseInconsistenciaModal}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 3,
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            },
          }}
        >
          <DialogTitle sx={{ pb: 1 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Box>
                <Typography variant="h5" fontWeight={700}>
                  {inconsistenciaSelecionada?.tipo === "prodSemAcesso"
                    ? "Produtividade sem Acesso"
                    : "Acesso sem Produtividade"}
                </Typography>
                {inconsistenciaSelecionada && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 0.5 }}
                  >
                    {inconsistenciaSelecionada.nome}
                  </Typography>
                )}
              </Box>
              <IconButton onClick={handleCloseInconsistenciaModal} size="small">
                <Close />
              </IconButton>
            </Box>
          </DialogTitle>

          <Divider />

          <DialogContent sx={{ pt: 3 }}>
            {inconsistenciaSelecionada && (
              <>
                <Box
                  sx={{
                    mb: 3,
                    p: 2,
                    borderRadius: 2,
                    bgcolor:
                      inconsistenciaSelecionada.tipo === "prodSemAcesso"
                        ? "warning.50"
                        : "info.50",
                    border: "1px solid",
                    borderColor:
                      inconsistenciaSelecionada.tipo === "prodSemAcesso"
                        ? "warning.200"
                        : "info.200",
                  }}
                >
                  <Box display="flex" alignItems="center" gap={2}>
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: "12px",
                        bgcolor:
                          inconsistenciaSelecionada.tipo === "prodSemAcesso"
                            ? "warning.main"
                            : "info.main",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {inconsistenciaSelecionada.tipo === "prodSemAcesso" ? (
                        <Warning sx={{ color: "white", fontSize: 28 }} />
                      ) : (
                        <AccessTime sx={{ color: "white", fontSize: 28 }} />
                      )}
                    </Box>
                    <Box>
                      <Typography variant="h6" fontWeight={600}>
                        {inconsistenciaSelecionada.datas.length}{" "}
                        {inconsistenciaSelecionada.datas.length === 1
                          ? "dia"
                          : "dias"}{" "}
                        com inconsistência
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {inconsistenciaSelecionada.tipo === "prodSemAcesso"
                          ? "Houve registro de produtividade médica mas não há registro de entrada/saída no sistema de acessos nestes dias"
                          : "Houve registro de entrada/saída no sistema mas não há registro de produtividade médica nestes dias"}
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                  Datas com Inconsistência
                </Typography>

                <TableContainer
                  component={Paper}
                  sx={{
                    maxHeight: 400,
                    boxShadow: "none",
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                  }}
                >
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600, bgcolor: "grey.50" }}>
                          #
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600, bgcolor: "grey.50" }}>
                          Data
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600, bgcolor: "grey.50" }}>
                          Tipo de Inconsistência
                        </TableCell>
                        {inconsistenciaSelecionada.tipo === "prodSemAcesso" && (
                          <>
                            <TableCell sx={{ fontWeight: 600, bgcolor: "grey.50", textAlign: "center" }}>
                              Proced.
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, bgcolor: "grey.50", textAlign: "center" }}>
                              Parec. S.
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, bgcolor: "grey.50", textAlign: "center" }}>
                              Parec. R.
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, bgcolor: "grey.50", textAlign: "center" }}>
                              Cirurg.
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, bgcolor: "grey.50", textAlign: "center" }}>
                              Prescr.
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, bgcolor: "grey.50", textAlign: "center" }}>
                              Evol.
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, bgcolor: "grey.50", textAlign: "center" }}>
                              Urg.
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, bgcolor: "grey.50", textAlign: "center" }}>
                              Ambul.
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, bgcolor: "grey.50", textAlign: "center" }}>
                              Total
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {inconsistenciaSelecionada.datas
                        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
                        .map((data, index) => {
                          // Calcular totais de produtividade para esta data (se aplicável)
                          let totaisProd = {
                            procedimento: 0,
                            parecer_solicitado: 0,
                            parecer_realizado: 0,
                            cirurgia_realizada: 0,
                            prescricao: 0,
                            evolucao: 0,
                            urgencia: 0,
                            ambulatorio: 0,
                          };

                          if (
                            inconsistenciaSelecionada.tipo === "prodSemAcesso" &&
                            inconsistenciaSelecionada.detalhes
                          ) {
                            const registros = inconsistenciaSelecionada.detalhes.get(data) || [];
                            totaisProd = registros.reduce(
                              (acc, reg) => ({
                                procedimento: acc.procedimento + reg.procedimento,
                                parecer_solicitado: acc.parecer_solicitado + reg.parecer_solicitado,
                                parecer_realizado: acc.parecer_realizado + reg.parecer_realizado,
                                cirurgia_realizada: acc.cirurgia_realizada + reg.cirurgia_realizada,
                                prescricao: acc.prescricao + reg.prescricao,
                                evolucao: acc.evolucao + reg.evolucao,
                                urgencia: acc.urgencia + reg.urgencia,
                                ambulatorio: acc.ambulatorio + reg.ambulatorio,
                              }),
                              totaisProd
                            );
                          }

                          const totalAtividades =
                            totaisProd.procedimento +
                            totaisProd.parecer_solicitado +
                            totaisProd.parecer_realizado +
                            totaisProd.cirurgia_realizada +
                            totaisProd.prescricao +
                            totaisProd.evolucao +
                            totaisProd.urgencia +
                            totaisProd.ambulatorio;

                          return (
                            <TableRow
                              key={index}
                              sx={{
                                "&:hover": { bgcolor: "action.hover" },
                                "&:last-child td": { border: 0 },
                              }}
                            >
                              <TableCell>
                                <Box
                                  sx={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: "6px",
                                    bgcolor:
                                      inconsistenciaSelecionada.tipo === "prodSemAcesso"
                                        ? "warning.main"
                                        : "info.main",
                                    color: "white",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontWeight: 700,
                                    fontSize: 12,
                                  }}
                                >
                                  {index + 1}
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" fontWeight={600}>
                                  {format(parseISO(data), "dd/MM/yyyy - EEEE", {
                                    locale: ptBR,
                                  })}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={
                                    inconsistenciaSelecionada.tipo === "prodSemAcesso"
                                      ? "Produção sem Acesso"
                                      : "Acesso sem Produção"
                                  }
                                  size="small"
                                  color={
                                    inconsistenciaSelecionada.tipo === "prodSemAcesso"
                                      ? "warning"
                                      : "info"
                                  }
                                  sx={{ fontWeight: 600 }}
                                />
                              </TableCell>
                              {inconsistenciaSelecionada.tipo === "prodSemAcesso" && (
                                <>
                                  <TableCell sx={{ textAlign: "center" }}>
                                    <Typography variant="body2" fontWeight={600}>
                                      {totaisProd.procedimento}
                                    </Typography>
                                  </TableCell>
                                  <TableCell sx={{ textAlign: "center" }}>
                                    <Typography variant="body2" fontWeight={600}>
                                      {totaisProd.parecer_solicitado}
                                    </Typography>
                                  </TableCell>
                                  <TableCell sx={{ textAlign: "center" }}>
                                    <Typography variant="body2" fontWeight={600}>
                                      {totaisProd.parecer_realizado}
                                    </Typography>
                                  </TableCell>
                                  <TableCell sx={{ textAlign: "center" }}>
                                    <Typography variant="body2" fontWeight={600}>
                                      {totaisProd.cirurgia_realizada}
                                    </Typography>
                                  </TableCell>
                                  <TableCell sx={{ textAlign: "center" }}>
                                    <Typography variant="body2" fontWeight={600}>
                                      {totaisProd.prescricao}
                                    </Typography>
                                  </TableCell>
                                  <TableCell sx={{ textAlign: "center" }}>
                                    <Typography variant="body2" fontWeight={600}>
                                      {totaisProd.evolucao}
                                    </Typography>
                                  </TableCell>
                                  <TableCell sx={{ textAlign: "center" }}>
                                    <Typography variant="body2" fontWeight={600}>
                                      {totaisProd.urgencia}
                                    </Typography>
                                  </TableCell>
                                  <TableCell sx={{ textAlign: "center" }}>
                                    <Typography variant="body2" fontWeight={600}>
                                      {totaisProd.ambulatorio}
                                    </Typography>
                                  </TableCell>
                                  <TableCell sx={{ textAlign: "center" }}>
                                    <Chip
                                      label={totalAtividades}
                                      size="small"
                                      color="primary"
                                      sx={{ fontWeight: 700 }}
                                    />
                                  </TableCell>
                                </>
                              )}
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </DialogContent>

          <Divider />

          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={handleCloseInconsistenciaModal} variant="outlined">
              Fechar
            </Button>
            <Button
              onClick={handleExportInconsistenciaCSV}
              variant="contained"
              startIcon={<Download />}
              sx={{ ml: 1 }}
            >
              Exportar CSV
            </Button>
          </DialogActions>
        </Dialog>

        {/* Modal de Aviso de Contrato */}
        <Dialog
          open={contratoWarningOpen}
          onClose={handleContratoWarningClose}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 3,
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            },
          }}
        >
          <DialogContent sx={{ pt: 4, pb: 3 }}>
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
              }}
            >
              <Box
                sx={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  bgcolor: "warning.50",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  mb: 2,
                }}
              >
                <Warning sx={{ fontSize: 32, color: "warning.main" }} />
              </Box>

              <Typography variant="h5" fontWeight={700} gutterBottom>
                Atenção
              </Typography>

              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ mt: 1, lineHeight: 1.7 }}
              >
                Ao selecionar um contrato, você estará visualizando todos os
                acessos de parceiros que estão vinculados ao número desse
                contrato. No entanto, isso não significa{" "}
                <em>necessariamente</em> que os acessos sejam referentes a esse
                contrato, uma vez que um parceiro pode participar de diferentes
                contratos.
              </Typography>
            </Box>
          </DialogContent>

          <Divider />

          <DialogActions sx={{ px: 3, py: 2, justifyContent: "center" }}>
            <Button
              onClick={handleContratoWarningAccept}
              variant="contained"
              sx={{
                minWidth: 120,
                background: "linear-gradient(135deg, #0ea5e9 0%, #8b5cf6 100%)",
                "&:hover": {
                  background:
                    "linear-gradient(135deg, #0284c7 0%, #7c3aed 100%)",
                },
              }}
            >
              Entendido
            </Button>
          </DialogActions>
        </Dialog>

        {/* Modal de Pontualidade */}
        <Dialog
          open={pontualidadeModalOpen}
          onClose={handleClosePontualidadeModal}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle sx={{ pb: 1 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Box display="flex" alignItems="center" gap={2}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: "10px",
                    bgcolor: "#22c55e",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Schedule sx={{ color: "white", fontSize: 24 }} />
                </Box>
                <Typography variant="h6" fontWeight={700}>
                  Detalhes de Pontualidade - {pontualidadeSelecionada?.nome}
                </Typography>
              </Box>
              <IconButton onClick={handleClosePontualidadeModal} size="small">
                <Close />
              </IconButton>
            </Box>
          </DialogTitle>

          <DialogContent>
            {pontualidadeSelecionada && (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Total de atrasos: {pontualidadeSelecionada.atrasos.length}
                </Typography>

                <TableContainer component={Paper} sx={{ boxShadow: "none", border: "1px solid #e5e7eb" }}>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ bgcolor: "#f9fafb" }}>
                        <TableCell width={60}>#</TableCell>
                        <TableCell>Data</TableCell>
                        <TableCell>Horário Escalado</TableCell>
                        <TableCell>Horário de Entrada</TableCell>
                        <TableCell>Atraso</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {pontualidadeSelecionada.atrasos.map((atraso, index) => (
                        <TableRow key={index} sx={{ "&:hover": { bgcolor: "#f9fafb" } }}>
                          <TableCell>
                            <Box
                              sx={{
                                width: 28,
                                height: 28,
                                borderRadius: "6px",
                                bgcolor: "#22c55e",
                                color: "white",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 700,
                                fontSize: 12,
                              }}
                            >
                              {index + 1}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>
                              {format(parseISO(atraso.data), "dd/MM/yyyy - EEEE", { locale: ptBR })}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={atraso.horarioEscalado}
                              size="small"
                              sx={{ bgcolor: "#dbeafe", color: "#1e40af", fontWeight: 600 }}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={atraso.horarioEntrada}
                              size="small"
                              sx={{ bgcolor: "#fef3c7", color: "#92400e", fontWeight: 600 }}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={`${atraso.atrasoMinutos} min`}
                              size="small"
                              sx={{
                                bgcolor: atraso.atrasoMinutos > 30 ? "#fecaca" : "#fed7aa",
                                color: atraso.atrasoMinutos > 30 ? "#991b1b" : "#92400e",
                                fontWeight: 600,
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </DialogContent>

          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={handleClosePontualidadeModal} variant="outlined">
              Fechar
            </Button>
          </DialogActions>
        </Dialog>

        {/* Modal de Absenteísmo */}
        <Dialog
          open={absenteismoModalOpen}
          onClose={handleCloseAbsenteismoModal}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle sx={{ pb: 1 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Box display="flex" alignItems="center" gap={2}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: "10px",
                    bgcolor: "#ef4444",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <PersonOff sx={{ color: "white", fontSize: 24 }} />
                </Box>
                <Typography variant="h6" fontWeight={700}>
                  Detalhes de Absenteísmo - {absenteismoSelecionado?.nome}
                </Typography>
              </Box>
              <IconButton onClick={handleCloseAbsenteismoModal} size="small">
                <Close />
              </IconButton>
            </Box>
          </DialogTitle>

          <DialogContent>
            {absenteismoSelecionado && (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Total de ausências: {absenteismoSelecionado.ausencias.length}
                </Typography>

                <TableContainer component={Paper} sx={{ boxShadow: "none", border: "1px solid #e5e7eb" }}>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ bgcolor: "#f9fafb" }}>
                        <TableCell width={60}>#</TableCell>
                        <TableCell>Data</TableCell>
                        <TableCell>Horário Escalado</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {absenteismoSelecionado.ausencias.map((ausencia, index) => (
                        <TableRow key={index} sx={{ "&:hover": { bgcolor: "#f9fafb" } }}>
                          <TableCell>
                            <Box
                              sx={{
                                width: 28,
                                height: 28,
                                borderRadius: "6px",
                                bgcolor: "#ef4444",
                                color: "white",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 700,
                                fontSize: 12,
                              }}
                            >
                              {index + 1}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>
                              {format(parseISO(ausencia.data), "dd/MM/yyyy - EEEE", { locale: ptBR })}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={ausencia.horarioEscalado}
                              size="small"
                              sx={{ bgcolor: "#dbeafe", color: "#1e40af", fontWeight: 600 }}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label="Sem acesso registrado"
                              size="small"
                              sx={{ bgcolor: "#fecaca", color: "#991b1b", fontWeight: 600 }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </DialogContent>

          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={handleCloseAbsenteismoModal} variant="outlined">
              Fechar
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default Dashboard;
