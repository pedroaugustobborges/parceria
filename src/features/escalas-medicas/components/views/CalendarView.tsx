/**
 * CalendarView Component
 *
 * Weekly calendar view for displaying escalas.
 */

import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import {
  format,
  parseISO,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isToday,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { EscalaMedica } from '../../types/escalas.types';
import { statusColorMap } from '../../utils/escalasStatusUtils';

// ============================================
// Props
// ============================================

export interface CalendarViewProps {
  escalas: EscalaMedica[];
  currentWeekStart: Date;
  onEscalaClick: (escala: EscalaMedica) => void;
}

// ============================================
// Day Names
// ============================================

const DAY_NAMES = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

// ============================================
// Component
// ============================================

export const CalendarView: React.FC<CalendarViewProps> = ({
  escalas,
  currentWeekStart,
  onEscalaClick,
}) => {
  const weekDays = eachDayOfInterval({
    start: currentWeekStart,
    end: endOfWeek(currentWeekStart, { weekStartsOn: 0 }),
  });

  return (
    <Box>
      {/* Calendar Header - Days of Week */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 0,
          mb: 0,
          bgcolor: 'primary.main',
          borderRadius: '12px 12px 0 0',
          overflow: 'hidden',
        }}
      >
        {weekDays.map((day, index) => {
          const isTodayDate = isToday(day);

          return (
            <Box
              key={day.toISOString()}
              sx={{
                textAlign: 'center',
                py: 1.5,
                px: 1,
                bgcolor: isTodayDate ? 'primary.dark' : 'transparent',
                borderLeft: index > 0 ? '1px solid rgba(255,255,255,0.1)' : 'none',
              }}
            >
              <Typography variant="h5" fontWeight={700} sx={{ color: 'white' }}>
                {format(day, 'd')}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: 'rgba(255,255,255,0.8)',
                  fontWeight: 500,
                  fontSize: '0.7rem',
                }}
              >
                {DAY_NAMES[index]}
              </Typography>
            </Box>
          );
        })}
      </Box>

      {/* Calendar Body - Schedule Grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 0,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          borderTop: 'none',
          borderRadius: '0 0 12px 12px',
          overflow: 'hidden',
          minHeight: 400,
        }}
      >
        {weekDays.map((day, index) => {
          const isTodayDate = isToday(day);
          const escalasOfDay = escalas
            .filter((escala) => isSameDay(parseISO(escala.data_inicio), day))
            .sort((a, b) => a.horario_entrada.localeCompare(b.horario_entrada));

          return (
            <Box
              key={day.toISOString()}
              sx={{
                borderLeft: index > 0 ? '1px solid' : 'none',
                borderColor: 'divider',
                bgcolor: isTodayDate
                  ? (theme) =>
                      theme.palette.mode === 'dark'
                        ? 'rgba(99, 102, 241, 0.08)'
                        : 'rgba(99, 102, 241, 0.04)'
                  : 'transparent',
                minHeight: 400,
                maxHeight: 600,
                overflowY: 'auto',
                p: 0.5,
                '&::-webkit-scrollbar': {
                  width: 4,
                },
                '&::-webkit-scrollbar-thumb': {
                  bgcolor: 'divider',
                  borderRadius: 2,
                },
              }}
            >
              {escalasOfDay.length === 0 ? (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    minHeight: 100,
                    opacity: 0.3,
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    -
                  </Typography>
                </Box>
              ) : (
                escalasOfDay.map((escala) => {
                  const colors = statusColorMap[escala.status] || statusColorMap['Programado'];

                  return (
                    <Paper
                      key={escala.id}
                      elevation={0}
                      onClick={() => onEscalaClick(escala)}
                      sx={{
                        p: 1,
                        mb: 0.5,
                        cursor: 'pointer',
                        borderLeft: '3px solid',
                        borderLeftColor: colors.border,
                        bgcolor: (theme) =>
                          theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : colors.bg,
                        transition: 'all 0.2s',
                        '&:hover': {
                          bgcolor: (theme) =>
                            theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'action.hover',
                          transform: 'translateX(2px)',
                        },
                      }}
                    >
                      {/* Doctor Name */}
                      {escala.medicos.slice(0, 1).map((medico, idx) => (
                        <Typography
                          key={idx}
                          variant="caption"
                          sx={{
                            display: 'block',
                            fontWeight: 600,
                            color: colors.hex,
                            fontSize: '0.7rem',
                            lineHeight: 1.2,
                            mb: 0.25,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {medico.nome.split(' ').slice(0, 2).join(' ').toUpperCase()}
                        </Typography>
                      ))}

                      {/* Additional Doctors */}
                      {escala.medicos.length > 1 && (
                        <Typography
                          variant="caption"
                          sx={{
                            display: 'block',
                            fontSize: '0.6rem',
                            color: 'text.secondary',
                            mb: 0.25,
                          }}
                        >
                          +{escala.medicos.length - 1} médico
                          {escala.medicos.length > 2 ? 's' : ''}
                        </Typography>
                      )}

                      {/* Time */}
                      <Typography
                        variant="caption"
                        sx={{
                          display: 'block',
                          fontSize: '0.65rem',
                          color: 'text.secondary',
                        }}
                      >
                        {escala.horario_entrada.substring(0, 5)} -{' '}
                        {escala.horario_saida.substring(0, 5)}
                      </Typography>
                    </Paper>
                  );
                })
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default CalendarView;
