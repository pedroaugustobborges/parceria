import { supabase } from "../lib/supabase";

const DEEPSEEK_API_KEY = "sk-d0e0658a1e6f47b3be03672291e6c1f8";
const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Busca dados do Supabase respeitando permissões do usuário
 */
async function buscarDadosDoUsuario(userId: string) {
  try {
    // Buscar perfil do usuário para verificar permissões
    const { data: usuario, error: userError } = await supabase
      .from("usuarios")
      .select("*")
      .eq("id", userId)
      .single();

    if (userError) throw userError;

    const isAdminCorporativo = usuario.tipo === "administrador-agir-corporativo";
    const isAdminPlanta = usuario.tipo === "administrador-agir-planta";
    const unidadeId = usuario.unidade_hospitalar_id;

    // Buscar contratos conforme permissão
    let contratosQuery = supabase.from("contratos").select("*");

    if (isAdminPlanta && unidadeId) {
      contratosQuery = contratosQuery.eq("unidade_hospitalar_id", unidadeId);
    }

    const { data: contratos } = await contratosQuery;

    // Buscar escalas médicas conforme permissão
    let escalasQuery = supabase
      .from("escalas_medicas")
      .select("*")
      .order("data_inicio", { ascending: false })
      .limit(100);

    if (isAdminPlanta && unidadeId) {
      const contratoIds = contratos?.map((c) => c.id) || [];
      if (contratoIds.length > 0) {
        escalasQuery = escalasQuery.in("contrato_id", contratoIds);
      }
    }

    const { data: escalas } = await escalasQuery;

    // Buscar produtividade conforme permissão
    let prodQuery = supabase
      .from("produtividade")
      .select("*")
      .order("data", { ascending: false })
      .limit(100);

    if (isAdminPlanta && unidadeId) {
      prodQuery = prodQuery.eq("unidade_hospitalar_id", unidadeId);
    }

    const { data: produtividade } = await prodQuery;

    // Buscar unidades hospitalares
    let unidadesQuery = supabase.from("unidades_hospitalares").select("*");

    if (isAdminPlanta && unidadeId) {
      unidadesQuery = unidadesQuery.eq("id", unidadeId);
    }

    const { data: unidades } = await unidadesQuery;

    // Buscar parceiros
    const { data: parceiros } = await supabase
      .from("parceiros")
      .select("*")
      .eq("ativo", true);

    // Buscar itens de contrato
    const { data: itensContrato } = await supabase
      .from("itens_contrato")
      .select("*")
      .eq("ativo", true);

    // Buscar acessos (últimos 1000 para não sobrecarregar)
    let acessosQuery = supabase
      .from("acessos")
      .select("*")
      .order("data_acesso", { ascending: false })
      .limit(1000);

    const { data: acessos } = await acessosQuery;

    return {
      usuario,
      contratos: contratos || [],
      escalas: escalas || [],
      produtividade: produtividade || [],
      unidades: unidades || [],
      parceiros: parceiros || [],
      itensContrato: itensContrato || [],
      acessos: acessos || [],
      permissoes: {
        isAdminCorporativo,
        isAdminPlanta,
        unidadeId,
      },
    };
  } catch (error) {
    console.error("Erro ao buscar dados:", error);
    throw new Error("Não foi possível buscar os dados do sistema");
  }
}

/**
 * Formata dados para contexto da IA
 */
function formatarContexto(dados: any): string {
  const {
    contratos,
    escalas,
    produtividade,
    unidades,
    parceiros,
    itensContrato,
    acessos,
    permissoes,
  } = dados;

  let contexto = `# Contexto do Sistema ParcerIA\n\n`;

  contexto += `## Permissões do Usuário\n`;
  contexto += `- Admin Corporativo: ${permissoes.isAdminCorporativo ? "Sim" : "Não"}\n`;
  contexto += `- Admin Planta: ${permissoes.isAdminPlanta ? "Sim" : "Não"}\n`;
  if (permissoes.unidadeId) {
    contexto += `- Unidade: ${unidades.find((u: any) => u.id === permissoes.unidadeId)?.nome || "N/A"}\n`;
  }
  contexto += `\n`;

  // Resumo de contratos
  contexto += `## Contratos (Total: ${contratos.length})\n`;
  if (contratos.length > 0) {
    const contratosAtivos = contratos.filter((c: any) => c.ativo);
    contexto += `- Contratos ativos: ${contratosAtivos.length}\n`;
    contexto += `- Contratos inativos: ${contratos.length - contratosAtivos.length}\n`;

    const empresas = [...new Set(contratos.map((c: any) => c.empresa))];
    contexto += `- Parceiros: ${empresas.join(", ")}\n`;

    contexto += `\nDetalhes dos contratos:\n`;
    contratos.slice(0, 10).forEach((c: any) => {
      contexto += `  - ${c.nome} (${c.empresa}) - ${c.ativo ? "Ativo" : "Inativo"}\n`;
    });
  }
  contexto += `\n`;

  // Resumo de escalas
  contexto += `## Escalas Médicas (Total: ${escalas.length})\n`;
  if (escalas.length > 0) {
    const porStatus = {
      Programado: escalas.filter((e: any) => e.status === "Programado").length,
      Aprovado: escalas.filter((e: any) => e.status === "Aprovado").length,
      Reprovado: escalas.filter((e: any) => e.status === "Reprovado").length,
    };
    contexto += `- Programadas: ${porStatus.Programado}\n`;
    contexto += `- Aprovadas: ${porStatus.Aprovado}\n`;
    contexto += `- Reprovadas: ${porStatus.Reprovado}\n`;

    const totalMedicos = escalas.reduce(
      (acc: number, e: any) => acc + (e.medicos?.length || 0),
      0
    );
    contexto += `- Total de médicos escalados: ${totalMedicos}\n`;
  }
  contexto += `\n`;

  // Resumo de produtividade
  contexto += `## Produtividade (Total de registros: ${produtividade.length})\n`;
  if (produtividade.length > 0) {
    const totalProcedimentos = produtividade.reduce(
      (acc: number, p: any) => acc + (p.procedimento || 0),
      0
    );
    const totalCirurgias = produtividade.reduce(
      (acc: number, p: any) => acc + (p.cirurgia_realizada || 0),
      0
    );
    const totalPareceres = produtividade.reduce(
      (acc: number, p: any) => acc + (p.parecer_realizado || 0),
      0
    );

    contexto += `- Total de procedimentos: ${totalProcedimentos}\n`;
    contexto += `- Total de cirurgias: ${totalCirurgias}\n`;
    contexto += `- Total de pareceres: ${totalPareceres}\n`;
  }
  contexto += `\n`;

  // Unidades
  contexto += `## Unidades Hospitalares (Total: ${unidades.length})\n`;
  if (unidades.length > 0) {
    unidades.forEach((u: any) => {
      contexto += `  - ${u.codigo} - ${u.nome}${u.ativo ? "" : " (Inativa)"}\n`;
    });
  }
  contexto += `\n`;

  // Parceiros
  contexto += `## Parceiros (Total: ${parceiros.length})\n`;
  if (parceiros.length > 0) {
    parceiros.slice(0, 10).forEach((p: any) => {
      contexto += `  - ${p.nome} (CNPJ: ${p.cnpj})\n`;
    });
  }
  contexto += `\n`;

  // Acessos
  contexto += `## Acessos Recentes (Total: ${acessos.length})\n`;
  if (acessos.length > 0) {
    const entradas = acessos.filter((a: any) => a.sentido === "E").length;
    const saidas = acessos.filter((a: any) => a.sentido === "S").length;
    contexto += `- Entradas: ${entradas}\n`;
    contexto += `- Saídas: ${saidas}\n`;
  }

  return contexto;
}

/**
 * Envia mensagem para a API DeepSeek
 */
async function enviarParaDeepSeek(
  mensagem: string,
  contexto: string
): Promise<string> {
  const systemPrompt = `Você é o assistente inteligente da ParcerIA, um sistema de gestão inteligente de acessos e parcerias na área da saúde.

Seu papel é ajudar gestores e administradores a analisarem dados sobre:
- Contratos com empresas parceiras
- Escalas médicas
- Produtividade de profissionais de saúde
- Acessos e registros
- Unidades hospitalares

IMPORTANTE:
- Responda APENAS com base nos dados fornecidos no contexto
- Se não houver dados suficientes, seja honesto sobre isso
- Use linguagem profissional mas acessível
- Seja objetivo e direto
- Use emojis moderadamente para tornar as respostas mais amigáveis
- Formate números e datas de forma legível
- Se possível, ofereça insights e análises além dos dados brutos
- NUNCA invente dados ou estatísticas

${contexto}`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: mensagem },
  ];

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error("Erro ao chamar DeepSeek:", error);
    throw new Error("Erro ao processar sua pergunta. Tente novamente.");
  }
}

/**
 * Função principal que orquestra o chat com dados
 */
export async function chatWithData(
  pergunta: string,
  userId: string
): Promise<string> {
  try {
    // 1. Buscar dados do usuário respeitando permissões
    const dados = await buscarDadosDoUsuario(userId);

    // 2. Formatar contexto
    const contexto = formatarContexto(dados);

    // 3. Enviar para DeepSeek
    const resposta = await enviarParaDeepSeek(pergunta, contexto);

    return resposta;
  } catch (error: any) {
    console.error("Erro no chat:", error);
    throw error;
  }
}
