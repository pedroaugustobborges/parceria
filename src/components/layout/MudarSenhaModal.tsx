import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  InputAdornment,
  Alert,
  LinearProgress,
  Divider,
} from "@mui/material";
import {
  Lock,
  Visibility,
  VisibilityOff,
  CheckCircle,
  Close,
} from "@mui/icons-material";
import { supabase } from "../../lib/supabase";

interface MudarSenhaModalProps {
  open: boolean;
  onClose: () => void;
  emailUsuario: string;
  onSenhaAlterada: () => void;
}

const MudarSenhaModal: React.FC<MudarSenhaModalProps> = ({
  open,
  onClose,
  emailUsuario,
  onSenhaAlterada,
}) => {
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [mostrarSenhaAtual, setMostrarSenhaAtual] = useState(false);
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState(false);

  const validarSenha = (senha: string): string | null => {
    if (senha.length < 6) return "A senha deve ter pelo menos 6 caracteres";
    if (!/[A-Z]/.test(senha))
      return "A senha deve conter pelo menos uma letra maiúscula";
    if (!/[a-z]/.test(senha))
      return "A senha deve conter pelo menos uma letra minúscula";
    if (!/[0-9]/.test(senha))
      return "A senha deve conter pelo menos um número";
    return null;
  };

  const calcularForcaSenha = (senha: string): number => {
    let forca = 0;
    if (senha.length >= 6) forca += 25;
    if (senha.length >= 8) forca += 25;
    if (/[A-Z]/.test(senha) && /[a-z]/.test(senha)) forca += 25;
    if (/[0-9]/.test(senha)) forca += 15;
    if (/[^A-Za-z0-9]/.test(senha)) forca += 10;
    return Math.min(forca, 100);
  };

  const obterCorForca = (
    forca: number
  ): "error" | "warning" | "success" => {
    if (forca < 50) return "error";
    if (forca < 75) return "warning";
    return "success";
  };

  const obterLabelForca = (forca: number) => {
    if (forca < 50) return "Fraca";
    if (forca < 75) return "Moderada";
    return "Forte";
  };

  const handleSubmit = async () => {
    setErro("");

    if (!senhaAtual || !novaSenha || !confirmarSenha) {
      setErro("Preencha todos os campos.");
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setErro("As senhas novas não coincidem.");
      return;
    }
    const erroValidacao = validarSenha(novaSenha);
    if (erroValidacao) {
      setErro(erroValidacao);
      return;
    }
    if (senhaAtual === novaSenha) {
      setErro("A nova senha deve ser diferente da senha atual.");
      return;
    }

    setCarregando(true);
    try {
      // Verifica senha atual tentando reautenticar
      const { error: erroReauth } = await supabase.auth.signInWithPassword({
        email: emailUsuario,
        password: senhaAtual,
      });

      if (erroReauth) {
        setErro("Senha atual incorreta. Verifique e tente novamente.");
        setCarregando(false);
        return;
      }

      // Atualiza a senha e marca como alterada nos metadados
      const { error: erroAtualizacao } = await supabase.auth.updateUser({
        password: novaSenha,
        data: { senha_alterada: true },
      });

      if (erroAtualizacao) throw erroAtualizacao;

      setSucesso(true);
      onSenhaAlterada();

      setTimeout(() => {
        setSucesso(false);
        handleFechar();
      }, 2500);
    } catch (err: any) {
      setErro(err.message || "Erro ao alterar senha. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  };

  const handleFechar = () => {
    if (carregando) return;
    setSenhaAtual("");
    setNovaSenha("");
    setConfirmarSenha("");
    setErro("");
    setSucesso(false);
    onClose();
  };

  const forcaSenha = calcularForcaSenha(novaSenha);

  return (
    <Dialog
      open={open}
      onClose={sucesso ? undefined : handleFechar}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 3, overflow: "hidden" },
      }}
    >
      {/* Cabeçalho com gradiente */}
      <Box
        sx={{
          background: "linear-gradient(135deg, #0ea5e9 0%, #8b5cf6 100%)",
          pt: 3,
          pb: 2.5,
          px: 3,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 1.5,
          position: "relative",
        }}
      >
        {!sucesso && (
          <IconButton
            onClick={handleFechar}
            disabled={carregando}
            size="small"
            sx={{
              position: "absolute",
              top: 8,
              right: 8,
              color: "rgba(255,255,255,0.8)",
              "&:hover": { color: "white", bgcolor: "rgba(255,255,255,0.15)" },
            }}
          >
            <Close fontSize="small" />
          </IconButton>
        )}

        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            bgcolor: "rgba(255,255,255,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Lock sx={{ fontSize: 28, color: "white" }} />
        </Box>

        <Typography variant="h6" fontWeight={700} color="white">
          Alterar Senha
        </Typography>

        <Typography
          variant="body2"
          sx={{ color: "rgba(255,255,255,0.85)", textAlign: "center" }}
        >
          Para sua segurança, preencha todos os campos abaixo
        </Typography>
      </Box>

      <DialogContent sx={{ pt: 3, pb: 2, px: 3 }}>
        {sucesso ? (
          <Box sx={{ textAlign: "center", py: 3 }}>
            <CheckCircle
              sx={{ fontSize: 60, color: "success.main", mb: 1.5 }}
            />
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Senha alterada com sucesso!
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Sua senha foi atualizada. Use-a no próximo acesso.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            {erro && (
              <Alert severity="error" onClose={() => setErro("")}>
                {erro}
              </Alert>
            )}

            <TextField
              label="Senha atual"
              type={mostrarSenhaAtual ? "text" : "password"}
              value={senhaAtual}
              onChange={(e) => setSenhaAtual(e.target.value)}
              fullWidth
              disabled={carregando}
              autoComplete="current-password"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setMostrarSenhaAtual(!mostrarSenhaAtual)}
                      edge="end"
                      disabled={carregando}
                    >
                      {mostrarSenhaAtual ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Divider />

            <TextField
              label="Nova senha"
              type={mostrarNovaSenha ? "text" : "password"}
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              fullWidth
              disabled={carregando}
              autoComplete="new-password"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setMostrarNovaSenha(!mostrarNovaSenha)}
                      edge="end"
                      disabled={carregando}
                    >
                      {mostrarNovaSenha ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            {novaSenha && (
              <Box sx={{ mt: -1 }}>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    mb: 0.5,
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    Força da senha
                  </Typography>
                  <Typography
                    variant="caption"
                    color={`${obterCorForca(forcaSenha)}.main`}
                    fontWeight={600}
                  >
                    {obterLabelForca(forcaSenha)}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={forcaSenha}
                  color={obterCorForca(forcaSenha)}
                  sx={{ borderRadius: 4, height: 6 }}
                />
              </Box>
            )}

            <TextField
              label="Confirmar nova senha"
              type={mostrarConfirmar ? "text" : "password"}
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              fullWidth
              disabled={carregando}
              autoComplete="new-password"
              error={confirmarSenha.length > 0 && confirmarSenha !== novaSenha}
              helperText={
                confirmarSenha.length > 0 && confirmarSenha !== novaSenha
                  ? "As senhas não coincidem"
                  : ""
              }
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setMostrarConfirmar(!mostrarConfirmar)}
                      edge="end"
                      disabled={carregando}
                    >
                      {mostrarConfirmar ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Box>
        )}
      </DialogContent>

      {!sucesso && (
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button
            onClick={handleFechar}
            disabled={carregando}
            color="inherit"
            variant="outlined"
            sx={{ borderRadius: 2, minWidth: 100 }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={carregando}
            variant="contained"
            sx={{
              borderRadius: 2,
              minWidth: 140,
              background:
                "linear-gradient(135deg, #0ea5e9 0%, #8b5cf6 100%)",
              "&:hover": {
                background:
                  "linear-gradient(135deg, #0284c7 0%, #7c3aed 100%)",
              },
            }}
          >
            {carregando ? "Alterando..." : "Alterar Senha"}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};

export default MudarSenhaModal;
