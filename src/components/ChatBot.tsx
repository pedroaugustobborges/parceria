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
} from "@mui/material";
import {
  Chat,
  Close,
  Send,
  SmartToy,
  Person,
  AutoAwesome,
} from "@mui/icons-material";
import { useAuth } from "../contexts/AuthContext";
import { chatWithData } from "../services/chatService";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ChatBotProps {
  context?: string;
}

const ChatBot: React.FC<ChatBotProps> = ({ context }) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { userProfile } = useAuth();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleToggle = () => {
    setOpen(!open);
    if (!open && messages.length === 0) {
      // Mensagem de boas-vindas
      setMessages([
        {
          role: "assistant",
          content: `Olá! 👋 Sou o assistente inteligente da **ParcerIA**.\n\nPosso te ajudar a analisar dados de:\n- Contratos e parceiros\n- Escalas médicas\n- Produtividade\n- Acessos e registros\n\nPergunte-me qualquer coisa sobre seus dados!`,
          timestamp: new Date(),
        },
      ]);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      // Chamar serviço de chat que busca dados e consulta IA
      const response = await chatWithData(input, userProfile?.id || "");

      const assistantMessage: Message = {
        role: "assistant",
        content: response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      const errorMessage: Message = {
        role: "assistant",
        content: `Desculpe, ocorreu um erro ao processar sua pergunta: ${error.message}. Por favor, tente novamente.`,
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

  return (
    <>
      {/* Botão flutuante */}
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
            width: { xs: "calc(100vw - 48px)", sm: 400 },
            height: 600,
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
                  Parcer<span style={{ color: "#fbbf24" }}>IA</span> Assistant
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
            <IconButton onClick={handleToggle} sx={{ color: "white" }}>
              <Close />
            </IconButton>
          </Box>

          {/* Área de mensagens */}
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
              <Box
                key={index}
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
                      msg.role === "user"
                        ? "primary.main"
                        : "linear-gradient(135deg, #0ea5e9 0%, #8b5cf6 100%)",
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
                    maxWidth: "75%",
                    borderRadius: "12px",
                    bgcolor: msg.role === "user" ? "#0ea5e9" : "white",
                    color: msg.role === "user" ? "white" : "text.primary",
                    border:
                      msg.role === "assistant" ? "1px solid #e5e7eb" : "none",
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      "& strong": { fontWeight: 700 },
                    }}
                  >
                    {msg.content.split("**").map((part, i) =>
                      i % 2 === 0 ? (
                        part
                      ) : (
                        <strong key={i}>{part}</strong>
                      )
                    )}
                  </Typography>
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
            ))}

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
                    onClick={handleSend}
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
                label="Powered by DeepSeek"
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

export default ChatBot;
