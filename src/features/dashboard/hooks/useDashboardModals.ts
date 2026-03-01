/**
 * useDashboardModals Hook
 *
 * Manages all modal state for the Dashboard.
 */

import { useState, useCallback } from 'react';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import { supabase } from '../../../lib/supabase';
import { loadPersonProdutividade } from '../services/dashboardService';
import type {
  Acesso,
  HorasCalculadas,
  Produtividade,
  EscalaMedica,
  Contrato,
} from '../types/dashboard.types';

// Modal state types
export interface InconsistenciaModalState {
  nome: string;
  tipo: 'prodSemAcesso' | 'acessoSemProd';
  datas: string[];
  detalhes?: Map<string, Produtividade[]>;
}

export interface PontualidadeModalState {
  nome: string;
  cpf: string;
  atrasos: Array<{
    data: string;
    horarioEscalado: string;
    horarioEntrada: string;
    atrasoMinutos: number;
  }>;
}

export interface AbsenteismoModalState {
  nome: string;
  cpf: string;
  ausencias: Array<{
    data: string;
    horarioEscalado: string;
  }>;
}

export interface DiferencaHorasModalState {
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
}

export interface HorasEscaladasModalState {
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
}

export interface HorasUnidadeModalState {
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
}

export interface UseDashboardModalsReturn {
  // Access History Modal
  modalOpen: boolean;
  selectedPerson: HorasCalculadas | null;
  personAcessos: Acesso[];
  openAccessModal: (person: HorasCalculadas, acessosFiltrados: Acesso[]) => void;
  closeAccessModal: () => void;

  // Productivity Modal
  produtividadeModalOpen: boolean;
  selectedPersonProdutividade: HorasCalculadas | null;
  personProdutividade: Produtividade[];
  openProdutividadeModal: (
    person: HorasCalculadas,
    filtroDataInicio: Date | null,
    filtroDataFim: Date | null
  ) => void;
  closeProdutividadeModal: () => void;

  // Contract Warning Modal
  contratoWarningOpen: boolean;
  pendingContrato: Contrato | null;
  openContratoWarning: (contrato: Contrato) => void;
  closeContratoWarning: () => void;
  confirmContratoChange: () => Contrato | null;

  // Inconsistency Modal
  inconsistenciaModalOpen: boolean;
  inconsistenciaSelecionada: InconsistenciaModalState | null;
  openInconsistenciaModal: (data: InconsistenciaModalState) => void;
  closeInconsistenciaModal: () => void;

  // Punctuality Modal
  pontualidadeModalOpen: boolean;
  pontualidadeSelecionada: PontualidadeModalState | null;
  openPontualidadeModal: (data: PontualidadeModalState) => void;
  closePontualidadeModal: () => void;

  // Absenteeism Modal
  absenteismoModalOpen: boolean;
  absenteismoSelecionado: AbsenteismoModalState | null;
  openAbsenteismoModal: (data: AbsenteismoModalState) => void;
  closeAbsenteismoModal: () => void;

  // Hours Difference Modal
  diferencaHorasModalOpen: boolean;
  diferencaHorasSelecionada: DiferencaHorasModalState | null;
  openDiferencaHorasModal: (
    cpf: string,
    nome: string,
    totalHoras: number,
    cargaHorariaEscalada: number,
    acessosFiltrados: Acesso[],
    escalas: EscalaMedica[],
    filtroDataInicio: Date | null,
    filtroDataFim: Date | null
  ) => void;
  closeDiferencaHorasModal: () => void;

  // Scheduled Hours Modal
  horasEscaladasModalOpen: boolean;
  horasEscaladasSelecionadas: HorasEscaladasModalState | null;
  openHorasEscaladasModal: (
    cpf: string,
    nome: string,
    escalas: EscalaMedica[],
    filtroDataInicio: Date | null,
    filtroDataFim: Date | null
  ) => void;
  closeHorasEscaladasModal: () => void;

  // Unit Hours Modal
  horasUnidadeModalOpen: boolean;
  horasUnidadeSelecionadas: HorasUnidadeModalState | null;
  openHorasUnidadeModal: (cpf: string, nome: string, acessosFiltrados: Acesso[]) => void;
  closeHorasUnidadeModal: () => void;
}

export function useDashboardModals(): UseDashboardModalsReturn {
  // Access History Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<HorasCalculadas | null>(null);
  const [personAcessos, setPersonAcessos] = useState<Acesso[]>([]);

  // Productivity Modal
  const [produtividadeModalOpen, setProdutividadeModalOpen] = useState(false);
  const [selectedPersonProdutividade, setSelectedPersonProdutividade] =
    useState<HorasCalculadas | null>(null);
  const [personProdutividade, setPersonProdutividade] = useState<Produtividade[]>([]);

  // Contract Warning Modal
  const [contratoWarningOpen, setContratoWarningOpen] = useState(false);
  const [pendingContrato, setPendingContrato] = useState<Contrato | null>(null);

  // Inconsistency Modal
  const [inconsistenciaModalOpen, setInconsistenciaModalOpen] = useState(false);
  const [inconsistenciaSelecionada, setInconsistenciaSelecionada] =
    useState<InconsistenciaModalState | null>(null);

  // Punctuality Modal
  const [pontualidadeModalOpen, setPontualidadeModalOpen] = useState(false);
  const [pontualidadeSelecionada, setPontualidadeSelecionada] =
    useState<PontualidadeModalState | null>(null);

  // Absenteeism Modal
  const [absenteismoModalOpen, setAbsenteismoModalOpen] = useState(false);
  const [absenteismoSelecionado, setAbsenteismoSelecionado] =
    useState<AbsenteismoModalState | null>(null);

  // Hours Difference Modal
  const [diferencaHorasModalOpen, setDiferencaHorasModalOpen] = useState(false);
  const [diferencaHorasSelecionada, setDiferencaHorasSelecionada] =
    useState<DiferencaHorasModalState | null>(null);

  // Scheduled Hours Modal
  const [horasEscaladasModalOpen, setHorasEscaladasModalOpen] = useState(false);
  const [horasEscaladasSelecionadas, setHorasEscaladasSelecionadas] =
    useState<HorasEscaladasModalState | null>(null);

  // Unit Hours Modal
  const [horasUnidadeModalOpen, setHorasUnidadeModalOpen] = useState(false);
  const [horasUnidadeSelecionadas, setHorasUnidadeSelecionadas] =
    useState<HorasUnidadeModalState | null>(null);

  // Access History Modal handlers
  const openAccessModal = useCallback(
    (person: HorasCalculadas, acessosFiltrados: Acesso[]) => {
      setSelectedPerson(person);
      const acessosPessoa = acessosFiltrados
        .filter((a) => a.cpf === person.cpf)
        .sort(
          (a, b) => new Date(b.data_acesso).getTime() - new Date(a.data_acesso).getTime()
        );
      setPersonAcessos(acessosPessoa);
      setModalOpen(true);
    },
    []
  );

  const closeAccessModal = useCallback(() => {
    setModalOpen(false);
    setSelectedPerson(null);
    setPersonAcessos([]);
  }, []);

  // Productivity Modal handlers
  const openProdutividadeModal = useCallback(
    async (
      person: HorasCalculadas,
      filtroDataInicio: Date | null,
      filtroDataFim: Date | null
    ) => {
      setSelectedPersonProdutividade(person);
      setProdutividadeModalOpen(true);

      try {
        const prodData = await loadPersonProdutividade({
          codigoMV: person.codigomv !== '-' ? person.codigomv : undefined,
          nome: person.nome,
          dataInicio: filtroDataInicio || undefined,
          dataFim: filtroDataFim || undefined,
        });
        setPersonProdutividade(prodData);
      } catch (err) {
        console.error('Erro ao buscar produtividade:', err);
        setPersonProdutividade([]);
      }
    },
    []
  );

  const closeProdutividadeModal = useCallback(() => {
    setProdutividadeModalOpen(false);
    setSelectedPersonProdutividade(null);
    setPersonProdutividade([]);
  }, []);

  // Contract Warning Modal handlers
  const openContratoWarning = useCallback((contrato: Contrato) => {
    setPendingContrato(contrato);
    setContratoWarningOpen(true);
  }, []);

  const closeContratoWarning = useCallback(() => {
    setContratoWarningOpen(false);
    setPendingContrato(null);
  }, []);

  const confirmContratoChange = useCallback(() => {
    const contrato = pendingContrato;
    setContratoWarningOpen(false);
    setPendingContrato(null);
    return contrato;
  }, [pendingContrato]);

  // Inconsistency Modal handlers
  const openInconsistenciaModal = useCallback((data: InconsistenciaModalState) => {
    setInconsistenciaSelecionada(data);
    setInconsistenciaModalOpen(true);
  }, []);

  const closeInconsistenciaModal = useCallback(() => {
    setInconsistenciaModalOpen(false);
    setInconsistenciaSelecionada(null);
  }, []);

  // Punctuality Modal handlers
  const openPontualidadeModal = useCallback((data: PontualidadeModalState) => {
    setPontualidadeSelecionada(data);
    setPontualidadeModalOpen(true);
  }, []);

  const closePontualidadeModal = useCallback(() => {
    setPontualidadeModalOpen(false);
    setPontualidadeSelecionada(null);
  }, []);

  // Absenteeism Modal handlers
  const openAbsenteismoModal = useCallback((data: AbsenteismoModalState) => {
    setAbsenteismoSelecionado(data);
    setAbsenteismoModalOpen(true);
  }, []);

  const closeAbsenteismoModal = useCallback(() => {
    setAbsenteismoModalOpen(false);
    setAbsenteismoSelecionado(null);
  }, []);

  // Hours Difference Modal handlers
  const openDiferencaHorasModal = useCallback(
    (
      cpf: string,
      nome: string,
      totalHoras: number,
      cargaHorariaEscalada: number,
      acessosFiltrados: Acesso[],
      escalas: EscalaMedica[],
      filtroDataInicio: Date | null,
      filtroDataFim: Date | null
    ) => {
      // Calculate daily breakdown
      const acessosPessoa = acessosFiltrados.filter((a) => a.cpf === cpf);
      const acessosPorDia = acessosPessoa.reduce(
        (acc, acesso) => {
          const data = format(parseISO(acesso.data_acesso), 'yyyy-MM-dd');
          if (!acc[data]) acc[data] = [];
          acc[data].push(acesso);
          return acc;
        },
        {} as Record<string, Acesso[]>
      );

      const detalhamentoDiario = Object.entries(acessosPorDia)
        .map(([data, acessosDia]) => {
          const entradas = acessosDia.filter((a) => a.sentido === 'E');
          const saidas = acessosDia.filter((a) => a.sentido === 'S');

          let horasTrabalhadas = 0;
          if (entradas.length > 0 && saidas.length > 0) {
            const primeiraEntrada = parseISO(entradas[0].data_acesso);
            const ultimaSaida = parseISO(saidas[saidas.length - 1].data_acesso);
            if (ultimaSaida > primeiraEntrada) {
              horasTrabalhadas = differenceInMinutes(ultimaSaida, primeiraEntrada) / 60;
            }
          }

          // Calculate scheduled hours for this day
          const escalasNoDia = escalas.filter((escala) => {
            if (!escala.medicos?.some((m: { cpf: string }) => m.cpf === cpf)) return false;
            const dataEscala = format(parseISO(escala.data_inicio), 'yyyy-MM-dd');
            return dataEscala === data;
          });

          const cargaEscalada = escalasNoDia.reduce((sum, escala) => {
            try {
              const [horaEntrada, minEntrada] = escala.horario_entrada.split(':').map(Number);
              const [horaSaida, minSaida] = escala.horario_saida.split(':').map(Number);
              let minutos = horaSaida * 60 + minSaida - (horaEntrada * 60 + minEntrada);
              if (minutos < 0) minutos += 24 * 60;
              return sum + minutos / 60;
            } catch {
              return sum;
            }
          }, 0);

          return {
            data,
            horasTrabalhadas: parseFloat(horasTrabalhadas.toFixed(2)),
            cargaEscalada: parseFloat(cargaEscalada.toFixed(2)),
            diferenca: parseFloat((horasTrabalhadas - cargaEscalada).toFixed(2)),
          };
        })
        .sort((a, b) => a.data.localeCompare(b.data));

      setDiferencaHorasSelecionada({
        nome,
        cpf,
        totalHoras,
        cargaHorariaEscalada,
        diferenca: totalHoras - cargaHorariaEscalada,
        detalhamentoDiario,
      });
      setDiferencaHorasModalOpen(true);
    },
    []
  );

  const closeDiferencaHorasModal = useCallback(() => {
    setDiferencaHorasModalOpen(false);
    setDiferencaHorasSelecionada(null);
  }, []);

  // Scheduled Hours Modal handlers
  const openHorasEscaladasModal = useCallback(
    (
      cpf: string,
      nome: string,
      escalas: EscalaMedica[],
      filtroDataInicio: Date | null,
      filtroDataFim: Date | null
    ) => {
      const escalasDoMedico = escalas.filter((escala) => {
        if (!escala.medicos?.some((m: { cpf: string }) => m.cpf === cpf)) return false;

        if (filtroDataInicio) {
          const dataEscala = new Date(escala.data_inicio);
          dataEscala.setHours(0, 0, 0, 0);
          const inicio = new Date(filtroDataInicio);
          inicio.setHours(0, 0, 0, 0);
          if (dataEscala < inicio) return false;
        }

        if (filtroDataFim) {
          const dataEscala = new Date(escala.data_inicio);
          dataEscala.setHours(0, 0, 0, 0);
          const fim = new Date(filtroDataFim);
          fim.setHours(0, 0, 0, 0);
          if (dataEscala > fim) return false;
        }

        return true;
      });

      const detalhamento = escalasDoMedico.map((escala) => {
        let horas = 0;
        try {
          const [horaEntrada, minEntrada] = escala.horario_entrada.split(':').map(Number);
          const [horaSaida, minSaida] = escala.horario_saida.split(':').map(Number);
          let minutos = horaSaida * 60 + minSaida - (horaEntrada * 60 + minEntrada);
          if (minutos < 0) minutos += 24 * 60;
          horas = minutos / 60;
        } catch {
          // ignore
        }

        return {
          data: escala.data_inicio,
          horarioEntrada: escala.horario_entrada,
          horarioSaida: escala.horario_saida,
          horas: parseFloat(horas.toFixed(2)),
          observacoes: escala.observacoes || null,
          status: escala.status,
        };
      });

      const totalHoras = detalhamento.reduce((sum, d) => sum + d.horas, 0);

      setHorasEscaladasSelecionadas({
        nome,
        cpf,
        totalHoras: parseFloat(totalHoras.toFixed(2)),
        detalhamento: detalhamento.sort((a, b) => a.data.localeCompare(b.data)),
      });
      setHorasEscaladasModalOpen(true);
    },
    []
  );

  const closeHorasEscaladasModal = useCallback(() => {
    setHorasEscaladasModalOpen(false);
    setHorasEscaladasSelecionadas(null);
  }, []);

  // Unit Hours Modal handlers
  const openHorasUnidadeModal = useCallback(
    (cpf: string, nome: string, acessosFiltrados: Acesso[]) => {
      const acessosPessoa = acessosFiltrados.filter((a) => a.cpf === cpf);
      const acessosPorDia = acessosPessoa.reduce(
        (acc, acesso) => {
          const data = format(parseISO(acesso.data_acesso), 'yyyy-MM-dd');
          if (!acc[data]) acc[data] = [];
          acc[data].push(acesso);
          return acc;
        },
        {} as Record<string, Acesso[]>
      );

      const detalhamento = Object.entries(acessosPorDia)
        .map(([data, acessosDia]) => {
          const entradas = acessosDia.filter((a) => a.sentido === 'E');
          const saidas = acessosDia.filter((a) => a.sentido === 'S');

          let horas = 0;
          let primeiraEntrada = '-';
          let ultimaSaida = '-';

          if (entradas.length > 0) {
            primeiraEntrada = format(parseISO(entradas[0].data_acesso), 'HH:mm');
          }
          if (saidas.length > 0) {
            ultimaSaida = format(parseISO(saidas[saidas.length - 1].data_acesso), 'HH:mm');
          }

          if (entradas.length > 0 && saidas.length > 0) {
            const entrada = parseISO(entradas[0].data_acesso);
            const saida = parseISO(saidas[saidas.length - 1].data_acesso);
            if (saida > entrada) {
              horas = differenceInMinutes(saida, entrada) / 60;
            }
          }

          return {
            data,
            primeiraEntrada,
            ultimaSaida,
            horas: parseFloat(horas.toFixed(2)),
            entradas: entradas.length,
            saidas: saidas.length,
          };
        })
        .sort((a, b) => a.data.localeCompare(b.data));

      const totalHoras = detalhamento.reduce((sum, d) => sum + d.horas, 0);

      setHorasUnidadeSelecionadas({
        nome,
        cpf,
        totalHoras: parseFloat(totalHoras.toFixed(2)),
        detalhamento,
      });
      setHorasUnidadeModalOpen(true);
    },
    []
  );

  const closeHorasUnidadeModal = useCallback(() => {
    setHorasUnidadeModalOpen(false);
    setHorasUnidadeSelecionadas(null);
  }, []);

  return {
    // Access History Modal
    modalOpen,
    selectedPerson,
    personAcessos,
    openAccessModal,
    closeAccessModal,

    // Productivity Modal
    produtividadeModalOpen,
    selectedPersonProdutividade,
    personProdutividade,
    openProdutividadeModal,
    closeProdutividadeModal,

    // Contract Warning Modal
    contratoWarningOpen,
    pendingContrato,
    openContratoWarning,
    closeContratoWarning,
    confirmContratoChange,

    // Inconsistency Modal
    inconsistenciaModalOpen,
    inconsistenciaSelecionada,
    openInconsistenciaModal,
    closeInconsistenciaModal,

    // Punctuality Modal
    pontualidadeModalOpen,
    pontualidadeSelecionada,
    openPontualidadeModal,
    closePontualidadeModal,

    // Absenteeism Modal
    absenteismoModalOpen,
    absenteismoSelecionado,
    openAbsenteismoModal,
    closeAbsenteismoModal,

    // Hours Difference Modal
    diferencaHorasModalOpen,
    diferencaHorasSelecionada,
    openDiferencaHorasModal,
    closeDiferencaHorasModal,

    // Scheduled Hours Modal
    horasEscaladasModalOpen,
    horasEscaladasSelecionadas,
    openHorasEscaladasModal,
    closeHorasEscaladasModal,

    // Unit Hours Modal
    horasUnidadeModalOpen,
    horasUnidadeSelecionadas,
    openHorasUnidadeModal,
    closeHorasUnidadeModal,
  };
}
