/**
 * StatusChip Component
 *
 * Reusable chip component for displaying escala status.
 */

import React from 'react';
import { Chip } from '@mui/material';
import {
  Schedule,
  HourglassEmpty,
  ThumbUpAlt,
  HowToReg,
  Warning,
  CheckCircle,
  Cancel,
} from '@mui/icons-material';
import type { StatusEscala } from '../types/escalas.types';
import { getStatusConfig, getStatusColors } from '../utils/escalasStatusUtils';

// ============================================
// Icon Mapping
// ============================================

const statusIconMap: Record<StatusEscala, React.ReactElement> = {
  'Pré-Agendado': <Schedule />,
  'Programado': <HourglassEmpty />,
  'Pré-Aprovado': <ThumbUpAlt />,
  'Aprovação Parcial': <HowToReg />,
  'Atenção': <Warning />,
  'Aprovado': <CheckCircle />,
  'Reprovado': <Cancel />,
};

// ============================================
// Props
// ============================================

export interface StatusChipProps {
  status: StatusEscala;
  size?: 'small' | 'medium';
  showIcon?: boolean;
  onClick?: () => void;
}

// ============================================
// Component
// ============================================

export const StatusChip: React.FC<StatusChipProps> = ({
  status,
  size = 'small',
  showIcon = true,
  onClick,
}) => {
  const config = getStatusConfig(status);
  const colors = getStatusColors(status);
  const icon = statusIconMap[status];

  return (
    <Chip
      label={config.label}
      size={size}
      icon={showIcon ? icon : undefined}
      onClick={onClick}
      sx={{
        bgcolor: colors.bg,
        color: colors.hex,
        border: `1px solid ${colors.hex}`,
        cursor: onClick ? 'pointer' : 'default',
        '& .MuiChip-icon': {
          color: colors.hex,
        },
        '&:hover': onClick
          ? {
              bgcolor: colors.bg,
              opacity: 0.9,
            }
          : undefined,
      }}
    />
  );
};

export default StatusChip;
