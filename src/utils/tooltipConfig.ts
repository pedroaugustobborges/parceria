/**
 * Configuração padrão para Tooltips do Dashboard
 * Elimina repetição de código de configuração de tooltips
 */
export const defaultTooltipProps = {
  arrow: true,
  placement: "top" as const,
  enterDelay: 200,
  leaveDelay: 0,
  componentsProps: {
    tooltip: {
      sx: {
        bgcolor: "rgba(15, 23, 42, 0.95)",
        backdropFilter: "blur(10px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 2,
        maxWidth: 320,
      },
    },
    arrow: {
      sx: {
        color: "rgba(15, 23, 42, 0.95)",
      },
    },
  },
};
