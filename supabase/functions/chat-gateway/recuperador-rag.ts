// recuperador-rag.ts - Busca vetorial em documentos + resposta com citacoes

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ContextoUsuario, obterFiltroContratosRAG } from "./contexto-usuario.ts";

export interface Citacao {
  documento: string;
  secao: string;
  pagina?: number;
}

export interface ResultadoRAG {
  resposta: string;
  citacoes: Citacao[];
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
      input: texto,
    }),
  });

  if (!resposta.ok) {
    throw new Error(`Erro ao gerar embedding: ${resposta.statusText}`);
  }

  const dados = await resposta.json();
  return dados.data[0].embedding;
}

export async function buscarEResponderRAG(
  pergunta: string,
  contexto: ContextoUsuario,
  historicoMensagens: Array<{ role: string; content: string }>,
  supabase: SupabaseClient,
  apiKey: string
): Promise<ResultadoRAG> {
  // Terceiros nao tem acesso a documentos
  if (contexto.tipo === "terceiro") {
    return {
      resposta:
        "Desculpe, voce nao tem permissao para acessar documentos de contrato. Entre em contato com o administrador para mais informacoes.",
      citacoes: [],
    };
  }

  // Gerar embedding da pergunta
  const embeddingConsulta = await gerarEmbedding(pergunta, apiKey);

  // Obter filtro de contratos baseado no role
  const filtroContratos = obterFiltroContratosRAG(contexto);

  // Se admin-terceiro sem contratos vinculados
  if (filtroContratos && filtroContratos.length === 0) {
    return {
      resposta: "Nao foram encontrados documentos vinculados ao seu perfil.",
      citacoes: [],
    };
  }

  // Buscar chunks similares via funcao do banco
  const { data: chunks, error: erroChunks } = await supabase.rpc(
    "buscar_chunks_similares",
    {
      embedding_consulta: embeddingConsulta,
      limite_similaridade: 0.7,
      limite_resultados: 5,
      filtro_contrato_ids: filtroContratos,
    }
  );

  if (erroChunks) {
    throw new Error(`Erro na busca vetorial: ${erroChunks.message}`);
  }

  if (!chunks || chunks.length === 0) {
    return {
      resposta:
        "Nao encontrei informacoes relevantes nos documentos disponiveis para responder sua pergunta. Tente reformular ou perguntar sobre outro topico.",
      citacoes: [],
    };
  }

  // Montar contexto com chunks encontrados
  const contextoDocs = chunks
    .map(
      (c: any, i: number) =>
        `[Fonte ${i + 1}] Documento: "${c.nome_arquivo}"${c.titulo_secao ? `, Secao: ${c.titulo_secao}` : ""}${c.numero_pagina ? `, Pagina: ${c.numero_pagina}` : ""}\n${c.conteudo}`
    )
    .join("\n\n---\n\n");

  // Gerar resposta com citacoes
  const prompt = `Voce e o assistente ParcerIA, especializado em gestao de contratos hospitalares.

Responda a pergunta do usuario usando APENAS as informacoes dos documentos fornecidos abaixo.

## Documentos Relevantes
${contextoDocs}

## Regras
1. Responda APENAS com base nas informacoes dos documentos
2. SEMPRE cite a fonte usando o formato: (Documento "X", Secao Y, Pagina Z)
3. Se a informacao nao estiver nos documentos, diga claramente
4. Use linguagem profissional e acessivel
5. Use markdown para formatacao
6. Ao final, inclua secao **Fontes:** listando todos os documentos citados

Pergunta: "${pergunta}"`;

  const resposta = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Voce e o assistente ParcerIA. Responda sempre com citacoes dos documentos.",
        },
        ...historicoMensagens.slice(-4),
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 1500,
    }),
  });

  if (!resposta.ok) {
    throw new Error(`Erro ao gerar resposta RAG: ${resposta.statusText}`);
  }

  const dados = await resposta.json();

  // Extrair citacoes dos chunks usados
  const citacoes: Citacao[] = chunks.map((c: any) => ({
    documento: c.nome_arquivo,
    secao: c.titulo_secao || "Secao nao identificada",
    pagina: c.numero_pagina || undefined,
  }));

  return {
    resposta: dados.choices[0].message.content,
    citacoes,
  };
}
