/**
 * EscalasScorecards Component
 *
 * Grid of status scorecards showing metrics by status.
 */

import React, { useMemo } from 'react';
import { Box, Card, CardContent, Typography, Chip } from '@mui/material';
import {
  Schedule,
  HourglassEmpty,
  ThumbUpAlt,
  HowToReg,
  Warning,
  CheckCircle,
  Cancel,
  AccessTime,
  DeleteForever,
} from '@mui/icons-material';
import type { ScorecardMetrics, ScorecardConfig } from '../../types/escalas.types';
import { formatCurrency } from '../../utils/escalasHoursUtils';

// ============================================
// Icon Mapping
// ============================================

const statusIconMap = {
  preAgendado: Schedule,
  programado: HourglassEmpty,
  preAprovado: ThumbUpAlt,
  aprovacaoParcial: HowToReg,
  atencao: Warning,
  aprovado: CheckCircle,
  reprovado: Cancel,
  excluida: DeleteForever,
};

// ============================================
// Props
// ============================================

export interface EscalasScorecardsProps {
  metrics: ScorecardMetrics;
  isAdminAgirCorporativo?: boolean;
  isAdminAgirPlanta?: boolean;
}

// ============================================
// Component
// ============================================

export const EscalasScorecards: React.FC<EscalasScorecardsProps> = ({
  metrics,
  isAdminAgirCorporativo = false,
  isAdminAgirPlanta = false,
}) => {
  const canSeeExcluida = isAdminAgirCorporativo || isAdminAgirPlanta;

  const scorecardConfig = useMemo<ScorecardConfig[]>(() => {
    const baseConfig: ScorecardConfig[] = [
      {
        key: 'preAgendado',
        label: 'Pré-Agendado',
        color: '#6366f1',
        bgColor: '#eef2ff',
        icon: statusIconMap.preAgendado,
        metrics: metrics.preAgendado,
      },
      {
        key: 'programado',
        label: 'Programado',
        color: '#8b5cf6',
        bgColor: '#f5f3ff',
        icon: statusIconMap.programado,
        metrics: metrics.programado,
      },
      {
        key: 'preAprovado',
        label: 'Pré-Aprovado',
        color: '#3b82f6',
        bgColor: '#eff6ff',
        icon: statusIconMap.preAprovado,
        metrics: metrics.preAprovado,
      },
      {
        key: 'aprovacaoParcial',
        label: 'Aprov. Parcial',
        color: '#06b6d4',
        bgColor: '#ecfeff',
        icon: statusIconMap.aprovacaoParcial,
        metrics: metrics.aprovacaoParcial,
      },
      {
        key: 'atencao',
        label: 'Atenção',
        color: '#f59e0b',
        bgColor: '#fffbeb',
        icon: statusIconMap.atencao,
        metrics: metrics.atencao,
      },
      {
        key: 'aprovado',
        label: 'Aprovado',
        color: '#10b981',
        bgColor: '#ecfdf5',
        icon: statusIconMap.aprovado,
        metrics: metrics.aprovado,
      },
      {
        key: 'reprovado',
        label: 'Reprovado',
        color: '#ef4444',
        bgColor: '#fef2f2',
        icon: statusIconMap.reprovado,
        metrics: metrics.reprovado,
      },
    ];

    // Add "Excluída" scorecard only for admin-agir users
    if (canSeeExcluida) {
      baseConfig.push({
        key: 'excluida',
        label: 'Excluída',
        color: '#64748b',
        bgColor: '#f1f5f9',
        icon: statusIconMap.excluida,
        metrics: metrics.excluida,
      });
    }

    return baseConfig;
  }, [metrics, canSeeExcluida]);

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(2, 1fr)',
          md: 'repeat(4, 1fr)',
        },
        gap: { xs: 2, sm: 2.5, md: 3 },
        mb: 4,
        transition: 'all 0.3s ease',
      }}
    >
      {scorecardConfig.map((card) => {
        const IconComponent = card.icon;

        return (
          <Card
            key={card.key}
            sx={{
              position: 'relative',
              overflow: 'hidden',
              borderLeft: `4px solid ${card.color}`,
              transition: 'all 0.3s',
              height: '100%',
              '&:hover': {
                boxShadow: `0 8px 24px ${card.color}26`,
                transform: 'translateY(-2px)',
              },
            }}
          >
            <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
              {/* Header Row */}
              <Box display="flex" justifyContent="space-between" alignItems="start" mb={1.5}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  {/* Label */}
                  <Typography
                    variant="caption"
                    sx={{
                      color: '#6b7280',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      fontSize: { xs: '0.65rem', sm: '0.7rem' },
                      display: 'block',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {card.label}
                  </Typography>

                  {/* Value */}
                  <Box display="flex" alignItems="baseline" gap={0.5} mt={0.5} flexWrap="wrap">
                    <Typography
                      sx={{
                        fontWeight: 700,
                        color: card.color,
                        fontSize: { xs: '1.1rem', sm: '1.25rem', md: '1.5rem' },
                        lineHeight: 1.2,
                      }}
                    >
                      R$
                    </Typography>
                    <Typography
                      sx={{
                        fontWeight: 700,
                        color: card.color,
                        fontSize: { xs: '1.1rem', sm: '1.25rem', md: '1.5rem' },
                        lineHeight: 1.2,
                      }}
                    >
                      {formatCurrency(card.metrics.valor)}
                    </Typography>
                  </Box>
                </Box>

                {/* Icon */}
                <Box
                  sx={{
                    bgcolor: card.bgColor,
                    borderRadius: '50%',
                    p: { xs: 0.75, sm: 1 },
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    ml: 1,
                  }}
                >
                  <IconComponent
                    sx={{
                      color: card.color,
                      fontSize: { xs: 22, sm: 26, md: 28 },
                    }}
                  />
                </Box>
              </Box>

              {/* Footer Row */}
              <Box display="flex" alignItems="center" justifyContent="space-between" gap={1} flexWrap="wrap">
                {/* Hours */}
                <Box display="flex" alignItems="center" gap={0.5}>
                  <AccessTime
                    sx={{
                      fontSize: { xs: 14, sm: 16 },
                      color: '#9ca3af',
                    }}
                  />
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                  >
                    {card.metrics.horas.toFixed(1)}h
                  </Typography>
                </Box>

                {/* Count Chip */}
                <Chip
                  label={`${card.metrics.count} escala${card.metrics.count !== 1 ? 's' : ''}`}
                  size="small"
                  sx={{
                    height: { xs: 20, sm: 22 },
                    fontSize: { xs: '0.65rem', sm: '0.7rem' },
                    bgcolor: `${card.color}15`,
                    color: card.color,
                    fontWeight: 600,
                    '& .MuiChip-label': {
                      px: 1,
                    },
                  }}
                />
              </Box>
            </CardContent>
          </Card>
        );
      })}
    </Box>
  );
};

export default EscalasScorecards;
