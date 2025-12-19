import React, { useState, useRef, useEffect } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
  Alert,
  Container,
  InputAdornment,
  IconButton,
  alpha,
  Divider,
  Chip,
  Link,
} from "@mui/material";
import {
  Visibility,
  VisibilityOff,
  Email,
  Lock,
  Handshake,
  HealthAndSafety,
  AutoAwesome,
  Diversity3,
} from "@mui/icons-material";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { signIn, user, userProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const isSubmitting = useRef(false);

  // Auto-redirect when user is authenticated and profile is loaded
  useEffect(() => {
    if (user && userProfile && !authLoading) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, userProfile, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Guard against double submission
    if (isSubmitting.current) {
      return;
    }

    isSubmitting.current = true;
    setError("");
    setSubmitting(true);

    try {
      await signIn(email, password);
      // Navigation will happen automatically via useEffect when userProfile loads
    } catch (err: any) {
      setError(
        err.message || "Erro ao fazer login. Verifique suas credenciais."
      );
      isSubmitting.current = false;
      setSubmitting(false);
    }
  };

  return (
    <Box
      className="min-h-screen flex items-center justify-center"
      sx={{
        background: "linear-gradient(135deg, #0ea5e9 0%, #8b5cf6 100%)",
        position: "relative",
        overflow: "hidden",
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `
            radial-gradient(circle at 20% 50%, rgba(255, 255, 255, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(139, 92, 246, 0.3) 0%, transparent 50%),
            radial-gradient(circle at 40% 80%, rgba(14, 165, 233, 0.2) 0%, transparent 50%)
          `,
        },
        "&::after": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `
            repeating-linear-gradient(
              45deg,
              rgba(255, 255, 255, 0.03) 0px,
              rgba(255, 255, 255, 0.03) 2px,
              transparent 2px,
              transparent 4px
            )
          `,
        },
      }}
    >
      <Container maxWidth="lg" sx={{ position: "relative", zIndex: 1 }}>
        <Box
          sx={{
            display: "flex",
            gap: 4,
            alignItems: "center",
            flexDirection: { xs: "column", md: "row" },
          }}
        >
          {/* Left Panel - Branding & Features */}
          <Box
            sx={{
              flex: 1,
              display: { xs: "none", md: "flex" },
              flexDirection: "column",
              gap: 4,
              color: "white",
            }}
          >
            <Box sx={{ textAlign: "center" }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                  mb: 2,
                }}
              >
                <Handshake sx={{ fontSize: 72, color: "#fff" }} />
                <Typography
                  variant="h1"
                  fontWeight={900}
                  sx={{ letterSpacing: -2, fontSize: "4rem" }}
                >
                  Parcer
                  <span style={{ fontWeight: 900, color: "#fbbf24" }}>IA</span>
                </Typography>
              </Box>
              <Typography
                variant="h6"
                sx={{ opacity: 0.95, fontWeight: 400, mb: 4, lineHeight: 1.4 }}
              >
                Plataforma Inteligente de Gestão
                <br />
                de Acessos e Parcerias
              </Typography>
            </Box>

            <Divider sx={{ borderColor: "rgba(255, 255, 255, 0.2)" }} />

            {/* Feature Cards */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <Box
                sx={{
                  display: "flex",
                  gap: 2,
                  p: 3,
                  borderRadius: 3,
                  backgroundColor: "rgba(255, 255, 255, 0.15)",
                  backdropFilter: "blur(10px)",
                  border: "1px solid rgba(255, 255, 255, 0.25)",
                }}
              >
                <HealthAndSafety
                  sx={{
                    fontSize: 40,
                    color: "#34d399",
                    filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
                  }}
                />
                <Box>
                  <Typography variant="h6" fontWeight={700} gutterBottom>
                    Saúde & Segurança
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.95 }}>
                    Controle total de acessos em ambientes hospitalares com
                    tecnologia de reconhecimento facial
                  </Typography>
                </Box>
              </Box>

              <Box
                sx={{
                  display: "flex",
                  gap: 2,
                  p: 3,
                  borderRadius: 3,
                  backgroundColor: "rgba(255, 255, 255, 0.15)",
                  backdropFilter: "blur(10px)",
                  border: "1px solid rgba(255, 255, 255, 0.25)",
                }}
              >
                <AutoAwesome
                  sx={{
                    fontSize: 40,
                    color: "#fcd34d",
                    filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
                  }}
                />
                <Box>
                  <Typography variant="h6" fontWeight={700} gutterBottom>
                    Inteligência Artificial
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.95 }}>
                    Análise automatizada de horas trabalhadas e relatórios
                    inteligentes em tempo real
                  </Typography>
                </Box>
              </Box>

              <Box
                sx={{
                  display: "flex",
                  gap: 2,
                  p: 3,
                  borderRadius: 3,
                  backgroundColor: "rgba(255, 255, 255, 0.15)",
                  backdropFilter: "blur(10px)",
                  border: "1px solid rgba(255, 255, 255, 0.25)",
                }}
              >
                <Diversity3
                  sx={{
                    fontSize: 40,
                    color: "#22d3ee",
                    filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
                  }}
                />
                <Box>
                  <Typography variant="h6" fontWeight={700} gutterBottom>
                    Gestão de Parcerias
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.95 }}>
                    Administração eficiente de contratos e equipes terceirizadas
                    com transparência total
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>

          {/* Right Panel - Login Form */}
          <Box
            sx={{
              flex: { xs: "1 1 100%", md: "0 0 440px" },
              display: "flex",
              flexDirection: "column",
              gap: 3,
            }}
          >
            <Card
              elevation={0}
              sx={{
                borderRadius: 4,
                overflow: "hidden",
                backdropFilter: "blur(20px)",
                backgroundColor: "rgba(255, 255, 255, 0.98)",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4)",
                border: "1px solid rgba(255, 255, 255, 0.3)",
              }}
            >
              {/* Mobile Logo */}
              <Box
                sx={{
                  display: { xs: "flex", md: "none" },
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 1.5,
                  p: 3,
                  background:
                    "linear-gradient(135deg, #0ea5e9 0%, #8b5cf6 100%)",
                  color: "white",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <Handshake sx={{ fontSize: 42 }} />
                  <Typography
                    variant="h3"
                    fontWeight={900}
                    sx={{ letterSpacing: -1 }}
                  >
                    Parcer
                    <span style={{ fontWeight: 900, color: "#fbbf24" }}>
                      IA
                    </span>
                  </Typography>
                </Box>
              </Box>

              <CardContent sx={{ p: 4 }}>
                <Box sx={{ mb: 4, textAlign: "center" }}>
                  <Typography
                    variant="h5"
                    fontWeight={700}
                    gutterBottom
                    sx={{ color: "#1e293b" }}
                  >
                    Bem-vindo de volta!
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Faça login para acessar o sistema
                  </Typography>
                </Box>

                {error && (
                  <Alert
                    severity="error"
                    sx={{
                      mb: 3,
                      borderRadius: 2,
                      border: "1px solid",
                      borderColor: "error.light",
                    }}
                  >
                    {error}
                  </Alert>
                )}

                <form onSubmit={handleSubmit}>
                  <TextField
                    fullWidth
                    label="Email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    margin="normal"
                    required
                    autoComplete="email"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Email sx={{ color: "#0ea5e9" }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      mb: 2,
                      "& .MuiOutlinedInput-root": {
                        "&:hover fieldset": {
                          borderColor: "#0ea5e9",
                        },
                        "&.Mui-focused fieldset": {
                          borderColor: "#8b5cf6",
                        },
                      },
                    }}
                  />

                  <TextField
                    fullWidth
                    label="Senha"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    margin="normal"
                    required
                    autoComplete="current-password"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Lock sx={{ color: "#8b5cf6" }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label="toggle password visibility"
                            onClick={() => setShowPassword(!showPassword)}
                            edge="end"
                            sx={{ color: "#64748b" }}
                          >
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      mb: 4,
                      "& .MuiOutlinedInput-root": {
                        "&:hover fieldset": {
                          borderColor: "#8b5cf6",
                        },
                        "&.Mui-focused fieldset": {
                          borderColor: "#0ea5e9",
                        },
                      },
                    }}
                  />

                  <Button
                    fullWidth
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={submitting || authLoading}
                    sx={{
                      py: 1.8,
                      fontSize: "1rem",
                      fontWeight: 600,
                      borderRadius: 2,
                      textTransform: "none",

                      // 1. Força a cor branca no estado normal
                      color: "#ffffff",

                      background:
                        "linear-gradient(135deg, #0ea5e9 0%, #8b5cf6 100%)",
                      boxShadow: "0 4px 14px 0 rgba(139, 92, 246, 0.4)",

                      // Impede cliques mas mantém o cursor correto
                      pointerEvents:
                        submitting || authLoading ? "none" : "auto",

                      // 2. Override essencial para manter o texto branco quando "Entrando..."
                      "&.Mui-disabled": {
                        background:
                          "linear-gradient(135deg, #0ea5e9 0%, #8b5cf6 100%)",
                        color: "rgba(255, 255, 255, 0.8)", // Branco levemente transparente para indicar processamento
                        opacity: 0.9, // Dá um feedback visual de que está desativado
                      },

                      "&:hover": {
                        background:
                          "linear-gradient(135deg, #0284c7 0%, #7c3aed 100%)",
                        boxShadow: "0 6px 20px 0 rgba(139, 92, 246, 0.5)",
                        transform: "translateY(-2px)",
                        color: "#ffffff", // Garante o branco no hover também
                      },
                      transition: "all 0.3s ease",
                    }}
                  >
                    {submitting || authLoading
                      ? "Entrando..."
                      : "Entrar no Sistema"}
                  </Button>
                </form>

                <Box sx={{ mt: 2, textAlign: "center" }}>
                  <Link
                    component="button"
                    variant="body2"
                    onClick={() => navigate("/forgot-password")}
                    sx={{
                      color: "primary.main",
                      textDecoration: "none",
                      fontWeight: 600,
                      "&:hover": {
                        textDecoration: "underline",
                      },
                    }}
                  >
                    Esqueceu sua senha?
                  </Link>
                </Box>

                <Divider sx={{ my: 3 }}>
                  <Chip
                    label="Seguro e Confiável"
                    size="small"
                    sx={{
                      backgroundColor: alpha("#0ea5e9", 0.15),
                      color: "#0284c7",
                      fontWeight: 700,
                      border: `1px solid ${alpha("#0ea5e9", 0.3)}`,
                    }}
                  />
                </Divider>

                <Box sx={{ textAlign: "center" }}>
                  <Typography variant="caption" color="text.secondary">
                    © 2025 Todos os direitos reservados
                  </Typography>
                </Box>
              </CardContent>
            </Card>

            {/* Agir Branding Below Card */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 1,
                px: 2,
              }}
            >
              <Typography
                variant="body2"
                sx={{ color: "rgba(255, 255, 255, 0.7)", fontWeight: 500 }}
              >
                Powered by
              </Typography>
              <img
                src="/logodaagir.png"
                alt="Logo Agir Saúde"
                style={{
                  maxWidth: "100px",
                  height: "auto",
                  filter: "brightness(0) invert(1)",
                  opacity: 0.8,
                }}
              />
            </Box>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default Login;
