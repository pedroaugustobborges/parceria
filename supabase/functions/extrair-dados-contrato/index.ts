// extrair-dados-contrato/index.ts
// Recebe PDF + contexto do sistema (parceiros, unidades, itens do catalogo),
// extrai texto, chama GPT-4o com opcoes reais para retornar IDs precisos.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getDocumentProxy, extractText } from "npm:unpdf";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function sanitizarTexto(texto: string): string {
  return texto
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\uFFFD/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function extrairTextoPDF(arquivo: Blob): Promise<string> {
  try {
    const buffer = await arquivo.arrayBuffer();
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return sanitizarTexto(text || "");
  } catch (_e) {
    // Fallback manual para PDFs simples
    const buffer = await arquivo.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const decoder = new TextDecoder("latin1");
    const str = decoder.decode(bytes);
    let texto = "";
    const btRegex = /BT([\s\S]*?)ET/g;
    let match;
    while ((match = btRegex.exec(str)) !== null) {
      const content = match[1];
      const textRegex = /\(([^)]*)\)\s*Tj/g;
      let textMatch;
      while ((textMatch = textRegex.exec(content)) !== null) {
        texto += textMatch[1] + " ";
      }
    }
    return sanitizarTexto(texto);
  }
}

interface ParceiroCtx {
  id: string;
  nome: string;
}

interface UnidadeCtx {
  id: string;
  nome: string;
  codigo: string;
}

interface ItemCatalogoCtx {
  id: string;
  nome: string;
  unidade_medida: string;
  codigo_corporativo: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ erro: "Token de autorizacao ausente" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ erro: "OPENAI_API_KEY nao configurada no servidor" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Autenticar usuario
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: erroAuth } = await supabaseUser.auth.getUser();
    if (erroAuth || !user) {
      return new Response(
        JSON.stringify({ erro: "Usuario nao autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Receber PDF e contexto via multipart/form-data
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return new Response(
        JSON.stringify({ erro: "Content-Type deve ser multipart/form-data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formData = await req.formData();

    const pdfFile = formData.get("pdf");
    if (!pdfFile || !(pdfFile instanceof File)) {
      return new Response(
        JSON.stringify({ erro: "Campo 'pdf' nao encontrado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Contexto opcional: listas do sistema para matching preciso
    let parceiros: ParceiroCtx[] = [];
    let unidades: UnidadeCtx[] = [];
    let itensCatalogo: ItemCatalogoCtx[] = [];

    const contextoStr = formData.get("contexto");
    if (contextoStr && typeof contextoStr === "string") {
      try {
        const ctx = JSON.parse(contextoStr);
        parceiros = ctx.parceiros || [];
        unidades = ctx.unidades || [];
        itensCatalogo = ctx.itens || [];
      } catch {
        console.warn("[extrair-dados-contrato] Falha ao parsear contexto, continuando sem ele");
      }
    }

    // Extrair texto do PDF
    console.log("[extrair-dados-contrato] Extraindo texto do PDF...");
    const textoPDF = await extrairTextoPDF(pdfFile as Blob);

    if (!textoPDF || textoPDF.trim().length < 30) {
      return new Response(
        JSON.stringify({ erro: "Nao foi possivel extrair texto do PDF. O arquivo pode estar escaneado, corrompido ou protegido." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[extrair-dados-contrato] Texto extraido: ${textoPDF.length} chars`);

    // Limitar a 15000 chars para o contexto da IA
    const textoParaExtracao = textoPDF.substring(0, 15000);

    // Montar secoes de contexto para o prompt
    const secaoParceiros = parceiros.length > 0
      ? `\nEMPRESAS PARCEIRAS CADASTRADAS NO SISTEMA (escolha a que melhor corresponde à empresa CONTRATADA do contrato, retorne o id exato):
${parceiros.map((p) => `- id="${p.id}" | nome="${p.nome}"`).join("\n")}`
      : "\nNenhuma empresa parceira cadastrada no sistema.";

    const secaoUnidades = unidades.length > 0
      ? `\nUNIDADES HOSPITALARES CADASTRADAS (escolha a que melhor corresponde ao local do contrato, retorne o id exato):
${unidades.map((u) => `- id="${u.id}" | codigo="${u.codigo}" | nome="${u.nome}"`).join("\n")}`
      : "\nNenhuma unidade hospitalar cadastrada.";

    const secaoItens = itensCatalogo.length > 0
      ? `\nITENS DO CATÁLOGO DE SERVIÇOS (para cada servico encontrado no contrato, identifique o item do catalogo mais proximo e retorne seu id):
${itensCatalogo.map((i) => `- id="${i.id}" | nome="${i.nome}" | unidade="${i.unidade_medida}"${i.codigo_corporativo ? ` | cod="${i.codigo_corporativo}"` : ""}`).join("\n")}`
      : "\nNenhum item de catalogo disponivel.";

    const prompt = `Voce e um extrator especializado em contratos de servicos medicos brasileiros.

Analise o texto do contrato abaixo e extraia as informacoes no formato JSON especificado.
Use o contexto do sistema (listas abaixo) para retornar IDs exatos — isso e FUNDAMENTAL para o pre-preenchimento funcionar.

Retorne APENAS JSON valido, sem explicacoes.

${secaoParceiros}
${secaoUnidades}
${secaoItens}

FORMATO DE SAIDA (JSON):
{
  "nome": "descricao completa do objeto/servico do contrato (ex: PRESTACAO DE SERVICOS MEDICOS ESPECIALIZADOS EM UTI)",
  "numero_contrato": "numero IDENTIFICADOR do contrato — procure no cabecalho, titulo ou campo 'Contrato N°'. Geralmente tem formato alfanumerico como 'CTS29.2025.AGO.02063', '001/2024', 'CT-2024-001'. NAO confunda com numeros de clausulas, artigos, paragrafos ou paginas. Use null se nao encontrar.",
  "empresa_id": "id exato da empresa CONTRATADA da lista acima, ou null se nao encontrar correspondencia",
  "empresa_nome_contrato": "nome da empresa CONTRATADA exatamente como aparece no contrato",
  "unidade_hospitalar_id": "id exato da unidade hospitalar da lista acima, ou null",
  "data_inicio": "YYYY-MM-DD — data de inicio de vigencia do contrato",
  "data_fim": "YYYY-MM-DD — regra: (1) se a data fim estiver explicita, use-a; (2) se o contrato mencionar duracao em meses/anos a partir da data inicio, CALCULE: data_fim = data_inicio + duracao - 1 dia. Exemplo: '12 meses a partir de 21/12/2025' = 2026-12-20. (3) se for renovavel/indeterminado sem data, use null.",
  "itens": [
    {
      "item_catalogo_id": "id exato do item do catalogo mais proximo, ou null se nao encontrar",
      "nome_no_contrato": "nome do servico exatamente como aparece no contrato (ex: do ANEXO I)",
      "quantidade": numero (use 1 se nao especificado),
      "valor_unitario": valor em reais como numero (ex: 2500.00 para R$ 2.500,00),
      "codigo_corporativo": "codigo do item na tabela do contrato se presente (ex: '001', 'A-01'), ou null"
    }
  ]
}

INSTRUCOES IMPORTANTES:
- Os itens geralmente estao no ANEXO I ou em tabela de servicos/remuneracao
- Para cada item do contrato, tente encontrar o item_catalogo_id mais proximo na lista acima
- Se houver tabela com codigos, descricao, quantidade e valor unitario, extraia todos os itens
- Valores: use ponto como separador decimal (2500.00), sem R$ ou pontos de milhar
- numero_contrato: NUNCA use numero de clausula ou artigo. O numero do contrato aparece geralmente no titulo, cabecalho, ou campo especifico como "NUMERO DO CONTRATO", "REF:", "CTS...", "CT-..." etc.

TEXTO DO CONTRATO:
${textoParaExtracao}`;

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "Voce e um extrator preciso de dados de contratos brasileiros. Sempre retorne JSON valido conforme a estrutura solicitada. Quando houver listas do sistema para correspondencia, priorize retornar os IDs exatos da lista.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 2500,
        response_format: { type: "json_object" },
      }),
    });

    if (!openaiResponse.ok) {
      const erroOpenAI = await openaiResponse.text();
      console.error("[extrair-dados-contrato] Erro OpenAI:", erroOpenAI);
      throw new Error(`Erro na API OpenAI: ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    const conteudoResposta = openaiData.choices?.[0]?.message?.content;

    if (!conteudoResposta) {
      throw new Error("Resposta vazia da IA");
    }

    let dadosExtraidos: Record<string, unknown>;
    try {
      dadosExtraidos = JSON.parse(conteudoResposta);
    } catch {
      console.error("[extrair-dados-contrato] JSON invalido da IA:", conteudoResposta);
      throw new Error("A IA retornou um formato invalido");
    }

    console.log("[extrair-dados-contrato] Extracao concluida com sucesso");

    return new Response(
      JSON.stringify({ sucesso: true, dados: dadosExtraidos }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro interno";
    console.error("[extrair-dados-contrato] Erro:", message);
    return new Response(
      JSON.stringify({ erro: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
