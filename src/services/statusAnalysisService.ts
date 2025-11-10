import { supabase } from "../lib/supabase";
import { EscalaMedica } from "../types/database.types";
import { parseISO, format, isSameDay } from "date-fns";

/**
 * Calcula as horas trabalhadas por um médico baseado nos acessos mais próximos aos horários escalados
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
    console.log(`[Status Analysis] Acessos:`, acessos.map(a => ({
      horario: format(parseISO(a.data_acesso), 'dd/MM/yyyy HH:mm:ss'),
      sentido: a.sentido === "E" ? "Entrada" : "Saída"
    })));

    // Nova lógica: encontrar entrada e saída mais próximas aos horários escalados
    console.log(`[Status Analysis] ===== Buscando entrada/saída mais próximas aos horários escalados =====`);

    // Separar entradas e saídas
    const entradas = acessos.filter(a => a.sentido === "E").map(a => ({
      ...a,
      dataHora: parseISO(a.data_acesso)
    }));
    const saidas = acessos.filter(a => a.sentido === "S").map(a => ({
      ...a,
      dataHora: parseISO(a.data_acesso)
    }));

    console.log(`[Status Analysis] Total de entradas encontradas: ${entradas.length}`);
    console.log(`[Status Analysis] Total de saídas encontradas: ${saidas.length}`);

    if (entradas.length === 0 || saidas.length === 0) {
      console.log(`[Status Analysis] ❌ Não há pares completos de entrada/saída`);
      console.log(`[Status Analysis] ========== FIM DO CÁLCULO (sem pares) ==========\n`);
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

    // Encontrar entrada mais próxima ao horário escalado (janela de ±3 horas)
    const JANELA_TOLERANCIA = 3 * 60 * 60 * 1000; // 3 horas em ms

    let entradaMaisProxima = null;
    let menorDiferencaEntrada = Infinity;

    for (const entrada of entradas) {
      const diferenca = Math.abs(entrada.dataHora.getTime() - horarioEntradaEsperado.getTime());
      console.log(`[Status Analysis]   Entrada em ${format(entrada.dataHora, 'HH:mm:ss')} - Diferença: ${(diferenca / 60000).toFixed(0)} minutos`);

      if (diferenca <= JANELA_TOLERANCIA && diferenca < menorDiferencaEntrada) {
        menorDiferencaEntrada = diferenca;
        entradaMaisProxima = entrada;
      }
    }

    if (!entradaMaisProxima) {
      console.log(`[Status Analysis] ❌ Nenhuma entrada encontrada dentro da janela de ±3h do horário escalado`);
      console.log(`[Status Analysis] ========== FIM DO CÁLCULO (entrada não encontrada) ==========\n`);
      return 0;
    }

    console.log(`[Status Analysis] ✓ Entrada mais próxima selecionada: ${format(entradaMaisProxima.dataHora, 'dd/MM/yyyy HH:mm:ss')}`);
    console.log(`[Status Analysis]   (${(menorDiferencaEntrada / 60000).toFixed(0)} minutos de diferença do horário escalado)`);

    // Encontrar saída mais próxima ao horário escalado (após a entrada selecionada)
    let saidaMaisProxima = null;
    let menorDiferencaSaida = Infinity;

    for (const saida of saidas) {
      // A saída deve ser APÓS a entrada
      if (saida.dataHora.getTime() <= entradaMaisProxima.dataHora.getTime()) {
        console.log(`[Status Analysis]   Saída em ${format(saida.dataHora, 'HH:mm:ss')} - IGNORADA (antes da entrada)`);
        continue;
      }

      const diferenca = Math.abs(saida.dataHora.getTime() - horarioSaidaEsperado.getTime());
      console.log(`[Status Analysis]   Saída em ${format(saida.dataHora, 'HH:mm:ss')} - Diferença: ${(diferenca / 60000).toFixed(0)} minutos`);

      if (diferenca <= JANELA_TOLERANCIA && diferenca < menorDiferencaSaida) {
        menorDiferencaSaida = diferenca;
        saidaMaisProxima = saida;
      }
    }

    if (!saidaMaisProxima) {
      console.log(`[Status Analysis] ❌ Nenhuma saída encontrada dentro da janela de ±3h do horário escalado (após a entrada)`);
      console.log(`[Status Analysis] ========== FIM DO CÁLCULO (saída não encontrada) ==========\n`);
      return 0;
    }

    console.log(`[Status Analysis] ✓ Saída mais próxima selecionada: ${format(saidaMaisProxima.dataHora, 'dd/MM/yyyy HH:mm:ss')}`);
    console.log(`[Status Analysis]   (${(menorDiferencaSaida / 60000).toFixed(0)} minutos de diferença do horário escalado)`);

    // Calcular horas trabalhadas
    const diffMs = saidaMaisProxima.dataHora.getTime() - entradaMaisProxima.dataHora.getTime();
    const horasTrabalhadas = diffMs / (1000 * 60 * 60);

    console.log(`[Status Analysis] ===== Fim da busca =====`);
    console.log(`[Status Analysis] 🎯 HORAS TRABALHADAS NO PLANTÃO: ${horasTrabalhadas.toFixed(4)}h (${(horasTrabalhadas * 60).toFixed(2)} minutos)`);
    console.log(`[Status Analysis] Período: ${format(entradaMaisProxima.dataHora, 'dd/MM/yyyy HH:mm:ss')} até ${format(saidaMaisProxima.dataHora, 'dd/MM/yyyy HH:mm:ss')}`);
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
    let todosCumpriram = true;
    let algumNaoCompareceu = false;

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
      console.log(`[Status Analysis] Diferença: ${(horasTrabalhadas - horasEsperadas).toFixed(4)}h`);
      console.log(`[Status Analysis] horasTrabalhadas === 0? ${horasTrabalhadas === 0}`);
      console.log(`[Status Analysis] horasTrabalhadas < horasEsperadas? ${horasTrabalhadas < horasEsperadas}`);
      console.log(`[Status Analysis] horasTrabalhadas >= horasEsperadas? ${horasTrabalhadas >= horasEsperadas}`);

      if (horasTrabalhadas === 0) {
        console.log(`[Status Analysis] ❌ RESULTADO: Médico não compareceu (0 horas)`);
        algumNaoCompareceu = true;
        todosCumpriram = false;
      } else if (horasTrabalhadas < horasEsperadas) {
        console.log(`[Status Analysis] ⚠️  RESULTADO: Médico NÃO cumpriu carga horária (${horasTrabalhadas.toFixed(4)}h < ${horasEsperadas.toFixed(4)}h)`);
        todosCumpriram = false;
      } else {
        console.log(`[Status Analysis] ✅ RESULTADO: Médico CUMPRIU carga horária (${horasTrabalhadas.toFixed(4)}h >= ${horasEsperadas.toFixed(4)}h)`);
      }
      console.log(`[Status Analysis] =============================`);
    }

    // Determinar status
    let statusFinal;
    console.log(`\n[Status Analysis] ========== DETERMINAÇÃO DO STATUS FINAL ==========`);
    console.log(`[Status Analysis] algumNaoCompareceu: ${algumNaoCompareceu}`);
    console.log(`[Status Analysis] todosCumpriram: ${todosCumpriram}`);

    if (algumNaoCompareceu || !todosCumpriram) {
      statusFinal = "Atenção";
      console.log(`[Status Analysis] 🔴 Status final: ATENÇÃO`);
      console.log(`[Status Analysis] Motivo: ${algumNaoCompareceu ? 'Médico não compareceu (0 horas)' : 'Médico não cumpriu carga horária'}`);
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
        dataEscala,
        escala.horario_entrada,
        escala.horario_saida
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
