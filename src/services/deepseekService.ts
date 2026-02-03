import { supabase } from "../lib/supabase";

/**
 * Gera analise IA via Edge Function (server-side, sem API key no frontend)
 */
export const gerarAnaliseIA = async (): Promise<string> => {
  try {
    const { data, error } = await supabase.functions.invoke("gerar-insights", {
      body: {},
    });

    if (error) {
      console.error("Erro na Edge Function gerar-insights:", error);
      throw new Error(error.message || "Erro ao gerar analise");
    }

    if (data?.erro) {
      throw new Error(data.erro);
    }

    return data.diagnostico;
  } catch (error) {
    console.error("Erro ao gerar analise:", error);
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
 * Busca todos os insights (historico)
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
 * Verifica se ja existe uma analise para hoje
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
