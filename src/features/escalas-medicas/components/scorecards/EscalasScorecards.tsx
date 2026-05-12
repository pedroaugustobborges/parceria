/**
 * EscalasScorecards Component
 *
 * Grid of status scorecards showing metrics by status.
 */

import React, { useMemo } from 'react';
import { Box, Card, CardContent, Typography, Chip } from '@mui/material';
import {
  HourglassEmpty,
  ThumbUpAlt,
  HowToReg,
  Warning,
  CheckCircle,
  Cancel,
  AccessTime,
  DeleteForever,
  PieChart,
  Payments,
} from '@mui/icons-material';
import type { ScorecardMetrics, ScorecardConfig } from '../../types/escalas.types';
import { formatCurrency } from '../../utils/escalasHoursUtils';

// ============================================
// Icon Mapping
// ============================================

const statusIconMap = {
  programado: HourglassEmpty,
  preAprovado: ThumbUpAlt,
  aprovacaoParcial: HowToReg,
  atencao: Warning,
  aprovado: CheckCircle,
  aprovadoComGlosa: PieChart,
  reprovado: Cancel,
  excluida: DeleteForever,
  escalasPagas: Payments,
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
      // Note: 'excluida' is rendered separately as a full-width card below
      {
        key: 'aprovado',
        label: 'Aprovado',
        color: '#10b981',
        bgColor: '#ecfdf5',
        icon: statusIconMap.aprovado,
        metrics: metrics.aprovado,
      },
      {
        key: 'aprovadoComGlosa',
        label: 'Aprov. c/ Glosa',
        color: '#d97706',
        bgColor: '#fffbeb',
        icon: statusIconMap.aprovadoComGlosa,
        metrics: metrics.aprovadoComGlosa,
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
        key: 'programado',
        label: 'Programado',
        color: '#8b5cf6',
        bgColor: '#f5f3ff',
        icon: statusIconMap.programado,
        metrics: metrics.programado,
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
      {/* Escalas Pagas */}
      <Card
        sx={{
          position: 'relative',
          overflow: 'hidden',
          borderLeft: '4px solid #10b981',
          transition: 'all 0.3s',
          height: '100%',
          '&:hover': {
            boxShadow: '0 8px 24px #10b98126',
            transform: 'translateY(-2px)',
          },
        }}
      >
        <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
          {/* Header Row */}
          <Box display="flex" justifyContent="space-between" alignItems="start" mb={1.5}>
            <Box sx={{ minWidth: 0, flex: 1 }}>
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
                Escalas Pagas
              </Typography>
              <Box display="flex" alignItems="baseline" gap={0.5} mt={0.5} flexWrap="wrap">
                <Typography
                  sx={{
                    fontWeight: 700,
                    color: '#10b981',
                    fontSize: { xs: '1.1rem', sm: '1.25rem', md: '1.5rem' },
                    lineHeight: 1.2,
                  }}
                >
                  R$
                </Typography>
                <Typography
                  sx={{
                    fontWeight: 700,
                    color: '#10b981',
                    fontSize: { xs: '1.1rem', sm: '1.25rem', md: '1.5rem' },
                    lineHeight: 1.2,
                  }}
                >
                  {formatCurrency(metrics.escalasPagas.valor)}
                </Typography>
              </Box>
            </Box>
            <Box
              sx={{
                bgcolor: '#ecfdf5',
                borderRadius: '50%',
                p: { xs: 0.75, sm: 1 },
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                ml: 1,
              }}
            >
              <Payments sx={{ color: '#10b981', fontSize: { xs: 22, sm: 26, md: 28 } }} />
            </Box>
          </Box>
          {/* Footer Row */}
          <Box display="flex" alignItems="center" justifyContent="space-between" gap={1} flexWrap="wrap">
            <Box display="flex" alignItems="center" gap={0.5}>
              <AccessTime sx={{ fontSize: { xs: 14, sm: 16 }, color: '#9ca3af' }} />
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
              >
                {metrics.escalasPagas.horas.toFixed(1)}h
              </Typography>
            </Box>
            <Chip
              label={`${metrics.escalasPagas.count} escala${metrics.escalasPagas.count !== 1 ? 's' : ''}`}
              size="small"
              sx={{
                height: { xs: 20, sm: 22 },
                fontSize: { xs: '0.65rem', sm: '0.7rem' },
                bgcolor: '#10b98115',
                color: '#10b981',
                fontWeight: 600,
                '& .MuiChip-label': { px: 1 },
              }}
            />
          </Box>
        </CardContent>
      </Card>

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

      {/* Excluída — full-width card to avoid orphaned single card on last row */}
      {canSeeExcluida && (
        <Card
          sx={{
            gridColumn: '1 / -1',
            borderLeft: '4px solid #64748b',
            transition: 'all 0.3s',
            '&:hover': {
              boxShadow: '0 4px 16px #64748b26',
              transform: 'translateY(-1px)',
            },
          }}
        >
          <CardContent sx={{ p: { xs: 2, sm: 2 }, '&:last-child': { pb: 2 } }}>
            <Box
              display="flex"
              alignItems="center"
              justifyContent="space-between"
              flexWrap="wrap"
              gap={2}
            >
              {/* Left: label + icon */}
              <Box display="flex" alignItems="center" gap={1.5}>
                <Box
                  sx={{
                    bgcolor: '#f1f5f9',
                    borderRadius: '50%',
                    p: 0.75,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <DeleteForever sx={{ color: '#64748b', fontSize: 22 }} />
                </Box>
                <Typography
                  variant="caption"
                  sx={{
                    color: '#6b7280',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    fontSize: '0.7rem',
                  }}
                >
                  Excluída
                </Typography>
              </Box>

              {/* Center: value */}
              <Box display="flex" alignItems="baseline" gap={0.5}>
                <Typography sx={{ fontWeight: 700, color: '#64748b', fontSize: '1.25rem', lineHeight: 1.2 }}>
                  R$
                </Typography>
                <Typography sx={{ fontWeight: 700, color: '#64748b', fontSize: '1.25rem', lineHeight: 1.2 }}>
                  {formatCurrency(metrics.excluida.valor)}
                </Typography>
              </Box>

              {/* Right: hours + count */}
              <Box display="flex" alignItems="center" gap={2}>
                <Box display="flex" alignItems="center" gap={0.5}>
                  <AccessTime sx={{ fontSize: 14, color: '#9ca3af' }} />
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                    {metrics.excluida.horas.toFixed(1)}h
                  </Typography>
                </Box>
                <Chip
                  label={`${metrics.excluida.count} escala${metrics.excluida.count !== 1 ? 's' : ''}`}
                  size="small"
                  sx={{
                    height: 22,
                    fontSize: '0.7rem',
                    bgcolor: '#64748b15',
                    color: '#64748b',
                    fontWeight: 600,
                    '& .MuiChip-label': { px: 1 },
                  }}
                />
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default EscalasScorecards;
