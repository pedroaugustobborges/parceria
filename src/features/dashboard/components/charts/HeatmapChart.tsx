/**
 * HeatmapChart Component
 *
 * Displays access patterns by hour and day of week.
 */

import React, { useMemo } from 'react';
import { Box, Card, CardContent, Tooltip, Typography } from '@mui/material';
import { parseISO } from 'date-fns';
import type { Acesso, Usuario, Contrato } from '../../types/dashboard.types';

export interface HeatmapChartProps {
  acessos: Acesso[];
  usuarios: Usuario[];
  filtroTipo: string[];
  filtroMatricula: string[];
  filtroNome: string[];
  filtroCpf: string[];
  filtroEspecialidade: string[];
  filtroUnidade: string[];
  filtroDataInicio: Date | null;
  filtroDataFim: Date | null;
  cpfsDoContratoFiltrado: string[];
}

interface HeatmapCell {
  horario: string;
  count: number;
  intensity: number;
}

interface HeatmapRow {
  dia: string;
  valores: HeatmapCell[];
}

/**
 * Get heatmap color based on intensity
 */
function getHeatmapColor(intensity: number): string {
  if (intensity === 0) return '#f0f9ff';
  if (intensity < 0.2) return '#e0f2fe';
  if (intensity < 0.4) return '#bae6fd';
  if (intensity < 0.6) return '#7dd3fc';
  if (intensity < 0.8) return '#38bdf8';
  return '#0284c7';
}

export const HeatmapChart: React.FC<HeatmapChartProps> = ({
  acessos,
  usuarios,
  filtroTipo,
  filtroMatricula,
  filtroNome,
  filtroCpf,
  filtroEspecialidade,
  filtroUnidade,
  filtroDataInicio,
  filtroDataFim,
  cpfsDoContratoFiltrado,
}) => {
  const heatmapData = useMemo((): HeatmapRow[] => {
    // Filter accesses
    const acessosFiltrados = acessos.filter((acesso) => {
      if (filtroTipo.length > 0 && !filtroTipo.includes(acesso.tipo)) return false;
      if (filtroMatricula.length > 0 && !filtroMatricula.includes(acesso.matricula))
        return false;
      if (filtroNome.length > 0 && !filtroNome.includes(acesso.nome)) return false;
      if (filtroCpf.length > 0 && !filtroCpf.includes(acesso.cpf)) return false;
      if (filtroEspecialidade.length > 0) {
        const usuario = usuarios.find((u) => u.cpf === acesso.cpf);
        if (
          !usuario ||
          !usuario.especialidade ||
          !usuario.especialidade.some((esp: string) => filtroEspecialidade.includes(esp))
        )
          return false;
      }
      if (filtroUnidade.length > 0 && !filtroUnidade.includes(acesso.planta)) return false;
      if (cpfsDoContratoFiltrado.length > 0 && !cpfsDoContratoFiltrado.includes(acesso.cpf))
        return false;
      if (filtroDataInicio) {
        const dataAcesso = new Date(acesso.data_acesso);
        dataAcesso.setHours(0, 0, 0, 0);
        const inicioNormalizado = new Date(filtroDataInicio);
        inicioNormalizado.setHours(0, 0, 0, 0);
        if (dataAcesso < inicioNormalizado) return false;
      }
      if (filtroDataFim) {
        const dataAcesso = new Date(acesso.data_acesso);
        dataAcesso.setHours(0, 0, 0, 0);
        const fimNormalizado = new Date(filtroDataFim);
        fimNormalizado.setHours(0, 0, 0, 0);
        if (dataAcesso > fimNormalizado) return false;
      }
      return true;
    });

    const diasSemana = [
      'Segunda-feira',
      'Terça-feira',
      'Quarta-feira',
      'Quinta-feira',
      'Sexta-feira',
      'Sábado',
      'Domingo',
    ];

    const horarios = [
      '00:00', '01:00', '02:00', '03:00', '04:00', '05:00',
      '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
      '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
      '18:00', '19:00', '20:00', '21:00', '22:00', '23:00',
    ];

    // Matrix to count accesses
    const matriz: number[][] = diasSemana.map(() => horarios.map(() => 0));

    // Count accesses by day of week and hour
    acessosFiltrados.forEach((acesso) => {
      const data = parseISO(acesso.data_acesso);
      const diaSemana = data.getDay();
      const hora = data.getHours();

      // Adjust day index (Monday=0, Sunday=6)
      const diaIndex = diaSemana === 0 ? 6 : diaSemana - 1;
      const horaIndex = hora;

      if (diaIndex >= 0 && diaIndex < 7 && horaIndex >= 0 && horaIndex < 24) {
        matriz[diaIndex][horaIndex]++;
      }
    });

    // Find max value for normalization
    const maxValue = Math.max(...matriz.flat());

    // Transform to render format
    return diasSemana.map((dia, diaIndex) => ({
      dia,
      valores: horarios.map((horario, horaIndex) => ({
        horario,
        count: matriz[diaIndex][horaIndex],
        intensity: maxValue > 0 ? matriz[diaIndex][horaIndex] / maxValue : 0,
      })),
    }));
  }, [
    acessos,
    filtroTipo,
    filtroMatricula,
    filtroNome,
    filtroCpf,
    filtroEspecialidade,
    filtroUnidade,
    filtroDataInicio,
    filtroDataFim,
    cpfsDoContratoFiltrado,
    usuarios,
  ]);

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" fontWeight={600} gutterBottom>
          Horário de Registros da Facial na Catraca
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Análise de densidade de acessos por período
        </Typography>

        {/* Heatmap Grid */}
        <Box sx={{ overflowX: 'auto', pb: 2 }}>
          <Box
            sx={{
              minWidth: 1200,
              display: 'flex',
              flexDirection: 'column',
              gap: 0.5,
            }}
          >
            {/* Header with hours */}
            <Box sx={{ display: 'flex', gap: 0.5, mb: 1 }}>
              <Box
                sx={{
                  width: 120,
                  minWidth: 120,
                  fontSize: 11,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  pl: 1,
                }}
              >
                Dia da Semana
              </Box>
              {heatmapData[0]?.valores.map((v, idx) => (
                <Box
                  key={idx}
                  sx={{
                    flex: 1,
                    minWidth: 30,
                    fontSize: 9,
                    fontWeight: 600,
                    textAlign: 'center',
                    color: 'text.secondary',
                  }}
                >
                  {v.horario.split(':')[0]}h
                </Box>
              ))}
            </Box>

            {/* Heatmap rows */}
            {heatmapData.map((row, rowIdx) => (
              <Box key={rowIdx} sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                <Box
                  sx={{
                    width: 120,
                    minWidth: 120,
                    fontSize: 12,
                    fontWeight: 500,
                    pl: 1,
                  }}
                >
                  {row.dia}
                </Box>
                {row.valores.map((cell, cellIdx) => (
                  <Tooltip
                    key={cellIdx}
                    title={`${row.dia} - ${cell.horario}: ${cell.count} acessos`}
                    arrow
                  >
                    <Box
                      sx={{
                        flex: 1,
                        minWidth: 30,
                        height: 32,
                        backgroundColor: getHeatmapColor(cell.intensity),
                        borderRadius: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 9,
                        fontWeight: 600,
                        color: cell.intensity > 0.5 ? 'white' : 'text.primary',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        '&:hover': {
                          transform: 'scale(1.05)',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                          zIndex: 1,
                        },
                      }}
                    >
                      {cell.count > 0 ? cell.count : ''}
                    </Box>
                  </Tooltip>
                ))}
              </Box>
            ))}
          </Box>
        </Box>

        {/* Legend */}
        <Box sx={{ mt: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="caption" fontWeight={600}>
            Legenda:
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 20,
                height: 20,
                backgroundColor: '#f0f9ff',
                borderRadius: 0.5,
                border: '1px solid #e0e0e0',
              }}
            />
            <Typography variant="caption">Baixo</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 20,
                height: 20,
                backgroundColor: '#7dd3fc',
                borderRadius: 0.5,
              }}
            />
            <Typography variant="caption">Médio</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 20,
                height: 20,
                backgroundColor: '#0284c7',
                borderRadius: 0.5,
              }}
            />
            <Typography variant="caption">Alto</Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default HeatmapChart;
