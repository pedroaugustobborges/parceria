/**
 * DashboardFilters Component
 *
 * Filter bar for the Dashboard.
 */

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Autocomplete,
  Grid,
  Chip,
  Button,
  CircularProgress,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { FilterList, Search, Refresh, Close } from '@mui/icons-material';
import type { Contrato, UseDashboardFiltersReturn } from '../../types/dashboard.types';

export interface DashboardFiltersProps {
  filters: UseDashboardFiltersReturn;
  contratos: Contrato[];
  loading: boolean;
  onSearch: () => void;
  onContratoChange: (contrato: Contrato | null) => void;
}

export const DashboardFilters: React.FC<DashboardFiltersProps> = ({
  filters,
  contratos,
  loading,
  onSearch,
  onContratoChange,
}) => {
  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 1 }}>
          <FilterList color="primary" />
          <Typography variant="h6" fontWeight={600}>
            Filtros Avançados
          </Typography>
          <Chip label="Datas obrigatórias" size="small" color="warning" sx={{ ml: 1 }} />
          <Box sx={{ flexGrow: 1 }} />
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={4}>
            <Autocomplete
              multiple
              value={filters.filtroTipo}
              onChange={(_, newValue) => filters.setFiltroTipo(newValue)}
              options={filters.tiposUnicos}
              renderInput={(params) => (
                <TextField {...params} label="Tipo" placeholder="Selecione um ou mais" />
              )}
              size="small"
              limitTags={2}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <Autocomplete
              multiple
              value={filters.filtroMatricula}
              onChange={(_, newValue) => filters.setFiltroMatricula(newValue)}
              options={filters.matriculasUnicas}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Matrícula"
                  placeholder="Selecione uma ou mais"
                />
              )}
              size="small"
              limitTags={2}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <Autocomplete
              multiple
              value={filters.filtroNome}
              onChange={(_, newValue) => filters.setFiltroNome(newValue)}
              options={filters.nomesUnicos}
              renderInput={(params) => (
                <TextField {...params} label="Nome" placeholder="Selecione um ou mais" />
              )}
              size="small"
              limitTags={2}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <Autocomplete
              multiple
              value={filters.filtroCpf}
              onChange={(_, newValue) => filters.setFiltroCpf(newValue)}
              options={filters.cpfsUnicos}
              renderInput={(params) => (
                <TextField {...params} label="CPF" placeholder="Selecione um ou mais" />
              )}
              size="small"
              limitTags={2}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <Autocomplete
              multiple
              value={filters.filtroEspecialidade}
              onChange={(_, newValue) => filters.setFiltroEspecialidade(newValue)}
              options={filters.especialidadesUnicas}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Especialidade"
                  placeholder="Selecione uma ou mais"
                />
              )}
              size="small"
              limitTags={2}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <Autocomplete
              multiple
              value={filters.filtroUnidade}
              onChange={(_, newValue) => filters.setFiltroUnidade(newValue)}
              options={filters.plantasUnicas}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Unidade Hospitalar"
                  placeholder="Selecione uma ou mais"
                />
              )}
              size="small"
              limitTags={2}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <Autocomplete
              value={filters.filtroContrato}
              onChange={(_, newValue) => onContratoChange(newValue)}
              options={contratos}
              getOptionLabel={(option) => `${option.nome} - ${option.empresa}`}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Contrato"
                  placeholder="Selecione um contrato"
                />
              )}
              size="small"
            />
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <DatePicker
              label="Data Início *"
              value={filters.filtroDataInicio}
              onChange={(newValue) => filters.setFiltroDataInicio(newValue)}
              slotProps={{
                textField: {
                  size: 'small',
                  fullWidth: true,
                  required: true,
                  error: !filters.filtroDataInicio && filters.buscaRealizada,
                  helperText:
                    !filters.filtroDataInicio && filters.buscaRealizada
                      ? 'Campo obrigatório'
                      : '',
                },
              }}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <DatePicker
              label="Data Fim *"
              value={filters.filtroDataFim}
              onChange={(newValue) => filters.setFiltroDataFim(newValue)}
              slotProps={{
                textField: {
                  size: 'small',
                  fullWidth: true,
                  required: true,
                  error: !filters.filtroDataFim && filters.buscaRealizada,
                  helperText:
                    !filters.filtroDataFim && filters.buscaRealizada
                      ? 'Campo obrigatório'
                      : '',
                },
              }}
            />
          </Grid>
        </Grid>

        {/* Search Button */}
        <Box sx={{ display: 'flex', gap: 2, mt: 3, justifyContent: 'center' }}>
          <Button
            variant="contained"
            size="large"
            startIcon={
              loading ? (
                <CircularProgress size={20} sx={{ color: 'white' }} />
              ) : (
                <Search />
              )
            }
            onClick={onSearch}
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
            {loading ? 'Buscando...' : 'Buscar Acessos'}
          </Button>

          {filters.buscaRealizada && (
            <>
              <Button
                variant="outlined"
                size="large"
                startIcon={<Refresh />}
                onClick={onSearch}
                disabled={loading}
              >
                Atualizar
              </Button>

              <Button
                variant="outlined"
                size="large"
                startIcon={<Close />}
                onClick={filters.handleClearFilters}
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

export default DashboardFilters;
