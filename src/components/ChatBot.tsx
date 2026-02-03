import React, { useState, useRef, useEffect } from "react";
import {
  Box,
  IconButton,
  Paper,
  Typography,
  TextField,
  Avatar,
  Fab,
  Zoom,
  CircularProgress,
  Chip,
  Tooltip,
  Collapse,
} from "@mui/material";
import {
  Chat,
  Close,
  Send,
  SmartToy,
  Person,
  AutoAwesome,
  Storage,
  FindInPage,
  MergeType,
  ExpandMore,
  ExpandLess,
  DeleteSweep,
} from "@mui/icons-material";
import ReactMarkdown from "react-markdown";
import { useAuth } from "../contexts/AuthContext";
import { chatWithData } from "../services/chatService";
import { RotaChat, Citacao } from "../types/database.types";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  rota?: RotaChat;
  citacoes?: Citacao[];
  sqlExecutado?: string;
}

const ChatBot: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const {
    userProfile,
    isAdminAgirCorporativo,
    isAdminAgirPlanta,
    isAdminTerceiro,
  } = useAuth();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Perguntas sugeridas baseadas no role
  const perguntasSugeridas = (() => {
    if (isAdminAgirCorporativo) {
      return [
        "Quantas escalas medicas este mes?",
        "Comparar produtividade entre unidades",
        "Resumo de contratos ativos",
      ];
    }
    if (isAdminAgirPlanta) {
      return [
        "Total de escalas aprovadas este mes",
        "Produtividade da minha unidade",
        "Contratos proximos ao vencimento",
      ];
    }
    if (isAdminTerceiro) {
      return [
        "Escalas do meu contrato este mes",
        "Quais clausulas do meu contrato?",
        "Status das escalas pendentes",
      ];
    }
    return ["Minhas escalas este mes", "Minha produtividade recente"];
  })();

  const handleToggle = () => {
    setOpen(!open);
    if (!open && messages.length === 0) {
      setMessages([
        {
          role: "assistant",
          content: `Ola! Sou o assistente inteligente da **ParcerIA**.\n\nPosso te ajudar com:\n- **Metricas e dados** (escalas, produtividade, acessos)\n- **Documentos de contrato** (clausulas, SLAs, termos)\n- **Analises combinadas** (comparar dados reais com contratos)\n\nPergunte-me qualquer coisa!`,
          timestamp: new Date(),
        },
      ]);
    }
  };

  const handleSend = async (texto?: string) => {
    const pergunta = texto || input.trim();
    if (!pergunta || loading) return;

    const userMessage: Message = {
      role: "user",
      content: pergunta,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const historico = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.content }));

      const response = await chatWithData(
        pergunta,
        userProfile?.id || "",
        historico,
      );

      const assistantMessage: Message = {
        role: "assistant",
        content: response.resposta,
        timestamp: new Date(),
        rota: response.rota,
        citacoes: response.citacoes,
        sqlExecutado: response.sqlExecutado,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      const errorMessage: Message = {
        role: "assistant",
        content: `Desculpe, ocorreu um erro: ${error.message}. Tente novamente.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleLimparConversa = () => {
    setMessages([
      {
        role: "assistant",
        content: "Conversa limpa. Como posso ajudar?",
        timestamp: new Date(),
      },
    ]);
  };

  const rotaIcon = (rota: RotaChat) => {
    switch (rota) {
      case "sql":
        return <Storage sx={{ fontSize: 14 }} />;
      case "rag":
        return <FindInPage sx={{ fontSize: 14 }} />;
      case "hibrido":
        return <MergeType sx={{ fontSize: 14 }} />;
    }
  };

  const rotaLabel = (rota?: RotaChat) => {
    switch (rota) {
      case "sql":
        return "Dados";
      case "rag":
        return "Documentos";
      case "hibrido":
        return "Hibrido";
      default:
        return null;
    }
  };

  const rotaColor = (
    rota?: RotaChat,
  ): "primary" | "secondary" | "info" | "default" => {
    switch (rota) {
      case "sql":
        return "primary";
      case "rag":
        return "secondary";
      case "hibrido":
        return "info";
      default:
        return "default";
    }
  };

  return (
    <>
      {/* Botao flutuante */}
      <Zoom in={!open}>
        <Fab
          color="primary"
          aria-label="chat"
          onClick={handleToggle}
          sx={{
            position: "fixed",
            bottom: 24,
            right: 24,
            background: "linear-gradient(135deg, #0ea5e9 0%, #8b5cf6 100%)",
            color: "white",
            "&:hover": {
              background: "linear-gradient(135deg, #0284c7 0%, #7c3aed 100%)",
              transform: "scale(1.1)",
            },
            transition: "all 0.3s ease",
            boxShadow: "0 8px 24px rgba(14, 165, 233, 0.4)",
            zIndex: 1300,
          }}
        >
          <Chat />
        </Fab>
      </Zoom>

      {/* Janela do chat */}
      <Zoom in={open}>
        <Paper
          elevation={8}
          sx={{
            position: "fixed",
            bottom: 24,
            right: 24,
            width: { xs: "calc(100vw - 48px)", sm: 420 },
            height: 650,
            borderRadius: "20px",
            display: open ? "flex" : "none",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: "0 12px 40px rgba(0, 0, 0, 0.15)",
            zIndex: 1300,
          }}
        >
          {/* Header */}
          <Box
            sx={{
              background: "linear-gradient(135deg, #0ea5e9 0%, #8b5cf6 100%)",
              color: "white",
              p: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Box display="flex" alignItems="center" gap={1.5}>
              <Avatar
                sx={{
                  background: "rgba(255, 255, 255, 0.2)",
                  backdropFilter: "blur(10px)",
                }}
              >
                <SmartToy />
              </Avatar>
              <Box>
                <Typography variant="h6" fontWeight={700}>
                  Parcer<span style={{ color: "#fbbf24" }}>IA</span> Assistente
                </Typography>
                <Box display="flex" alignItems="center" gap={0.5}>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      bgcolor: "#4ade80",
                      animation: "pulse 2s ease-in-out infinite",
                      "@keyframes pulse": {
                        "0%, 100%": { opacity: 1 },
                        "50%": { opacity: 0.5 },
                      },
                    }}
                  />
                  <Typography variant="caption" sx={{ opacity: 0.9 }}>
                    Online
                  </Typography>
                </Box>
              </Box>
            </Box>
            <Box>
              <Tooltip title="Limpar conversa">
                <IconButton
                  onClick={handleLimparConversa}
                  sx={{ color: "white", mr: 0.5 }}
                  size="small"
                >
                  <DeleteSweep fontSize="small" />
                </IconButton>
              </Tooltip>
              <IconButton onClick={handleToggle} sx={{ color: "white" }}>
                <Close />
              </IconButton>
            </Box>
          </Box>

          {/* Area de mensagens */}
          <Box
            sx={{
              flex: 1,
              overflowY: "auto",
              p: 2,
              bgcolor: "#f5f7fa",
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            {messages.map((msg, index) => (
              <Box key={index}>
                <Box
                  sx={{
                    display: "flex",
                    gap: 1,
                    alignItems: "flex-start",
                    flexDirection: msg.role === "user" ? "row-reverse" : "row",
                  }}
                >
                  <Avatar
                    sx={{
                      bgcolor:
                        msg.role === "user" ? "primary.main" : "transparent",
                      background:
                        msg.role === "assistant"
                          ? "linear-gradient(135deg, #0ea5e9 0%, #8b5cf6 100%)"
                          : undefined,
                      width: 32,
                      height: 32,
                    }}
                  >
                    {msg.role === "user" ? (
                      <Person fontSize="small" />
                    ) : (
                      <SmartToy fontSize="small" />
                    )}
                  </Avatar>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 1.5,
                      maxWidth: "80%",
                      borderRadius: "12px",
                      bgcolor: msg.role === "user" ? "#0ea5e9" : "white",
                      color: msg.role === "user" ? "white" : "text.primary",
                      border:
                        msg.role === "assistant" ? "1px solid #e5e7eb" : "none",
                    }}
                  >
                    {/* Chip de rota */}
                    {msg.rota && (
                      <Chip
                        icon={rotaIcon(msg.rota)}
                        label={rotaLabel(msg.rota)}
                        size="small"
                        color={rotaColor(msg.rota)}
                        variant="outlined"
                        sx={{
                          mb: 1,
                          height: 22,
                          fontSize: "0.65rem",
                        }}
                      />
                    )}

                    {/* Conteudo com Markdown */}
                    {msg.role === "assistant" ? (
                      <Box
                        sx={{
                          "& p": { m: 0, mb: 1 },
                          "& p:last-child": { mb: 0 },
                          "& ul, & ol": { pl: 2, m: 0, mb: 1 },
                          "& li": { mb: 0.5 },
                          "& h1, & h2, & h3": { mt: 1, mb: 0.5 },
                          "& code": {
                            bgcolor: "grey.100",
                            px: 0.5,
                            borderRadius: 0.5,
                            fontSize: "0.8rem",
                          },
                          "& pre": {
                            bgcolor: "grey.100",
                            p: 1,
                            borderRadius: 1,
                            overflow: "auto",
                          },
                          fontSize: "0.875rem",
                        }}
                      >
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </Box>
                    ) : (
                      <Typography
                        variant="body2"
                        sx={{
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }}
                      >
                        {msg.content}
                      </Typography>
                    )}

                    {/* Citacoes colapsaveis */}
                    {msg.citacoes && msg.citacoes.length > 0 && (
                      <CitacoesColapsavel citacoes={msg.citacoes} />
                    )}

                    <Typography
                      variant="caption"
                      sx={{
                        opacity: 0.7,
                        mt: 0.5,
                        display: "block",
                        fontSize: "0.65rem",
                      }}
                    >
                      {msg.timestamp.toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Typography>
                  </Paper>
                </Box>
              </Box>
            ))}

            {/* Perguntas sugeridas (quando so tem boas-vindas) */}
            {messages.length === 1 && !loading && (
              <Box display="flex" gap={0.5} flexWrap="wrap">
                {perguntasSugeridas.map((p, i) => (
                  <Chip
                    key={i}
                    label={p}
                    size="small"
                    variant="outlined"
                    onClick={() => handleSend(p)}
                    sx={{
                      fontSize: "0.7rem",
                      cursor: "pointer",
                      "&:hover": { bgcolor: "primary.50" },
                    }}
                  />
                ))}
              </Box>
            )}

            {loading && (
              <Box display="flex" gap={1} alignItems="center">
                <Avatar
                  sx={{
                    background:
                      "linear-gradient(135deg, #0ea5e9 0%, #8b5cf6 100%)",
                    width: 32,
                    height: 32,
                  }}
                >
                  <SmartToy fontSize="small" />
                </Avatar>
                <Paper
                  elevation={0}
                  sx={{
                    p: 1.5,
                    borderRadius: "12px",
                    bgcolor: "white",
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <Box display="flex" gap={0.5} alignItems="center">
                    <CircularProgress size={16} />
                    <Typography variant="body2" color="text.secondary" ml={1}>
                      Analisando dados...
                    </Typography>
                  </Box>
                </Paper>
              </Box>
            )}

            <div ref={messagesEndRef} />
          </Box>

          {/* Input */}
          <Box
            sx={{
              p: 2,
              bgcolor: "white",
              borderTop: "1px solid #e5e7eb",
            }}
          >
            <Box display="flex" gap={1} alignItems="flex-end">
              <TextField
                fullWidth
                multiline
                maxRows={3}
                placeholder="Digite sua pergunta..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={loading}
                variant="outlined"
                size="small"
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "12px",
                    bgcolor: "#f5f7fa",
                  },
                }}
              />
              <Tooltip title="Enviar (Enter)">
                <span>
                  <IconButton
                    color="primary"
                    onClick={() => handleSend()}
                    disabled={!input.trim() || loading}
                    sx={{
                      background:
                        "linear-gradient(135deg, #0ea5e9 0%, #8b5cf6 100%)",
                      color: "white",
                      "&:hover": {
                        background:
                          "linear-gradient(135deg, #0284c7 0%, #7c3aed 100%)",
                      },
                      "&.Mui-disabled": {
                        background: "#e5e7eb",
                        color: "#9ca3af",
                      },
                    }}
                  >
                    <Send fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>

            <Box display="flex" gap={0.5} mt={1} flexWrap="wrap">
              <Chip
                icon={<AutoAwesome />}
                label="Powered by OpenAI"
                size="small"
                sx={{
                  fontSize: "0.65rem",
                  height: 20,
                  bgcolor: "rgba(14, 165, 233, 0.1)",
                  color: "primary.main",
                }}
              />
            </Box>
          </Box>
        </Paper>
      </Zoom>
    </>
  );
};

// Componente de citacoes colapsavel
const CitacoesColapsavel: React.FC<{ citacoes: Citacao[] }> = ({
  citacoes,
}) => {
  const [aberto, setAberto] = useState(false);

  return (
    <Box sx={{ mt: 1 }}>
      <Chip
        label={`${citacoes.length} fonte${citacoes.length > 1 ? "s" : ""}`}
        size="small"
        icon={aberto ? <ExpandLess /> : <ExpandMore />}
        onClick={() => setAberto(!aberto)}
        sx={{
          fontSize: "0.65rem",
          height: 22,
          cursor: "pointer",
          bgcolor: "rgba(139, 92, 246, 0.1)",
          color: "secondary.main",
        }}
      />
      <Collapse in={aberto}>
        <Box
          sx={{
            mt: 0.5,
            p: 1,
            bgcolor: "grey.50",
            borderRadius: 1,
            border: "1px solid",
            borderColor: "grey.200",
          }}
        >
          {citacoes.map((c, i) => (
            <Typography
              key={i}
              variant="caption"
              display="block"
              sx={{ mb: 0.25 }}
            >
              [{i + 1}] {c.documento}
              {c.secao ? ` - ${c.secao}` : ""}
              {c.pagina ? `, p. ${c.pagina}` : ""}
            </Typography>
          ))}
        </Box>
      </Collapse>
    </Box>
  );
};

export default ChatBot;
