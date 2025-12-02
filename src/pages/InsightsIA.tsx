import React, { useState, useEffect } from "react";
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Chip,
  Paper,
  Divider,
  IconButton,
  Tooltip,
} from "@mui/material";
import {
  Psychology,
  Refresh,
  History,
  TrendingUp,
  LocalHospital,
  Assessment,
  Close,
  CalendarToday,
  AutoAwesome,
} from "@mui/icons-material";
import ReactMarkdown from "react-markdown";
import { format, parseISO, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  gerarAnaliseIA,
  buscarInsightMaisRecente,
  buscarHistoricoInsights,
  jaTemAnaliseHoje,
} from "../services/deepseekService";
import { InsightIA } from "../types/database.types";
import ChatBot from "../components/ChatBot";

const InsightsIA: React.FC = () => {
  const [insightAtual, setInsightAtual] = useState<InsightIA | null>(null);
  const [historico, setHistorico] = useState<InsightIA[]>([]);
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");
  const [historicoOpen, setHistoricoOpen] = useState(false);
  const [insightSelecionado, setInsightSelecionado] =
    useState<InsightIA | null>(null);

  useEffect(() => {
    carregarInsights();
  }, []);

  const carregarInsights = async () => {
    try {
      setLoading(true);
      setErro("");

      // Buscar insight mais recente
      const maisRecente = await buscarInsightMaisRecente();
      setInsightAtual(maisRecente);

      // Buscar histórico
      const hist = await buscarHistoricoInsights();
      setHistorico(hist);
    } catch (error) {
      console.error("Erro ao carregar insights:", error);
      setErro("Erro ao carregar insights. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleGerarNovaAnalise = async () => {
    try {
      setGerando(true);
      setErro("");

      // Verificar se já tem análise hoje
      const temHoje = await jaTemAnaliseHoje();
      if (temHoje) {
        const confirmar = window.confirm(
          "Já existe uma análise gerada hoje. Deseja gerar uma nova análise mesmo assim? Economizar tokens é economia de custos!"
        );
        if (!confirmar) {
          setGerando(false);
          return;
        }
      }

      // Gerar nova análise
      await gerarAnaliseIA();

      // Recarregar insights
      await carregarInsights();
    } catch (error) {
      console.error("Erro ao gerar análise:", error);
      setErro(
        "Erro ao gerar análise. Verifique sua conexão e tente novamente."
      );
    } finally {
      setGerando(false);
    }
  };

  const formatarData = (dataString: string) => {
    const data = parseISO(dataString);
    const dataFormatada = format(data, "dd 'de' MMMM 'de' yyyy 'às' HH:mm", {
      locale: ptBR,
    });

    if (isToday(data)) {
      return `Hoje, ${format(data, "HH:mm")}`;
    }

    return dataFormatada;
  };

  const handleVerHistorico = () => {
    setHistoricoOpen(true);
  };

  const handleSelecionarInsightHistorico = (insight: InsightIA) => {
    setInsightSelecionado(insight);
  };

  const handleVoltarParaAtual = () => {
    setInsightSelecionado(null);
  };

  // Determinar qual insight mostrar
  const insightExibido = insightSelecionado || insightAtual;
  const estaVisualizandoHistorico = insightSelecionado !== null;

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="60vh"
        >
          <CircularProgress size={60} />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          <Box
            sx={{
              background: "linear-gradient(135deg, #0ea5e9 0%, #8b5cf6 100%)",
              borderRadius: "12px",
              p: 1.5,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Psychology sx={{ fontSize: 40, color: "white" }} />
          </Box>
          <Box>
            <Typography variant="h4" fontWeight={700} gutterBottom>
              Insights da IA - em construção!
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Análise inteligente de produtividade e gestão de contratos médicos
            </Typography>
          </Box>
        </Box>

        {/* Ações */}
        <Box display="flex" gap={2} flexWrap="wrap">
          <Button
            variant="contained"
            startIcon={
              gerando ? (
                <CircularProgress size={20} sx={{ color: "white" }} />
              ) : (
                <Refresh sx={{ color: "white" }} />
              )
            }
            onClick={handleGerarNovaAnalise}
            disabled={gerando}
            sx={{
              bgcolor: "primary.main",
              color: "white",
              "&:hover": {
                bgcolor: "primary.dark",
              },
            }}
          >
            {gerando ? "Gerando Análise..." : "Gerar Nova Análise"}
          </Button>

          <Button
            variant="outlined"
            startIcon={<History />}
            onClick={handleVerHistorico}
            disabled={historico.length === 0}
          >
            Ver Histórico ({historico.length})
          </Button>

          {estaVisualizandoHistorico && (
            <Button
              variant="outlined"
              startIcon={<TrendingUp />}
              onClick={handleVoltarParaAtual}
              color="primary"
            >
              Voltar para Atual
            </Button>
          )}
        </Box>
      </Box>

      {/* Mensagens de Erro */}
      {erro && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setErro("")}>
          {erro}
        </Alert>
      )}

      {/* Card de Insight */}
      {insightExibido ? (
        <Card
          sx={{
            mb: 3,
            background: estaVisualizandoHistorico
              ? "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)"
              : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
            borderRadius: "16px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
          }}
        >
          <CardContent sx={{ p: 4 }}>
            {/* Header do Card */}
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              mb={3}
            >
              <Box display="flex" alignItems="center" gap={2}>
                <AutoAwesome sx={{ fontSize: 32 }} />
                <Box>
                  <Typography variant="h6" fontWeight={600}>
                    {estaVisualizandoHistorico
                      ? "Análise Histórica"
                      : "Análise Atual"}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    {formatarData(insightExibido.data_analise)}
                  </Typography>
                </Box>
              </Box>

              {estaVisualizandoHistorico && (
                <Chip
                  label="Histórico"
                  icon={<History />}
                  sx={{
                    background: "rgba(255,255,255,0.2)",
                    color: "white",
                    fontWeight: 600,
                  }}
                />
              )}
            </Box>

            <Divider sx={{ borderColor: "rgba(255,255,255,0.2)", mb: 3 }} />

            {/* Conteúdo do Diagnóstico */}
            <Paper
              sx={{
                p: 3,
                borderRadius: "12px",
                bgcolor: "background.paper",
                color: "text.primary",
                maxHeight: "70vh",
                overflow: "auto",
              }}
            >
              <ReactMarkdown
                components={{
                  h1: ({ node, ...props }) => (
                    <Typography
                      variant="h4"
                      fontWeight={700}
                      gutterBottom
                      {...props}
                    />
                  ),
                  h2: ({ node, ...props }) => (
                    <Typography
                      variant="h5"
                      fontWeight={600}
                      gutterBottom
                      mt={3}
                      {...props}
                    />
                  ),
                  h3: ({ node, ...props }) => (
                    <Typography
                      variant="h6"
                      fontWeight={600}
                      gutterBottom
                      mt={2}
                      {...props}
                    />
                  ),
                  p: ({ node, ...props }) => (
                    <Typography variant="body1" paragraph {...props} />
                  ),
                  ul: ({ node, ...props }) => (
                    <Box component="ul" sx={{ pl: 3 }} {...props} />
                  ),
                  li: ({ node, ...props }) => (
                    <Typography component="li" variant="body1" {...props} />
                  ),
                  strong: ({ node, ...props }) => (
                    <Typography component="span" fontWeight={700} {...props} />
                  ),
                }}
              >
                {insightExibido.diagnostico}
              </ReactMarkdown>
            </Paper>

            {/* Footer do Card */}
            <Box display="flex" gap={2} mt={3} flexWrap="wrap">
              <Chip
                icon={<LocalHospital />}
                label="Saúde Digital"
                sx={{ background: "rgba(255,255,255,0.2)", color: "white" }}
              />
              <Chip
                icon={<Assessment />}
                label="Análise Automatizada"
                sx={{ background: "rgba(255,255,255,0.2)", color: "white" }}
              />
              <Chip
                icon={<Psychology />}
                label="Powered by Agir"
                sx={{ background: "rgba(255,255,255,0.2)", color: "white" }}
              />
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Card sx={{ textAlign: "center", p: 6 }}>
          <Psychology sx={{ fontSize: 80, color: "text.secondary", mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Nenhuma análise disponível
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Clique em "Gerar Nova Análise" para criar o primeiro insight
          </Typography>
        </Card>
      )}

      {/* Dialog de Histórico */}
      <Dialog
        open={historicoOpen}
        onClose={() => setHistoricoOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Box display="flex" alignItems="center" gap={1}>
              <History />
              <Typography variant="h6">Histórico de Análises</Typography>
            </Box>
            <IconButton onClick={() => setHistoricoOpen(false)}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {historico.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={4}>
              Nenhuma análise anterior encontrada
            </Typography>
          ) : (
            <List>
              {historico.map((insight, index) => (
                <ListItem key={insight.id} disablePadding>
                  <ListItemButton
                    onClick={() => {
                      handleSelecionarInsightHistorico(insight);
                      setHistoricoOpen(false);
                    }}
                    sx={{
                      borderRadius: "8px",
                      mb: 1,
                      "&:hover": {
                        background:
                          "linear-gradient(135deg, rgba(102,126,234,0.1) 0%, rgba(118,75,162,0.1) 100%)",
                      },
                    }}
                  >
                    <Box
                      display="flex"
                      alignItems="center"
                      gap={2}
                      width="100%"
                    >
                      <CalendarToday color="primary" />
                      <ListItemText
                        primary={formatarData(insight.data_analise)}
                        secondary={`Análise #${historico.length - index}`}
                      />
                      {isToday(parseISO(insight.data_analise)) && (
                        <Chip label="Hoje" size="small" color="primary" />
                      )}
                    </Box>
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoricoOpen(false)}>Fechar</Button>
        </DialogActions>
      </Dialog>

      {/* ChatBot */}
      <ChatBot />
    </Container>
  );
};

export default InsightsIA;
