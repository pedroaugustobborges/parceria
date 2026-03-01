/**
 * CardView Component
 *
 * Card-based view for displaying escalas.
 */

import React from 'react';
import { Box, Card, CardContent, Chip, Grid, Typography } from '@mui/material';
import { AccessTime, Person } from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { EscalaMedica } from '../../types/escalas.types';
import { statusColorMap } from '../../utils/escalasStatusUtils';

// ============================================
// Props
// ============================================

export interface CardViewProps {
  escalas: EscalaMedica[];
  onEscalaClick: (escala: EscalaMedica) => void;
}

// ============================================
// Component
// ============================================

export const CardView: React.FC<CardViewProps> = ({ escalas, onEscalaClick }) => {
  if (escalas.length === 0) {
    return (
      <Box
        sx={{
          textAlign: 'center',
          py: 8,
          px: 4,
          bgcolor: 'background.paper',
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography variant="h6" color="text.secondary">
          Nenhuma escala encontrada
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Ajuste os filtros para visualizar as escalas.
        </Typography>
      </Box>
    );
  }

  return (
    <Grid container spacing={2}>
      {escalas.map((escala) => {
        const colors = statusColorMap[escala.status] || statusColorMap['Programado'];

        return (
          <Grid item xs={12} sm={6} md={4} lg={3} key={escala.id}>
            <Card
              onClick={() => onEscalaClick(escala)}
              sx={{
                cursor: 'pointer',
                height: '100%',
                borderLeft: '4px solid',
                borderLeftColor: colors.border,
                transition: 'all 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 4,
                },
              }}
            >
              <CardContent>
                {/* Status Chip */}
                <Box sx={{ mb: 2 }}>
                  <Chip
                    label={escala.status}
                    size="small"
                    sx={{
                      bgcolor: colors.bg,
                      color: colors.hex,
                      fontWeight: 600,
                      fontSize: '0.7rem',
                    }}
                  />
                </Box>

                {/* Date */}
                <Typography
                  variant="subtitle2"
                  fontWeight={700}
                  sx={{ mb: 1, textTransform: 'capitalize' }}
                >
                  {format(parseISO(escala.data_inicio), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </Typography>

                {/* Time */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <AccessTime sx={{ fontSize: 16, color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">
                    {escala.horario_entrada.substring(0, 5)} - {escala.horario_saida.substring(0, 5)}
                  </Typography>
                </Box>

                {/* Doctors */}
                <Box>
                  {escala.medicos.slice(0, 2).map((medico, idx) => (
                    <Box
                      key={idx}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        mb: 0.5,
                      }}
                    >
                      <Person sx={{ fontSize: 16, color: 'primary.main' }} />
                      <Typography
                        variant="body2"
                        fontWeight={500}
                        sx={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {medico.nome}
                      </Typography>
                    </Box>
                  ))}
                  {escala.medicos.length > 2 && (
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 3 }}>
                      +{escala.medicos.length - 2} médico{escala.medicos.length > 3 ? 's' : ''}
                    </Typography>
                  )}
                </Box>

                {/* Observations */}
                {escala.observacoes && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      display: 'block',
                      mt: 2,
                      fontStyle: 'italic',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {escala.observacoes}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        );
      })}
    </Grid>
  );
};

export default CardView;
