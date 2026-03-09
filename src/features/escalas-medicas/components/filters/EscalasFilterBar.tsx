/**
 * EscalasFilterBar Component
 *
 * Filter card with all filter inputs for escalas.
 */

import React from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  TextField,
  Typography,
  Autocomplete,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { FilterList, Search, Refresh, Close } from '@mui/icons-material';
import type { StatusEscala, FilterOption } from '../../types/escalas.types';
import { getVisibleStatusOptions } from '../../utils/escalasStatusUtils';
import StatusChip from '../StatusChip';

// ============================================
// Props
// ============================================

export interface EscalasFilterBarProps {
  // Filter values
  filtroContrato: string[];
  filtroItemContrato: string[];
  filtroUnidade: string[];
  filtroNome: string[];
  filtroCpf: string[];
  filtroStatus: StatusEscala[];
  filtroDataInicio: Date | null;
  filtroDataFim: Date | null;
  buscaRealizada: boolean;

  // Filter options
  contratosUnicos: FilterOption[];
  itensContratoUnicos: FilterOption[];
  unidadesUnicas: string[];
  nomesUnicos: string[];
  cpfsUnicos: string[];

  // Setters
  setFiltroContrato: (value: string[]) => void;
  setFiltroItemContrato: (value: string[]) => void;
  setFiltroUnidade: (value: string[]) => void;
  setFiltroNome: (value: string[]) => void;
  setFiltroCpf: (value: string[]) => void;
  setFiltroStatus: (value: StatusEscala[]) => void;
  setFiltroDataInicio: (value: Date | null) => void;
  setFiltroDataFim: (value: Date | null) => void;

  // Actions
  onBuscar: () => void;
  onClearFilters: () => void;
  loading: boolean;

  // Admin visibility flags
  isAdminAgirCorporativo?: boolean;
  isAdminAgirPlanta?: boolean;
}

// ============================================
// Component
// ============================================

export const EscalasFilterBar: React.FC<EscalasFilterBarProps> = ({
  filtroContrato,
  filtroItemContrato,
  filtroUnidade,
  filtroNome,
  filtroCpf,
  filtroStatus,
  filtroDataInicio,
  filtroDataFim,
  buscaRealizada,
  contratosUnicos,
  itensContratoUnicos,
  unidadesUnicas,
  nomesUnicos,
  cpfsUnicos,
  setFiltroContrato,
  setFiltroItemContrato,
  setFiltroUnidade,
  setFiltroNome,
  setFiltroCpf,
  setFiltroStatus,
  setFiltroDataInicio,
  setFiltroDataFim,
  onBuscar,
  onClearFilters,
  loading,
  isAdminAgirCorporativo = false,
  isAdminAgirPlanta = false,
}) => {
  // Get visible status options based on user role
  const statusOptions = getVisibleStatusOptions(isAdminAgirCorporativo, isAdminAgirPlanta);
  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 1 }}>
          <FilterList color="primary" />
          <Typography variant="h6" fontWeight={600}>
            Filtros Avançados
          </Typography>
          <Chip label="Datas obrigatórias" size="small" color="warning" sx={{ ml: 1 }} />
        </Box>

        {/* Filter Grid */}
        <Grid container spacing={2}>
          {/* Contract */}
          <Grid item xs={12} sm={6} md={3}>
            <Autocomplete
              multiple
              value={filtroContrato}
              onChange={(_, newValue) => setFiltroContrato(newValue)}
              options={contratosUnicos.map((c) => c.id)}
              getOptionLabel={(option) => contratosUnicos.find((c) => c.id === option)?.label || ''}
              renderInput={(params) => (
                <TextField {...params} label="Contrato" placeholder="Selecione um ou mais" />
              )}
              size="small"
              limitTags={2}
            />
          </Grid>

          {/* Contract Item */}
          <Grid item xs={12} sm={6} md={3}>
            <Autocomplete
              multiple
              value={filtroItemContrato}
              onChange={(_, newValue) => setFiltroItemContrato(newValue)}
              options={itensContratoUnicos.map((i) => i.id)}
              getOptionLabel={(option) =>
                itensContratoUnicos.find((i) => i.id === option)?.label || ''
              }
              renderInput={(params) => (
                <TextField {...params} label="Item de Contrato" placeholder="Selecione um ou mais" />
              )}
              size="small"
              limitTags={2}
            />
          </Grid>

          {/* Hospital Unit */}
          <Grid item xs={12} sm={6} md={3}>
            <Autocomplete
              multiple
              value={filtroUnidade}
              onChange={(_, newValue) => setFiltroUnidade(newValue)}
              options={unidadesUnicas}
              renderInput={(params) => (
                <TextField {...params} label="Unidade Hospitalar" placeholder="Selecione uma ou mais" />
              )}
              size="small"
              limitTags={2}
            />
          </Grid>

          {/* Name */}
          <Grid item xs={12} sm={6} md={3}>
            <Autocomplete
              multiple
              value={filtroNome}
              onChange={(_, newValue) => setFiltroNome(newValue)}
              options={nomesUnicos}
              renderInput={(params) => (
                <TextField {...params} label="Nome" placeholder="Selecione um ou mais" />
              )}
              size="small"
              limitTags={2}
            />
          </Grid>

          {/* CPF */}
          <Grid item xs={12} sm={6} md={3}>
            <Autocomplete
              multiple
              value={filtroCpf}
              onChange={(_, newValue) => setFiltroCpf(newValue)}
              options={cpfsUnicos}
              renderInput={(params) => (
                <TextField {...params} label="CPF" placeholder="Selecione um ou mais" />
              )}
              size="small"
              limitTags={2}
            />
          </Grid>

          {/* Status */}
          <Grid item xs={12} sm={6} md={3}>
            <Autocomplete
              multiple
              value={filtroStatus}
              onChange={(_, newValue) => setFiltroStatus(newValue as StatusEscala[])}
              options={statusOptions}
              renderInput={(params) => (
                <TextField {...params} label="Status" placeholder="Selecione um ou mais" />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => {
                  const { key, ...tagProps } = getTagProps({ index });
                  return (
                    <StatusChip
                      key={key}
                      status={option}
                      size="small"
                      {...tagProps}
                    />
                  );
                })
              }
              size="small"
              limitTags={2}
            />
          </Grid>

          {/* Start Date */}
          <Grid item xs={12} sm={6} md={3}>
            <DatePicker
              label="Data Início *"
              value={filtroDataInicio}
              onChange={(newValue) => setFiltroDataInicio(newValue)}
              slotProps={{
                textField: {
                  size: 'small',
                  fullWidth: true,
                  required: true,
                  error: !filtroDataInicio && buscaRealizada,
                  helperText: !filtroDataInicio && buscaRealizada ? 'Campo obrigatório' : '',
                },
              }}
            />
          </Grid>

          {/* End Date */}
          <Grid item xs={12} sm={6} md={3}>
            <DatePicker
              label="Data Fim *"
              value={filtroDataFim}
              onChange={(newValue) => setFiltroDataFim(newValue)}
              slotProps={{
                textField: {
                  size: 'small',
                  fullWidth: true,
                  required: true,
                  error: !filtroDataFim && buscaRealizada,
                  helperText: !filtroDataFim && buscaRealizada ? 'Campo obrigatório' : '',
                },
              }}
            />
          </Grid>
        </Grid>

        {/* Action Buttons */}
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center', gap: 2 }}>
          <Button
            variant="contained"
            size="large"
            startIcon={loading ? <CircularProgress size={20} sx={{ color: 'white' }} /> : <Search />}
            onClick={onBuscar}
            disabled={loading}
            sx={{
              minWidth: 200,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white !important',
              fontWeight: 600,
              '&:hover': {
                background: 'linear-gradient(135deg, #5568d3 0%, #63397d 100%)',
              },
              '&.Mui-disabled': {
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white !important',
                opacity: 0.8,
              },
            }}
          >
            {loading ? 'Buscando...' : 'Buscar Escalas'}
          </Button>

          {buscaRealizada && (
            <>
              <Button
                variant="outlined"
                size="large"
                startIcon={<Refresh />}
                onClick={onBuscar}
                disabled={loading}
              >
                Atualizar
              </Button>

              <Button
                variant="outlined"
                size="large"
                startIcon={<Close />}
                onClick={onClearFilters}
                disabled={loading}
                color="error"
              >
                Limpar Filtros
              </Button>
            </>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default EscalasFilterBar;
