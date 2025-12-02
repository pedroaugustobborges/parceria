import React, { ReactNode } from "react";
import { Card, CardContent, Box, Typography, Tooltip } from "@mui/material";
import { SvgIconComponent } from "@mui/icons-material";
import { defaultTooltipProps } from "../../utils/tooltipConfig";

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: SvgIconComponent;
  gradient: string;
  tooltipTitle: string;
  tooltipDescription: string;
  tooltipFormula?: string;
  onClick?: () => void;
}

/**
 * Componente reutilizável para cards de métricas
 * Elimina duplicação de código dos cards do Dashboard
 */
export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  icon: Icon,
  gradient,
  tooltipTitle,
  tooltipDescription,
  tooltipFormula,
  onClick,
}) => {
  return (
    <Tooltip
      {...defaultTooltipProps}
      title={
        <Box sx={{ p: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
            {tooltipTitle}
          </Typography>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            {tooltipDescription}
          </Typography>
          {tooltipFormula && (
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.7)" }}>
              💡 {tooltipFormula}
            </Typography>
          )}
        </Box>
      }
    >
      <Card
        onClick={onClick}
        sx={{
          height: "100%",
          background: gradient,
          cursor: onClick ? "pointer" : "help",
          transition: "transform 0.2s ease, box-shadow 0.2s ease",
          "&:hover": {
            transform: "translateY(-4px)",
            boxShadow: "0 12px 24px rgba(0,0,0,0.2)",
          },
        }}
      >
        <CardContent>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              color: "white",
            }}
          >
            <Box>
              <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                {title}
              </Typography>
              <Typography variant="h3" fontWeight={700}>
                {value}
              </Typography>
            </Box>
            <Icon sx={{ fontSize: 48, opacity: 0.3 }} />
          </Box>
        </CardContent>
      </Card>
    </Tooltip>
  );
};
