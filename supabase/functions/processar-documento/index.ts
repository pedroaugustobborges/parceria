// processar-documento/index.ts - Processa PDFs: extrai texto, divide em chunks, gera embeddings
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Configuracoes de chunking
const TAMANHO_CHUNK_TOKENS = 800;
const OVERLAP_TOKENS = 200;
const CHARS_POR_TOKEN = 4; // Aproximacao

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

    if (!supabaseServiceKey) {
      console.error("[processar-documento] SUPABASE_SERVICE_ROLE_KEY nao configurada");
      return new Response(
        JSON.stringify({ erro: "SUPABASE_SERVICE_ROLE_KEY nao configurada no servidor" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!openaiApiKey) {
      console.error("[processar-documento] OPENAI_API_KEY nao configurada");
      return new Response(
        JSON.stringify({ erro: "OPENAI_API_KEY nao configurada no servidor" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Usar service_role para inserir chunks (bypass RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Cliente com token do usuario para validacao
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verificar usuario
    const {
      data: { user },
      error: erroAuth,
    } = await supabaseUser.auth.getUser();

    if (erroAuth || !user) {
      return new Response(
        JSON.stringify({ erro: "Usuario nao autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { documento_id, tabela = "documentos_contrato" } = await req.json();

    if (!documento_id) {
      return new Response(
        JSON.stringify({ erro: "documento_id e obrigatorio" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validar tabela
    const tabelasValidas = ["documentos_contrato", "documentos_gestao"];
    if (!tabelasValidas.includes(tabela)) {
      return new Response(
        JSON.stringify({ erro: "Tabela invalida. Use documentos_contrato ou documentos_gestao" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determinar configuracoes baseado no tipo de documento
    const isGestao = tabela === "documentos_gestao";
    const tabelaDocumentos = isGestao ? "documentos_gestao" : "documentos_contrato";
    const tabelaChunks = isGestao ? "documento_gestao_chunks" : "documento_chunks";
    const bucketStorage = isGestao ? "documentos-gestao" : "documentos-contratos";

    console.log(`[processar-documento] Iniciando processamento do documento: ${documento_id} (tabela: ${tabelaDocumentos})`);

    // Buscar documento da tabela correta
    const { data: documento, error: erroDoc } = await supabaseAdmin
      .from(tabelaDocumentos)
      .select(isGestao ? "*" : "*, contratos(unidade_hospitalar_id)")
      .eq("id", documento_id)
      .single();

    if (erroDoc || !documento) {
      console.error("[processar-documento] Documento nao encontrado:", erroDoc);
      throw new Error(`Documento nao encontrado: ${erroDoc?.message || documento_id}`);
    }

    console.log(`[processar-documento] Documento encontrado: ${documento.nome_arquivo}, caminho: ${documento.caminho_storage}`);

    // Atualizar status para 'processando'
    await supabaseAdmin
      .from(tabelaDocumentos)
      .update({ status: "processando" })
      .eq("id", documento_id);

    try {
      // 1. Baixar PDF do Storage (bucket depende do tipo de documento)
      console.log(`[processar-documento] Baixando PDF do storage: ${bucketStorage}/${documento.caminho_storage}`);
      const { data: arquivoPDF, error: erroDownload } = await supabaseAdmin.storage
        .from(bucketStorage)
        .download(documento.caminho_storage);

      if (erroDownload || !arquivoPDF) {
        console.error("[processar-documento] Erro ao baixar PDF:", erroDownload);
        throw new Error(`Erro ao baixar PDF: ${erroDownload?.message}`);
      }

      console.log(`[processar-documento] PDF baixado, tamanho: ${arquivoPDF.size} bytes`);

      // 2. Extrair texto do PDF
      console.log("[processar-documento] Extraindo texto do PDF...");
      const textoExtraido = await extrairTextoPDF(arquivoPDF);

      console.log(`[processar-documento] Texto extraido: ${textoExtraido.length} caracteres`);

      if (!textoExtraido || textoExtraido.trim().length === 0) {
        throw new Error("Nao foi possivel extrair texto do PDF. O arquivo pode estar escaneado ou protegido.");
      }

      // 3. Dividir em chunks
      const chunks = dividirEmChunks(textoExtraido);
      console.log(`[processar-documento] Dividido em ${chunks.length} chunks`);

      // 4. Gerar embeddings e inserir chunks
      // Para gestao, unidade_id vem direto do documento; para contrato, vem do join
      const unidadeId = isGestao
        ? documento.unidade_hospitalar_id
        : documento.contratos?.unidade_hospitalar_id || null;

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        console.log(`[processar-documento] Processando chunk ${i + 1}/${chunks.length}...`);

        // Gerar embedding via OpenAI
        const embedding = await gerarEmbedding(chunk.conteudo, openaiApiKey);

        console.log(`[processar-documento] Embedding gerado para chunk ${i + 1}, dimensao: ${embedding.length}`);

        // Inserir chunk com embedding - converter array para formato pgvector
        const embeddingString = `[${embedding.join(",")}]`;

        // Montar dados do chunk (estrutura diferente para gestao vs contrato)
        const chunkData: Record<string, any> = {
          documento_id: documento_id,
          unidade_hospitalar_id: unidadeId,
          indice_chunk: i,
          conteudo: chunk.conteudo,
          titulo_secao: chunk.tituloSecao,
          numero_pagina: chunk.numeroPagina,
          contagem_tokens: chunk.contagemTokens,
          embedding: embeddingString,
          metadata: {
            posicao_inicio: chunk.posicaoInicio,
            posicao_fim: chunk.posicaoFim,
          },
        };

        // Adicionar contrato_id apenas para documentos de contrato
        if (!isGestao) {
          chunkData.contrato_id = documento.contrato_id;
        }

        const { error: erroInsert } = await supabaseAdmin
          .from(tabelaChunks)
          .insert(chunkData);

        if (erroInsert) {
          console.error(`[processar-documento] Erro ao inserir chunk ${i}:`, erroInsert);
          throw new Error(`Erro ao inserir chunk ${i}: ${erroInsert.message}`);
        }

        console.log(`[processar-documento] Chunk ${i + 1} inserido com sucesso`);
      }

      // 5. Atualizar status para 'pronto'
      await supabaseAdmin
        .from(tabelaDocumentos)
        .update({ status: "pronto" })
        .eq("id", documento_id);

      return new Response(
        JSON.stringify({
          sucesso: true,
          chunks_processados: chunks.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (erroProcessamento: any) {
      // Atualizar status para 'erro' na tabela correta
      await supabaseAdmin
        .from(tabelaDocumentos)
        .update({
          status: "erro",
          mensagem_erro: erroProcessamento.message,
        })
        .eq("id", documento_id);

      throw erroProcessamento;
    }
  } catch (erro: any) {
    console.error("Erro ao processar documento:", erro);
    return new Response(
      JSON.stringify({
        erro: "Erro ao processar documento",
        detalhes: erro.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// Extrai texto de um PDF usando unpdf (compativel com Deno/serverless)
async function extrairTextoPDF(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();

  // Tentar usar unpdf (biblioteca serverless-friendly)
  try {
    const texto = await extrairTextoUnpdf(arrayBuffer);
    if (texto && texto.trim().length > 50) {
      console.log(`[processar-documento] unpdf extraiu ${texto.length} caracteres`);
      return texto;
    }
  } catch (e) {
    console.log("[processar-documento] unpdf falhou:", e);
  }

  // Fallback: parsing manual
  console.log("[processar-documento] Tentando parsing manual...");
  return extrairTextoManual(arrayBuffer);
}

// Usa unpdf para extrair texto (funciona em Deno Edge Runtime)
async function extrairTextoUnpdf(arrayBuffer: ArrayBuffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import("npm:unpdf");

  const uint8Array = new Uint8Array(arrayBuffer);
  const pdf = await getDocumentProxy(uint8Array);
  const { text } = await extractText(pdf, { mergePages: true });

  return text.replace(/\s+/g, " ").trim();
}

// Parsing manual como fallback
function extrairTextoManual(arrayBuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(arrayBuffer);
  const textos: string[] = [];

  // Tentar decodificar como latin1 (mais comum para PDFs)
  const decoder = new TextDecoder("latin1");
  const conteudo = decoder.decode(bytes);

  // Extrair streams descomprimidos (FlateDecode ja processado)
  // Procurar por texto em streams entre "stream" e "endstream"
  const regexStream = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let matchStream;

  while ((matchStream = regexStream.exec(conteudo)) !== null) {
    const streamContent = matchStream[1];

    // Extrair texto entre parenteses (strings literais)
    const regexString = /\(([^\\)]*(?:\\.[^\\)]*)*)\)/g;
    let matchString;
    while ((matchString = regexString.exec(streamContent)) !== null) {
      let texto = matchString[1];
      // Decodificar escapes
      texto = texto
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\\(/g, "(")
        .replace(/\\\)/g, ")")
        .replace(/\\\\/g, "\\")
        .replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));

      if (texto.trim().length > 1) {
        textos.push(texto.trim());
      }
    }
  }

  // Tambem tentar extrair de blocos BT/ET
  const regexTexto = /BT\s([\s\S]*?)ET/g;
  let match;

  while ((match = regexTexto.exec(conteudo)) !== null) {
    const bloco = match[1];

    // Extrair Tj e TJ operators (texto em PDF)
    const regexTj = /\(([^)]*)\)\s*Tj/g;
    let matchTj;
    while ((matchTj = regexTj.exec(bloco)) !== null) {
      const texto = matchTj[1].replace(/\\\(/g, "(").replace(/\\\)/g, ")");
      if (texto.trim().length > 0) {
        textos.push(texto);
      }
    }

    // Extrair TJ arrays
    const regexTJ = /\[(.*?)\]\s*TJ/g;
    let matchTJ;
    while ((matchTJ = regexTJ.exec(bloco)) !== null) {
      const arr = matchTJ[1];
      const regexItem = /\(([^)]*)\)/g;
      let matchItem;
      while ((matchItem = regexItem.exec(arr)) !== null) {
        const texto = matchItem[1].replace(/\\\(/g, "(").replace(/\\\)/g, ")");
        if (texto.trim().length > 0) {
          textos.push(texto);
        }
      }
    }
  }

  const resultado = textos.join(" ").replace(/\s+/g, " ").trim();
  console.log(`[processar-documento] Parsing manual extraiu ${resultado.length} caracteres`);
  return resultado;
}

interface ChunkInfo {
  conteudo: string;
  tituloSecao: string | null;
  numeroPagina: number | null;
  contagemTokens: number;
  posicaoInicio: number;
  posicaoFim: number;
}

function dividirEmChunks(texto: string): ChunkInfo[] {
  const chunks: ChunkInfo[] = [];
  const tamanhoChunkChars = TAMANHO_CHUNK_TOKENS * CHARS_POR_TOKEN;
  const overlapChars = OVERLAP_TOKENS * CHARS_POR_TOKEN;
  const passo = tamanhoChunkChars - overlapChars;

  const regexTitulo = /(?:^|\n)((?:CLAUSULA|SECAO|CAPITULO|ARTIGO)\s+[\dIVXLCDM]+[.:)\s-]+[^\n]+)/gi;

  for (let i = 0; i < texto.length; i += passo) {
    const inicio = i;
    const fim = Math.min(i + tamanhoChunkChars, texto.length);
    const conteudo = texto.slice(inicio, fim);

    let tituloSecao: string | null = null;
    const matchTitulo = conteudo.match(regexTitulo);
    if (matchTitulo) {
      tituloSecao = matchTitulo[0].trim();
    }

    const numeroPagina = Math.floor(inicio / 3000) + 1;

    chunks.push({
      conteudo,
      tituloSecao,
      numeroPagina,
      contagemTokens: Math.ceil(conteudo.length / CHARS_POR_TOKEN),
      posicaoInicio: inicio,
      posicaoFim: fim,
    });

    if (fim >= texto.length) break;
  }

  return chunks;
}

async function gerarEmbedding(texto: string, apiKey: string): Promise<number[]> {
  const resposta = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: texto.slice(0, 8000),
    }),
  });

  if (!resposta.ok) {
    throw new Error(`Erro ao gerar embedding: ${resposta.statusText}`);
  }

  const dados = await resposta.json();
  return dados.data[0].embedding;
}
