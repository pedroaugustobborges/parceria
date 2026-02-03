// chat-gateway/index.ts - Ponto de entrada unico para interacoes do chat ParcerIA
// Consolidado em arquivo unico para compatibilidade com Supabase CLI
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ============================================================
// TIPOS
// ============================================================

type RotaChat = "sql" | "rag" | "hibrido";

interface ResultadoClassificacao {
  rota: RotaChat;
  confianca: number;
}

interface ContextoUsuario {
  usuarioId: string;
  nome: string;
  email: string;
  tipo: string;
  unidadeHospitalarId: string | null;
  contratoIds: string[];
  cpf: string;
  nomeUnidade: string | null;
}

interface Citacao {
  documento: string;
  secao: string;
  pagina?: number;
}

interface ResultadoSQL {
  resposta: string;
  sqlExecutado: string;
  dados: any;
}

interface ResultadoRAG {
  resposta: string;
  citacoes: Citacao[];
}

interface ResultadoHibrido {
  resposta: string;
  citacoes: Citacao[];
  sqlExecutado: string | null;
}

// ============================================================
// CONTEXTO DO USUARIO (tenant)
// ============================================================

async function construirContextoUsuario(
  supabase: SupabaseClient,
  usuarioId: string
): Promise<ContextoUsuario> {
  const { data: usuario, error: erroUsuario } = await supabase
    .from("usuarios")
    .select("*")
    .eq("id", usuarioId)
    .single();

  if (erroUsuario || !usuario) {
    throw new Error("Usuario nao encontrado");
  }

  const { data: vinculos } = await supabase
    .from("usuario_contrato")
    .select("contrato_id")
    .eq("usuario_id", usuarioId);

  const contratoIds = vinculos?.map((v: any) => v.contrato_id) || [];

  let nomeUnidade: string | null = null;
  if (usuario.unidade_hospitalar_id) {
    const { data: unidade } = await supabase
      .from("unidades_hospitalares")
      .select("nome")
      .eq("id", usuario.unidade_hospitalar_id)
      .single();
    nomeUnidade = unidade?.nome || null;
  }

  return {
    usuarioId: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    tipo: usuario.tipo,
    unidadeHospitalarId: usuario.unidade_hospitalar_id,
    contratoIds,
    cpf: usuario.cpf,
    nomeUnidade,
  };
}

function gerarRestricoesTenant(contexto: ContextoUsuario): string {
  switch (contexto.tipo) {
    case "administrador-agir-corporativo":
      return "-- Sem restricao: acesso corporativo total";

    case "administrador-agir-planta":
      return `-- Restricao de planta: apenas dados da unidade
WHERE unidade_hospitalar_id = '${contexto.unidadeHospitalarId}'`;

    case "administrador-terceiro":
      if (contexto.contratoIds.length === 0) {
        return "-- Sem contratos vinculados: nenhum dado acessivel\nWHERE 1=0";
      }
      return `-- Restricao de admin-terceiro: apenas seus contratos
WHERE contrato_id IN (${contexto.contratoIds.map((id) => `'${id}'`).join(", ")})
-- PROIBIDO: colunas valor_unitario, valor_total, custo, preco`;

    case "terceiro":
      return `-- Restricao de terceiro: apenas dados proprios
WHERE cpf = '${contexto.cpf}'
-- PROIBIDO: colunas valor_unitario, valor_total, custo, preco
-- PROIBIDO: acesso a documentos`;

    default:
      return "WHERE 1=0";
  }
}

function obterFiltroContratosRAG(contexto: ContextoUsuario): string[] | null {
  switch (contexto.tipo) {
    case "administrador-agir-corporativo":
      return null;
    case "administrador-agir-planta":
      return null;
    case "administrador-terceiro":
      return contexto.contratoIds;
    case "terceiro":
      return [];
    default:
      return [];
  }
}

// ============================================================
// CLASSIFICADOR DE INTENCAO
// ============================================================

async function classificarIntencao(
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

  try {
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
      const erroTexto = await resposta.text();
      console.error("Erro OpenAI classificador:", resposta.status, erroTexto);
      throw new Error(`Erro na API OpenAI: ${resposta.status} ${erroTexto}`);
    }

    const dados = await resposta.json();
    const conteudo = dados.choices[0].message.content.trim();

    try {
      const jsonMatch = conteudo.match(/\{[^}]+\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return JSON.parse(conteudo);
    } catch {
      // Fallback por palavras-chave
      return classificarPorPalavrasChave(pergunta);
    }
  } catch (erro: any) {
    console.error("Erro ao classificar intencao:", erro.message);
    // Fallback por palavras-chave se OpenAI falhar
    return classificarPorPalavrasChave(pergunta);
  }
}

function classificarPorPalavrasChave(pergunta: string): ResultadoClassificacao {
  const p = pergunta.toLowerCase();
  if (
    p.includes("contrato") &&
    (p.includes("clausula") ||
      p.includes("sla") ||
      p.includes("termo") ||
      p.includes("obrigac"))
  ) {
    return { rota: "rag", confianca: 0.6 };
  }
  if (
    p.includes("quanto") ||
    p.includes("total") ||
    p.includes("media") ||
    p.includes("ranking") ||
    p.includes("quantas") ||
    p.includes("quantos")
  ) {
    return { rota: "sql", confianca: 0.6 };
  }
  return { rota: "sql", confianca: 0.5 };
}

// ============================================================
// GERADOR SQL
// ============================================================

const SCHEMA_DESCRICAO = `
## Tabelas do Sistema ParcerIA

### contratos
- id (uuid), nome (text), numero_contrato (text), empresa (text)
- data_inicio (date), data_fim (date), ativo (boolean)
- unidade_hospitalar_id (uuid FK)

### escalas_medicas
- id (uuid), contrato_id (uuid FK), item_contrato_id (uuid FK)
- data_inicio (date), horario_entrada (time), horario_saida (time)
- medicos (jsonb array de objetos: [{"nome": "Dr. X", "cpf": "12345678900"}, ...])
- status (text: Pre-Agendado/Programado/Pre-Aprovado/Aprovacao Parcial/Atencao/Aprovado/Reprovado)
- observacoes (text), justificativa (text), ativo (boolean)

**IMPORTANTE para consultar medicos em escalas_medicas:**
- Para expandir o array de medicos: jsonb_array_elements(medicos) AS m
- Para extrair nome do medico: m->>'nome'
- Para extrair cpf do medico: m->>'cpf'
- Para contar medicos: jsonb_array_length(medicos)
Exemplo correto:
  SELECT m->>'nome' AS nome_medico, COUNT(*)
  FROM escalas_medicas e, jsonb_array_elements(e.medicos) AS m
  GROUP BY m->>'nome'

### produtividade
- id (uuid), codigo_mv (text), nome (text), especialidade (text)
- data (date), procedimento (int), parecer_solicitado (int), parecer_realizado (int)
- cirurgia_realizada (int), prescricao (int), evolucao (int)
- urgencia (int), ambulatorio (int), auxiliar (int), encaminhamento (int)
- unidade_hospitalar_id (uuid FK)

### acessos
- id (uuid), tipo (text), matricula (text), nome (text), cpf (text)
- data_acesso (timestamptz), sentido ('E'|'S'), planta (text)
- Registra entradas (sentido='E') e saidas (sentido='S') de pessoas na unidade

### unidades_hospitalares
- id (uuid), codigo (text), nome (text), ativo (boolean)

### itens_contrato
- id (uuid), nome (text), descricao (text), unidade_medida (text), ativo (boolean)

### contrato_itens
- id (uuid), contrato_id (uuid FK), item_id (uuid FK)
- quantidade (numeric), valor_unitario (numeric), observacoes (text)

### parceiros
- id (uuid), nome (text), cnpj (text), telefone (text), email (text), ativo (boolean)

## Views Materializadas
### vm_escalas_mensal (mes, contrato_id, unidade_hospitalar_id, empresa, especialidade, total_escalas, aprovadas, reprovadas, programadas, pre_agendadas, total_medicos)
### vm_produtividade_mensal (mes, unidade_hospitalar_id, especialidade, profissionais_ativos, total_procedimentos, total_pareceres_solicitados, total_pareceres_realizados, total_cirurgias, total_prescricoes, total_evolucoes, total_urgencias, total_ambulatorios)
### vm_acessos_mensal (mes, planta, tipo, total_registros, entradas, saidas, pessoas_unicas)

## CONCEITOS DE NEGOCIO IMPORTANTES

### ABSENTEISMO (faltas)
Absenteismo = medico que estava ESCALADO (em escalas_medicas) mas NAO registrou ACESSO (em acessos) naquele dia.
Para calcular absenteismo, faca LEFT JOIN entre escalas_medicas e acessos pelo CPF do medico e data:
- Escala: data_inicio em escalas_medicas
- Acesso: DATE(data_acesso) em acessos
- Medico escalado: m->>'cpf' de jsonb_array_elements(medicos)
- Medico com acesso: cpf em acessos
- AUSENCIA = quando NAO existe registro em acessos para aquele CPF naquela data

Exemplo de query para absenteismo:
WITH escalas_expandidas AS (
  SELECT e.data_inicio, m->>'nome' AS nome_medico, m->>'cpf' AS cpf_medico
  FROM escalas_medicas e, jsonb_array_elements(e.medicos) AS m
  WHERE e.data_inicio >= '2026-01-01' AND e.data_inicio < '2026-02-01'
),
acessos_dia AS (
  SELECT DISTINCT cpf, DATE(data_acesso) AS data_acesso
  FROM acessos
  WHERE data_acesso >= '2026-01-01' AND data_acesso < '2026-02-01'
)
SELECT ee.nome_medico, ee.cpf_medico,
       COUNT(*) AS total_escalas,
       COUNT(*) FILTER (WHERE ad.cpf IS NULL) AS total_ausencias,
       ROUND(100.0 * COUNT(*) FILTER (WHERE ad.cpf IS NULL) / COUNT(*), 2) AS taxa_absenteismo_pct
FROM escalas_expandidas ee
LEFT JOIN acessos_dia ad ON ee.cpf_medico = ad.cpf AND ee.data_inicio = ad.data_acesso
GROUP BY ee.nome_medico, ee.cpf_medico
ORDER BY total_ausencias DESC

### STATUS de escalas_medicas NAO indica presenca/ausencia
- O status (Aprovado, Reprovado, etc) refere-se a APROVACAO ADMINISTRATIVA da escala, nao a presenca do medico
- Reprovado = escala foi rejeitada administrativamente (ex: documentacao incorreta)
- Aprovado = escala foi aprovada administrativamente
`;

async function gerarEExecutarSQL(
  pergunta: string,
  contexto: ContextoUsuario,
  historicoMensagens: Array<{ role: string; content: string }>,
  supabase: SupabaseClient,
  apiKey: string
): Promise<ResultadoSQL> {
  const restricoes = gerarRestricoesTenant(contexto);

  const colunasProibidas =
    contexto.tipo === "administrador-terceiro" || contexto.tipo === "terceiro"
      ? "\n\nIMPORTANTE: NAO inclua colunas valor_unitario, valor_total, custo ou preco nas consultas. O usuario nao tem permissao para ver valores monetarios."
      : "";

  // Data atual para contexto temporal
  const dataAtual = new Date();
  const anoAtual = dataAtual.getFullYear();
  const mesAtual = dataAtual.getMonth() + 1;
  const diaAtual = dataAtual.getDate();
  const dataHoje = `${anoAtual}-${String(mesAtual).padStart(2, "0")}-${String(diaAtual).padStart(2, "0")}`;

  const promptSQL = `Voce e um gerador de SQL PostgreSQL para o sistema ParcerIA.

## DATA ATUAL: ${dataHoje}
- Ano atual: ${anoAtual}
- Mes atual: ${mesAtual}
- "Este mes" significa: ${anoAtual}-${String(mesAtual).padStart(2, "0")}-01 ate ${dataHoje}
- "Este ano" significa: ${anoAtual}-01-01 ate ${dataHoje}

${SCHEMA_DESCRICAO}

## Restricoes de Acesso do Usuario
Tipo: ${contexto.tipo}
${restricoes}
${colunasProibidas}

## Regras de Geracao SQL
1. Gere APENAS consultas SELECT ou WITH (CTE)
2. NUNCA use INSERT, UPDATE, DELETE, DROP ou qualquer DDL/DML
3. Aplique SEMPRE as restricoes de tenant acima
4. Use as views materializadas (vm_*) quando possivel para melhor performance
5. Use nomes de colunas em portugues quando gerar aliases
6. Para filtros de data, SEMPRE use formato completo: '${anoAtual}-01-01' (nao '${anoAtual}-01')
7. Para comparar datas, use: data_inicio >= '2026-01-01' AND data_inicio < '2026-02-01'
8. NUNCA use formato 'YYYY-MM' sozinho, sempre 'YYYY-MM-DD'

## IMPORTANTE: Agregacao vs Dados Brutos
- Para perguntas analiticas (totais, medias, rankings, tendencias), SEMPRE use funcoes de agregacao (COUNT, SUM, AVG, etc.)
- A query deve retornar METRICAS CALCULADAS, nao dados brutos
- Agregue TODOS os dados do periodo, nao limite antes de agregar
- O LIMIT so deve ser aplicado ao resultado final agregado (ex: TOP 10 medicos)
- Exemplo CORRETO: SELECT medico, COUNT(*) AS total FROM ... GROUP BY medico ORDER BY total DESC LIMIT 10
- Exemplo ERRADO: SELECT * FROM ... LIMIT 1000 (isso perde dados e nao agrega)

Pergunta do usuario: "${pergunta}"

Responda APENAS com a consulta SQL, sem explicacao, sem markdown, sem \`\`\`.`;

  // Gerar SQL via OpenAI
  const respostaSQL = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: promptSQL },
        ...historicoMensagens.slice(-4),
        { role: "user", content: pergunta },
      ],
      temperature: 0.1,
      max_tokens: 500,
    }),
  });

  if (!respostaSQL.ok) {
    const erroTexto = await respostaSQL.text();
    console.error("Erro OpenAI SQL:", respostaSQL.status, erroTexto);
    throw new Error(`Erro ao gerar SQL: ${respostaSQL.status} ${erroTexto}`);
  }

  const dadosSQL = await respostaSQL.json();
  let sql = dadosSQL.choices[0].message.content.trim();

  // Limpar possivel markdown e trailing semicolons
  sql = sql.replace(/```sql\n?/g, "").replace(/```\n?/g, "").trim();
  sql = sql.replace(/;\s*$/, "").trim();

  // Validacao basica de seguranca
  const sqlUpper = sql.toUpperCase();
  if (
    sqlUpper.includes("INSERT") ||
    sqlUpper.includes("UPDATE") ||
    sqlUpper.includes("DELETE") ||
    sqlUpper.includes("DROP") ||
    sqlUpper.includes("ALTER") ||
    sqlUpper.includes("TRUNCATE") ||
    sqlUpper.includes("GRANT")
  ) {
    throw new Error("Consulta SQL invalida: operacoes de modificacao nao sao permitidas");
  }

  // Executar SQL via funcao segura do banco
  const { data: resultado, error: erroExecucao } = await supabase.rpc(
    "executar_consulta_analytics",
    {
      texto_consulta: sql,
      id_usuario: contexto.usuarioId,
    }
  );

  if (erroExecucao) {
    console.error("Erro ao executar SQL:", erroExecucao, "SQL:", sql);
    throw new Error(`Erro ao executar consulta: ${erroExecucao.message}`);
  }

  // Formatar resultado em linguagem natural via OpenAI
  const promptFormatacao = `Voce e o assistente ParcerIA. Formate os dados abaixo em uma resposta clara e objetiva em portugues.

Pergunta original: "${pergunta}"
SQL executado: ${sql}
Dados retornados: ${JSON.stringify(resultado, null, 2)}

Regras:
- Use linguagem profissional e acessivel
- Formate numeros com separadores de milhar
- Formate datas no padrao brasileiro (dd/mm/yyyy)
- Se nao houver dados, informe que nao foram encontrados registros
- Ofereca insights adicionais quando relevante
- Use markdown para formatacao`;

  const respostaFormatada = await fetch("https://api.openai.com/v1/chat/completions", {
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
          content: "Voce e o assistente inteligente ParcerIA, especializado em gestao hospitalar.",
        },
        { role: "user", content: promptFormatacao },
      ],
      temperature: 0.5,
      max_tokens: 1000,
    }),
  });

  if (!respostaFormatada.ok) {
    throw new Error(`Erro ao formatar resposta: ${respostaFormatada.statusText}`);
  }

  const dadosFormatados = await respostaFormatada.json();

  return {
    resposta: dadosFormatados.choices[0].message.content,
    sqlExecutado: sql,
    dados: resultado,
  };
}

// ============================================================
// RECUPERADOR RAG
// ============================================================

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

async function buscarEResponderRAG(
  pergunta: string,
  contexto: ContextoUsuario,
  historicoMensagens: Array<{ role: string; content: string }>,
  supabase: SupabaseClient,
  apiKey: string
): Promise<ResultadoRAG> {
  if (contexto.tipo === "terceiro") {
    return {
      resposta:
        "Desculpe, voce nao tem permissao para acessar documentos de contrato. Entre em contato com o administrador para mais informacoes.",
      citacoes: [],
    };
  }

  console.log(`[RAG] Gerando embedding para pergunta: "${pergunta.substring(0, 50)}..."`);
  const embeddingConsulta = await gerarEmbedding(pergunta, apiKey);
  console.log(`[RAG] Embedding gerado, dimensao: ${embeddingConsulta.length}`);

  const filtroContratos = obterFiltroContratosRAG(contexto);
  console.log(`[RAG] Filtro de contratos: ${filtroContratos ? JSON.stringify(filtroContratos) : "null (sem filtro)"}`);

  if (filtroContratos && filtroContratos.length === 0) {
    return {
      resposta: "Nao foram encontrados documentos vinculados ao seu perfil.",
      citacoes: [],
    };
  }

  // Converter embedding array para string format que pgvector aceita
  const embeddingString = `[${embeddingConsulta.join(",")}]`;

  console.log(`[RAG] Buscando chunks similares...`);
  const { data: chunks, error: erroChunks } = await supabase.rpc(
    "buscar_chunks_similares",
    {
      embedding_consulta: embeddingString,
      limite_similaridade: 0.5, // Reduzido de 0.7 para 0.5 para mais resultados
      limite_resultados: 5,
      filtro_contrato_ids: filtroContratos,
    }
  );

  if (erroChunks) {
    console.error("[RAG] Erro na busca vetorial:", erroChunks);
    throw new Error(`Erro na busca vetorial: ${erroChunks.message}`);
  }

  console.log(`[RAG] Chunks encontrados: ${chunks?.length || 0}`);

  if (!chunks || chunks.length === 0) {
    // Debug: verificar se existem chunks no banco
    const { data: totalChunks } = await supabase
      .from("documento_chunks")
      .select("id", { count: "exact", head: true });
    console.log(`[RAG] Total de chunks no banco (via query direta): ${totalChunks?.length || "erro ao contar"}`);

    return {
      resposta:
        "Nao encontrei informacoes relevantes nos documentos disponiveis para responder sua pergunta. Tente reformular ou perguntar sobre outro topico.",
      citacoes: [],
    };
  }

  console.log(`[RAG] Primeiro chunk similaridade: ${chunks[0]?.similaridade}`);

  const contextoDocs = chunks
    .map(
      (c: any, i: number) =>
        `[Fonte ${i + 1}] Documento: "${c.nome_arquivo}"${c.titulo_secao ? `, Secao: ${c.titulo_secao}` : ""}${c.numero_pagina ? `, Pagina: ${c.numero_pagina}` : ""}\n${c.conteudo}`
    )
    .join("\n\n---\n\n");

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

// ============================================================
// HIBRIDO
// ============================================================

async function executarHibrido(
  pergunta: string,
  contexto: ContextoUsuario,
  historicoMensagens: Array<{ role: string; content: string }>,
  supabase: SupabaseClient,
  apiKey: string
): Promise<ResultadoHibrido> {
  const [resultadoSQL, resultadoRAG] = await Promise.allSettled([
    gerarEExecutarSQL(pergunta, contexto, historicoMensagens, supabase, apiKey),
    buscarEResponderRAG(pergunta, contexto, historicoMensagens, supabase, apiKey),
  ]);

  const dadosSQL =
    resultadoSQL.status === "fulfilled" ? resultadoSQL.value : null;
  const dadosRAG =
    resultadoRAG.status === "fulfilled" ? resultadoRAG.value : null;

  if (!dadosSQL && !dadosRAG) {
    throw new Error(
      "Nao foi possivel obter dados do banco nem dos documentos. Tente reformular sua pergunta."
    );
  }

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
6. Seja objetivo e ofereca insights acionaveis`;

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

// ============================================================
// HANDLER PRINCIPAL
// ============================================================

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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ erro: "OPENAI_API_KEY nao configurada no servidor" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const {
      data: { user },
      error: erroAuth,
    } = await supabase.auth.getUser();

    if (erroAuth || !user) {
      return new Response(
        JSON.stringify({ erro: "Usuario nao autenticado", detalhes: erroAuth?.message }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { pergunta, historico = [] } = await req.json();

    if (!pergunta || typeof pergunta !== "string") {
      return new Response(
        JSON.stringify({ erro: "Pergunta e obrigatoria" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[chat-gateway] Usuario: ${user.id}, Pergunta: "${pergunta.substring(0, 50)}..."`);

    // Construir contexto do usuario (tenant)
    const contexto = await construirContextoUsuario(supabase, user.id);
    console.log(`[chat-gateway] Contexto: tipo=${contexto.tipo}, unidade=${contexto.unidadeHospitalarId}`);

    // Classificar intencao
    const classificacao = await classificarIntencao(pergunta, openaiApiKey);
    console.log(`[chat-gateway] Rota: ${classificacao.rota}, Confianca: ${classificacao.confianca}`);

    let respostaFinal: any;

    switch (classificacao.rota) {
      case "sql": {
        const resultado = await gerarEExecutarSQL(
          pergunta,
          contexto,
          historico,
          supabase,
          openaiApiKey
        );
        respostaFinal = {
          resposta: resultado.resposta,
          rota: "sql",
          sqlExecutado: resultado.sqlExecutado,
          citacoes: null,
        };
        break;
      }

      case "rag": {
        const resultado = await buscarEResponderRAG(
          pergunta,
          contexto,
          historico,
          supabase,
          openaiApiKey
        );
        respostaFinal = {
          resposta: resultado.resposta,
          rota: "rag",
          citacoes: resultado.citacoes,
          sqlExecutado: null,
        };
        break;
      }

      case "hibrido": {
        const resultado = await executarHibrido(
          pergunta,
          contexto,
          historico,
          supabase,
          openaiApiKey
        );
        respostaFinal = {
          resposta: resultado.resposta,
          rota: "hibrido",
          citacoes: resultado.citacoes,
          sqlExecutado: resultado.sqlExecutado,
        };
        break;
      }
    }

    // Pos-processamento: mascarar valores monetarios para roles restritos
    if (
      contexto.tipo === "terceiro" ||
      contexto.tipo === "administrador-terceiro"
    ) {
      respostaFinal.resposta = mascararValoresMonetarios(
        respostaFinal.resposta
      );
    }

    console.log(`[chat-gateway] Resposta gerada com sucesso via rota: ${classificacao.rota}`);

    return new Response(JSON.stringify(respostaFinal), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (erro: any) {
    console.error("[chat-gateway] ERRO:", erro.message, erro.stack);
    return new Response(
      JSON.stringify({
        erro: "Erro ao processar sua pergunta. Tente novamente.",
        detalhes: erro.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function mascararValoresMonetarios(texto: string): string {
  const padroes = [
    /R\$\s*[\d.,]+/g,
    /\b\d{1,3}(?:\.\d{3})*,\d{2}\b(?=\s*(?:reais|real|R\$))/gi,
  ];

  let resultado = texto;
  for (const padrao of padroes) {
    resultado = resultado.replace(padrao, "[valor restrito]");
  }

  return resultado;
}
