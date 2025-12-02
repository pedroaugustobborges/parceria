import React from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Autocomplete,
  Grid,
  Button,
  Alert,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { ptBR } from "date-fns/locale";
import { FilterList, Refresh } from "@mui/icons-material";
import { Contrato, UnidadeHospitalar } from "../../types/database.types";

interface FilterSectionProps {
  // Valores dos filtros
  filtroTipo: string[];
  filtroMatricula: string[];
  filtroNome: string[];
  filtroCpf: string[];
  filtroSentido: string[];
  filtroContrato: Contrato | null;
  filtroUnidade: string[];
  filtroDataInicio: Date | null;
  filtroDataFim: Date | null;

  // Setters dos filtros
  setFiltroTipo: (value: string[]) => void;
  setFiltroMatricula: (value: string[]) => void;
  setFiltroNome: (value: string[]) => void;
  setFiltroCpf: (value: string[]) => void;
  setFiltroSentido: (value: string[]) => void;
  setFiltroUnidade: (value: string[]) => void;
  setFiltroDataInicio: (value: Date | null) => void;
  setFiltroDataFim: (value: Date | null) => void;

  // Opções para autocompletes
  tiposUnicos: string[];
  matriculasUnicas: string[];
  nomesUnicos: string[];
  cpfsUnicos: string[];
  plantasUnicas: string[];
  contratos: Contrato[];
  unidades: UnidadeHospitalar[];

  // Handlers
  handleContratoChange: (event: any, newValue: Contrato | null) => void;
  handleBuscarAcessos: () => void;

  // Estado
  loading: boolean;
  error: string;
  buscaRealizada: boolean;
}

/**
 * Componente de filtros do Dashboard
 * Extrai a lógica de filtros para um componente separado
 */
export const FilterSection: React.FC<FilterSectionProps> = ({
  filtroTipo,
  filtroMatricula,
  filtroNome,
  filtroCpf,
  filtroSentido,
  filtroContrato,
  filtroUnidade,
  filtroDataInicio,
  filtroDataFim,
  setFiltroTipo,
  setFiltroMatricula,
  setFiltroNome,
  setFiltroCpf,
  setFiltroSentido,
  setFiltroUnidade,
  setFiltroDataInicio,
  setFiltroDataFim,
  tiposUnicos,
  matriculasUnicas,
  nomesUnicos,
  cpfsUnicos,
  plantasUnicas,
  contratos,
  unidades,
  handleContratoChange,
  handleBuscarAcessos,
  loading,
  error,
  buscaRealizada,
}) => {
  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 3,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <FilterList />
            <Typography variant="h6" fontWeight={600}>
              Filtros de Busca
            </Typography>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ptBR}>
          <Grid container spacing={2}>
            {/* Data Início */}
            <Grid item xs={12} sm={6} md={3}>
              <DatePicker
                label="Data Início *"
                value={filtroDataInicio}
                onChange={setFiltroDataInicio}
                format="dd/MM/yyyy"
                slotProps={{
                  textField: {
                    fullWidth: true,
                    size: "small",
                    required: true,
                  },
                }}
              />
            </Grid>

            {/* Data Fim */}
            <Grid item xs={12} sm={6} md={3}>
              <DatePicker
                label="Data Fim *"
                value={filtroDataFim}
                onChange={setFiltroDataFim}
                format="dd/MM/yyyy"
                slotProps={{
                  textField: {
                    fullWidth: true,
                    size: "small",
                    required: true,
                  },
                }}
              />
            </Grid>

            {/* Contrato */}
            <Grid item xs={12} sm={6} md={3}>
              <Autocomplete
                options={contratos}
                getOptionLabel={(option) => option.nome}
                value={filtroContrato}
                onChange={handleContratoChange}
                renderInput={(params) => (
                  <TextField {...params} label="Contrato" size="small" fullWidth />
                )}
                size="small"
              />
            </Grid>

            {/* Unidade Hospitalar */}
            <Grid item xs={12} sm={6} md={3}>
              <Autocomplete
                multiple
                options={plantasUnicas}
                value={filtroUnidade}
                onChange={(_, newValue) => setFiltroUnidade(newValue)}
                renderInput={(params) => (
                  <TextField {...params} label="Unidade" size="small" fullWidth />
                )}
                size="small"
              />
            </Grid>

            {/* Filtros avançados - mostrar apenas após busca */}
            {buscaRealizada && (
              <>
                <Grid item xs={12} sm={6} md={3}>
                  <Autocomplete
                    multiple
                    options={tiposUnicos}
                    value={filtroTipo}
                    onChange={(_, newValue) => setFiltroTipo(newValue)}
                    renderInput={(params) => (
                      <TextField {...params} label="Tipo" size="small" fullWidth />
                    )}
                    size="small"
                  />
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Autocomplete
                    multiple
                    options={matriculasUnicas}
                    value={filtroMatricula}
                    onChange={(_, newValue) => setFiltroMatricula(newValue)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Matrícula"
                        size="small"
                        fullWidth
                      />
                    )}
                    size="small"
                  />
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Autocomplete
                    multiple
                    options={nomesUnicos}
                    value={filtroNome}
                    onChange={(_, newValue) => setFiltroNome(newValue)}
                    renderInput={(params) => (
                      <TextField {...params} label="Nome" size="small" fullWidth />
                    )}
                    size="small"
                  />
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Autocomplete
                    multiple
                    options={cpfsUnicos}
                    value={filtroCpf}
                    onChange={(_, newValue) => setFiltroCpf(newValue)}
                    renderInput={(params) => (
                      <TextField {...params} label="CPF" size="small" fullWidth />
                    )}
                    size="small"
                  />
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Autocomplete
                    multiple
                    options={["E", "S"]}
                    value={filtroSentido}
                    onChange={(_, newValue) => setFiltroSentido(newValue)}
                    getOptionLabel={(option) =>
                      option === "E" ? "Entrada" : "Saída"
                    }
                    renderInput={(params) => (
                      <TextField {...params} label="Sentido" size="small" fullWidth />
                    )}
                    size="small"
                  />
                </Grid>
              </>
            )}
          </Grid>
        </LocalizationProvider>

        <Box sx={{ mt: 3, display: "flex", gap: 2 }}>
          <Button
            variant="contained"
            startIcon={loading ? <Refresh /> : <FilterList />}
            onClick={handleBuscarAcessos}
            disabled={loading}
            sx={{
              px: 4,
              py: 1.5,
              fontWeight: 600,
              fontSize: "1rem",
            }}
          >
            {loading ? "Buscando..." : "Buscar Acessos"}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};
