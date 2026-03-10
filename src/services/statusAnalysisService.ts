import { supabase } from "../lib/supabase";
import { EscalaMedica } from "../types/database.types";
import { parseISO, format, isSameDay } from "date-fns";

// Tolerância de 1 hora para considerar escala como cumprida
// Se o médico trabalhou pelo menos (horasEsperadas - 1h), considera como Pré-Aprovado
const TOLERANCIA_HORAS = 1;

/**
 * Calcula as horas trabalhadas por um médico baseado nos acessos mais próximos aos horários escalados.
 * IMPORTANTE: Ignora a distinção entre Entrada (E) e Saída (S) pois algumas catracas estão mal configuradas.
 * Usa o primeiro acesso próximo ao horário de entrada e o último acesso próximo ao horário de saída.
 */
async function calcularHorasTrabalhadas(
  cpf: string,
  data: Date,
  horarioEntradaEscalado: string, // Formato "HH:mm"
  horarioSaidaEscalado: string     // Formato "HH:mm"
): Promise<number> {
  try {
    // Normalizar a data para garantir que estamos buscando o dia correto
    const dataNormalizada = new Date(data);
    dataNormalizada.setHours(0, 0, 0, 0);

    const dataFormatada = format(dataNormalizada, "yyyy-MM-dd");

    // Verificar se a escala atravessa meia-noite
    const [horaE, minE] = horarioEntradaEscalado.split(":").map(Number);
    const [horaS, minS] = horarioSaidaEscalado.split(":").map(Number);
    const minutosEntrada = horaE * 60 + minE;
    const minutosSaida = horaS * 60 + minS;
    const atravessaMeiaNoite = minutosSaida < minutosEntrada;

    console.log(`[Status Analysis] ========== INÍCIO DO CÁLCULO ==========`);
    console.log(`[Status Analysis] CPF: ${cpf}`);
    console.log(`[Status Analysis] Data da escala: ${dataFormatada}`);
    console.log(`[Status Analysis] Horário escalado: ${horarioEntradaEscalado} - ${horarioSaidaEscalado}`);
    console.log(`[Status Analysis] Atravessa meia-noite: ${atravessaMeiaNoite}`);

    // Buscar acessos - se atravessa meia-noite, buscar do dia atual e dia seguinte
    let acessos: any[] = [];

    if (atravessaMeiaNoite) {
      // Buscar acessos de dois dias
      const diaSeguinte = new Date(dataNormalizada);
      diaSeguinte.setDate(diaSeguinte.getDate() + 1);
      const diaSeguinteFormatado = format(diaSeguinte, "yyyy-MM-dd");

      console.log(`[Status Analysis] Buscando acessos em DOIS dias (escala noturna):`);
      console.log(`[Status Analysis]   - Dia 1: ${dataFormatada}T00:00:00 até ${dataFormatada}T23:59:59`);
      console.log(`[Status Analysis]   - Dia 2: ${diaSeguinteFormatado}T00:00:00 até ${diaSeguinteFormatado}T23:59:59`);

      const { data: acessosDia1, error: error1 } = await supabase
        .from("acessos")
        .select("*")
        .eq("cpf", cpf)
        .gte("data_acesso", `${dataFormatada}T00:00:00`)
        .lte("data_acesso", `${dataFormatada}T23:59:59`)
        .order("data_acesso", { ascending: true });

      const { data: acessosDia2, error: error2 } = await supabase
        .from("acessos")
        .select("*")
        .eq("cpf", cpf)
        .gte("data_acesso", `${diaSeguinteFormatado}T00:00:00`)
        .lte("data_acesso", `${diaSeguinteFormatado}T23:59:59`)
        .order("data_acesso", { ascending: true });

      if (error1 || error2) throw error1 || error2;

      acessos = [...(acessosDia1 || []), ...(acessosDia2 || [])];
    } else {
      // Buscar acessos de um único dia
      console.log(`[Status Analysis] Buscando acessos em UM dia: ${dataFormatada}T00:00:00 até ${dataFormatada}T23:59:59`);

      const { data: acessosData, error } = await supabase
        .from("acessos")
        .select("*")
        .eq("cpf", cpf)
        .gte("data_acesso", `${dataFormatada}T00:00:00`)
        .lte("data_acesso", `${dataFormatada}T23:59:59`)
        .order("data_acesso", { ascending: true });

      if (error) throw error;
      acessos = acessosData || [];
    }

    if (!acessos || acessos.length === 0) {
      console.log(`[Status Analysis] ❌ Nenhum acesso encontrado para CPF ${cpf}`);
      console.log(`[Status Analysis] ========== FIM DO CÁLCULO (0 acessos) ==========\n`);
      return 0;
    }

    console.log(`[Status Analysis] ✅ ${acessos.length} acessos encontrados`);
    console.log(`[Status Analysis] Acessos (ignorando sentido E/S):`, acessos.map(a => ({
      horario: format(parseISO(a.data_acesso), 'dd/MM/yyyy HH:mm:ss'),
      sentido: a.sentido === "E" ? "Entrada" : "Saída",
      nota: "(sentido ignorado - usando apenas timestamp)"
    })));

    // Nova lógica: usar TODOS os acessos como timestamps, ignorando E/S
    // Encontrar o primeiro acesso próximo ao horário de entrada e o último próximo ao de saída
    console.log(`[Status Analysis] ===== Buscando primeiro/último acesso (ignorando sentido E/S) =====`);

    // Converter todos os acessos para objetos com dataHora
    const todosAcessos = acessos.map(a => ({
      ...a,
      dataHora: parseISO(a.data_acesso)
    }));

    console.log(`[Status Analysis] Total de acessos (todos os tipos): ${todosAcessos.length}`);

    if (todosAcessos.length === 0) {
      console.log(`[Status Analysis] ❌ Nenhum acesso disponível`);
      console.log(`[Status Analysis] ========== FIM DO CÁLCULO (sem acessos) ==========\n`);
      return 0;
    }

    // Criar horário escalado de entrada no dia correto
    const horarioEntradaEsperado = new Date(dataNormalizada);
    horarioEntradaEsperado.setHours(horaE, minE, 0, 0);

    // Criar horário escalado de saída (pode ser no dia seguinte)
    let horarioSaidaEsperado = new Date(dataNormalizada);
    horarioSaidaEsperado.setHours(horaS, minS, 0, 0);
    if (atravessaMeiaNoite) {
      horarioSaidaEsperado.setDate(horarioSaidaEsperado.getDate() + 1);
    }

    console.log(`[Status Analysis] Horário de entrada esperado: ${format(horarioEntradaEsperado, 'dd/MM/yyyy HH:mm:ss')}`);
    console.log(`[Status Analysis] Horário de saída esperado: ${format(horarioSaidaEsperado, 'dd/MM/yyyy HH:mm:ss')}`);

    // Encontrar o acesso mais próximo ao horário escalado de ENTRADA (janela de ±3 horas)
    const JANELA_TOLERANCIA = 3 * 60 * 60 * 1000; // 3 horas em ms

    let primeiroAcesso = null;
    let menorDiferencaEntrada = Infinity;

    for (const acesso of todosAcessos) {
      const diferenca = Math.abs(acesso.dataHora.getTime() - horarioEntradaEsperado.getTime());
      console.log(`[Status Analysis]   Acesso em ${format(acesso.dataHora, 'HH:mm:ss')} (${acesso.sentido}) - Diferença da entrada: ${(diferenca / 60000).toFixed(0)} minutos`);

      if (diferenca <= JANELA_TOLERANCIA && diferenca < menorDiferencaEntrada) {
        menorDiferencaEntrada = diferenca;
        primeiroAcesso = acesso;
      }
    }

    // FALLBACK: Se não encontrou dentro da janela, usar primeiro acesso do dia
    if (!primeiroAcesso) {
      console.log(`[Status Analysis] ⚠️ Nenhum acesso encontrado dentro da janela de ±3h do horário de entrada`);
      console.log(`[Status Analysis] 🔄 FALLBACK: Usando primeiro acesso do dia`);
      primeiroAcesso = todosAcessos[0]; // Já está ordenado por data_acesso
    }

    console.log(`[Status Analysis] ✓ Primeiro acesso selecionado: ${format(primeiroAcesso.dataHora, 'dd/MM/yyyy HH:mm:ss')} (${primeiroAcesso.sentido})`);
    if (menorDiferencaEntrada !== Infinity) {
      console.log(`[Status Analysis]   (${(menorDiferencaEntrada / 60000).toFixed(0)} minutos de diferença do horário escalado)`);
    }

    // Encontrar o acesso mais próximo ao horário escalado de SAÍDA (após o primeiro acesso)
    let ultimoAcesso = null;
    let menorDiferencaSaida = Infinity;

    for (const acesso of todosAcessos) {
      // O último acesso deve ser APÓS o primeiro
      if (acesso.dataHora.getTime() <= primeiroAcesso.dataHora.getTime()) {
        continue;
      }

      const diferenca = Math.abs(acesso.dataHora.getTime() - horarioSaidaEsperado.getTime());
      console.log(`[Status Analysis]   Acesso em ${format(acesso.dataHora, 'HH:mm:ss')} (${acesso.sentido}) - Diferença da saída: ${(diferenca / 60000).toFixed(0)} minutos`);

      if (diferenca <= JANELA_TOLERANCIA && diferenca < menorDiferencaSaida) {
        menorDiferencaSaida = diferenca;
        ultimoAcesso = acesso;
      }
    }

    // FALLBACK: Se não encontrou dentro da janela, usar último acesso do dia (após primeiro)
    if (!ultimoAcesso) {
      console.log(`[Status Analysis] ⚠️ Nenhum acesso encontrado dentro da janela de ±3h do horário de saída`);
      console.log(`[Status Analysis] 🔄 FALLBACK: Usando último acesso do dia (após primeiro)`);

      // Procurar último acesso após o primeiro
      const acessosAposPrimeiro = todosAcessos.filter(a => a.dataHora.getTime() > primeiroAcesso.dataHora.getTime());
      if (acessosAposPrimeiro.length > 0) {
        ultimoAcesso = acessosAposPrimeiro[acessosAposPrimeiro.length - 1];
      } else {
        console.log(`[Status Analysis] ❌ Nenhum acesso encontrado após o primeiro`);
        console.log(`[Status Analysis] ========== FIM DO CÁLCULO (sem segundo acesso) ==========\n`);
        return 0;
      }
    }

    console.log(`[Status Analysis] ✓ Último acesso selecionado: ${format(ultimoAcesso.dataHora, 'dd/MM/yyyy HH:mm:ss')} (${ultimoAcesso.sentido})`);
    if (menorDiferencaSaida !== Infinity) {
      console.log(`[Status Analysis]   (${(menorDiferencaSaida / 60000).toFixed(0)} minutos de diferença do horário escalado)`);
    }

    // Calcular horas trabalhadas
    const diffMs = ultimoAcesso.dataHora.getTime() - primeiroAcesso.dataHora.getTime();
    const horasTrabalhadas = diffMs / (1000 * 60 * 60);

    console.log(`[Status Analysis] ===== Fim da busca =====`);
    console.log(`[Status Analysis] 🎯 HORAS TRABALHADAS NO PLANTÃO: ${horasTrabalhadas.toFixed(4)}h (${(horasTrabalhadas * 60).toFixed(2)} minutos)`);
    console.log(`[Status Analysis] Período: ${format(primeiroAcesso.dataHora, 'dd/MM/yyyy HH:mm:ss')} até ${format(ultimoAcesso.dataHora, 'dd/MM/yyyy HH:mm:ss')}`);
    console.log(`[Status Analysis] ========== FIM DO CÁLCULO ==========\n`);

    return horasTrabalhadas;
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

    console.log(`\n[Status Analysis] ===============================================`);
    console.log(`[Status Analysis] ==== Analisando Escala ID: ${escala.id} ====`);
    console.log(`[Status Analysis] ===============================================`);
    console.log(`[Status Analysis] escala.data_inicio (string RAW do banco): "${escala.data_inicio}"`);
    console.log(`[Status Analysis] dataEscala (após parseISO):`, dataEscala);
    console.log(`[Status Analysis] dataEscala como ISO String: ${dataEscala.toISOString()}`);
    console.log(`[Status Analysis] Data formatada (dd/MM/yyyy): ${format(dataEscala, 'dd/MM/yyyy')}`);
    console.log(`[Status Analysis] Data formatada (yyyy-MM-dd): ${format(dataEscala, 'yyyy-MM-dd')}`);
    console.log(`[Status Analysis] Horário: ${escala.horario_entrada} - ${escala.horario_saida}`);
    console.log(`[Status Analysis] Médicos na escala:`, escala.medicos.map(m => `${m.nome} (${m.cpf})`).join(', '));

    // Se a escala é futura, status deve ser "Programado"
    if (dataEscala > hoje) {
      console.log(`[Status Analysis] Escala futura. Status: Programado`);
      return "Programado";
    }

    // Se já foi aprovado ou reprovado manualmente, não alterar
    if (escala.status === "Aprovado" || escala.status === "Reprovado") {
      console.log(`[Status Analysis] Status já finalizado: ${escala.status}`);
      return escala.status;
    }

    // Calcular horas esperadas
    const horasEsperadas = calcularHorasEscaladas(escala);
    console.log(`[Status Analysis] Horários raw: entrada="${escala.horario_entrada}", saída="${escala.horario_saida}"`);
    console.log(`[Status Analysis] Horas esperadas calculadas: ${horasEsperadas.toFixed(4)}h (${horasEsperadas} raw)`);

    // Para cada médico escalado, verificar se cumpriu a carga horária
    // Tolerância de 1 hora: se trabalhou (horasEsperadas - 1h), considera como cumprido
    const horasMinimasParaAprovacao = Math.max(0, horasEsperadas - TOLERANCIA_HORAS);

    let todosCumpriram = true;
    let algumNaoCompareceu = false;
    let algumTrabalhouParcial = false;

    for (const medico of escala.medicos) {
      console.log(`[Status Analysis] Analisando médico: ${medico.nome} (CPF: ${medico.cpf})`);

      const horasTrabalhadas = await calcularHorasTrabalhadas(
        medico.cpf,
        dataEscala,
        escala.horario_entrada,
        escala.horario_saida
      );

      console.log(`[Status Analysis] ===== COMPARAÇÃO FINAL =====`);
      console.log(`[Status Analysis] Horas trabalhadas: ${horasTrabalhadas.toFixed(4)}h (${horasTrabalhadas} raw)`);
      console.log(`[Status Analysis] Horas esperadas: ${horasEsperadas.toFixed(4)}h (${horasEsperadas} raw)`);
      console.log(`[Status Analysis] Tolerância: ${TOLERANCIA_HORAS}h`);
      console.log(`[Status Analysis] Horas mínimas para aprovação: ${horasMinimasParaAprovacao.toFixed(4)}h`);
      console.log(`[Status Analysis] Diferença: ${(horasTrabalhadas - horasEsperadas).toFixed(4)}h`);
      console.log(`[Status Analysis] horasTrabalhadas === 0? ${horasTrabalhadas === 0}`);
      console.log(`[Status Analysis] horasTrabalhadas < horasMinimasParaAprovacao? ${horasTrabalhadas < horasMinimasParaAprovacao}`);
      console.log(`[Status Analysis] horasTrabalhadas >= horasMinimasParaAprovacao? ${horasTrabalhadas >= horasMinimasParaAprovacao}`);

      if (horasTrabalhadas === 0) {
        console.log(`[Status Analysis] ❌ RESULTADO: Médico não compareceu (0 horas)`);
        algumNaoCompareceu = true;
        todosCumpriram = false;
      } else if (horasTrabalhadas < horasMinimasParaAprovacao) {
        console.log(`[Status Analysis] ⚠️  RESULTADO: Médico trabalhou parcialmente (${horasTrabalhadas.toFixed(4)}h < ${horasMinimasParaAprovacao.toFixed(4)}h mínimo)`);
        algumTrabalhouParcial = true;
        todosCumpriram = false;
      } else {
        console.log(`[Status Analysis] ✅ RESULTADO: Médico CUMPRIU carga horária (${horasTrabalhadas.toFixed(4)}h >= ${horasMinimasParaAprovacao.toFixed(4)}h mínimo, tolerância de ${TOLERANCIA_HORAS}h aplicada)`);
      }
      console.log(`[Status Analysis] =============================`);
    }

    // Determinar status
    let statusFinal;
    console.log(`\n[Status Analysis] ========== DETERMINAÇÃO DO STATUS FINAL ==========`);
    console.log(`[Status Analysis] algumNaoCompareceu: ${algumNaoCompareceu}`);
    console.log(`[Status Analysis] algumTrabalhouParcial: ${algumTrabalhouParcial}`);
    console.log(`[Status Analysis] todosCumpriram: ${todosCumpriram}`);

    if (algumNaoCompareceu) {
      statusFinal = "Atenção";
      console.log(`[Status Analysis] 🔴 Status final: ATENÇÃO`);
      console.log(`[Status Analysis] Motivo: Médico não compareceu (0 horas trabalhadas)`);
    } else if (algumTrabalhouParcial) {
      statusFinal = "Aprovação Parcial";
      console.log(`[Status Analysis] 🟡 Status final: APROVAÇÃO PARCIAL`);
      console.log(`[Status Analysis] Motivo: Médico trabalhou parcialmente (menos que as horas escaladas)`);
    } else {
      statusFinal = "Pré-Aprovado";
      console.log(`[Status Analysis] ✅ Status final: PRÉ-APROVADO`);
      console.log(`[Status Analysis] Motivo: Todos os médicos cumpriram a carga horária`);
    }

    console.log(`[Status Analysis] ===============================================`);
    console.log(`[Status Analysis] ==== Fim da Análise da Escala ${escala.id} ====`);
    console.log(`[Status Analysis] ===============================================\n`);
    return statusFinal;
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
    // Buscar apenas escalas com status "Programado" (escalas pré-agendadas não devem ser recalculadas)
    const { data: escalas, error } = await supabase
      .from("escalas_medicas")
      .select("*")
      .eq("status", "Programado");

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
    const horasMinimasParaAprovacao = Math.max(0, horasEsperadas - TOLERANCIA_HORAS);
    const dataEscala = parseISO(escala.data_inicio);
    const detalhes = [];

    for (const medico of escala.medicos) {
      const horasTrabalhadas = await calcularHorasTrabalhadas(
        medico.cpf,
        dataEscala,
        escala.horario_entrada,
        escala.horario_saida
      );
      // Considera cumprido se trabalhou pelo menos (horasEsperadas - tolerância)
      const cumpriu = horasTrabalhadas >= horasMinimasParaAprovacao;

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
