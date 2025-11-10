import { supabase } from "../lib/supabase";
import { EscalaMedica } from "../types/database.types";
import { parseISO, format, isSameDay } from "date-fns";

/**
 * Calcula as horas trabalhadas por um médico em um dia específico baseado nos acessos
 */
async function calcularHorasTrabalhadas(
  cpf: string,
  data: Date
): Promise<number> {
  try {
    const dataFormatada = format(data, "yyyy-MM-dd");

    // Buscar todos os acessos do médico no dia
    const { data: acessos, error } = await supabase
      .from("acessos")
      .select("*")
      .eq("cpf", cpf)
      .gte("data_acesso", `${dataFormatada}T00:00:00`)
      .lte("data_acesso", `${dataFormatada}T23:59:59`)
      .order("data_acesso", { ascending: true });

    if (error) throw error;

    if (!acessos || acessos.length === 0) {
      return 0; // Nenhum acesso registrado
    }

    // Agrupar acessos em pares entrada/saída
    let totalHoras = 0;
    let ultimaEntrada: Date | null = null;

    for (const acesso of acessos) {
      const dataAcesso = parseISO(acesso.data_acesso);

      if (acesso.sentido === "E") {
        // Entrada
        ultimaEntrada = dataAcesso;
      } else if (acesso.sentido === "S" && ultimaEntrada) {
        // Saída - calcular diferença
        const diffMs = dataAcesso.getTime() - ultimaEntrada.getTime();
        const diffHoras = diffMs / (1000 * 60 * 60);
        totalHoras += diffHoras;
        ultimaEntrada = null;
      }
    }

    return totalHoras;
  } catch (error) {
    console.error("Erro ao calcular horas trabalhadas:", error);
    return 0;
  }
}

/**
 * Calcula as horas estabelecidas na escala
 */
function calcularHorasEscaladas(escala: EscalaMedica): number {
  try {
    const [horaE, minE] = escala.horario_entrada.split(":").map(Number);
    const [horaS, minS] = escala.horario_saida.split(":").map(Number);

    const minutosEntrada = horaE * 60 + minE;
    const minutosSaida = horaS * 60 + minS;

    // Se horário de saída é menor, passou da meia-noite
    const duracaoMinutos =
      minutosSaida >= minutosEntrada
        ? minutosSaida - minutosEntrada
        : 1440 - minutosEntrada + minutosSaida;

    return duracaoMinutos / 60;
  } catch (error) {
    console.error("Erro ao calcular horas escaladas:", error);
    return 0;
  }
}

/**
 * Analisa uma escala e determina seu status automático
 */
async function analisarEscala(escala: EscalaMedica): Promise<string> {
  try {
    const dataEscala = parseISO(escala.data_inicio);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // Se a escala é futura, status deve ser "Programado"
    if (dataEscala > hoje) {
      return "Programado";
    }

    // Se já foi aprovado ou reprovado manualmente, não alterar
    if (escala.status === "Aprovado" || escala.status === "Reprovado") {
      return escala.status;
    }

    // Calcular horas esperadas
    const horasEsperadas = calcularHorasEscaladas(escala);

    // Para cada médico escalado, verificar se cumpriu a carga horária
    let todosCumpriram = true;
    let algumNaoCompareceu = false;

    for (const medico of escala.medicos) {
      const horasTrabalhadas = await calcularHorasTrabalhadas(
        medico.cpf,
        dataEscala
      );

      if (horasTrabalhadas === 0) {
        algumNaoCompareceu = true;
        todosCumpriram = false;
      } else if (horasTrabalhadas < horasEsperadas) {
        todosCumpriram = false;
      }
    }

    // Determinar status
    if (algumNaoCompareceu || !todosCumpriram) {
      return "Atenção";
    } else {
      return "Pré-Aprovado";
    }
  } catch (error) {
    console.error("Erro ao analisar escala:", error);
    return "Atenção"; // Em caso de erro, marcar como atenção
  }
}

/**
 * Recalcula o status de todas as escalas não finalizadas
 */
export async function recalcularStatusEscalas(): Promise<{
  success: boolean;
  atualizadas: number;
  erros: number;
  mensagem: string;
}> {
  try {
    // Buscar todas as escalas que não estão aprovadas/reprovadas
    const { data: escalas, error } = await supabase
      .from("escalas_medicas")
      .select("*")
      .not("status", "in", '("Aprovado","Reprovado")');

    if (error) throw error;

    if (!escalas || escalas.length === 0) {
      return {
        success: true,
        atualizadas: 0,
        erros: 0,
        mensagem: "Nenhuma escala para recalcular",
      };
    }

    let atualizadas = 0;
    let erros = 0;

    // Analisar cada escala
    for (const escala of escalas) {
      try {
        const novoStatus = await analisarEscala(escala as EscalaMedica);

        // Atualizar apenas se o status mudou
        if (novoStatus !== escala.status) {
          const { error: updateError } = await supabase
            .from("escalas_medicas")
            .update({ status: novoStatus })
            .eq("id", escala.id);

          if (updateError) {
            console.error("Erro ao atualizar escala:", updateError);
            erros++;
          } else {
            atualizadas++;
          }
        }
      } catch (error) {
        console.error("Erro ao processar escala:", error);
        erros++;
      }
    }

    return {
      success: true,
      atualizadas,
      erros,
      mensagem: `${atualizadas} escala(s) atualizada(s) com sucesso${erros > 0 ? `. ${erros} erro(s) encontrado(s)` : ""}`,
    };
  } catch (error: any) {
    console.error("Erro ao recalcular status:", error);
    return {
      success: false,
      atualizadas: 0,
      erros: 0,
      mensagem: `Erro ao recalcular status: ${error.message}`,
    };
  }
}

/**
 * Analisa uma escala específica e retorna informações detalhadas
 */
export async function analisarEscalaDetalhada(
  escalaId: string
): Promise<{
  status: string;
  detalhes: Array<{
    medico: string;
    cpf: string;
    horasEsperadas: number;
    horasTrabalhadas: number;
    cumpriu: boolean;
  }>;
}> {
  try {
    const { data: escala, error } = await supabase
      .from("escalas_medicas")
      .select("*")
      .eq("id", escalaId)
      .single();

    if (error) throw error;

    const horasEsperadas = calcularHorasEscaladas(escala as EscalaMedica);
    const dataEscala = parseISO(escala.data_inicio);
    const detalhes = [];

    for (const medico of escala.medicos) {
      const horasTrabalhadas = await calcularHorasTrabalhadas(
        medico.cpf,
        dataEscala
      );
      const cumpriu = horasTrabalhadas >= horasEsperadas;

      detalhes.push({
        medico: medico.nome,
        cpf: medico.cpf,
        horasEsperadas,
        horasTrabalhadas,
        cumpriu,
      });
    }

    const novoStatus = await analisarEscala(escala as EscalaMedica);

    return {
      status: novoStatus,
      detalhes,
    };
  } catch (error: any) {
    throw new Error(`Erro ao analisar escala: ${error.message}`);
  }
}
