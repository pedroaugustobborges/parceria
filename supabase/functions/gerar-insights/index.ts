// gerar-insights/index.ts - Gera analise IA server-side (substitui deepseekService.gerarAnaliseIA)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
      global: { headers: { Authorization: authHeader } },
    });

    // Verificar usuario
    const {
      data: { user },
      error: erroAuth,
    } = await supabase.auth.getUser();

    if (erroAuth || !user) {
      return new Response(
        JSON.stringify({ erro: "Usuario nao autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar perfil do usuario
    const { data: usuario } = await supabase
      .from("usuarios")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!usuario) {
      return new Response(
        JSON.stringify({ erro: "Perfil do usuario nao encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar dados respeitando RLS (filtrado automaticamente pelo token do usuario)
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - 30);

    const [
      { data: acessos },
      { data: produtividade },
      { data: contratos },
      { data: escalas },
    ] = await Promise.all([
      supabase
        .from("acessos")
        .select("*")
        .gte("data_acesso", dataLimite.toISOString())
        .order("data_acesso", { ascending: false })
        .limit(5000),
      supabase
        .from("produtividade")
        .select("*")
        .gte("data", dataLimite.toISOString().split("T")[0])
        .order("data", { ascending: false })
        .limit(1000),
      supabase.from("contratos").select("*").eq("ativo", true),
      supabase
        .from("escalas_medicas")
        .select("*")
        .eq("ativo", true)
        .order("data_inicio", { ascending: false })
        .limit(500),
    ]);

    // Preparar resumo estatistico
    const resumo = prepararResumo(
      acessos || [],
      produtividade || [],
      contratos || [],
      escalas || [],
      usuario
    );

    // Gerar analise via OpenAI
    const respostaIA = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content:
                "Voce e um analista de dados senior especializado em gestao de contratos medicos, com vasta experiencia em indicadores de saude e otimizacao de processos hospitalares.",
            },
            {
              role: "user",
              content: `Analise os dados abaixo do sistema ParcerIA e forneca um diagnostico completo e profissional sobre:

1. **Principais Insights**: Identifique padroes, tendencias e anomalias
2. **Indicadores de Performance**: Avalie a eficiencia operacional e produtividade
3. **Pontos de Atencao**: Destaque possiveis problemas ou areas que necessitam intervencao
4. **Recomendacoes Estrategicas**: Sugira acoes concretas para otimizacao
5. **Analise de Tendencias**: Identifique se os numeros estao crescendo, estaveis ou em declinio

Contexto do usuario: ${usuario.tipo}${usuario.unidade_hospitalar_id ? " (planta especifica)" : ""}

${resumo}

IMPORTANTE:
- Seja objetivo e use linguagem profissional de gestao de saude
- Use markdown para formatacao
- Priorize insights acionaveis
- Se identificar problemas criticos, destaque-os claramente`,
            },
          ],
          temperature: 0.7,
          max_tokens: 3000,
        }),
      }
    );

    if (!respostaIA.ok) {
      const erroTexto = await respostaIA.text();
      console.error("Erro OpenAI:", respostaIA.status, erroTexto);
      throw new Error(`Erro na API OpenAI: ${respostaIA.status} - ${erroTexto}`);
    }

    const dadosIA = await respostaIA.json();
    const analise = dadosIA.choices[0].message.content;

    // Salvar no Supabase com contexto do usuario
    const { error: erroSalvar } = await supabase.from("insights_ia").insert({
      diagnostico: analise,
      data_analise: new Date().toISOString(),
      usuario_id: user.id,
      unidade_hospitalar_id: usuario.unidade_hospitalar_id,
      role_tipo: usuario.tipo,
    });

    if (erroSalvar) {
      console.error("Erro ao salvar insight:", erroSalvar);
    }

    return new Response(JSON.stringify({ diagnostico: analise }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (erro: any) {
    console.error("Erro ao gerar insights:", erro);
    return new Response(
      JSON.stringify({
        erro: "Erro ao gerar analise. Tente novamente.",
        detalhes: erro.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function prepararResumo(
  acessos: any[],
  produtividade: any[],
  contratos: any[],
  escalas: any[],
  usuario: any
): string {
  const totalAcessos = acessos.length;
  const entradas = acessos.filter((a) => a.sentido === "E").length;
  const saidas = acessos.filter((a) => a.sentido === "S").length;
  const pessoasUnicas = new Set(acessos.map((a) => a.cpf)).size;

  const acessosPorTipo: Record<string, number> = {};
  acessos.forEach((a) => {
    acessosPorTipo[a.tipo] = (acessosPorTipo[a.tipo] || 0) + 1;
  });

  const totalProd = produtividade.length;
  const profissionaisUnicos = new Set(produtividade.map((p) => p.codigo_mv)).size;

  const totais = produtividade.reduce(
    (acc, p) => ({
      procedimentos: acc.procedimentos + (p.procedimento || 0),
      pareceres_solicitados: acc.pareceres_solicitados + (p.parecer_solicitado || 0),
      pareceres_realizados: acc.pareceres_realizados + (p.parecer_realizado || 0),
      cirurgias: acc.cirurgias + (p.cirurgia_realizada || 0),
      prescricoes: acc.prescricoes + (p.prescricao || 0),
      evolucoes: acc.evolucoes + (p.evolucao || 0),
      urgencias: acc.urgencias + (p.urgencia || 0),
      ambulatorios: acc.ambulatorios + (p.ambulatorio || 0),
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

  const escalasAprovadas = escalas.filter((e) => e.status === "Aprovado").length;
  const escalasReprovadas = escalas.filter((e) => e.status === "Reprovado").length;
  const escalasProgramadas = escalas.filter((e) => e.status === "Programado").length;

  return `
# DADOS PARA ANALISE - SISTEMA ParcerIA
## Periodo: Ultimos 30 dias
## Data: ${new Date().toLocaleDateString("pt-BR")}

### 1. ACESSOS
- Total: ${totalAcessos} | Entradas: ${entradas} | Saidas: ${saidas}
- Pessoas unicas: ${pessoasUnicas}
- Por tipo: ${Object.entries(acessosPorTipo).map(([t, c]) => `${t}: ${c}`).join(", ")}

### 2. PRODUTIVIDADE
- Registros: ${totalProd} | Profissionais ativos: ${profissionaisUnicos}
- Procedimentos: ${totais.procedimentos} | Cirurgias: ${totais.cirurgias}
- Pareceres solicitados: ${totais.pareceres_solicitados} | Realizados: ${totais.pareceres_realizados}
- Prescricoes: ${totais.prescricoes} | Evolucoes: ${totais.evolucoes}
- Urgencias: ${totais.urgencias} | Ambulatorios: ${totais.ambulatorios}

### 3. CONTRATOS ATIVOS: ${contratos.length}
${contratos.map((c) => `- ${c.nome} (${c.empresa})`).join("\n")}

### 4. ESCALAS MEDICAS (ultimas 500)
- Aprovadas: ${escalasAprovadas} | Reprovadas: ${escalasReprovadas} | Programadas: ${escalasProgramadas}
- Total: ${escalas.length}
`;
}
