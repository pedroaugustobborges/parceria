import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  Chip,
} from "@mui/material";
import {
  Warning,
  ErrorOutline,
  Info,
} from "@mui/icons-material";

type SeverityLevel = "warning" | "error" | "critical";

interface DeleteConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  itemName: string;
  severity?: SeverityLevel;
  isBlocked?: boolean;
  blockReason?: string;
  relatedItems?: {
    type: string;
    count: number;
    items?: string[];
  }[];
  warningMessage?: string;
  loading?: boolean;
}

const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  itemName,
  severity = "warning",
  isBlocked = false,
  blockReason,
  relatedItems = [],
  warningMessage,
  loading = false,
}) => {
  const getSeverityConfig = () => {
    switch (severity) {
      case "critical":
        return {
          icon: <ErrorOutline sx={{ fontSize: 60, color: "error.main" }} />,
          color: "error.main",
          bgGradient: "linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)",
          textColor: "error.dark",
        };
      case "error":
        return {
          icon: <Warning sx={{ fontSize: 60, color: "warning.main" }} />,
          color: "warning.main",
          bgGradient: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
          textColor: "warning.dark",
        };
      default:
        return {
          icon: <Info sx={{ fontSize: 60, color: "info.main" }} />,
          color: "info.main",
          bgGradient: "linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)",
          textColor: "info.dark",
        };
    }
  };

  const config = getSeverityConfig();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: "hidden",
        },
      }}
    >
      {/* Header com gradiente */}
      <Box
        sx={{
          background: config.bgGradient,
          pt: 3,
          pb: 2,
          px: 3,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
        }}
      >
        {config.icon}
        <DialogTitle sx={{ p: 0, textAlign: "center" }}>
          <Typography variant="h5" fontWeight={700} color={config.textColor}>
            {title}
          </Typography>
        </DialogTitle>
      </Box>

      <DialogContent sx={{ pt: 3, pb: 2 }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {/* Item being deleted */}
          <Box
            sx={{
              p: 2,
              bgcolor: "grey.50",
              borderRadius: 2,
              border: "1px solid",
              borderColor: "grey.200",
            }}
          >
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Item a ser excluído:
            </Typography>
            <Typography variant="h6" fontWeight={600} color="text.primary">
              {itemName}
            </Typography>
          </Box>

          {/* Blocked message */}
          {isBlocked && blockReason && (
            <Alert
              severity="error"
              icon={<ErrorOutline />}
              sx={{
                "& .MuiAlert-message": {
                  width: "100%",
                },
              }}
            >
              <Typography variant="body2" fontWeight={600} gutterBottom>
                Exclusão Bloqueada
              </Typography>
              <Typography variant="body2">{blockReason}</Typography>
            </Alert>
          )}

          {/* Related items warning */}
          {!isBlocked && relatedItems.length > 0 && (
            <Alert
              severity="warning"
              icon={<Warning />}
              sx={{
                "& .MuiAlert-message": {
                  width: "100%",
                },
              }}
            >
              <Typography variant="body2" fontWeight={600} gutterBottom>
                Itens Relacionados
              </Typography>
              {relatedItems.map((related, index) => (
                <Box key={index} sx={{ mt: 1 }}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      mb: 0.5,
                    }}
                  >
                    <Chip
                      label={related.count}
                      size="small"
                      color="warning"
                      sx={{ fontWeight: 600 }}
                    />
                    <Typography variant="body2">{related.type}</Typography>
                  </Box>
                  {related.items && related.items.length > 0 && (
                    <Box sx={{ ml: 4, mt: 0.5 }}>
                      {related.items.slice(0, 3).map((item, idx) => (
                        <Typography
                          key={idx}
                          variant="caption"
                          color="text.secondary"
                          display="block"
                        >
                          • {item}
                        </Typography>
                      ))}
                      {related.items.length > 3 && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          display="block"
                        >
                          ... e mais {related.items.length - 3}
                        </Typography>
                      )}
                    </Box>
                  )}
                </Box>
              ))}
            </Alert>
          )}

          {/* Warning message */}
          {!isBlocked && warningMessage && (
            <Alert severity={severity === "critical" ? "error" : "warning"}>
              <Typography variant="body2">{warningMessage}</Typography>
            </Alert>
          )}

          {/* Critical action warning */}
          {!isBlocked && severity === "critical" && (
            <Box
              sx={{
                p: 2,
                bgcolor: "error.50",
                borderRadius: 2,
                border: "2px solid",
                borderColor: "error.main",
              }}
            >
              <Typography
                variant="body2"
                fontWeight={700}
                color="error.main"
                gutterBottom
              >
                ⚠️ ATENÇÃO: Esta é uma ação IRREVERSÍVEL
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Todos os dados relacionados serão permanentemente excluídos e não
                poderão ser recuperados.
              </Typography>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions
        sx={{
          px: 3,
          pb: 3,
          gap: 1,
          justifyContent: isBlocked ? "center" : "space-between",
        }}
      >
        {isBlocked ? (
          <Button
            onClick={onClose}
            variant="contained"
            size="large"
            sx={{
              minWidth: 120,
            }}
          >
            Entendi
          </Button>
        ) : (
          <>
            <Button
              onClick={onClose}
              variant="outlined"
              size="large"
              disabled={loading}
              sx={{
                minWidth: 120,
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={onConfirm}
              variant="contained"
              color={severity === "critical" ? "error" : "warning"}
              size="large"
              disabled={loading}
              sx={{
                minWidth: 120,
                fontWeight: 600,
              }}
            >
              {loading ? "Excluindo..." : "Sim, Excluir"}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default DeleteConfirmDialog;
