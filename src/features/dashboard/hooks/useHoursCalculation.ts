/**
 * useHoursCalculation Hook
 *
 * Handles hours calculation logic for dashboard data.
 */

import { useCallback } from 'react';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import { supabase } from '../../../lib/supabase';
import { normalizeCPF } from '../utils/cpfUtils';
import type {
  Acesso,
  HorasCalculadas,
  EscalaMedica,
  Usuario,
  Produtividade,
  Contrato,
} from '../types/dashboard.types';

export interface CalculateHoursParams {
  acessos: Acesso[];
  escalas: EscalaMedica[];
  usuarios: Usuario[];
  produtividade: Produtividade[];
  filtroTipo: string[];
  filtroMatricula: string[];
  filtroNome: string[];
  filtroCpf: string[];
  filtroEspecialidade: string[];
  filtroContrato: Contrato | null;
  filtroUnidade: string[];
  filtroDataInicio: Date | null;
  filtroDataFim: Date | null;
}

export interface CalculateHoursResult {
  horasCalculadas: HorasCalculadas[];
  acessosFiltrados: Acesso[];
}

export function useHoursCalculation() {
  const calculateHours = useCallback(
    async (params: CalculateHoursParams): Promise<CalculateHoursResult> => {
      const {
        acessos,
        escalas,
        usuarios,
        produtividade,
        filtroTipo,
        filtroMatricula,
        filtroNome,
        filtroCpf,
        filtroEspecialidade,
        filtroContrato,
        filtroUnidade,
        filtroDataInicio,
        filtroDataFim,
      } = params;

      // Get CPFs from contract if filtered
      let cpfsDoContrato: string[] = [];
      if (filtroContrato) {
        try {
          const { data: usuariosContrato } = await supabase
            .from('usuario_contrato')
            .select('cpf')
            .eq('contrato_id', filtroContrato.id);

          if (usuariosContrato && usuariosContrato.length > 0) {
            cpfsDoContrato = usuariosContrato.map((u: { cpf: string }) => u.cpf);
          }

          const { data: usuariosDirectos } = await supabase
            .from('usuarios')
            .select('cpf')
            .eq('contrato_id', filtroContrato.id);

          if (usuariosDirectos && usuariosDirectos.length > 0) {
            const cpfsDirectos = usuariosDirectos.map((u: { cpf: string }) => u.cpf);
            cpfsDoContrato = [...new Set([...cpfsDoContrato, ...cpfsDirectos])];
          }
        } catch (err) {
          console.error('Erro ao buscar CPFs do contrato:', err);
        }
      }

      // Filter accesses
      const acessosFiltrados = acessos.filter((acesso) => {
        if (filtroTipo.length > 0 && !filtroTipo.includes(acesso.tipo)) return false;
        if (filtroMatricula.length > 0 && !filtroMatricula.includes(acesso.matricula))
          return false;
        if (filtroNome.length > 0 && !filtroNome.includes(acesso.nome)) return false;
        if (filtroCpf.length > 0 && !filtroCpf.includes(acesso.cpf)) return false;

        if (filtroEspecialidade.length > 0) {
          const usuario = usuarios.find((u) => u.cpf === acesso.cpf);
          if (
            !usuario ||
            !usuario.especialidade ||
            !usuario.especialidade.some((esp: string) => filtroEspecialidade.includes(esp))
          )
            return false;
        }

        if (filtroContrato && cpfsDoContrato.length > 0 && !cpfsDoContrato.includes(acesso.cpf))
          return false;

        if (filtroUnidade.length > 0 && !filtroUnidade.includes(acesso.planta)) return false;

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

      // Group by CPF
      const acessosPorCpf = acessosFiltrados.reduce(
        (acc, acesso) => {
          if (!acc[acesso.cpf]) {
            acc[acesso.cpf] = [];
          }
          acc[acesso.cpf].push(acesso);
          return acc;
        },
        {} as Record<string, Acesso[]>
      );

      // Calculate hours for each CPF
      const resultado: HorasCalculadas[] = Object.entries(acessosPorCpf).map(
        ([cpf, acessosCpf]) => {
          const acessosOrdenados = acessosCpf.sort(
            (a, b) => new Date(a.data_acesso).getTime() - new Date(b.data_acesso).getTime()
          );

          const acessosPorDia = acessosOrdenados.reduce(
            (acc, acesso) => {
              const data = format(parseISO(acesso.data_acesso), 'yyyy-MM-dd');
              if (!acc[data]) {
                acc[data] = [];
              }
              acc[data].push(acesso);
              return acc;
            },
            {} as Record<string, Acesso[]>
          );

          let totalMinutos = 0;
          let totalEntradas = 0;
          let totalSaidas = 0;
          const diasUnicos = new Set<string>();

          const diasOrdenados = Object.keys(acessosPorDia).sort();

          for (let i = 0; i < diasOrdenados.length; i++) {
            const dia = diasOrdenados[i];
            const acessosDia = acessosPorDia[dia];

            const entradasDia = acessosDia.filter((a) => a.sentido === 'E');
            const saidasDia = acessosDia.filter((a) => a.sentido === 'S');

            totalEntradas += entradasDia.length;
            totalSaidas += saidasDia.length;

            if (entradasDia.length > 0) {
              const primeiraEntrada = parseISO(entradasDia[0].data_acesso);

              if (saidasDia.length > 0) {
                const ultimaSaida = parseISO(saidasDia[saidasDia.length - 1].data_acesso);

                if (ultimaSaida > primeiraEntrada) {
                  const minutos = differenceInMinutes(ultimaSaida, primeiraEntrada);
                  totalMinutos += minutos;
                  diasUnicos.add(dia);
                }
              } else {
                for (let j = i + 1; j < diasOrdenados.length; j++) {
                  const proximoDia = diasOrdenados[j];
                  const acessosProximoDia = acessosPorDia[proximoDia];
                  const saidasProximoDia = acessosProximoDia.filter((a) => a.sentido === 'S');

                  if (saidasProximoDia.length > 0) {
                    const primeiraSaidaProximoDia = parseISO(saidasProximoDia[0].data_acesso);
                    const minutos = differenceInMinutes(primeiraSaidaProximoDia, primeiraEntrada);
                    totalMinutos += minutos;
                    diasUnicos.add(dia);
                    break;
                  }
                }
              }
            }
          }

          const totalHoras = totalMinutos / 60;
          const ultimoAcesso = acessosCpf.sort(
            (a, b) => new Date(b.data_acesso).getTime() - new Date(a.data_acesso).getTime()
          )[0];

          // Calculate scheduled hours for this CPF
          const escalasDoMedico = escalas.filter((escala) => {
            if (!escala.medicos?.some((medico: { cpf: string }) => medico.cpf === cpf)) {
              return false;
            }

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
              const [horaEntrada, minEntrada] = escala.horario_entrada.split(':').map(Number);
              const [horaSaida, minSaida] = escala.horario_saida.split(':').map(Number);

              let minutosTotais = horaSaida * 60 + minSaida - (horaEntrada * 60 + minEntrada);

              if (minutosTotais < 0) {
                minutosTotais += 24 * 60;
              }

              return sum + minutosTotais / 60;
            } catch {
              return sum;
            }
          }, 0);

          const usuario = usuarios.find((u) => u.cpf === cpf);
          const especialidade = usuario?.especialidade?.[0] || '-';

          // Calculate productivity for this CPF
          const produtividadeCpf = produtividade.filter((p) => {
            const usuarioProd = usuarios.find((u) => u.codigomv === p.codigo_mv);
            if (usuarioProd?.cpf !== cpf) return false;

            if (p.data && (filtroDataInicio || filtroDataFim)) {
              const dataProdStr = p.data.split('T')[0];

              if (filtroDataInicio) {
                const dataInicioStr = format(filtroDataInicio, 'yyyy-MM-dd');
                if (dataProdStr < dataInicioStr) return false;
              }

              if (filtroDataFim) {
                const dataFimStr = format(filtroDataFim, 'yyyy-MM-dd');
                if (dataProdStr > dataFimStr) return false;
              }
            }

            return true;
          });

          return {
            cpf,
            nome: ultimoAcesso.nome,
            matricula: ultimoAcesso.matricula,
            tipo: ultimoAcesso.tipo,
            codigomv: usuario?.codigomv || '-',
            totalHoras: parseFloat(totalHoras.toFixed(2)),
            cargaHorariaEscalada: parseFloat(cargaHorariaEscaladaPorCpf.toFixed(2)),
            diasComRegistro: diasUnicos.size,
            entradas: totalEntradas,
            saidas: totalSaidas,
            ultimoAcesso: ultimoAcesso.data_acesso,
            especialidade,
            produtividade_procedimento: produtividadeCpf.reduce(
              (sum, item) => sum + (item.procedimento || 0),
              0
            ),
            produtividade_parecer_solicitado: produtividadeCpf.reduce(
              (sum, item) => sum + (item.parecer_solicitado || 0),
              0
            ),
            produtividade_parecer_realizado: produtividadeCpf.reduce(
              (sum, item) => sum + (item.parecer_realizado || 0),
              0
            ),
            produtividade_cirurgia_realizada: produtividadeCpf.reduce(
              (sum, item) => sum + (item.cirurgia_realizada || 0),
              0
            ),
            produtividade_prescricao: produtividadeCpf.reduce(
              (sum, item) => sum + (item.prescricao || 0),
              0
            ),
            produtividade_evolucao: produtividadeCpf.reduce(
              (sum, item) => sum + (item.evolucao || 0),
              0
            ),
            produtividade_urgencia: produtividadeCpf.reduce(
              (sum, item) => sum + (item.urgencia || 0),
              0
            ),
            produtividade_ambulatorio: produtividadeCpf.reduce(
              (sum, item) => sum + (item.ambulatorio || 0),
              0
            ),
            produtividade_auxiliar: produtividadeCpf.reduce(
              (sum, item) => sum + (item.auxiliar || 0),
              0
            ),
            produtividade_encaminhamento: produtividadeCpf.reduce(
              (sum, item) => sum + (item.encaminhamento || 0),
              0
            ),
            produtividade_folha_objetivo_diario: produtividadeCpf.reduce(
              (sum, item) => sum + (item.folha_objetivo_diario || 0),
              0
            ),
            produtividade_evolucao_diurna_cti: produtividadeCpf.reduce(
              (sum, item) => sum + (item.evolucao_diurna_cti || 0),
              0
            ),
            produtividade_evolucao_noturna_cti: produtividadeCpf.reduce(
              (sum, item) => sum + (item.evolucao_noturna_cti || 0),
              0
            ),
          };
        }
      );

      return {
        horasCalculadas: resultado.sort((a, b) => b.totalHoras - a.totalHoras),
        acessosFiltrados,
      };
    },
    []
  );

  return { calculateHours };
}
