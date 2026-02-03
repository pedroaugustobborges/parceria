import { supabase } from "../lib/supabase";
import { RespostaChat } from "../types/database.types";

interface MensagemHistorico {
  role: "user" | "assistant";
  content: string;
}

/**
 * Envia pergunta para o chat-gateway (Edge Function) com roteamento inteligente
 */
export async function chatWithData(
  pergunta: string,
  _userId: string,
  historico: MensagemHistorico[] = []
): Promise<RespostaChat> {
  try {
    const { data, error } = await supabase.functions.invoke("chat-gateway", {
      body: {
        pergunta,
        historico: historico.slice(-6).map((m) => ({
          role: m.role,
          content: m.content,
        })),
      },
    });

    if (error) {
      // Tentar extrair mensagem detalhada do corpo da resposta
      let mensagemErro = error.message;
      try {
        // O contexto do erro pode estar no body quando status != 2xx
        const contexto = (error as any).context;
        if (contexto && typeof contexto.json === "function") {
          const corpo = await contexto.json();
          mensagemErro = corpo?.detalhes || corpo?.erro || corpo?.message || mensagemErro;
        }
      } catch {
        // Ignorar erro ao tentar parsear
      }
      console.error("Erro no chat-gateway:", mensagemErro, error);
      throw new Error(mensagemErro);
    }

    if (data?.erro) {
      console.error("Erro retornado pelo chat-gateway:", data.erro, data.detalhes);
      throw new Error(data.detalhes || data.erro);
    }

    return {
      resposta: data.resposta,
      rota: data.rota,
      citacoes: data.citacoes || undefined,
      sqlExecutado: data.sqlExecutado || undefined,
    };
  } catch (error: any) {
    console.error("Erro no chat:", error);
    throw new Error(
      error.message || "Erro ao processar sua pergunta. Tente novamente."
    );
  }
}
