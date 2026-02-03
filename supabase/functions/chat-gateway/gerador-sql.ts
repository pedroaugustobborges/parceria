// gerador-sql.ts - Gera e executa SQL seguro baseado na pergunta do usuario

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ContextoUsuario, gerarRestricoesTenant } from "./contexto-usuario.ts";

const SCHEMA_DESCRICAO = `
## Tabelas do Sistema ParcerIA

### contratos
- id (uuid), nome (text), numero_contrato (text), empresa (text)
- data_inicio (date), data_fim (date), ativo (boolean)
- unidade_hospitalar_id (uuid FK)

### escalas_medicas
- id (uuid), contrato_id (uuid FK), item_contrato_id (uuid FK)
- data_inicio (date), horario_entrada (time), horario_saida (time)
- medicos (jsonb array [{nome, cpf}]), status (text: Pre-Agendado/Programado/Pre-Aprovado/Aprovacao Parcial/Atencao/Aprovado/Reprovado)
- observacoes (text), justificativa (text), ativo (boolean)

### produtividade
- id (uuid), codigo_mv (text), nome (text), especialidade (text)
- data (date), procedimento (int), parecer_solicitado (int), parecer_realizado (int)
- cirurgia_realizada (int), prescricao (int), evolucao (int)
- urgencia (int), ambulatorio (int), auxiliar (int), encaminhamento (int)
- unidade_hospitalar_id (uuid FK)

### acessos
- id (uuid), tipo (text), matricula (text), nome (text), cpf (text)
- data_acesso (timestamptz), sentido ('E'|'S'), planta (text)

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
`;

export interface ResultadoSQL {
  resposta: string;
  sqlExecutado: string;
  dados: any;
}

export async function gerarEExecutarSQL(
  pergunta: string,
  contexto: ContextoUsuario,
  historicoMensagens: Array<{ role: string; content: string }>,
  supabase: SupabaseClient,
  apiKey: string
): Promise<ResultadoSQL> {
  const restricoes = gerarRestricoesTenant(contexto);

  // Colunas proibidas para roles restritos
  const colunasProibidas =
    contexto.tipo === "administrador-terceiro" || contexto.tipo === "terceiro"
      ? "\n\nIMPORTANTE: NAO inclua colunas valor_unitario, valor_total, custo ou preco nas consultas. O usuario nao tem permissao para ver valores monetarios."
      : "";

  const promptSQL = `Voce e um gerador de SQL PostgreSQL para o sistema ParcerIA.

${SCHEMA_DESCRICAO}

## Restricoes de Acesso do Usuario
Tipo: ${contexto.tipo}
${restricoes}
${colunasProibidas}

## Regras
1. Gere APENAS consultas SELECT ou WITH (CTE)
2. NUNCA use INSERT, UPDATE, DELETE, DROP ou qualquer DDL/DML
3. Aplique SEMPRE as restricoes de tenant acima
4. Use as views materializadas (vm_*) quando possivel para melhor performance
5. Limite resultados a no maximo 100 linhas
6. Use nomes de colunas em portugues quando gerar aliases
7. Para contar medicos em escalas: jsonb_array_length(medicos)

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
    throw new Error(`Erro ao gerar SQL: ${respostaSQL.statusText}`);
  }

  const dadosSQL = await respostaSQL.json();
  let sql = dadosSQL.choices[0].message.content.trim();

  // Limpar possivel markdown
  sql = sql.replace(/```sql\n?/g, "").replace(/```\n?/g, "").trim();

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
- Ofereça insights adicionais quando relevante
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
