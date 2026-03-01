/**
 * AccessLineChart Component
 *
 * Displays daily doctor access over time as a line chart.
 */

import React, { useMemo } from 'react';
import { Box, Card, CardContent, Typography, useTheme } from '@mui/material';
import { FilterList } from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Acesso, Usuario } from '../../types/dashboard.types';

export interface AccessLineChartProps {
  acessos: Acesso[];
  usuarios: Usuario[];
  filtroNome: string[];
  filtroCpf: string[];
  filtroUnidade: string[];
  filtroEspecialidade: string[];
  filtroDataInicio: Date | null;
  filtroDataFim: Date | null;
  cpfsDoContratoFiltrado: string[];
}

interface ChartDataItem {
  date: string;
  count: number;
  formattedDate: string;
}

export const AccessLineChart: React.FC<AccessLineChartProps> = ({
  acessos,
  usuarios,
  filtroNome,
  filtroCpf,
  filtroUnidade,
  filtroEspecialidade,
  filtroDataInicio,
  filtroDataFim,
  cpfsDoContratoFiltrado,
}) => {
  const theme = useTheme();

  const chartData = useMemo((): ChartDataItem[] => {
    if (acessos.length === 0) return [];

    // Group accesses by date and count unique CPFs
    const accessByDate = new Map<string, Set<string>>();

    acessos.forEach((acesso) => {
      // Apply same filters as rest of dashboard
      if (filtroNome.length > 0 && !filtroNome.includes(acesso.nome)) return;
      if (filtroCpf.length > 0 && !filtroCpf.includes(acesso.cpf)) return;
      if (filtroUnidade.length > 0 && !filtroUnidade.includes(acesso.planta))
        return;
      if (
        cpfsDoContratoFiltrado.length > 0 &&
        !cpfsDoContratoFiltrado.includes(acesso.cpf)
      )
        return;

      // Specialty filter
      if (filtroEspecialidade.length > 0) {
        const usuario = usuarios.find((u) => u.cpf === acesso.cpf);
        if (
          !usuario ||
          !usuario.especialidade ||
          !usuario.especialidade.some((esp) =>
            filtroEspecialidade.includes(esp)
          )
        )
          return;
      }

      // Apply date filters
      const dataAcesso = new Date(acesso.data_acesso);
      dataAcesso.setHours(0, 0, 0, 0);

      if (filtroDataInicio) {
        const dataInicio = new Date(filtroDataInicio);
        dataInicio.setHours(0, 0, 0, 0);
        if (dataAcesso < dataInicio) return;
      }

      if (filtroDataFim) {
        const dataFim = new Date(filtroDataFim);
        dataFim.setHours(0, 0, 0, 0);
        if (dataAcesso > dataFim) return;
      }

      // Extract date in YYYY-MM-DD format
      const dateKey = acesso.data_acesso.split("T")[0];

      if (!accessByDate.has(dateKey)) {
        accessByDate.set(dateKey, new Set());
      }
      accessByDate.get(dateKey)!.add(acesso.cpf);
    });

    // Convert to array and sort by date
    const data = Array.from(accessByDate.entries())
      .map(([date, cpfSet]) => ({
        date,
        count: cpfSet.size,
        formattedDate: format(parseISO(date), "dd/MM/yyyy", { locale: ptBR }),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return data;
  }, [
    acessos,
    filtroNome,
    filtroCpf,
    filtroUnidade,
    filtroEspecialidade,
    filtroDataInicio,
    filtroDataFim,
    cpfsDoContratoFiltrado,
    usuarios,
  ]);

  const hasActiveFilters =
    filtroNome.length > 0 ||
    filtroDataInicio ||
    filtroDataFim ||
    filtroEspecialidade.length > 0;

  if (chartData.length === 0) {
    return null;
  }

  const maxCount = Math.max(...chartData.map((d) => d.count));
  const avgCount = Math.round(
    chartData.reduce((acc, d) => acc + d.count, 0) / chartData.length
  );
  const minCount = Math.min(...chartData.map((d) => d.count));

  return (
    <Card
      sx={{
        mb: 3,
        background: theme.palette.mode === 'dark'
          ? "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)"
          : "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
        borderRadius: 3,
        boxShadow: theme.palette.mode === 'dark'
          ? "0 4px 20px rgba(59, 130, 246, 0.15)"
          : "0 4px 20px rgba(59, 130, 246, 0.08)",
        border: theme.palette.mode === 'dark'
          ? "1px solid rgba(59, 130, 246, 0.3)"
          : "1px solid #e0e7ff",
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ mb: 3 }}>
          <Typography
            variant="h6"
            fontWeight={700}
            sx={{
              background: theme.palette.mode === 'dark'
                ? "linear-gradient(135deg, #60a5fa 0%, #93c5fd 100%)"
                : "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              mb: 1,
            }}
          >
            Acesso Médico ao Longo do Tempo
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mb: 0.5 }}
          >
            Número de médicos que acessaram o hospital por dia
          </Typography>
          {hasActiveFilters && (
            <Box
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 1,
                mt: 1,
                px: 2,
                py: 0.5,
                bgcolor: theme.palette.mode === 'dark'
                  ? "rgba(59, 130, 246, 0.15)"
                  : "rgba(59, 130, 246, 0.08)",
                borderRadius: 2,
                border: theme.palette.mode === 'dark'
                  ? "1px solid rgba(59, 130, 246, 0.4)"
                  : "1px solid rgba(59, 130, 246, 0.2)",
              }}
            >
              <FilterList sx={{ fontSize: 16, color: "#3b82f6" }} />
              <Typography
                variant="caption"
                sx={{
                  color: theme.palette.mode === 'dark' ? "#93c5fd" : "#1e40af",
                  fontWeight: 600,
                }}
              >
                Filtros ativos aplicados
              </Typography>
            </Box>
          )}
        </Box>

        <ResponsiveContainer width="100%" height={350}>
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient
                id="colorDoctors"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor="#3b82f6"
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor="#3b82f6"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={theme.palette.mode === 'dark' ? "#334155" : "#e2e8f0"}
              vertical={false}
            />
            <XAxis
              dataKey="formattedDate"
              tick={{ fill: theme.palette.mode === 'dark' ? "#94a3b8" : "#64748b", fontSize: 12 }}
              tickLine={{ stroke: theme.palette.mode === 'dark' ? "#475569" : "#cbd5e1" }}
              axisLine={{ stroke: theme.palette.mode === 'dark' ? "#475569" : "#cbd5e1" }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis
              tick={{ fill: theme.palette.mode === 'dark' ? "#94a3b8" : "#64748b", fontSize: 12 }}
              tickLine={{ stroke: theme.palette.mode === 'dark' ? "#475569" : "#cbd5e1" }}
              axisLine={{ stroke: theme.palette.mode === 'dark' ? "#475569" : "#cbd5e1" }}
              label={{
                value: "Médicos Únicos",
                angle: -90,
                position: "insideLeft",
                style: {
                  fill: theme.palette.mode === 'dark' ? "#94a3b8" : "#475569",
                  fontSize: 12,
                  fontWeight: 600,
                },
              }}
            />
            <RechartsTooltip
              contentStyle={{
                backgroundColor: theme.palette.mode === 'dark'
                  ? "rgba(30, 41, 59, 0.98)"
                  : "rgba(255, 255, 255, 0.98)",
                border: "2px solid #3b82f6",
                borderRadius: 12,
                boxShadow: "0 8px 24px rgba(59, 130, 246, 0.2)",
                padding: "12px 16px",
              }}
              labelStyle={{
                color: theme.palette.mode === 'dark' ? "#f1f5f9" : "#1e293b",
                fontWeight: 700,
                fontSize: 13,
                marginBottom: 4,
              }}
              formatter={(value: number) => [
                `${value} ${value === 1 ? "médico" : "médicos"}`,
                "Total",
              ]}
              cursor={{
                stroke: "#3b82f6",
                strokeWidth: 2,
                strokeDasharray: "5 5",
              }}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#3b82f6"
              strokeWidth={3}
              dot={{
                fill: "#3b82f6",
                strokeWidth: 2,
                r: 4,
                stroke: theme.palette.mode === 'dark' ? "#1e293b" : "#fff",
              }}
              activeDot={{
                r: 6,
                fill: "#2563eb",
                stroke: theme.palette.mode === 'dark' ? "#1e293b" : "#fff",
                strokeWidth: 3,
              }}
              fill="url(#colorDoctors)"
            />
          </LineChart>
        </ResponsiveContainer>

        {/* Quick Statistics */}
        <Box
          sx={{
            mt: 3,
            pt: 3,
            borderTop: theme.palette.mode === 'dark'
              ? "1px solid #334155"
              : "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-around",
            flexWrap: "wrap",
            gap: 2,
          }}
        >
          <Box sx={{ textAlign: "center" }}>
            <Typography
              variant="h5"
              fontWeight={700}
              sx={{ color: "#3b82f6" }}
            >
              {maxCount}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Pico Máximo
            </Typography>
          </Box>
          <Box sx={{ textAlign: "center" }}>
            <Typography
              variant="h5"
              fontWeight={700}
              sx={{ color: "#0ea5e9" }}
            >
              {avgCount}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Média Diária
            </Typography>
          </Box>
          <Box sx={{ textAlign: "center" }}>
            <Typography
              variant="h5"
              fontWeight={700}
              sx={{ color: "#06b6d4" }}
            >
              {minCount}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Mínimo
            </Typography>
          </Box>
          <Box sx={{ textAlign: "center" }}>
            <Typography
              variant="h5"
              fontWeight={700}
              sx={{ color: "#0284c7" }}
            >
              {chartData.length}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Dias Analisados
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default AccessLineChart;
