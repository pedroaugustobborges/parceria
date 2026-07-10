import React from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Container,
  Link,
  Divider,
} from "@mui/material";
import {
  ArrowBack,
  AdminPanelSettings,
  LocalHospital,
  LockReset,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";

const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0ea5e9 0%, #8b5cf6 100%)",
        position: "relative",
        overflow: "hidden",
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(circle at 20% 50%, rgba(255,255,255,0.15) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(139,92,246,0.3) 0%, transparent 50%),
            radial-gradient(circle at 40% 80%, rgba(14,165,233,0.2) 0%, transparent 50%)
          `,
        },
      }}
    >
      <Container maxWidth="sm" sx={{ position: "relative", zIndex: 1 }}>
        <Card
          elevation={0}
          sx={{
            borderRadius: 4,
            backdropFilter: "blur(20px)",
            backgroundColor: "rgba(255,255,255,0.98)",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.4)",
            border: "1px solid rgba(255,255,255,0.3)",
          }}
        >
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            {/* Ícone e título */}
            <Box sx={{ textAlign: "center", mb: 3 }}>
              <Box
                sx={{
                  width: 72,
                  height: 72,
                  borderRadius: "50%",
                  background:
                    "linear-gradient(135deg, #0ea5e9 0%, #8b5cf6 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  mx: "auto",
                  mb: 2,
                  boxShadow: "0 8px 24px rgba(139,92,246,0.35)",
                }}
              >
                <LockReset sx={{ fontSize: 36, color: "#fff" }} />
              </Box>

              <Typography
                variant="h5"
                fontWeight={700}
                sx={{ color: "#1e293b", mb: 0.5 }}
              >
                Redefinição de Senha
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Como recuperar o acesso ao ParcerIA
              </Typography>
            </Box>

            <Divider sx={{ mb: 3 }} />

            {/* Mensagem principal */}
            <Box
              sx={{
                background: "linear-gradient(135deg, #f0f9ff 0%, #faf5ff 100%)",
                border: "1px solid",
                borderColor: "rgba(139,92,246,0.2)",
                borderRadius: 3,
                p: 3,
                mb: 3,
              }}
            >
              <Typography
                variant="body1"
                sx={{ color: "#1e293b", lineHeight: 1.7 }}
              >
                Por questões de segurança, a redefinição de senhas no ParcerIA é
                realizada exclusivamente pela equipe de gestão de escalas.
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 1.5, lineHeight: 1.7 }}
              >
                Entre em contato com a equipe de sua unidade e solicite a
                redefinição. Sua senha será restaurada para o padrão do sistema,
                permitindo que você acesse e altere-a novamente.
              </Typography>
            </Box>

            {/* Quem contatar */}
            <Typography
              variant="caption"
              fontWeight={700}
              sx={{
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Quem contatar
            </Typography>

            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 1.5,
                mt: 1.5,
                mb: 3,
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  p: 2,
                  borderRadius: 2,
                  bgcolor: "#f8fafc",
                  border: "1px solid #e2e8f0",
                }}
              >
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #0ea5e9, #0284c7)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <LocalHospital sx={{ fontSize: 20, color: "#fff" }} />
                </Box>
                <Box>
                  <Typography
                    variant="body2"
                    fontWeight={600}
                    sx={{ color: "#1e293b" }}
                  >
                    Equipe de Gestão de Escalas da Unidade Hospitalar
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Responsável pelo seu hospital (HUGOL, HECAD, CRER...)
                  </Typography>
                </Box>
              </Box>

              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  p: 2,
                  borderRadius: 2,
                  bgcolor: "#f8fafc",
                  border: "1px solid #e2e8f0",
                }}
              >
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <AdminPanelSettings sx={{ fontSize: 20, color: "#fff" }} />
                </Box>
                <Box>
                  <Typography
                    variant="body2"
                    fontWeight={600}
                    sx={{ color: "#1e293b" }}
                  >
                    Administrador Corporativo Agir
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Coordenação Corporativa de Contratos Assistenciais
                  </Typography>
                </Box>
              </Box>
            </Box>

            <Divider sx={{ mb: 2.5 }} />

            {/* Voltar */}
            <Box sx={{ textAlign: "center" }}>
              <Link
                component="button"
                variant="body2"
                onClick={() => navigate("/login")}
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.5,
                  color: "#8b5cf6",
                  textDecoration: "none",
                  fontWeight: 600,
                  "&:hover": { textDecoration: "underline" },
                }}
              >
                <ArrowBack fontSize="small" />
                Voltar para o login
              </Link>
            </Box>

            <Box sx={{ mt: 2.5, textAlign: "center" }}>
              <Typography variant="caption" color="text.secondary">
                © 2026 Todos os direitos reservados
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};

export default ForgotPassword;
