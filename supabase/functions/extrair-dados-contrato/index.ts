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

// (catalog context removed — matching is done client-side for reliability)

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

    // Contexto opcional: parceiros e unidades para matching pela IA
    // (itens do catálogo NÃO são enviados — matching feito no cliente para não sobrecarregar o prompt)
    let parceiros: ParceiroCtx[] = [];
    let unidades: UnidadeCtx[] = [];

    const contextoStr = formData.get("contexto");
    if (contextoStr && typeof contextoStr === "string") {
      try {
        const ctx = JSON.parse(contextoStr);
        parceiros = ctx.parceiros || [];
        unidades = ctx.unidades || [];
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

    // Fatia linear: os primeiros 22000 chars cobrem cabecalho, clausulas e ANEXO I
    // na grande maioria dos contratos. Nao usar estrategia de split com gap marker
    // pois o ANEXO I pode estar no meio do documento e seria cortado.
    const textoParaExtracao = textoPDF.substring(0, 22000);

    // Montar secoes de contexto para o prompt
    const secaoParceiros = parceiros.length > 0
      ? `\nEMPRESAS PARCEIRAS CADASTRADAS NO SISTEMA (escolha a que melhor corresponde à empresa CONTRATADA do contrato, retorne o id exato):
${parceiros.map((p) => `- id="${p.id}" | nome="${p.nome}"`).join("\n")}`
      : "\nNenhuma empresa parceira cadastrada no sistema.";

    const secaoUnidades = unidades.length > 0
      ? `\nUNIDADES HOSPITALARES CADASTRADAS (escolha a que melhor corresponde ao local do contrato, retorne o id exato):
${unidades.map((u) => `- id="${u.id}" | codigo="${u.codigo}" | nome="${u.nome}"`).join("\n")}`
      : "\nNenhuma unidade hospitalar cadastrada.";

    const prompt = `Voce e um extrator especializado em contratos de servicos medicos brasileiros.

Analise o texto do contrato abaixo e extraia as informacoes no formato JSON especificado.
Use o contexto do sistema (listas abaixo) para retornar IDs exatos de parceiros e unidades.

Retorne APENAS JSON valido, sem explicacoes.

${secaoParceiros}
${secaoUnidades}

FORMATO DE SAIDA (JSON):
{
  "nome": "descricao completa do objeto/servico do contrato",
  "numero_contrato": "numero IDENTIFICADOR do contrato — procure no cabecalho, titulo ou campo 'Contrato N°' / 'REF'. Geralmente tem formato alfanumerico como 'CTS88.2025.OUT.00153', '001/2024'. NUNCA use numero de clausula, artigo, paragrafo ou pagina. null se nao encontrar.",
  "empresa_id": "id exato da empresa CONTRATADA da lista acima, ou null",
  "empresa_nome_contrato": "nome da empresa CONTRATADA exatamente como aparece no contrato",
  "unidade_hospitalar_id": "id exato da unidade hospitalar da lista acima, ou null",
  "data_inicio": "YYYY-MM-DD — data de inicio de vigencia",
  "data_fim": "YYYY-MM-DD — REGRAS: (1) data explicita: use-a diretamente; (2) duracao em meses/anos: CALCULE data_fim = data_inicio + duracao - 1 dia (ex: '12 meses a partir de 21/12/2025' = '2026-12-20'); (3) renovavel/indeterminado: null.",
  "itens": [
    {
      "nome_no_contrato": "nome/descricao do servico EXATAMENTE como aparece no contrato",
      "codigo_corporativo": "codigo alfanumerico do item no contrato se presente (ex: '37S', '6900S', '6611S', '001'), ou null",
      "unidade_medida": "unidade de medida do servico como aparece no contrato (ex: horas, plantao, cirurgia, diaria, procedimento), ou null",
      "quantidade": 0,
      "valor_unitario": 0.00
    }
  ]
}

REGRAS CRITICAS PARA ITENS — LEIA COM ATENCAO:
1. EXTRAIA TODOS OS ITENS DA TABELA, nao apenas o primeiro. Se a tabela tiver 3, 5, 8 linhas, retorne TODAS elas no array "itens".
2. A tabela de itens fica no ANEXO I, QUADRO DE SERVICOS, TABELA DE REMUNERACAO ou secao equivalente.
3. Cada linha da tabela e um item separado. Exemplos de itens distintos: CIRURGIA PROGRAMADA, PLANTAO DIURNO, PLANTAO NOTURNO, DIARISTA, URG/EMERG — todos devem ser extraidos.
4. Valores: numero puro em reais (ex: 2500.00 para R$ 2.500,00), sem simbolo de moeda.
5. Se nao houver tabela de itens visivel no texto, retorne "itens": [].

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
        max_tokens: 4000,
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

    const itensExtraidos = Array.isArray((dadosExtraidos as any).itens)
      ? (dadosExtraidos as any).itens
      : [];
    console.log(
      `[extrair-dados-contrato] Concluido. Itens extraidos: ${itensExtraidos.length}`,
      itensExtraidos.map((i: any) => ({
        nome: i.nome_no_contrato,
        cod: i.codigo_corporativo,
        unidade: i.unidade_medida,
        qty: i.quantidade,
        valor: i.valor_unitario,
      }))
    );

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
