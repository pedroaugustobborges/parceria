/**
 * EXEMPLO DE DASHBOARD REFATORADO
 *
 * Este arquivo mostra como o Dashboard.tsx ficaria após aplicar todas as refatorações.
 * Demonstra o uso de hooks customizados, utilities e componentes reutilizáveis.
 *
 * REDUÇÃO ESTIMADA: De 6.794 linhas para ~4.500 linhas (-34%)
 */

import React, { useState, useEffect, useMemo } from "react";
import { Box, Grid, CircularProgress, Alert } from "@mui/material";
import {
  AccessTime,
  TrendingUp,
  People,
  LocalHospital,
  Assignment,
  CalendarMonth,
} from "@mui/icons-material";
import { useAuth } from "../contexts/AuthContext";

// ✅ IMPORTS DE HOOKS CUSTOMIZADOS (Eliminam ~500 linhas de código)
import { useDashboardData } from "../hooks/useDashboardData";
import { useContractCPFs } from "../hooks/useContractCPFs";

// ✅ IMPORTS DE UTILITIES (Eliminam ~800 linhas de duplicação)
import {
  normalizeDate,
  isDateInRange,
  parseISODate,
  extractDateString,
} from "../utils/dateUtils";
import {
  calculateDailyHours,
  groupAccessesByDay,
  calculateScheduledHours,
  PUNCTUALITY_TOLERANCE_MINUTES,
} from "../utils/hoursCalculation";
import { downloadCSV } from "../utils/csvExport";
import {
  filterAccesses,
  getUniqueValues,
  calculateProductivitySum,
  AccessFilters,
} from "../utils/filterUtils";

// ✅ IMPORTS DE COMPONENTES REUTILIZÁVEIS (Eliminam ~400 linhas)
import { MetricCard } from "../components/dashboard/MetricCard";
import { FilterSection } from "../components/dashboard/FilterSection";

// Tipos
import {
  Acesso,
  HorasCalculadas,
  Contrato,
  Produtividade,
} from "../types/database.types";
import { format, parseISO } from "date-fns";
import { supabase } from "../lib/supabase";

const Dashboard: React.FC = () => {
  const { userProfile, isAdminTerceiro, isTerceiro } = useAuth();

  // ✅ HOOK CUSTOMIZADO - Consolida 7 estados e 6 funções (Reduz ~200 linhas)
  const {
    contratos,
    contratoItems,
    produtividade,
    escalas,
    usuarios,
    unidades,
    loading: dataLoading,
    error: dataError,
    refreshData,
  } = useDashboardData();

  // Estados do componente (Reduzidos de 45 para ~30)
  const [acessos, setAcessos] = useState<Acesso[]>([]);
  const [acessosFiltrados, setAcessosFiltrados] = useState<Acesso[]>([]);
  const [horasCalculadas, setHorasCalculadas] = useState<HorasCalculadas[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [buscaRealizada, setBuscaRealizada] = useState(false);

  // Filtros
  const [filtroTipo, setFiltroTipo] = useState<string[]>([]);
  const [filtroMatricula, setFiltroMatricula] = useState<string[]>([]);
  const [filtroNome, setFiltroNome] = useState<string[]>([]);
  const [filtroCpf, setFiltroCpf] = useState<string[]>([]);
  const [filtroSentido, setFiltroSentido] = useState<string[]>([]);
  const [filtroContrato, setFiltroContrato] = useState<Contrato | null>(null);
  const [filtroUnidade, setFiltroUnidade] = useState<string[]>([]);
  const [filtroDataInicio, setFiltroDataInicio] = useState<Date | null>(null);
  const [filtroDataFim, setFiltroDataFim] = useState<Date | null>(null);

  // Estados dos modals (agrupados por funcionalidade)
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<HorasCalculadas | null>(null);
  const [personAcessos, setPersonAcessos] = useState<Acesso[]>([]);

  const [produtividadeModalOpen, setProdutividadeModalOpen] = useState(false);
  const [selectedPersonProdutividade, setSelectedPersonProdutividade] =
    useState<HorasCalculadas | null>(null);
  const [personProdutividade, setPersonProdutividade] = useState<Produtividade[]>([]);

  // ... outros estados de modals

  // ✅ HOOK CUSTOMIZADO - Elimina duplicação de busca de CPFs (~80 linhas)
  const { cpfs: cpfsDoContratoFiltrado, loading: cpfsLoading } =
    useContractCPFs(filtroContrato);

  // ✅ Buscar Acessos (Simplificado com utility de filtros)
  const handleBuscarAcessos = async () => {
    if (!filtroDataInicio || !filtroDataFim) {
      setError("Por favor, selecione uma data de início e uma data de fim.");
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

      // Carregar com paginação
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
        } else if (isAdminTerceiro && userProfile?.contrato_id) {
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
      setBuscaRealizada(true);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar acessos");
      console.error("Erro:", err);
    } finally {
      setLoading(false);
    }
  };

  // ✅ CALCULAR HORAS - Simplificado com utilities (Reduz ~200 linhas)
  const calcularHoras = async () => {
    // ✅ Usar utility de filtros ao invés de código duplicado
    const filters: AccessFilters = {
      tipo: filtroTipo,
      matricula: filtroMatricula,
      nome: filtroNome,
      cpf: filtroCpf,
      sentido: filtroSentido,
      unidade: filtroUnidade,
      contractCpfs: cpfsDoContratoFiltrado,
      dataInicio: filtroDataInicio,
      dataFim: filtroDataFim,
    };

    const acessosFiltradosLocal = filterAccesses(acessos, filters);
    setAcessosFiltrados(acessosFiltradosLocal);

    // Agrupar por CPF
    const acessosPorCpf = acessosFiltradosLocal.reduce((acc, acesso) => {
      if (!acc[acesso.cpf]) {
        acc[acesso.cpf] = [];
      }
      acc[acesso.cpf].push(acesso);
      return acc;
    }, {} as Record<string, Acesso[]>);

    // ✅ Calcular horas usando utility function
    const resultado: HorasCalculadas[] = Object.entries(acessosPorCpf).map(
      ([cpf, acessosCpf]) => {
        const acessosOrdenados = acessosCpf.sort(
          (a, b) =>
            new Date(a.data_acesso).getTime() - new Date(b.data_acesso).getTime()
        );

        // ✅ Usar utility para agrupar por dia
        const acessosPorDia = groupAccessesByDay(acessosOrdenados);
        const diasOrdenados = Object.keys(acessosPorDia).sort();

        let totalMinutos = 0;
        let totalEntradas = 0;
        let totalSaidas = 0;
        const diasUnicos = new Set<string>();

        // ✅ Usar utility calculateDailyHours para cada dia
        diasOrdenados.forEach((dia, i) => {
          const acessosDia = acessosPorDia[dia];
          const proximoDia = diasOrdenados[i + 1];
          const acessosProximoDia = proximoDia ? acessosPorDia[proximoDia] : undefined;

          const { hours, entriesCount, exitsCount } = calculateDailyHours(
            acessosDia,
            dia,
            acessosProximoDia
          );

          if (hours > 0) {
            totalMinutos += hours * 60;
            diasUnicos.add(dia);
          }

          totalEntradas += entriesCount;
          totalSaidas += exitsCount;
        });

        const totalHoras = totalMinutos / 60;
        const ultimoAcesso = acessosCpf.sort(
          (a, b) =>
            new Date(b.data_acesso).getTime() - new Date(a.data_acesso).getTime()
        )[0];

        // ✅ Calcular carga horária escalada usando utility
        const escalasDoMedico = escalas.filter((escala) => {
          if (!escala.medicos?.some((medico) => medico.cpf === cpf)) {
            return false;
          }
          // ✅ Usar utility isDateInRange
          return isDateInRange(escala.data_inicio, filtroDataInicio, filtroDataFim);
        });

        const cargaHorariaEscaladaPorCpf = escalasDoMedico.reduce((sum, escala) => {
          // ✅ Usar utility calculateScheduledHours
          const horas = calculateScheduledHours(
            escala.horario_entrada,
            escala.horario_saida
          );
          return sum + horas;
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

  // ✅ Opções para autocomplete usando utility
  const tiposUnicos = useMemo(
    () => getUniqueValues<string>(acessos, "tipo"),
    [acessos]
  );
  const matriculasUnicas = useMemo(
    () => getUniqueValues<string>(acessos, "matricula"),
    [acessos]
  );
  const nomesUnicos = useMemo(
    () => getUniqueValues<string>(acessos, "nome"),
    [acessos]
  );
  const cpfsUnicos = useMemo(
    () => getUniqueValues<string>(acessos, "cpf"),
    [acessos]
  );
  const plantasUnicas = useMemo(
    () => getUniqueValues<string>(acessos, "planta").filter(Boolean),
    [acessos]
  );

  // ✅ Métricas calculadas (Simplificado)
  const totalHoras = useMemo(
    () => horasCalculadas.reduce((sum, h) => sum + h.totalHoras, 0),
    [horasCalculadas]
  );

  const totalPessoas = horasCalculadas.length;

  const diasComRegistro = useMemo(
    () =>
      new Set(
        acessosFiltrados.map((a) =>
          format(parseISO(a.data_acesso), "yyyy-MM-dd")
        )
      ).size,
    [acessosFiltrados]
  );

  const mediaHoras = useMemo(
    () => (diasComRegistro > 0 ? (totalHoras / diasComRegistro).toFixed(1) : "0.0"),
    [totalHoras, diasComRegistro]
  );

  // ✅ Handlers simplificados com utilities
  const handleExportCSV = () => {
    if (!selectedPerson || personAcessos.length === 0) return;

    const headers = [
      "Data/Hora",
      "Tipo",
      "Matrícula",
      "Nome",
      "CPF",
      "Sentido",
      "Local",
    ];

    const rows = personAcessos.map((acesso) => [
      format(parseISO(acesso.data_acesso), "dd/MM/yyyy HH:mm:ss"),
      acesso.tipo,
      acesso.matricula,
      acesso.nome,
      acesso.cpf,
      acesso.sentido === "E" ? "Entrada" : "Saída",
      "",
    ]);

    // ✅ Usar utility downloadCSV
    downloadCSV(
      `acessos_${selectedPerson.nome.replace(/\s+/g, "_")}`,
      headers,
      rows
    );
  };

  const handleContratoChange = (_: any, newValue: Contrato | null) => {
    // Lógica do warning modal se necessário
    setFiltroContrato(newValue);
  };

  // Loading state
  if (dataLoading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* ✅ COMPONENTE REUTILIZÁVEL - FilterSection (Reduz ~250 linhas) */}
      <FilterSection
        filtroTipo={filtroTipo}
        filtroMatricula={filtroMatricula}
        filtroNome={filtroNome}
        filtroCpf={filtroCpf}
        filtroSentido={filtroSentido}
        filtroContrato={filtroContrato}
        filtroUnidade={filtroUnidade}
        filtroDataInicio={filtroDataInicio}
        filtroDataFim={filtroDataFim}
        setFiltroTipo={setFiltroTipo}
        setFiltroMatricula={setFiltroMatricula}
        setFiltroNome={setFiltroNome}
        setFiltroCpf={setFiltroCpf}
        setFiltroSentido={setFiltroSentido}
        setFiltroUnidade={setFiltroUnidade}
        setFiltroDataInicio={setFiltroDataInicio}
        setFiltroDataFim={setFiltroDataFim}
        tiposUnicos={tiposUnicos}
        matriculasUnicas={matriculasUnicas}
        nomesUnicos={nomesUnicos}
        cpfsUnicos={cpfsUnicos}
        plantasUnicas={plantasUnicas}
        contratos={contratos}
        unidades={unidades}
        handleContratoChange={handleContratoChange}
        handleBuscarAcessos={handleBuscarAcessos}
        loading={loading}
        error={error}
        buscaRealizada={buscaRealizada}
      />

      {/* Métricas - ✅ COMPONENTES REUTILIZÁVEIS (Reduz ~480 linhas) */}
      {buscaRealizada && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={4}>
            <MetricCard
              title="Total de Horas"
              value={`${totalHoras.toFixed(0)}h`}
              icon={AccessTime}
              gradient="linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%)"
              tooltipTitle="Como é calculado?"
              tooltipDescription="Soma de todas as horas trabalhadas registradas no sistema, calculadas pela diferença entre a primeira entrada e última saída de cada dia."
              tooltipFormula="Fórmula: Σ (Última Saída - Primeira Entrada)"
            />
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <MetricCard
              title="Total de Pessoas"
              value={totalPessoas}
              icon={People}
              gradient="linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)"
              tooltipTitle="Como é calculado?"
              tooltipDescription="Número total de profissionais únicos que registraram pelo menos um acesso no período selecionado."
            />
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <MetricCard
              title="Média de Horas por Dia"
              value={`${mediaHoras}h`}
              icon={TrendingUp}
              gradient="linear-gradient(135deg, #10b981 0%, #34d399 100%)"
              tooltipTitle="Como é calculado?"
              tooltipDescription="Total de horas dividido pelo número de dias com registros."
              tooltipFormula="Fórmula: Total de Horas ÷ Dias com Registro"
            />
          </Grid>

          {/* Mais cards de métricas... */}
        </Grid>
      )}

      {/* Resto do Dashboard... */}
      {/* Tabelas, Gráficos, Modais, etc. */}
    </Box>
  );
};

export default Dashboard;

/**
 * 📊 RESUMO DA REFATORAÇÃO
 *
 * ✅ Redução de ~2.300 linhas através de:
 * - Hooks customizados (useDashboardData, useContractCPFs)
 * - Utilities (dateUtils, hoursCalculation, csvExport, filterUtils)
 * - Componentes reutilizáveis (MetricCard, FilterSection)
 *
 * ✅ Melhorias obtidas:
 * - Eliminação de duplicação de código
 * - Maior testabilidade (funções puras)
 * - Melhor performance (memoização adequada)
 * - Maior reutilização de código
 * - Manutenção simplificada
 *
 * ✅ Próximos passos:
 * 1. Extrair componentes de Modal
 * 2. Extrair componentes de Tabela
 * 3. Extrair lógica de cálculo de inconsistências
 * 4. Criar testes unitários
 */
