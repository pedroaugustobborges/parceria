import { supabase } from "../lib/supabase";
import { RespostaChat, RotaChat, Citacao } from "../types/database.types";

interface MensagemHistorico {
  role: "user" | "assistant";
  content: string;
}

interface StreamCallbacks {
  onMetadata: (meta: { rota: RotaChat; sqlExecutado?: string }) => void;
  onToken: (token: string) => void;
  onCitacoes: (citacoes: Citacao[]) => void;
  onReplace: (conteudo: string) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}

/**
 * Envia pergunta para o chat-gateway com streaming SSE (typewriter effect)
 */
export async function chatWithDataStream(
  pergunta: string,
  _userId: string,
  historico: MensagemHistorico[] = [],
  callbacks: StreamCallbacks
): Promise<void> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      callbacks.onError(new Error("Sessao expirada. Faca login novamente."));
      return;
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const response = await fetch(
      `${supabaseUrl}/functions/v1/chat-gateway`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({
          pergunta,
          historico: historico.slice(-6).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      }
    );

    if (!response.ok) {
      let mensagemErro = `Erro ${response.status}`;
      try {
        const corpo = await response.json();
        mensagemErro = corpo?.detalhes || corpo?.erro || mensagemErro;
      } catch {
        // Ignorar erro ao parsear
      }
      callbacks.onError(new Error(mensagemErro));
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      callbacks.onError(new Error("Stream nao disponivel"));
      return;
    }

    const decoder = new TextDecoder();
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

        try {
          const evento = JSON.parse(dados);

          switch (evento.tipo) {
            case "metadata":
              callbacks.onMetadata({
                rota: evento.rota,
                sqlExecutado: evento.sqlExecutado || undefined,
              });
              break;

            case "token":
              callbacks.onToken(evento.conteudo);
              break;

            case "citacoes":
              callbacks.onCitacoes(evento.citacoes);
              break;

            case "replace":
              callbacks.onReplace(evento.conteudo);
              break;

            case "done":
              callbacks.onDone();
              break;

            case "erro":
              callbacks.onError(
                new Error(evento.mensagem || "Erro ao processar sua pergunta.")
              );
              break;
          }
        } catch {
          // Ignorar linhas nao-parseavel
        }
      }
    }

    // Processar buffer restante
    if (buffer.trim()) {
      const trimmed = buffer.trim();
      if (trimmed.startsWith("data: ")) {
        try {
          const evento = JSON.parse(trimmed.slice(6));
          if (evento.tipo === "done") {
            callbacks.onDone();
          }
        } catch {
          // Ignorar
        }
      }
    }
  } catch (error: any) {
    console.error("Erro no chat stream:", error);
    callbacks.onError(
      new Error(
        error.message || "Erro ao processar sua pergunta. Tente novamente."
      )
    );
  }
}

/**
 * Envia pergunta para o chat-gateway (Edge Function) - versao nao-streaming (fallback)
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
      let mensagemErro = error.message;
      try {
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
