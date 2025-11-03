import { supabase } from "../lib/supabase";
import {
  Acesso,
  Produtividade,
  Contrato,
  ItemContrato,
} from "../types/database.types";

const DEEPSEEK_API_KEY = "sk-785d2f2a795a4b338bfc543500f51c72";
const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

interface DadosAnalise {
  acessos: Acesso[];
  produtividade: Produtividade[];
  contratos: Contrato[];
  itensContrato: ItemContrato[];
}

/**
 * Busca todos os dados necessários para análise
 */
export const buscarDadosParaAnalise = async (): Promise<DadosAnalise> => {
  // Buscar acessos dos últimos 30 dias
  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - 30);

  const { data: acessos } = await supabase
    .from("acessos")
    .select("*")
    .gte("data_acesso", dataLimite.toISOString())
    .order("data_acesso", { ascending: false })
    .limit(5000);

  // Buscar produtividade dos últimos 30 dias
  const { data: produtividade } = await supabase
    .from("produtividade")
    .select("*")
    .gte("data", dataLimite.toISOString().split("T")[0])
    .order("data", { ascending: false })
    .limit(1000);

  // Buscar contratos ativos
  const { data: contratos } = await supabase
    .from("contratos")
    .select("*")
    .eq("ativo", true);

  // Buscar itens de contrato (se a tabela existir)
  let itensContrato: any[] = [];
  try {
    const { data } = await supabase
      .from("itens_contrato")
      .select("*")
      .eq("ativo", true);
    itensContrato = data || [];
  } catch (error) {
    console.log(
      "Tabela itens_contrato não existe, continuando sem esses dados"
    );
  }

  return {
    acessos: acessos || [],
    produtividade: produtividade || [],
    contratos: contratos || [],
    itensContrato: itensContrato,
  };
};

/**
 * Prepara um resumo estatístico dos dados para enviar à IA
 */
const prepararResumoEstatistico = (dados: DadosAnalise): string => {
  const { acessos, produtividade, contratos } = dados;

  // Estatísticas de Acessos
  const totalAcessos = acessos.length;
  const entradas = acessos.filter((a) => a.sentido === "E").length;
  const saidas = acessos.filter((a) => a.sentido === "S").length;
  const pessoasUnicas = new Set(acessos.map((a) => a.cpf)).size;
  const tiposUnicos = new Set(acessos.map((a) => a.tipo));

  // Acessos por tipo
  const acessosPorTipo: Record<string, number> = {};
  acessos.forEach((a) => {
    acessosPorTipo[a.tipo] = (acessosPorTipo[a.tipo] || 0) + 1;
  });

  // Estatísticas de Produtividade
  const totalProdutividade = produtividade.length;
  const profissionaisUnicos = new Set(produtividade.map((p) => p.codigo_mv))
    .size;
  const especialidadesUnicas = new Set(
    produtividade.map((p) => p.especialidade).filter(Boolean)
  );

  // Totais por categoria
  const totaisProdutividade = produtividade.reduce(
    (acc, p) => ({
      procedimentos: acc.procedimentos + p.procedimento,
      pareceres_solicitados: acc.pareceres_solicitados + p.parecer_solicitado,
      pareceres_realizados: acc.pareceres_realizados + p.parecer_realizado,
      cirurgias: acc.cirurgias + p.cirurgia_realizada,
      prescricoes: acc.prescricoes + p.prescricao,
      evolucoes: acc.evolucoes + p.evolucao,
      urgencias: acc.urgencias + p.urgencia,
      ambulatorios: acc.ambulatorios + p.ambulatorio,
    }),
    {
      procedimentos: 0,
      pareceres_solicitados: 0,
      pareceres_realizados: 0,
      cirurgias: 0,
      prescricoes: 0,
      evolucoes: 0,
      urgencias: 0,
      ambulatorios: 0,
    }
  );

  // Taxa de conversão de pareceres
  const taxaConversaoPareceres =
    totaisProdutividade.pareceres_solicitados > 0
      ? (
          (totaisProdutividade.pareceres_realizados /
            totaisProdutividade.pareceres_solicitados) *
          100
        ).toFixed(1)
      : "0.0";

  return `
# DADOS PARA ANÁLISE - SISTEMA ParecerIA
## Período: Últimos 30 dias
## Data da Análise: ${new Date().toLocaleDateString("pt-BR")}

### 1. ANÁLISE DE ACESSOS
- **Total de Registros de Acesso**: ${totalAcessos}
- **Entradas**: ${entradas} (${((entradas / totalAcessos) * 100).toFixed(1)}%)
- **Saídas**: ${saidas} (${((saidas / totalAcessos) * 100).toFixed(1)}%)
- **Pessoas Únicas com Acesso**: ${pessoasUnicas}
- **Tipos de Profissionais**: ${Array.from(tiposUnicos).join(", ")}

**Distribuição de Acessos por Tipo:**
${Object.entries(acessosPorTipo)
  .sort((a, b) => b[1] - a[1])
  .map(
    ([tipo, count]) =>
      `- ${tipo}: ${count} acessos (${((count / totalAcessos) * 100).toFixed(
        1
      )}%)`
  )
  .join("\n")}

### 2. ANÁLISE DE PRODUTIVIDADE MÉDICA
- **Total de Registros de Produtividade**: ${totalProdutividade}
- **Profissionais Ativos**: ${profissionaisUnicos}
- **Especialidades**: ${Array.from(especialidadesUnicas).join(", ")}

**Totais por Categoria:**
- Procedimentos: ${totaisProdutividade.procedimentos}
- Pareceres Solicitados: ${totaisProdutividade.pareceres_solicitados}
- Pareceres Realizados: ${totaisProdutividade.pareceres_realizados}
- Taxa de Conversão de Pareceres: ${taxaConversaoPareceres}%
- Cirurgias Realizadas: ${totaisProdutividade.cirurgias}
- Prescrições: ${totaisProdutividade.prescricoes}
- Evoluções: ${totaisProdutividade.evolucoes}
- Atendimentos de Urgência: ${totaisProdutividade.urgencias}
- Atendimentos Ambulatoriais: ${totaisProdutividade.ambulatorios}

### 3. CONTRATOS ATIVOS
- **Total de Contratos Ativos**: ${contratos.length}
${contratos.map((c) => `- ${c.nome} (${c.empresa})`).join("\n")}
`;
};

/**
 * Gera análise usando a DeepSeek API
 */
export const gerarAnaliseIA = async (): Promise<string> => {
  try {
    // 1. Buscar dados
    const dados = await buscarDadosParaAnalise();

    // 2. Preparar resumo estatístico
    const resumo = prepararResumoEstatistico(dados);

    // 3. Preparar prompt para a IA
    const prompt = `Você é um analista de dados especializado em gestão de contratos médicos e saúde digital.

Analise os dados abaixo do sistema ParecerIA e forneça um diagnóstico completo e profissional sobre:

1. **Principais Insights**: Identifique padrões, tendências e anomalias nos dados
2. **Indicadores de Performance**: Avalie a eficiência operacional e produtividade
3. **Pontos de Atenção**: Destaque possíveis problemas ou áreas que necessitam intervenção
4. **Recomendações Estratégicas**: Sugira ações concretas para otimização da gestão
5. **Comparações e Benchmarks**: Compare métricas entre diferentes profissionais/tipos
6. **Análise de Tendências**: Identifique se os números estão crescendo, estáveis ou em declínio

${resumo}

**IMPORTANTE**:
- Seja objetivo e use linguagem profissional de gestão de saúde
- Use markdown para formatação
- Inclua emojis relacionados à saúde quando apropriado (🏥, 📊, ⚕️, 📈, ⚠️, ✅)
- Priorize insights acionáveis
- Se identificar problemas críticos, destaque-os claramente`;

    // 4. Chamar API DeepSeek
    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content:
              "Você é um analista de dados sênior especializado em gestão de contratos médicos, com vasta experiência em indicadores de saúde e otimização de processos hospitalares.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 3000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Erro na API DeepSeek: ${response.status} - ${errorText}`
      );
    }

    const result = await response.json();
    const analise = result.choices[0].message.content;

    // 5. Salvar no Supabase
    const { error } = await supabase.from("insights_ia").insert({
      diagnostico: analise,
      data_analise: new Date().toISOString(),
    });

    if (error) {
      console.error("Erro ao salvar insight no Supabase:", error);
      throw error;
    }

    return analise;
  } catch (error) {
    console.error("Erro ao gerar análise:", error);
    throw error;
  }
};

/**
 * Busca o insight mais recente
 */
export const buscarInsightMaisRecente = async () => {
  const { data, error } = await supabase
    .from("insights_ia")
    .select("*")
    .order("data_analise", { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 = no rows returned
    throw error;
  }

  return data;
};

/**
 * Busca todos os insights (histórico)
 */
export const buscarHistoricoInsights = async () => {
  const { data, error } = await supabase
    .from("insights_ia")
    .select("*")
    .order("data_analise", { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
};

/**
 * Verifica se já existe uma análise para hoje
 */
export const jaTemAnaliseHoje = async (): Promise<boolean> => {
  const hoje = new Date().toISOString().split("T")[0];

  const { data } = await supabase
    .from("insights_ia")
    .select("id")
    .gte("data_analise", `${hoje}T00:00:00`)
    .limit(1);

  return (data?.length || 0) > 0;
};
