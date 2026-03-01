/**
 * DashboardScorecards Component
 *
 * Displays key metrics in card format.
 */

import React from 'react';
import { Box, Card, CardContent, Grid, Tooltip, Typography } from '@mui/material';
import { People, AccessTime, TrendingUp, LocalHospital, CalendarMonth, Warning } from '@mui/icons-material';

export interface DashboardMetrics {
  totalPessoas: number;
  totalHorasGeral: number;
  mediaHoras: string;
  produtividadeMedia: string;
  totalHorasEscaladas: number;
  diferencaHoras: number;
}

export interface DashboardScorecardsProps {
  metrics: DashboardMetrics;
}

const tooltipStyles = {
  tooltip: {
    sx: {
      bgcolor: 'rgba(15, 23, 42, 0.95)',
      backdropFilter: 'blur(10px)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 2,
      maxWidth: 320,
    },
  },
  arrow: {
    sx: {
      color: 'rgba(15, 23, 42, 0.95)',
    },
  },
};

interface ScoreCardProps {
  title: string;
  value: string | number;
  tooltipTitle: string;
  tooltipDescription: string;
  tooltipFormula: string;
  gradient: string;
  hoverShadow: string;
  icon: React.ReactNode;
}

const ScoreCard: React.FC<ScoreCardProps> = ({
  title,
  value,
  tooltipTitle,
  tooltipDescription,
  tooltipFormula,
  gradient,
  hoverShadow,
  icon,
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
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
          {tooltipFormula}
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
        height: '100%',
        background: gradient,
        cursor: 'help',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: hoverShadow,
        },
      }}
    >
      <CardContent>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: 'white',
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

export const DashboardScorecards: React.FC<DashboardScorecardsProps> = ({ metrics }) => {
  const {
    totalPessoas,
    totalHorasGeral,
    mediaHoras,
    produtividadeMedia,
    totalHorasEscaladas,
    diferencaHoras,
  } = metrics;

  return (
    <Grid container spacing={3} sx={{ mb: 4 }}>
      <Grid item xs={12} sm={6} md={4}>
        <ScoreCard
          title="Total de Pessoas"
          value={totalPessoas}
          tooltipTitle="Como é calculado?"
          tooltipDescription="Número total de pessoas que possuem cadastro no ParcerIA e que registraram pelo menos 1 entrada na unidade hospitalar."
          tooltipFormula="Aplica os filtros de Nome e Período selecionados"
          gradient="linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)"
          hoverShadow="0 12px 24px rgba(14, 165, 233, 0.4)"
          icon={<People sx={{ fontSize: 48, opacity: 0.3 }} />}
        />
      </Grid>

      <Grid item xs={12} sm={6} md={4}>
        <ScoreCard
          title="Total de Horas na Unidade"
          value={`${totalHorasGeral.toFixed(0)}h`}
          tooltipTitle="Como é calculado?"
          tooltipDescription="Soma total das horas trabalhadas por todas as pessoas. Calculado pela diferença entre a última saída e primeira entrada de cada profissional por dia."
          tooltipFormula="Fórmula: Σ (Última Saída - Primeira Entrada)"
          gradient="linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)"
          hoverShadow="0 12px 24px rgba(139, 92, 246, 0.4)"
          icon={<AccessTime sx={{ fontSize: 48, opacity: 0.3 }} />}
        />
      </Grid>

      <Grid item xs={12} sm={6} md={4}>
        <ScoreCard
          title="Média de Horas por Dia"
          value={`${mediaHoras}h`}
          tooltipTitle="Como é calculado?"
          tooltipDescription="Média de horas trabalhadas por dia, calculada dividindo o Total de Horas na Unidade pelo número total de dias com registro de acesso."
          tooltipFormula="Fórmula: Total de Horas ÷ Total de Dias com Registro"
          gradient="linear-gradient(135deg, #10b981 0%, #34d399 100%)"
          hoverShadow="0 12px 24px rgba(16, 185, 129, 0.4)"
          icon={<TrendingUp sx={{ fontSize: 48, opacity: 0.3 }} />}
        />
      </Grid>

      <Grid item xs={12} sm={6} md={4}>
        <ScoreCard
          title="Produtividade/Hora"
          value={produtividadeMedia}
          tooltipTitle="Como é calculado?"
          tooltipDescription="Indicador de eficiência médica calculado pela soma de todos os procedimentos realizados (procedimentos, pareceres, cirurgias, prescrições, evoluções, etc.) dividido pelo Total de Horas na Unidade."
          tooltipFormula="Fórmula: Total de Procedimentos ÷ Total de Horas"
          gradient="linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)"
          hoverShadow="0 12px 24px rgba(245, 158, 11, 0.4)"
          icon={<LocalHospital sx={{ fontSize: 48, opacity: 0.3 }} />}
        />
      </Grid>

      <Grid item xs={12} sm={6} md={4}>
        <ScoreCard
          title="Total Horas Escaladas"
          value={`${totalHorasEscaladas.toFixed(0)}h`}
          tooltipTitle="Como é calculado?"
          tooltipDescription="Soma de todas as horas previstas nas escalas médicas para o período selecionado. Representa a carga horária total planejada."
          tooltipFormula="Fórmula: Σ (Horário Saída - Horário Entrada) por escala"
          gradient="linear-gradient(135deg, #ec4899 0%, #f472b6 100%)"
          hoverShadow="0 12px 24px rgba(236, 72, 153, 0.4)"
          icon={<CalendarMonth sx={{ fontSize: 48, opacity: 0.3 }} />}
        />
      </Grid>

      <Grid item xs={12} sm={6} md={4}>
        <ScoreCard
          title="Diferença de Horas"
          value={`${diferencaHoras >= 0 ? '+' : ''}${diferencaHoras.toFixed(0)}h`}
          tooltipTitle="Como é calculado?"
          tooltipDescription="Diferença entre o Total de Horas na Unidade e o Total de Horas Escaladas. Valores positivos indicam horas extras, negativos indicam déficit."
          tooltipFormula="Fórmula: Total na Unidade - Total Escalado"
          gradient={
            diferencaHoras >= 0
              ? 'linear-gradient(135deg, #22c55e 0%, #4ade80 100%)'
              : 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)'
          }
          hoverShadow={
            diferencaHoras >= 0
              ? '0 12px 24px rgba(34, 197, 94, 0.4)'
              : '0 12px 24px rgba(239, 68, 68, 0.4)'
          }
          icon={<Warning sx={{ fontSize: 48, opacity: 0.3 }} />}
        />
      </Grid>
    </Grid>
  );
};

export default DashboardScorecards;
