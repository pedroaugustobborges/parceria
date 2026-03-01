/**
 * Horas DataGrid Column Definitions
 *
 * Column configuration for the hours DataGrid.
 */

import React from 'react';
import { Box, Chip, Typography } from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import { CalendarMonth, AccessTime } from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { HorasCalculadas } from '../../types/dashboard.types';

export interface ColumnsCallbacks {
  onOpenModal: (person: HorasCalculadas) => void;
  onOpenHorasEscaladasModal: (cpf: string, nome: string) => void;
  onOpenHorasUnidadeModal: (cpf: string, nome: string) => void;
  onOpenDiferencaHorasModal: (
    cpf: string,
    nome: string,
    totalHoras: number,
    cargaHorariaEscalada: number
  ) => void;
}

export function createHorasColumns(callbacks: ColumnsCallbacks): GridColDef[] {
  const {
    onOpenModal,
    onOpenHorasEscaladasModal,
    onOpenHorasUnidadeModal,
    onOpenDiferencaHorasModal,
  } = callbacks;

  return [
    {
      field: 'nome',
      headerName: 'Nome',
      width: 250,
      renderCell: (params) => (
        <Box
          sx={{
            cursor: 'pointer',
            '&:hover': {
              '& .MuiTypography-root': {
                color: 'primary.main',
              },
            },
          }}
          onClick={() => onOpenModal(params.row)}
        >
          <Typography variant="body2" fontWeight={600}>
            {params.value}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {params.row.matricula}
          </Typography>
        </Box>
      ),
    },
    { field: 'cpf', headerName: 'CPF', width: 140 },
    { field: 'codigomv', headerName: 'Código MV', width: 120 },
    {
      field: 'tipo',
      headerName: 'Tipo',
      width: 100,
      renderCell: (params) => (
        <Chip label={params.value} size="small" color="primary" variant="outlined" />
      ),
    },
    {
      field: 'cargaHorariaEscalada',
      headerName: 'Horas Escaladas',
      width: 160,
      type: 'number',
      filterable: true,
      sortable: true,
      headerAlign: 'center',
      align: 'center',
      renderCell: (params) => (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.5,
            width: '100%',
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: '6px',
            transition: 'all 0.2s',
            '&:hover': {
              bgcolor: 'rgba(237, 108, 2, 0.08)',
              transform: 'scale(1.05)',
              '& .MuiSvgIcon-root': {
                color: 'warning.main',
              },
              '& .MuiTypography-root': {
                color: 'warning.dark',
              },
            },
          }}
          onClick={() => onOpenHorasEscaladasModal(params.row.cpf, params.row.nome)}
        >
          <CalendarMonth fontSize="small" color="action" />
          <Typography variant="body2" fontWeight={600} color="warning.main">
            {params.value}h
          </Typography>
        </Box>
      ),
    },
    {
      field: 'totalHoras',
      headerName: 'Horas na Unidade',
      width: 130,
      type: 'number',
      renderCell: (params) => (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: '6px',
            transition: 'all 0.2s',
            '&:hover': {
              bgcolor: 'rgba(59, 130, 246, 0.08)',
              transform: 'scale(1.05)',
              '& .MuiSvgIcon-root': {
                color: 'primary.main',
              },
              '& .MuiTypography-root': {
                color: 'primary.dark',
              },
            },
          }}
          onClick={() => onOpenHorasUnidadeModal(params.row.cpf, params.row.nome)}
        >
          <AccessTime fontSize="small" color="action" />
          <Typography variant="body2" fontWeight={600} color="primary">
            {params.value}h
          </Typography>
        </Box>
      ),
    },
    {
      field: 'diferenca',
      headerName: 'Diferença',
      width: 110,
      type: 'number',
      renderCell: (params) => {
        const row = params.row as HorasCalculadas;
        const diferenca = row.totalHoras - row.cargaHorariaEscalada;
        const isPositive = diferenca > 0;
        const isNegative = diferenca < 0;

        return (
          <Chip
            label={`${diferenca > 0 ? '+' : ''}${diferenca.toFixed(1)}h`}
            size="small"
            onClick={() =>
              onOpenDiferencaHorasModal(
                row.cpf,
                row.nome,
                row.totalHoras,
                row.cargaHorariaEscalada
              )
            }
            sx={{
              cursor: 'pointer',
              bgcolor: isPositive
                ? 'rgba(34, 197, 94, 0.1)'
                : isNegative
                  ? 'rgba(239, 68, 68, 0.1)'
                  : 'rgba(156, 163, 175, 0.1)',
              color: isPositive ? '#16a34a' : isNegative ? '#dc2626' : '#6b7280',
              fontWeight: 600,
              '&:hover': {
                bgcolor: isPositive
                  ? 'rgba(34, 197, 94, 0.2)'
                  : isNegative
                    ? 'rgba(239, 68, 68, 0.2)'
                    : 'rgba(156, 163, 175, 0.2)',
                transform: 'scale(1.05)',
              },
              transition: 'all 0.2s',
            }}
          />
        );
      },
    },
    {
      field: 'entradas',
      headerName: 'Entradas',
      width: 100,
      type: 'number',
      renderCell: (params) => (
        <Chip label={params.value} size="small" color="success" />
      ),
    },
    {
      field: 'saidas',
      headerName: 'Saídas',
      width: 100,
      type: 'number',
      renderCell: (params) => (
        <Chip label={params.value} size="small" color="error" />
      ),
    },
    {
      field: 'ultimoAcesso',
      headerName: 'Último Acesso',
      width: 180,
      renderCell: (params) => (
        <Typography variant="body2">
          {format(parseISO(params.value), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
        </Typography>
      ),
    },
    {
      field: 'especialidade',
      headerName: 'Especialidade',
      width: 150,
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          sx={{
            bgcolor: 'primary.50',
            color: 'primary.700',
            fontWeight: 500,
          }}
        />
      ),
    },
    {
      field: 'produtividade_procedimento',
      headerName: 'Procedimento',
      width: 110,
      type: 'number',
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color={params.value > 0 ? 'success' : 'default'}
        />
      ),
    },
    {
      field: 'produtividade_parecer_solicitado',
      headerName: 'Parecer Sol.',
      width: 110,
      type: 'number',
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color={params.value > 0 ? 'success' : 'default'}
        />
      ),
    },
    {
      field: 'produtividade_parecer_realizado',
      headerName: 'Parecer Real.',
      width: 110,
      type: 'number',
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color={params.value > 0 ? 'success' : 'default'}
        />
      ),
    },
    {
      field: 'produtividade_cirurgia_realizada',
      headerName: 'Cirurgia',
      width: 100,
      type: 'number',
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color={params.value > 0 ? 'success' : 'default'}
        />
      ),
    },
    {
      field: 'produtividade_prescricao',
      headerName: 'Prescrição',
      width: 100,
      type: 'number',
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color={params.value > 0 ? 'success' : 'default'}
        />
      ),
    },
    {
      field: 'produtividade_evolucao',
      headerName: 'Evolução',
      width: 100,
      type: 'number',
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color={params.value > 0 ? 'success' : 'default'}
        />
      ),
    },
    {
      field: 'produtividade_urgencia',
      headerName: 'Urgência',
      width: 100,
      type: 'number',
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color={params.value > 0 ? 'success' : 'default'}
        />
      ),
    },
    {
      field: 'produtividade_ambulatorio',
      headerName: 'Ambulatório',
      width: 110,
      type: 'number',
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color={params.value > 0 ? 'success' : 'default'}
        />
      ),
    },
    {
      field: 'produtividade_auxiliar',
      headerName: 'Auxiliar',
      width: 100,
      type: 'number',
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color={params.value > 0 ? 'success' : 'default'}
        />
      ),
    },
    {
      field: 'produtividade_encaminhamento',
      headerName: 'Encaminh.',
      width: 110,
      type: 'number',
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color={params.value > 0 ? 'success' : 'default'}
        />
      ),
    },
    {
      field: 'produtividade_folha_objetivo_diario',
      headerName: 'Folha Obj.',
      width: 100,
      type: 'number',
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color={params.value > 0 ? 'success' : 'default'}
        />
      ),
    },
    {
      field: 'produtividade_evolucao_diurna_cti',
      headerName: 'Evol. Diurna CTI',
      width: 130,
      type: 'number',
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color={params.value > 0 ? 'success' : 'default'}
        />
      ),
    },
    {
      field: 'produtividade_evolucao_noturna_cti',
      headerName: 'Evol. Noturna CTI',
      width: 130,
      type: 'number',
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color={params.value > 0 ? 'success' : 'default'}
        />
      ),
    },
  ];
}
