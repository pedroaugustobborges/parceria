// chat-gateway/index.ts - Ponto de entrada unico para interacoes do chat ParcerIA
// Consolidado em arquivo unico para compatibilidade com Supabase CLI
// Suporta streaming SSE (Server-Sent Events) para efeito typewriter
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

interface DadosPreparadosSQL {
  sql: string;
  mensagens: Array<{ role: string; content: string }>;
}

interface DadosPreparadosRAG {
  mensagens: Array<{ role: string; content: string }> | null;
  citacoes: Citacao[];
  respostaEstatica: string | null;
}

interface DadosPreparadosHibrido {
  mensagens: Array<{ role: string; content: string }> | null;
  citacoes: Citacao[];
  sqlExecutado: string | null;
  respostaEstatica: string | null;
}

// ============================================================
// HELPERS SSE (Server-Sent Events)
// ============================================================

function enviarEvento(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  evento: object
): void {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(evento)}\n\n`));
}

async function streamOpenAI(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  mensagens: Array<{ role: string; content: string }>,
  apiKey: string,
  temperature: number = 0.5,
  maxTokens: number = 1500
): Promise<string> {
  const resposta = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: mensagens,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    }),
  });

  if (!resposta.ok) {
    const erroTexto = await resposta.text();
    throw new Error(`Erro OpenAI streaming: ${resposta.status} ${erroTexto}`);
  }

  const reader = resposta.body!.getReader();
  const decoder = new TextDecoder();
  let textoCompleto = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const linhas = buffer.split("\n");
    buffer = linhas.pop() || "";

    for (const linha of linhas) {
      const trimmed = linha.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;

      const dados = trimmed.slice(6);
      if (dados === "[DONE]") continue;

      try {
        const parsed = JSON.parse(dados);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          textoCompleto += delta;
          enviarEvento(controller, encoder, { tipo: "token", conteudo: delta });
        }
      } catch {
        // Ignorar chunks nao-parseavel
      }
    }
  }

  return textoCompleto;
}

// Chamada OpenAI nao-streaming (para etapas intermediarias)
async function chamarOpenAI(
  mensagens: Array<{ role: string; content: string }>,
  apiKey: string,
  temperature: number = 0.5,
  maxTokens: number = 1500
): Promise<string> {
  const resposta = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: mensagens,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!resposta.ok) {
    const erroTexto = await resposta.text();
    throw new Error(`Erro OpenAI: ${resposta.status} ${erroTexto}`);
  }

  const dados = await resposta.json();
  return dados.choices[0].message.content;
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

// Retorna filtros para busca RAG multi-tabela (contratos + gestao)
interface FiltrosRAG {
  filtroContratoIds: string[] | null;
  filtroUnidadeId: string | null;
  incluirGestao: boolean;
}

function obterFiltrosRAG(contexto: ContextoUsuario): FiltrosRAG {
  switch (contexto.tipo) {
    case "administrador-agir-corporativo":
      // Corporativo: busca em tudo (contratos e gestao de todas unidades)
      return { filtroContratoIds: null, filtroUnidadeId: null, incluirGestao: true };

    case "administrador-agir-planta":
      // Planta: contratos da unidade + gestao apenas da propria unidade
      return { filtroContratoIds: null, filtroUnidadeId: contexto.unidadeHospitalarId, incluirGestao: true };

    case "administrador-terceiro":
      // Admin-terceiro: apenas contratos que gerencia, SEM gestao
      return { filtroContratoIds: contexto.contratoIds, filtroUnidadeId: null, incluirGestao: false };

    case "terceiro":
      // Terceiro: bloqueado de tudo
      return { filtroContratoIds: [], filtroUnidadeId: null, incluirGestao: false };

    default:
      return { filtroContratoIds: [], filtroUnidadeId: null, incluirGestao: false };
  }
}

// Detecta mencoes a hospitais/unidades na pergunta e retorna o ID
async function detectarUnidadeMencionada(
  pergunta: string,
  supabase: SupabaseClient
): Promise<string | null> {
  const perguntaLower = pergunta.toLowerCase();

  // Mapeamento de siglas/nomes comuns para codigos
  const padroes: { regex: RegExp; codigo: string }[] = [
    { regex: /\bhugol\b/i, codigo: "HUGOL" },
    { regex: /\bhecad\b/i, codigo: "HECAD" },
    { regex: /\bcrer\b/i, codigo: "CRER" },
    { regex: /hospital\s+(estadual\s+)?(de\s+)?urg[eê]ncias?\b/i, codigo: "HUGOL" },
    { regex: /hospital\s+(estadual\s+)?(da\s+)?crian[cç]a/i, codigo: "HECAD" },
    { regex: /centro\s+(de\s+)?reabilita[cç][aã]o/i, codigo: "CRER" },
    { regex: /henrique\s+santillo/i, codigo: "CRER" },
    { regex: /ot[aá]vio\s+lage/i, codigo: "HUGOL" },
  ];

  for (const padrao of padroes) {
    if (padrao.regex.test(pergunta)) {
      // Buscar ID da unidade pelo codigo
      const { data: unidade, error } = await supabase
        .from("unidades_hospitalares")
        .select("id")
        .eq("codigo", padrao.codigo)
        .single();

      if (!error && unidade) {
        console.log(`[RAG] Unidade detectada na pergunta: ${padrao.codigo} -> ${unidade.id}`);
        return unidade.id;
      }
    }
  }

  return null;
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

**SQL** - Perguntas sobre metricas operacionais: escalas medicas, produtividade, acessos, contagens, rankings.
Exemplos: "Quantas escalas medicas em dezembro?", "Qual o total de procedimentos?", "Ranking de produtividade", "Quantos medicos trabalharam?"

**RAG** - Perguntas sobre conteudo de documentos: clausulas, termos, politicas, SLAs, definicoes contratuais, resumo de contratos.
Exemplos: "O que diz o contrato sobre SLA?", "Quais sao as clausulas de penalidade?", "Faca um resumo do contrato X"

**HIBRIDO** - Perguntas sobre VALORES FINANCEIROS de contratos, comparacoes entre dados operacionais e contratuais, ou visao geral que combina metricas com informacoes de documentos.
Exemplos: "Qual o valor total dos contratos do HUGOL?", "Estamos cumprindo o SLA?", "Quanto custa o contrato com empresa X?", "Qual o valor do contrato?", "Soma dos valores dos contratos"

IMPORTANTE: Perguntas sobre VALORES MONETARIOS (R$, valor, custo, preco, soma de contratos) devem ir para HIBRIDO pois os valores podem estar tanto no banco quanto nos documentos PDF.

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
      return classificarPorPalavrasChave(pergunta);
    }
  } catch (erro: any) {
    console.error("Erro ao classificar intencao:", erro.message);
    return classificarPorPalavrasChave(pergunta);
  }
}

function classificarPorPalavrasChave(pergunta: string): ResultadoClassificacao {
  const p = pergunta.toLowerCase();

  if (
    p.includes("valor") ||
    p.includes("custo") ||
    p.includes("preco") ||
    p.includes("r$") ||
    p.includes("reais") ||
    (p.includes("soma") && p.includes("contrato")) ||
    (p.includes("total") && p.includes("contrato"))
  ) {
    return { rota: "hibrido", confianca: 0.7 };
  }

  if (
    p.includes("contrato") &&
    (p.includes("clausula") ||
      p.includes("sla") ||
      p.includes("termo") ||
      p.includes("obrigac") ||
      p.includes("resumo") ||
      p.includes("explique"))
  ) {
    return { rota: "rag", confianca: 0.6 };
  }

  if (
    p.includes("quantas") ||
    p.includes("quantos") ||
    p.includes("media") ||
    p.includes("ranking") ||
    p.includes("escala") ||
    p.includes("produtividade") ||
    p.includes("acesso")
  ) {
    return { rota: "sql", confianca: 0.6 };
  }

  return { rota: "sql", confianca: 0.5 };
}

// ============================================================
// SCHEMA DO BANCO
// ============================================================

const SCHEMA_DESCRICAO = `
## Tabelas do Sistema ParcerIA

### contratos
- id (uuid), nome (text), numero_contrato (text), empresa (text)
- data_inicio (date), data_fim (date), ativo (boolean)
- unidade_hospitalar_id (uuid FK)
- valor_total (decimal) - Valor total do contrato (calculado automaticamente de contrato_itens)

### escalas_medicas
- id (uuid), contrato_id (uuid FK), item_contrato_id (uuid FK)
- data_inicio (date), horario_entrada (time), horario_saida (time)
- medicos (jsonb array de objetos: [{"nome": "Dr. X", "cpf": "12345678900"}, ...])
- status (text) - VALORES EXATOS com acentos: 'Pré-Agendado', 'Programado', 'Pré-Aprovado', 'Aprovação Parcial', 'Atenção', 'Aprovado', 'Reprovado'
- IMPORTANTE: Os valores de status TEM acentos e cedilha. Use EXATAMENTE como listado acima.
  - CORRETO: WHERE status = 'Atenção'
  - ERRADO: WHERE status = 'Atencao'
  - CORRETO: WHERE status = 'Pré-Agendado'
  - ERRADO: WHERE status = 'Pre-Agendado'
  - CORRETO: WHERE status = 'Aprovação Parcial'
  - ERRADO: WHERE status = 'Aprovacao Parcial'
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
- IMPORTANTE: Nome completo do hospital. Use ILIKE para busca parcial ou busque pelo codigo.
- Nomes completos:
  - HUGOL = "Hospital Estadual de Urgências Governador Otávio Lage de Siqueira"
  - HECAD = "Hospital Estadual da Criança e do Adolescente"
  - CRER = "Centro de Reabilitação e Readaptação Dr. Henrique Santillo"
- Codigos das unidades: HUGOL, HECAD, CRER
- Para buscar por sigla/apelido, use: codigo = 'HUGOL' ou nome ILIKE '%HUGOL%'

### itens_contrato
- id (uuid), nome (text), descricao (text), unidade_medida (text), ativo (boolean)

### contrato_itens
- id (uuid), contrato_id (uuid FK), item_id (uuid FK)
- quantidade (numeric), valor_unitario (numeric), observacoes (text)
- IMPORTANTE: Esta tabela contem os VALORES dos contratos
- Valor total de um item = quantidade * valor_unitario
- Para valor total de um contrato: SUM(quantidade * valor_unitario) WHERE contrato_id = X

### parceiros
- id (uuid), nome (text), cnpj (text), telefone (text), email (text), ativo (boolean)

## Views Materializadas
### vm_escalas_mensal (mes, contrato_id, unidade_hospitalar_id, empresa, especialidade, total_escalas, aprovadas, reprovadas, programadas, pre_agendadas, total_medicos)
### vm_produtividade_mensal (mes, unidade_hospitalar_id, especialidade, profissionais_ativos, total_procedimentos, total_pareceres_solicitados, total_pareceres_realizados, total_cirurgias, total_prescricoes, total_evolucoes, total_urgencias, total_ambulatorios)
### vm_acessos_mensal (mes, planta, tipo, total_registros, entradas, saidas, pessoas_unicas)

## CONCEITOS DE NEGOCIO IMPORTANTES

### VALOR TOTAL DE CONTRATOS
A coluna contratos.valor_total contem o valor total do contrato (ja calculado).
Para somar valores de contratos de uma unidade:
SELECT c.nome AS contrato, c.empresa, c.valor_total
FROM contratos c
JOIN unidades_hospitalares u ON u.id = c.unidade_hospitalar_id
WHERE c.ativo = true AND u.nome ILIKE '%NOME_UNIDADE%'

Para soma total de todos os contratos de uma unidade:
SELECT SUM(c.valor_total) AS soma_total
FROM contratos c
JOIN unidades_hospitalares u ON u.id = c.unidade_hospitalar_id
WHERE c.ativo = true AND u.nome ILIKE '%NOME_UNIDADE%'

### SIGLAS E APELIDOS DE UNIDADES
Os usuarios podem usar siglas como "HUGOL", "HECAD", "CRER", etc.
Para buscar unidades, use o codigo OU nome com ILIKE:
- WHERE u.codigo = 'HUGOL' (busca exata pelo codigo)
- WHERE u.nome ILIKE '%HUGOL%' (busca parcial pelo nome)
Isso encontrara "Hospital Estadual de Urgências Governador Otávio Lage de Siqueira"

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
- LEMBRETE: Sempre use os valores de status COM acentos: 'Atenção' (nao 'Atencao'), 'Pré-Agendado' (nao 'Pre-Agendado'), 'Aprovação Parcial' (nao 'Aprovacao Parcial')
`;

// ============================================================
// PREPARAR DADOS SQL (sem chamada final de formatacao)
// ============================================================

async function prepararSQL(
  pergunta: string,
  contexto: ContextoUsuario,
  historicoMensagens: Array<{ role: string; content: string }>,
  supabase: SupabaseClient,
  apiKey: string
): Promise<DadosPreparadosSQL> {
  const restricoes = gerarRestricoesTenant(contexto);

  const colunasProibidas =
    contexto.tipo === "administrador-terceiro" || contexto.tipo === "terceiro"
      ? "\n\nIMPORTANTE: NAO inclua colunas valor_unitario, valor_total, custo ou preco nas consultas. O usuario nao tem permissao para ver valores monetarios."
      : "";

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

  // Gerar SQL via OpenAI (nao-streaming)
  const respostaSQL = await chamarOpenAI(
    [
      { role: "system", content: promptSQL },
      ...historicoMensagens.slice(-4),
      { role: "user", content: pergunta },
    ],
    apiKey,
    0.1,
    500
  );

  let sql = respostaSQL.trim();
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

  // Executar SQL
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

  // Montar mensagens para a chamada de formatacao (sera streaming)
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

  return {
    sql,
    mensagens: [
      {
        role: "system",
        content: "Voce e o assistente inteligente ParcerIA, especializado em gestao hospitalar.",
      },
      { role: "user", content: promptFormatacao },
    ],
  };
}

// ============================================================
// PREPARAR DADOS RAG (sem chamada final de resposta)
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

async function prepararRAG(
  pergunta: string,
  contexto: ContextoUsuario,
  historicoMensagens: Array<{ role: string; content: string }>,
  supabase: SupabaseClient,
  apiKey: string
): Promise<DadosPreparadosRAG> {
  if (contexto.tipo === "terceiro") {
    return {
      mensagens: null,
      citacoes: [],
      respostaEstatica:
        "Desculpe, voce nao tem permissao para acessar documentos de contrato. Entre em contato com o administrador para mais informacoes.",
    };
  }

  console.log(`[RAG] Gerando embedding para pergunta: "${pergunta.substring(0, 50)}..."`);
  const embeddingConsulta = await gerarEmbedding(pergunta, apiKey);

  // Usar nova funcao de filtros que inclui documentos de gestao
  const filtros = obterFiltrosRAG(contexto);

  // Detectar se o usuario mencionou uma unidade especifica na pergunta
  // Isso permite que corporativo filtre por unidade quando menciona explicitamente
  const unidadeMencionada = await detectarUnidadeMencionada(pergunta, supabase);

  // Se usuario mencionou uma unidade, usar como filtro (sobrescreve filtro de contexto para gestao)
  let filtroUnidadeFinal = filtros.filtroUnidadeId;
  if (unidadeMencionada) {
    filtroUnidadeFinal = unidadeMencionada;
    console.log(`[RAG] Filtrando por unidade mencionada: ${unidadeMencionada}`);
  }

  if (filtros.filtroContratoIds && filtros.filtroContratoIds.length === 0 && !filtros.incluirGestao) {
    return {
      mensagens: null,
      citacoes: [],
      respostaEstatica: "Nao foram encontrados documentos vinculados ao seu perfil.",
    };
  }

  const embeddingString = `[${embeddingConsulta.join(",")}]`;

  // Usar nova funcao que busca em ambas tabelas (contratos + gestao)
  const { data: chunks, error: erroChunks } = await supabase.rpc(
    "buscar_chunks_similares_v2",
    {
      embedding_consulta: embeddingString,
      limite_similaridade: 0.5,
      limite_resultados: 5,
      filtro_contrato_ids: filtros.filtroContratoIds,
      filtro_unidade_id: filtroUnidadeFinal,
      incluir_gestao: filtros.incluirGestao,
    }
  );

  if (erroChunks) {
    console.error("[RAG] Erro na busca vetorial:", erroChunks);
    throw new Error(`Erro na busca vetorial: ${erroChunks.message}`);
  }

  if (!chunks || chunks.length === 0) {
    return {
      mensagens: null,
      citacoes: [],
      respostaEstatica:
        "Nao encontrei informacoes relevantes nos documentos disponiveis para responder sua pergunta. Tente reformular ou perguntar sobre outro topico.",
    };
  }

  // Incluir tipo_documento no contexto para diferenciar contratos de gestao
  const contextoDocs = chunks
    .map(
      (c: any, i: number) =>
        `[Fonte ${i + 1}] ${c.tipo_documento === 'gestao' ? '[Contrato de Gestao] ' : ''}Documento: "${c.nome_arquivo}"${c.titulo_secao ? `, Secao: ${c.titulo_secao}` : ""}${c.numero_pagina ? `, Pagina: ${c.numero_pagina}` : ""}\n${c.conteudo}`
    )
    .join("\n\n---\n\n");

  const prompt = `Voce e o assistente ParcerIA, especializado em gestao de contratos hospitalares.

Responda a pergunta do usuario usando APENAS as informacoes dos documentos fornecidos abaixo.
NOTA: Documentos marcados como [Contrato de Gestao] sao contratos entre o governo e a organizacao que definem metas e objetivos estrategicos.

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

  const citacoes: Citacao[] = chunks.map((c: any) => ({
    documento: c.nome_arquivo,
    secao: c.titulo_secao || "Secao nao identificada",
    pagina: c.numero_pagina || undefined,
  }));

  return {
    mensagens: [
      {
        role: "system",
        content: "Voce e o assistente ParcerIA. Responda sempre com citacoes dos documentos.",
      },
      ...historicoMensagens.slice(-4),
      { role: "user", content: prompt },
    ],
    citacoes,
    respostaEstatica: null,
  };
}

// ============================================================
// PREPARAR DADOS HIBRIDO
// ============================================================

async function prepararHibrido(
  pergunta: string,
  contexto: ContextoUsuario,
  historicoMensagens: Array<{ role: string; content: string }>,
  supabase: SupabaseClient,
  apiKey: string
): Promise<DadosPreparadosHibrido> {
  // Preparar SQL e RAG em paralelo
  const [resultadoSQL, resultadoRAG] = await Promise.allSettled([
    prepararSQL(pergunta, contexto, historicoMensagens, supabase, apiKey),
    prepararRAG(pergunta, contexto, historicoMensagens, supabase, apiKey),
  ]);

  const dadosSQL = resultadoSQL.status === "fulfilled" ? resultadoSQL.value : null;
  const dadosRAG = resultadoRAG.status === "fulfilled" ? resultadoRAG.value : null;

  if (!dadosSQL && !dadosRAG) {
    return {
      mensagens: null,
      citacoes: [],
      sqlExecutado: null,
      respostaEstatica:
        "Nao foi possivel obter dados do banco nem dos documentos. Tente reformular sua pergunta.",
    };
  }

  // Para o hibrido, precisamos das respostas intermediarias (nao-streaming)
  let respostaSQL = "Nao foi possivel obter dados do banco de dados.";
  let respostaRAG = "Nao foram encontrados documentos relevantes.";

  // Executar formatacoes intermediarias em paralelo
  const [formatadoSQL, formatadoRAG] = await Promise.allSettled([
    dadosSQL
      ? chamarOpenAI(dadosSQL.mensagens, apiKey, 0.5, 1000)
      : Promise.resolve(null),
    dadosRAG && dadosRAG.mensagens
      ? chamarOpenAI(dadosRAG.mensagens, apiKey, 0.3, 1500)
      : Promise.resolve(dadosRAG?.respostaEstatica || null),
  ]);

  if (formatadoSQL.status === "fulfilled" && formatadoSQL.value) {
    respostaSQL = formatadoSQL.value;
  }
  if (formatadoRAG.status === "fulfilled" && formatadoRAG.value) {
    respostaRAG = formatadoRAG.value;
  }

  const promptCombinado = `Voce e o assistente ParcerIA. Combine as informacoes abaixo para responder a pergunta do usuario.

## Pergunta
"${pergunta}"

## Dados do Banco (Metricas)
${respostaSQL}

## Dados dos Documentos (Contratos)
${respostaRAG}

## Regras
1. Combine ambas as fontes de forma coerente
2. Compare metricas reais com o que esta definido nos contratos
3. Destaque concordancias e discrepancias
4. Se houver documentos, cite as fontes
5. Use markdown para formatacao
6. Seja objetivo e ofereca insights acionaveis`;

  return {
    mensagens: [
      {
        role: "system",
        content:
          "Voce e o assistente ParcerIA, combinando dados reais do banco com clausulas de contratos.",
      },
      { role: "user", content: promptCombinado },
    ],
    citacoes: dadosRAG?.citacoes || [],
    sqlExecutado: dadosSQL?.sql || null,
    respostaEstatica: null,
  };
}

// ============================================================
// MASCARAMENTO MONETARIO
// ============================================================

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

// ============================================================
// HANDLER PRINCIPAL (com streaming SSE)
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

    const roleRestrito =
      contexto.tipo === "terceiro" || contexto.tipo === "administrador-terceiro";

    // Criar ReadableStream para SSE
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          let mensagensParaStream: Array<{ role: string; content: string }> | null = null;
          let citacoes: Citacao[] = [];
          let sqlExecutado: string | null = null;
          let respostaEstatica: string | null = null;
          let temperature = 0.5;
          let maxTokens = 1500;

          switch (classificacao.rota) {
            case "sql": {
              const preparado = await prepararSQL(
                pergunta, contexto, historico, supabase, openaiApiKey
              );
              mensagensParaStream = preparado.mensagens;
              sqlExecutado = preparado.sql;
              temperature = 0.5;
              maxTokens = 1000;
              break;
            }

            case "rag": {
              const preparado = await prepararRAG(
                pergunta, contexto, historico, supabase, openaiApiKey
              );
              mensagensParaStream = preparado.mensagens;
              citacoes = preparado.citacoes;
              respostaEstatica = preparado.respostaEstatica;
              temperature = 0.3;
              maxTokens = 1500;
              break;
            }

            case "hibrido": {
              const preparado = await prepararHibrido(
                pergunta, contexto, historico, supabase, openaiApiKey
              );
              mensagensParaStream = preparado.mensagens;
              citacoes = preparado.citacoes;
              sqlExecutado = preparado.sqlExecutado;
              respostaEstatica = preparado.respostaEstatica;
              temperature = 0.4;
              maxTokens = 2000;
              break;
            }
          }

          // Enviar metadata (rota, sqlExecutado)
          enviarEvento(controller, encoder, {
            tipo: "metadata",
            rota: classificacao.rota,
            sqlExecutado,
          });

          if (respostaEstatica) {
            // Resposta estatica (sem streaming) - enviar como tokens para manter protocolo consistente
            enviarEvento(controller, encoder, {
              tipo: "token",
              conteudo: respostaEstatica,
            });
          } else if (mensagensParaStream) {
            // Stream da resposta final do LLM
            const textoCompleto = await streamOpenAI(
              controller,
              encoder,
              mensagensParaStream,
              openaiApiKey,
              temperature,
              maxTokens
            );

            // Mascaramento monetario para roles restritos
            if (roleRestrito) {
              const textoMascarado = mascararValoresMonetarios(textoCompleto);
              if (textoMascarado !== textoCompleto) {
                // Enviar correcao: o frontend substituira o texto acumulado
                enviarEvento(controller, encoder, {
                  tipo: "replace",
                  conteudo: textoMascarado,
                });
              }
            }
          }

          // Enviar citacoes se houver
          if (citacoes.length > 0) {
            enviarEvento(controller, encoder, {
              tipo: "citacoes",
              citacoes,
            });
          }

          // Sinalizar fim do stream
          enviarEvento(controller, encoder, { tipo: "done" });

          console.log(`[chat-gateway] Stream concluido via rota: ${classificacao.rota}`);
        } catch (erro: any) {
          console.error("[chat-gateway] ERRO no stream:", erro.message, erro.stack);
          enviarEvento(controller, encoder, {
            tipo: "erro",
            mensagem: erro.message || "Erro ao processar sua pergunta.",
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (erro: any) {
    console.error("[chat-gateway] ERRO pre-stream:", erro.message, erro.stack);
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
