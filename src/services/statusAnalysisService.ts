import { supabase } from "../lib/supabase";
import { EscalaMedica } from "../types/database.types";
import { parseISO, format, addDays } from "date-fns";

/**
 * Checks if a schedule is overnight (ends the next day).
 * Returns true if horario_saida < horario_entrada (e.g., 07:00 < 19:00)
 */
function isOvernightShift(horarioEntrada: string, horarioSaida: string): boolean {
  const entrada = horarioEntrada.substring(0, 5);
  const saida = horarioSaida.substring(0, 5);
  return saida < entrada;
}

// Type for medico in escala
interface MedicoEscala {
  nome: string;
  cpf: string;
}

// Tolerância de 1 hora para considerar escala como cumprida
// Se o médico trabalhou pelo menos (horasEsperadas - 1h), considera como Pré-Aprovado
const TOLERANCIA_HORAS = 1;

// Cache for hospital access management settings to avoid repeated queries
const hospitalAccessCache = new Map<string, boolean>();

/**
 * Gets the hospital's access management setting for a given contract ID.
 * Returns true if the hospital has turnstile access management, false otherwise.
 */
async function getHospitalAccessManagement(contratoId: string): Promise<boolean> {
  try {
    // Check cache first
    if (hospitalAccessCache.has(contratoId)) {
      return hospitalAccessCache.get(contratoId)!;
    }

    // Fetch contract with hospital data
    const { data: contrato, error } = await supabase
      .from("contratos")
      .select("unidade_hospitalar_id, unidades_hospitalares(possui_gestao_acesso)")
      .eq("id", contratoId)
      .single();

    if (error) {
      console.error("[Status Analysis] Error fetching contract hospital:", error);
      // Default to true (with access management) to maintain backward compatibility
      return true;
    }

    if (!contrato || !contrato.unidade_hospitalar_id) {
      console.log("[Status Analysis] Contract has no hospital assigned, defaulting to access management = true");
      return true;
    }

    // Handle the nested relationship response
    const unidadeData = contrato.unidades_hospitalares as any;
    const possuiGestaoAcesso = unidadeData?.possui_gestao_acesso ?? true;

    // Cache the result
    hospitalAccessCache.set(contratoId, possuiGestaoAcesso);

    console.log(`[Status Analysis] Hospital access management for contract ${contratoId}: ${possuiGestaoAcesso ? 'YES (catracas)' : 'NO (productivity only)'}`);

    return possuiGestaoAcesso;
  } catch (error) {
    console.error("[Status Analysis] Error in getHospitalAccessManagement:", error);
    return true; // Default to true for backward compatibility
  }
}

/**
 * Gets the codigomv (MV code) for a doctor based on their CPF.
 * This is needed to match productivity records.
 */
async function getCodigoMvByCpf(cpf: string): Promise<string | null> {
  try {
    const { data: usuario, error } = await supabase
      .from("usuarios")
      .select("codigomv")
      .eq("cpf", cpf)
      .single();

    if (error || !usuario) {
      console.log(`[Status Analysis] Could not find codigomv for CPF ${cpf}`);
      return null;
    }

    return usuario.codigomv;
  } catch (error) {
    console.error("[Status Analysis] Error fetching codigomv:", error);
    return null;
  }
}

/**
 * Helper function to check if productivity records have actual values.
 */
function hasActualProductivityValues(records: any[]): boolean {
  return records.some((record: any) => {
    const totalProductivity =
      (record.procedimento || 0) +
      (record.parecer_solicitado || 0) +
      (record.parecer_realizado || 0) +
      (record.cirurgia_realizada || 0) +
      (record.prescricao || 0) +
      (record.evolucao || 0) +
      (record.urgencia || 0) +
      (record.ambulatorio || 0) +
      (record.auxiliar || 0) +
      (record.encaminhamento || 0) +
      (record.folha_objetivo_diario || 0) +
      (record.evolucao_diurna_cti || 0) +
      (record.evolucao_noturna_cti || 0) +
      (record.qtd_documentos_pep || 0);

    return totalProductivity > 0;
  });
}

/**
 * Checks if a doctor has productivity records for a specific date and hospital.
 * Returns true if there is at least one productivity record WITH actual productivity values.
 * A record is considered to have productivity if any of the numeric fields is > 0.
 *
 * The function tries two strategies:
 * 1. First, look up codigomv from usuarios table by CPF and search produtividade by codigo_mv
 * 2. If that fails, search produtividade directly by doctor name
 */
async function verificarProdutividade(
  cpf: string,
  data: Date,
  unidadeHospitalarId?: string,
  nomeMedico?: string
): Promise<boolean> {
  try {
    const dataFormatada = format(data, "yyyy-MM-dd");

    // Strategy 1: Try to find by codigomv from usuarios table
    const codigoMv = await getCodigoMvByCpf(cpf);

    if (codigoMv) {
      // Convert codigoMv to number - the produtividade table stores codigo_mv as BIGINT
      // while usuarios table stores codigomv as TEXT
      const codigoMvNumero = parseInt(codigoMv, 10);

      if (!isNaN(codigoMvNumero)) {
        console.log(`[Status Analysis] Checking productivity by codigo_mv=${codigoMvNumero} on ${dataFormatada}`);

        const { data: produtividade, error } = await supabase
          .from("produtividade")
          .select(`
            id, codigo_mv, data,
            procedimento, parecer_solicitado, parecer_realizado,
            cirurgia_realizada, prescricao, evolucao, urgencia,
            ambulatorio, auxiliar, encaminhamento,
            folha_objetivo_diario, evolucao_diurna_cti, evolucao_noturna_cti,
            qtd_documentos_pep
          `)
          .eq("codigo_mv", codigoMvNumero)
          .eq("data", dataFormatada);

        if (!error && produtividade && produtividade.length > 0) {
          const hasActual = hasActualProductivityValues(produtividade);
          console.log(`[Status Analysis] Found ${produtividade.length} records by codigo_mv, has actual values: ${hasActual}`);
          return hasActual;
        }
      }
    }

    // Strategy 2: If codigomv not found or no records, try by doctor name
    if (nomeMedico) {
      console.log(`[Status Analysis] Checking productivity by name="${nomeMedico}" on ${dataFormatada}`);

      const { data: produtividade, error } = await supabase
        .from("produtividade")
        .select(`
          id, codigo_mv, nome, data,
          procedimento, parecer_solicitado, parecer_realizado,
          cirurgia_realizada, prescricao, evolucao, urgencia,
          ambulatorio, auxiliar, encaminhamento,
          folha_objetivo_diario, evolucao_diurna_cti, evolucao_noturna_cti,
          qtd_documentos_pep
        `)
        .ilike("nome", nomeMedico)
        .eq("data", dataFormatada);

      if (!error && produtividade && produtividade.length > 0) {
        const hasActual = hasActualProductivityValues(produtividade);
        console.log(`[Status Analysis] Found ${produtividade.length} records by name, has actual values: ${hasActual}`);
        return hasActual;
      }
    }

    console.log(`[Status Analysis] No productivity records found for CPF ${cpf} / name "${nomeMedico || 'N/A'}" on ${dataFormatada}`);
    return false;
  } catch (error) {
    console.error("[Status Analysis] Error in verificarProdutividade:", error);
    return false;
  }
}

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
 * Analisa uma escala para hospitais COM gestão de acesso (catracas).
 * Usa registros de acesso para calcular horas trabalhadas.
 */
async function analisarEscalaComAcesso(escala: EscalaMedica): Promise<string> {
  const dataEscala = parseISO(escala.data_inicio);

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

  const medicos = (escala.medicos as unknown as MedicoEscala[]) || [];
  for (const medico of medicos) {
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

  return statusFinal;
}

/**
 * Analisa uma escala para hospitais SEM gestão de acesso (sem catracas).
 * Usa apenas registros de produtividade para determinar o status.
 * - "Atenção" quando médico tem escala mas não tem produtividade
 * - "Pré-Aprovado" quando médico tem registro de produtividade na data
 *
 * For overnight shifts (e.g., 19:00 - 07:00), checks productivity on both
 * the start date AND the next day.
 */
async function analisarEscalaSemAcesso(escala: EscalaMedica, unidadeHospitalarId?: string): Promise<string> {
  const dataEscala = parseISO(escala.data_inicio);
  const overnight = isOvernightShift(escala.horario_entrada, escala.horario_saida);
  const dataSeguinte = overnight ? addDays(dataEscala, 1) : null;

  const medicos = (escala.medicos as unknown as MedicoEscala[]) || [];
  console.log(`[Status Analysis] Modo: Validação por PRODUTIVIDADE (hospital sem gestão de acesso)`);
  console.log(`[Status Analysis] Escala noturna (atravessa meia-noite): ${overnight ? 'SIM' : 'NÃO'}`);
  console.log(`[Status Analysis] Verificando produtividade para ${medicos.length} médico(s)`);

  let algumSemProdutividade = false;

  for (const medico of medicos) {
    console.log(`[Status Analysis] Verificando produtividade do médico: ${medico.nome} (CPF: ${medico.cpf})`);

    // Check productivity on the schedule start date
    const temProdutividadeDiaEscala = await verificarProdutividade(
      medico.cpf,
      dataEscala,
      unidadeHospitalarId,
      medico.nome
    );

    // For overnight shifts, also check the next day
    let temProdutividadeDiaSeguinte = false;
    if (overnight && dataSeguinte) {
      console.log(`[Status Analysis] Verificando também produtividade do dia seguinte: ${format(dataSeguinte, 'yyyy-MM-dd')}`);
      temProdutividadeDiaSeguinte = await verificarProdutividade(
        medico.cpf,
        dataSeguinte,
        unidadeHospitalarId,
        medico.nome
      );
    }

    // Doctor has productivity if they have it on either day (for overnight shifts) or on the schedule day
    const temProdutividade = temProdutividadeDiaEscala || temProdutividadeDiaSeguinte;

    if (!temProdutividade) {
      console.log(`[Status Analysis] ❌ Médico ${medico.nome} NÃO possui produtividade registrada`);
      algumSemProdutividade = true;
    } else {
      const dias = [];
      if (temProdutividadeDiaEscala) dias.push(format(dataEscala, 'dd/MM/yyyy'));
      if (temProdutividadeDiaSeguinte && dataSeguinte) dias.push(format(dataSeguinte, 'dd/MM/yyyy'));
      console.log(`[Status Analysis] ✅ Médico ${medico.nome} possui produtividade em: ${dias.join(' e ')}`);
    }
  }

  // Determinar status baseado apenas na produtividade
  let statusFinal;
  console.log(`\n[Status Analysis] ========== DETERMINAÇÃO DO STATUS FINAL (SEM ACESSO) ==========`);
  console.log(`[Status Analysis] algumSemProdutividade: ${algumSemProdutividade}`);

  if (algumSemProdutividade) {
    statusFinal = "Atenção";
    console.log(`[Status Analysis] 🔴 Status final: ATENÇÃO`);
    console.log(`[Status Analysis] Motivo: Médico tem escala mas não tem produtividade registrada`);
  } else {
    statusFinal = "Pré-Aprovado";
    console.log(`[Status Analysis] ✅ Status final: PRÉ-APROVADO`);
    console.log(`[Status Analysis] Motivo: Todos os médicos possuem produtividade registrada`);
  }

  return statusFinal;
}

/**
 * Analisa uma escala e determina seu status automático.
 * A lógica de validação depende de se o hospital possui gestão de acesso via catracas ou não.
 */
async function analisarEscala(escala: EscalaMedica, unidadeHospitalarId?: string): Promise<string> {
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
    const medicosLog = (escala.medicos as unknown as MedicoEscala[]) || [];
    console.log(`[Status Analysis] Médicos na escala:`, medicosLog.map(m => `${m.nome} (${m.cpf})`).join(', '));

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

    // Check if the hospital has access management
    const possuiGestaoAcesso = await getHospitalAccessManagement(escala.contrato_id);

    let statusFinal: string;

    if (possuiGestaoAcesso) {
      // Hospital WITH access management - use turnstile/access records
      console.log(`[Status Analysis] Hospital possui gestão de acesso via catracas`);
      statusFinal = await analisarEscalaComAcesso(escala);
    } else {
      // Hospital WITHOUT access management - use only productivity records
      console.log(`[Status Analysis] Hospital NÃO possui gestão de acesso - usando apenas produtividade`);
      statusFinal = await analisarEscalaSemAcesso(escala, unidadeHospitalarId);
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
    // Clear the cache before recalculating
    hospitalAccessCache.clear();

    // Buscar apenas escalas com status "Programado" (escalas pré-agendadas não devem ser recalculadas)
    // Also fetch the contract's hospital ID for productivity validation
    const { data: escalas, error } = await supabase
      .from("escalas_medicas")
      .select(`
        *,
        contratos (
          unidade_hospitalar_id
        )
      `)
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
        const unidadeHospitalarId = (escala.contratos as any)?.unidade_hospitalar_id;
        const novoStatus = await analisarEscala(escala as EscalaMedica, unidadeHospitalarId);

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
    temProdutividade?: boolean;
  }>;
  modoValidacao: 'acesso' | 'produtividade';
}> {
  try {
    const { data: escala, error } = await supabase
      .from("escalas_medicas")
      .select(`
        *,
        contratos (
          unidade_hospitalar_id
        )
      `)
      .eq("id", escalaId)
      .single();

    if (error) throw error;

    const horasEsperadas = calcularHorasEscaladas(escala as EscalaMedica);
    const horasMinimasParaAprovacao = Math.max(0, horasEsperadas - TOLERANCIA_HORAS);
    const dataEscala = parseISO(escala.data_inicio);
    const unidadeHospitalarId = (escala.contratos as any)?.unidade_hospitalar_id;

    // Check if hospital has access management
    const possuiGestaoAcesso = await getHospitalAccessManagement(escala.contrato_id);
    const modoValidacao = possuiGestaoAcesso ? 'acesso' : 'produtividade';

    const detalhes = [];
    const medicos = (escala.medicos as unknown as MedicoEscala[]) || [];

    for (const medico of medicos) {
      if (possuiGestaoAcesso) {
        // Validation by access records
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
      } else {
        // Validation by productivity
        const temProdutividade = await verificarProdutividade(
          medico.cpf,
          dataEscala,
          unidadeHospitalarId
        );

        detalhes.push({
          medico: medico.nome,
          cpf: medico.cpf,
          horasEsperadas,
          horasTrabalhadas: 0, // Not applicable for productivity-only validation
          cumpriu: temProdutividade,
          temProdutividade,
        });
      }
    }

    const novoStatus = await analisarEscala(escala as EscalaMedica, unidadeHospitalarId);

    return {
      status: novoStatus,
      detalhes,
      modoValidacao,
    };
  } catch (error: any) {
    throw new Error(`Erro ao analisar escala: ${error.message}`);
  }
}
