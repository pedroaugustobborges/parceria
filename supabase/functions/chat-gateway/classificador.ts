// classificador.ts - Classifica intencao da pergunta do usuario

export type RotaChat = "sql" | "rag" | "hibrido";

export interface ResultadoClassificacao {
  rota: RotaChat;
  confianca: number;
}

export async function classificarIntencao(
  pergunta: string,
  apiKey: string
): Promise<ResultadoClassificacao> {
  const prompt = `Voce e um classificador de intencoes para um sistema de gestao hospitalar chamado ParcerIA.

Classifique a pergunta do usuario em uma das 3 rotas:

**SQL** - Perguntas sobre metricas, quantidades, contagens, datas, medias, rankings, comparacoes numericas.
Exemplos: "Quantas escalas medicas em dezembro?", "Qual o total de procedimentos?", "Ranking de produtividade"

**RAG** - Perguntas sobre clausulas de contrato, politicas, SLAs, definicoes, termos contratuais, obrigacoes.
Exemplos: "O que diz o contrato sobre SLA?", "Quais sao as clausulas de penalidade?", "Explique os termos do contrato X"

**HIBRIDO** - Precisa de numeros do banco E contexto de documentos/contratos.
Exemplos: "Estamos cumprindo o SLA?", "Como a produtividade se compara ao contratado?", "Quais metas nao foram atingidas?"

Responda APENAS com JSON: {"rota": "sql"|"rag"|"hibrido", "confianca": 0.0-1.0}

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
        { role: "system", content: "Responda apenas com JSON valido." },
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 50,
    }),
  });

  if (!resposta.ok) {
    throw new Error(`Erro na API OpenAI: ${resposta.statusText}`);
  }

  const dados = await resposta.json();
  const conteudo = dados.choices[0].message.content.trim();

  try {
    // Extrair JSON da resposta (pode vir com markdown)
    const jsonMatch = conteudo.match(/\{[^}]+\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(conteudo);
  } catch {
    // Fallback: tentar detectar por palavras-chave simples
    const perguntaLower = pergunta.toLowerCase();
    if (
      perguntaLower.includes("contrato") &&
      (perguntaLower.includes("clausula") ||
        perguntaLower.includes("sla") ||
        perguntaLower.includes("termo") ||
        perguntaLower.includes("obrigac"))
    ) {
      return { rota: "rag", confianca: 0.6 };
    }
    if (
      perguntaLower.includes("quanto") ||
      perguntaLower.includes("total") ||
      perguntaLower.includes("media") ||
      perguntaLower.includes("ranking")
    ) {
      return { rota: "sql", confianca: 0.6 };
    }
    return { rota: "sql", confianca: 0.5 };
  }
}
