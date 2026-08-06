/**
 * ProductivityBarChart Component
 *
 * Displays medical productivity distribution by activity type.
 */

import React, { useMemo } from 'react';
import { Box, Card, CardContent, Typography, useTheme } from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { Produtividade, Usuario, UnidadeHospitalar } from '../../types/dashboard.types';

export interface ProductivityBarChartProps {
  produtividade: Produtividade[];
  usuarios: Usuario[];
  unidades: UnidadeHospitalar[];
  filtroNome: string[];
  filtroUnidade: string[];
  filtroDataInicio: Date | null;
  filtroDataFim: Date | null;
  cpfsDoContratoFiltrado: string[];
}

interface ChartDataItem {
  name: string;
  value: number;
  color: string;
}

export const ProductivityBarChart: React.FC<ProductivityBarChartProps> = ({
  produtividade,
  usuarios,
  unidades,
  filtroNome,
  filtroUnidade,
  filtroDataInicio,
  filtroDataFim,
  cpfsDoContratoFiltrado,
}) => {
  const theme = useTheme();

  const chartData = useMemo((): ChartDataItem[] => {
    if (produtividade.length === 0) return [];

    // Map codigo_mv to CPF for contract filter
    const codigoMVToCPF = new Map<string, string>();
    usuarios.forEach((u) => {
      if (u.cpf && u.codigomv) {
        codigoMVToCPF.set(u.codigomv, u.cpf);
      }
    });

    // Filter productivity data based on advanced filters
    const produtividadeFiltrada = produtividade.filter((item) => {
      // Name filter
      if (filtroNome.length > 0 && !filtroNome.includes(item.nome))
        return false;

      // Hospital unit filter — now uses nm_unidade directly
      if (filtroUnidade.length > 0) {
        if (!item.nm_unidade || !filtroUnidade.includes(item.nm_unidade))
          return false;
      }

      // Contract filter (through codigo_mv -> cpf)
      if (cpfsDoContratoFiltrado.length > 0) {
        const cpf = codigoMVToCPF.get(item.codigo_mv);
        if (!cpf || !cpfsDoContratoFiltrado.includes(cpf)) return false;
      }

      // Date filters
      if (filtroDataInicio && item.data) {
        const [year, month, day] = item.data.split('T')[0].split('-').map(Number);
        const dataProd = new Date(year, month - 1, day);
        const inicio = new Date(filtroDataInicio);
        inicio.setHours(0, 0, 0, 0);
        if (dataProd < inicio) return false;
      }
      if (filtroDataFim && item.data) {
        const [year, month, day] = item.data.split('T')[0].split('-').map(Number);
        const dataProd = new Date(year, month - 1, day);
        const fim = new Date(filtroDataFim);
        fim.setHours(0, 0, 0, 0);
        if (dataProd > fim) return false;
      }

      return true;
    });

    const totais = {
      prescricao:           0,
      diagnostico:          0,
      encaminhamento:       0,
      parecer:              0,
      anotacao:             0,
      avaliacao:            0,
      documento_eletronico: 0,
      evolucao:             0,
      alta_medica:          0,
    };

    produtividadeFiltrada.forEach((item) => {
      totais.prescricao           += item.prescricao           || 0;
      totais.diagnostico          += item.diagnostico          || 0;
      totais.encaminhamento       += item.encaminhamento       || 0;
      totais.parecer              += item.parecer              || 0;
      totais.anotacao             += item.anotacao             || 0;
      totais.avaliacao            += item.avaliacao            || 0;
      totais.documento_eletronico += item.documento_eletronico || 0;
      totais.evolucao             += item.evolucao             || 0;
      totais.alta_medica          += item.alta_medica          || 0;
    });

    const data: ChartDataItem[] = [
      { name: 'Prescrição',           value: totais.prescricao,           color: '#ec4899' },
      { name: 'Diagnóstico',          value: totais.diagnostico,          color: '#0ea5e9' },
      { name: 'Encaminhamento',       value: totais.encaminhamento,       color: '#f97316' },
      { name: 'Parecer',              value: totais.parecer,              color: '#8b5cf6' },
      { name: 'Anotação',             value: totais.anotacao,             color: '#14b8a6' },
      { name: 'Avaliação',            value: totais.avaliacao,            color: '#f59e0b' },
      { name: 'Documento Eletrônico', value: totais.documento_eletronico, color: '#6366f1' },
      { name: 'Evolução',             value: totais.evolucao,             color: '#06b6d4' },
      { name: 'Alta Médica',          value: totais.alta_medica,          color: '#10b981' },
    ]
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);

    return data;
  }, [
    produtividade,
    filtroNome,
    filtroUnidade,
    filtroDataInicio,
    filtroDataFim,
    unidades,
    cpfsDoContratoFiltrado,
    usuarios,
  ]);

  const hasActiveFilters =
    filtroNome.length > 0 || filtroDataInicio || filtroDataFim;

  if (chartData.length === 0) {
    return null;
  }

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" fontWeight={600} gutterBottom>
          Produtividade Médica - Distribuição de Atividades
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: 1 }}
        >
          Total acumulado de cada tipo de atividade registrada
        </Typography>
        {hasActiveFilters && (
          <Typography
            variant="caption"
            sx={{
              display: "block",
              mb: 2,
              color: "primary.main",
              fontStyle: "italic",
            }}
          >
            ℹ️ Gráfico filtrado pelos filtros avançados (Nome e/ou Data)
          </Typography>
        )}
        <ResponsiveContainer width="100%" height={400}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={theme.palette.mode === 'dark' ? '#334155' : '#e0e0e0'}
            />
            <XAxis
              type="number"
              tick={{ fill: theme.palette.mode === 'dark' ? '#94a3b8' : '#64748b' }}
              axisLine={{ stroke: theme.palette.mode === 'dark' ? '#475569' : '#cbd5e1' }}
            />
            <YAxis
              dataKey="name"
              type="category"
              width={180}
              style={{ fontSize: 12 }}
              tick={{ fill: theme.palette.mode === 'dark' ? '#94a3b8' : '#64748b' }}
              axisLine={{ stroke: theme.palette.mode === 'dark' ? '#475569' : '#cbd5e1' }}
            />
            <RechartsTooltip
              contentStyle={{
                backgroundColor: theme.palette.mode === 'dark'
                  ? 'rgba(30, 41, 59, 0.98)'
                  : 'rgba(255, 255, 255, 0.95)',
                border: theme.palette.mode === 'dark'
                  ? '1px solid #475569'
                  : '1px solid #e0e0e0',
                borderRadius: 8,
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              }}
              labelStyle={{
                color: theme.palette.mode === 'dark' ? '#f1f5f9' : '#1e293b',
              }}
              itemStyle={{
                color: theme.palette.mode === 'dark' ? '#e2e8f0' : '#334155',
              }}
              formatter={(value: number) => [value, "Total"]}
            />
            <Bar dataKey="value" radius={[0, 8, 8, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default ProductivityBarChart;
