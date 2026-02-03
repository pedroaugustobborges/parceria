// hibrido.ts - Combina SQL + RAG em paralelo e gera resposta unificada

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ContextoUsuario } from "./contexto-usuario.ts";
import { gerarEExecutarSQL, ResultadoSQL } from "./gerador-sql.ts";
import { buscarEResponderRAG, ResultadoRAG, Citacao } from "./recuperador-rag.ts";

export interface ResultadoHibrido {
  resposta: string;
  citacoes: Citacao[];
  sqlExecutado: string | null;
}

export async function executarHibrido(
  pergunta: string,
  contexto: ContextoUsuario,
  historicoMensagens: Array<{ role: string; content: string }>,
  supabase: SupabaseClient,
  apiKey: string
): Promise<ResultadoHibrido> {
  // Executar SQL e RAG em paralelo
  const [resultadoSQL, resultadoRAG] = await Promise.allSettled([
    gerarEExecutarSQL(pergunta, contexto, historicoMensagens, supabase, apiKey),
    buscarEResponderRAG(pergunta, contexto, historicoMensagens, supabase, apiKey),
  ]);

  const dadosSQL =
    resultadoSQL.status === "fulfilled" ? resultadoSQL.value : null;
  const dadosRAG =
    resultadoRAG.status === "fulfilled" ? resultadoRAG.value : null;

  // Se ambos falharam
  if (!dadosSQL && !dadosRAG) {
    throw new Error(
      "Nao foi possivel obter dados do banco nem dos documentos. Tente reformular sua pergunta."
    );
  }

  // Combinar resultados em chamada final ao GPT-4o
  const promptCombinado = `Voce e o assistente ParcerIA. Combine as informacoes abaixo para responder a pergunta do usuario.

## Pergunta
"${pergunta}"

## Dados do Banco (Metricas)
${dadosSQL ? dadosSQL.resposta : "Nao foi possivel obter dados do banco de dados."}

## Dados dos Documentos (Contratos)
${dadosRAG ? dadosRAG.resposta : "Nao foram encontrados documentos relevantes."}

## Regras
1. Combine ambas as fontes de forma coerente
2. Compare metricas reais com o que esta definido nos contratos
3. Destaque concordancias e discrepancias
4. Se houver documentos, cite as fontes
5. Use markdown para formatacao
6. Seja objetivo e ofereça insights acionaveis`;

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
          content:
            "Voce e o assistente ParcerIA, combinando dados reais do banco com clausulas de contratos.",
        },
        { role: "user", content: promptCombinado },
      ],
      temperature: 0.4,
      max_tokens: 2000,
    }),
  });

  if (!resposta.ok) {
    throw new Error(`Erro ao gerar resposta hibrida: ${resposta.statusText}`);
  }

  const dados = await resposta.json();

  return {
    resposta: dados.choices[0].message.content,
    citacoes: dadosRAG?.citacoes || [],
    sqlExecutado: dadosSQL?.sqlExecutado || null,
  };
}
