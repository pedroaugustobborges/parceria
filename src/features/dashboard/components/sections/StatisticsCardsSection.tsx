/**
 * StatisticsCardsSection Component
 *
 * Displays the main dashboard statistics cards.
 */

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  People,
  AccessTime,
  TrendingUp,
  LocalHospital,
  Assignment,
  CalendarMonth,
} from '@mui/icons-material';

export interface StatisticsCardsSectionProps {
  totalPessoas: number;
  totalHorasGeral: number;
  mediaHoras: string;
  produtividadeMedia: string;
  cargaHorariaContratada: number;
  cargaHorariaEscalada: number;
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  gradient: string;
  shadowColor: string;
  tooltipTitle: string;
  tooltipDescription: string;
  tooltipHint: string;
}

const tooltipStyles = {
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
};

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  gradient,
  shadowColor,
  tooltipTitle,
  tooltipDescription,
  tooltipHint,
}) => (
  <Tooltip
    title={
      <Box sx={{ p: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
          {tooltipTitle}
        </Typography>
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          {tooltipDescription}
        </Typography>
        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.7)" }}>
          {tooltipHint}
        </Typography>
      </Box>
    }
    arrow
    placement="top"
    enterDelay={200}
    leaveDelay={0}
    componentsProps={tooltipStyles}
  >
    <Card
      sx={{
        height: "100%",
        background: gradient,
        cursor: "help",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: `0 12px 24px ${shadowColor}`,
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
          {icon}
        </Box>
      </CardContent>
    </Card>
  </Tooltip>
);

export const StatisticsCardsSection: React.FC<StatisticsCardsSectionProps> = ({
  totalPessoas,
  totalHorasGeral,
  mediaHoras,
  produtividadeMedia,
  cargaHorariaContratada,
  cargaHorariaEscalada,
}) => {
  const iconStyle = { fontSize: 48, opacity: 0.3 };

  const cards: StatCardProps[] = [
    {
      title: "Total de Pessoas",
      value: totalPessoas,
      icon: <People sx={iconStyle} />,
      gradient: "linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)",
      shadowColor: "rgba(14, 165, 233, 0.4)",
      tooltipTitle: "Como é calculado?",
      tooltipDescription:
        "Número total de pessoas que possuem cadastro no ParcerIA e que registraram pelo menos 1 entrada na unidade hospitalar.",
      tooltipHint: "Aplica os filtros de Nome e Período selecionados",
    },
    {
      title: "Total de Horas na Unidade",
      value: `${totalHorasGeral.toFixed(0)}h`,
      icon: <AccessTime sx={iconStyle} />,
      gradient: "linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)",
      shadowColor: "rgba(139, 92, 246, 0.4)",
      tooltipTitle: "Como é calculado?",
      tooltipDescription:
        "Soma total das horas trabalhadas por todas as pessoas. Calculado pela diferença entre a última saída e primeira entrada de cada profissional por dia.",
      tooltipHint: "Fórmula: Σ (Última Saída - Primeira Entrada)",
    },
    {
      title: "Média de Horas por Dia",
      value: `${mediaHoras}h`,
      icon: <TrendingUp sx={iconStyle} />,
      gradient: "linear-gradient(135deg, #10b981 0%, #34d399 100%)",
      shadowColor: "rgba(16, 185, 129, 0.4)",
      tooltipTitle: "Como é calculado?",
      tooltipDescription:
        "Média de horas trabalhadas por dia, calculada dividindo o Total de Horas na Unidade pelo número total de dias com registro de acesso.",
      tooltipHint: "Fórmula: Total de Horas ÷ Total de Dias com Registro",
    },
    {
      title: "Produtividade Médica",
      value: produtividadeMedia,
      icon: <LocalHospital sx={iconStyle} />,
      gradient: "linear-gradient(135deg, #ec4899 0%, #f472b6 100%)",
      shadowColor: "rgba(236, 72, 153, 0.4)",
      tooltipTitle: "Como é calculado?",
      tooltipDescription:
        "Indicador de eficiência médica calculado pela soma de todos os procedimentos realizados (procedimentos, pareceres, cirurgias, prescrições, evoluções, etc.) dividido pelo Total de Horas na Unidade.",
      tooltipHint: "Fórmula: Total de Procedimentos ÷ Total de Horas",
    },
    {
      title: "Carga Horária Contratada",
      value: `${cargaHorariaContratada.toFixed(0)}h`,
      icon: <Assignment sx={iconStyle} />,
      gradient: "linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)",
      shadowColor: "rgba(139, 92, 246, 0.4)",
      tooltipTitle: "Como é calculado?",
      tooltipDescription:
        "Total de horas contratadas para o período e o contrato selecionados. O cálculo considera a carga horária diária do contrato proporcional aos dias dentro do período de vigência em análise.",
      tooltipHint: "Considera apenas os dias em que o contrato estava ativo no período",
    },
    {
      title: "Carga Horária Escalada",
      value: `${cargaHorariaEscalada.toFixed(0)}h`,
      icon: <CalendarMonth sx={iconStyle} />,
      gradient: "linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)",
      shadowColor: "rgba(245, 158, 11, 0.4)",
      tooltipTitle: "Como é calculado?",
      tooltipDescription:
        "Total de horas em que o profissional foi programado/escalado para trabalhar no período. Calculado pela soma das diferenças entre horário de saída e entrada de cada plantão escalado.",
      tooltipHint: "Fórmula: Σ (Horário Saída - Horário Entrada) para cada escala no período",
    },
  ];

  return (
    <Grid container spacing={3} sx={{ mb: 4 }}>
      {cards.map((card, index) => (
        <Grid item xs={12} sm={6} md={4} key={index}>
          <StatCard {...card} />
        </Grid>
      ))}
    </Grid>
  );
};

export default StatisticsCardsSection;
