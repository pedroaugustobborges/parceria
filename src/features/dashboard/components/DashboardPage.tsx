/**
 * DashboardPage Component
 *
 * Main page component - thin orchestrator that composes
 * all the extracted hooks and components.
 *
 * This replaces the original 8000+ line monolithic component.
 */

import React, { useCallback, useEffect, useMemo } from 'react';
import { Box, Card, CardContent, Typography, Alert } from '@mui/material';
import { DataGrid, GridToolbar } from '@mui/x-data-grid';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ptBR } from 'date-fns/locale';
import { Dashboard as DashboardIcon } from '@mui/icons-material';

// Hooks
import { useAuth } from '../../../contexts/AuthContext';
import { usePersistentState } from '../../../hooks/usePersistentState';
import { useDashboard } from '../hooks/useDashboard';
import { useDashboardFilters } from '../hooks/useDashboardFilters';
import { useDashboardModals } from '../hooks/useDashboardModals';
import { useHoursCalculation } from '../hooks/useHoursCalculation';

// Components
import { DashboardHeader } from './header/DashboardHeader';
import { DashboardFilters } from './filters/DashboardFilters';
import { DashboardScorecards } from './scorecards/DashboardScorecards';
import { createHorasColumns } from './tables/horasColumns';

// Dialogs
import {
  AccessHistoryDialog,
  ProductivityHistoryDialog,
  ContractWarningDialog,
  PunctualityDetailsDialog,
  AbsenteismDetailsDialog,
  HoursDifferenceDialog,
  ScheduledHoursDialog,
  UnitHoursDialog,
  InconsistencyDetailsDialog,
} from './dialogs';

// Utils
import { exportDashboardCSV } from '../utils/exportUtils';

// Types
import type { Contrato } from '../types/dashboard.types';

// ============================================
// Component
// ============================================

export const DashboardPage: React.FC = () => {
  const { userProfile, isAdminTerceiro } = useAuth();

  // ============================================
  // Main Data Hook
  // ============================================

  const dashboard = useDashboard();

  // ============================================
  // Filters Hook
  // ============================================

  const filters = useDashboardFilters({
    acessos: dashboard.acessos,
    usuarios: dashboard.usuarios,
  });

  // ============================================
  // Modals Hook
  // ============================================

  const modals = useDashboardModals();

  // ============================================
  // Hours Calculation Hook
  // ============================================

  const { calculateHours } = useHoursCalculation();

  // ============================================
  // Local State
  // ============================================

  const [buscaRealizada, setBuscaRealizada] = usePersistentState<boolean>(
    'dashboard_buscaRealizada',
    false
  );

  // ============================================
  // Effects
  // ============================================

  // Load auxiliary data on mount
  useEffect(() => {
    dashboard.loadAuxiliaryData();

    // Auto-reload if filters are saved and search was previously performed
    if (
      buscaRealizada &&
      filters.filtroDataInicio &&
      filters.filtroDataFim &&
      dashboard.acessos.length === 0
    ) {
      handleBuscarAcessos();
    }
  }, []);

  // Calculate hours when data changes
  useEffect(() => {
    if (dashboard.acessos.length > 0) {
      handleCalculateHours();
    }
  }, [
    dashboard.acessos,
    dashboard.escalas,
    filters.filtroTipo,
    filters.filtroMatricula,
    filters.filtroNome,
    filters.filtroCpf,
    filters.filtroEspecialidade,
    filters.filtroContrato,
    filters.filtroUnidade,
    filters.filtroDataInicio,
    filters.filtroDataFim,
    dashboard.usuarios,
  ]);

  // Update CPFs when contract filter changes
  useEffect(() => {
    dashboard.fetchCpfsDoContrato(filters.filtroContrato);
  }, [filters.filtroContrato, isAdminTerceiro, userProfile]);

  // ============================================
  // Handlers
  // ============================================

  const handleBuscarAcessos = useCallback(async () => {
    await dashboard.handleBuscarAcessos({
      filtroDataInicio: filters.filtroDataInicio,
      filtroDataFim: filters.filtroDataFim,
      filtroTipo: filters.filtroTipo,
      filtroMatricula: filters.filtroMatricula,
      filtroNome: filters.filtroNome,
      filtroCpf: filters.filtroCpf,
      filtroEspecialidade: filters.filtroEspecialidade,
      filtroContrato: filters.filtroContrato,
      filtroUnidade: filters.filtroUnidade,
      buscaRealizada,
    });
    setBuscaRealizada(true);
  }, [dashboard, filters, buscaRealizada, setBuscaRealizada]);

  const handleCalculateHours = useCallback(async () => {
    const result = await calculateHours({
      acessos: dashboard.acessos,
      escalas: dashboard.escalas,
      usuarios: dashboard.usuarios,
      produtividade: dashboard.produtividade,
      filtroTipo: filters.filtroTipo,
      filtroMatricula: filters.filtroMatricula,
      filtroNome: filters.filtroNome,
      filtroCpf: filters.filtroCpf,
      filtroEspecialidade: filters.filtroEspecialidade,
      filtroContrato: filters.filtroContrato,
      filtroUnidade: filters.filtroUnidade,
      filtroDataInicio: filters.filtroDataInicio,
      filtroDataFim: filters.filtroDataFim,
    });

    dashboard.setHorasCalculadas(result.horasCalculadas);
    dashboard.setAcessosFiltrados(result.acessosFiltrados);
  }, [dashboard, filters, calculateHours]);

  // Note: handleClearFilters is available through filters.handleClearFilters

  const handleExportCSV = useCallback(() => {
    try {
      exportDashboardCSV(dashboard.horasCalculadas);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao exportar CSV';
      dashboard.setError(errorMessage);
    }
  }, [dashboard]);

  const handleContratoChange = useCallback(
    (contrato: Contrato | null) => {
      if (contrato && buscaRealizada) {
        modals.openContratoWarning(contrato);
      } else {
        filters.setFiltroContrato(contrato);
      }
    },
    [buscaRealizada, modals, filters]
  );

  const handleConfirmContratoChange = useCallback(() => {
    const contrato = modals.confirmContratoChange();
    if (contrato) {
      filters.setFiltroContrato(contrato);
    }
  }, [modals, filters]);

  // ============================================
  // Metrics Calculations
  // ============================================

  const metrics = useMemo(() => {
    const totalPessoas = dashboard.horasCalculadas.length;
    const totalHorasGeral = dashboard.horasCalculadas.reduce((sum, h) => sum + h.totalHoras, 0);
    const totalDiasComRegistro = dashboard.horasCalculadas.reduce(
      (sum, h) => sum + h.diasComRegistro,
      0
    );
    const mediaHoras =
      totalDiasComRegistro > 0 ? (totalHorasGeral / totalDiasComRegistro).toFixed(1) : '0';

    // Productivity calculation
    const totalProdutividade = dashboard.horasCalculadas.reduce(
      (sum, h) =>
        sum +
        h.produtividade_procedimento +
        h.produtividade_parecer_solicitado +
        h.produtividade_parecer_realizado +
        h.produtividade_cirurgia_realizada +
        h.produtividade_prescricao +
        h.produtividade_evolucao +
        h.produtividade_urgencia +
        h.produtividade_ambulatorio,
      0
    );
    const produtividadeMedia =
      totalHorasGeral > 0 ? (totalProdutividade / totalHorasGeral).toFixed(2) : '0';

    const totalHorasEscaladas = dashboard.horasCalculadas.reduce(
      (sum, h) => sum + h.cargaHorariaEscalada,
      0
    );
    const diferencaHoras = totalHorasGeral - totalHorasEscaladas;

    return {
      totalPessoas,
      totalHorasGeral,
      mediaHoras,
      produtividadeMedia,
      totalHorasEscaladas,
      diferencaHoras,
    };
  }, [dashboard.horasCalculadas]);

  // ============================================
  // DataGrid Columns
  // ============================================

  const columns = useMemo(
    () =>
      createHorasColumns({
        onOpenModal: (person) => modals.openAccessModal(person, dashboard.acessosFiltrados),
        onOpenHorasEscaladasModal: (cpf, nome) =>
          modals.openHorasEscaladasModal(
            cpf,
            nome,
            dashboard.escalas,
            filters.filtroDataInicio,
            filters.filtroDataFim
          ),
        onOpenHorasUnidadeModal: (cpf, nome) =>
          modals.openHorasUnidadeModal(cpf, nome, dashboard.acessosFiltrados),
        onOpenDiferencaHorasModal: (cpf, nome, totalHoras, cargaHorariaEscalada) =>
          modals.openDiferencaHorasModal(
            cpf,
            nome,
            totalHoras,
            cargaHorariaEscalada,
            dashboard.acessosFiltrados,
            dashboard.escalas,
            filters.filtroDataInicio,
            filters.filtroDataFim
          ),
      }),
    [dashboard, filters, modals]
  );

  // ============================================
  // Render
  // ============================================

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ptBR}>
      <Box>
        {/* Header */}
        <DashboardHeader
          loading={dashboard.loading}
          buscaRealizada={buscaRealizada}
          totalRegistros={dashboard.horasCalculadas.length}
          onExportCSV={handleExportCSV}
          onRefresh={handleBuscarAcessos}
        />

        {/* Messages */}
        {dashboard.error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => dashboard.setError('')}>
            {dashboard.error}
          </Alert>
        )}

        {/* Filters */}
        <DashboardFilters
          filters={filters}
          contratos={dashboard.contratos}
          loading={dashboard.loading}
          onSearch={handleBuscarAcessos}
          onContratoChange={handleContratoChange}
        />

        {/* Content */}
        {!buscaRealizada ? (
          <EmptyState />
        ) : (
          <Box>
            {/* Scorecards */}
            <DashboardScorecards metrics={metrics} />

            {/* DataGrid */}
            <Card sx={{ mb: 4 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                  Detalhamento por Profissional
                </Typography>
                <Box sx={{ height: 600 }}>
                  <DataGrid
                    rows={dashboard.horasCalculadas}
                    columns={columns}
                    getRowId={(row) => row.cpf}
                    slots={{ toolbar: GridToolbar }}
                    slotProps={{
                      toolbar: {
                        showQuickFilter: true,
                        quickFilterProps: { debounceMs: 500 },
                      },
                    }}
                    pageSizeOptions={[10, 25, 50, 100]}
                    initialState={{
                      pagination: { paginationModel: { pageSize: 25 } },
                    }}
                    disableRowSelectionOnClick
                    sx={{
                      border: 'none',
                      '& .MuiDataGrid-cell': {
                        borderBottom: '1px solid #f0f0f0',
                      },
                      '& .MuiDataGrid-columnHeaders': {
                        backgroundColor: '#f8fafc',
                        borderBottom: '2px solid #e2e8f0',
                      },
                    }}
                  />
                </Box>
              </CardContent>
            </Card>
          </Box>
        )}

        {/* Dialogs */}
        <AccessHistoryDialog
          open={modals.modalOpen}
          onClose={modals.closeAccessModal}
          selectedPerson={modals.selectedPerson}
          personAcessos={modals.personAcessos}
          onOpenProdutividade={(person) => {
            modals.openProdutividadeModal(
              person,
              filters.filtroDataInicio,
              filters.filtroDataFim
            );
          }}
          produtividadeAvailable={true}
        />

        <ProductivityHistoryDialog
          open={modals.produtividadeModalOpen}
          onClose={modals.closeProdutividadeModal}
          selectedPerson={modals.selectedPersonProdutividade}
          personProdutividade={modals.personProdutividade}
        />

        <ContractWarningDialog
          open={modals.contratoWarningOpen}
          onClose={modals.closeContratoWarning}
          onAccept={handleConfirmContratoChange}
        />

        <PunctualityDetailsDialog
          open={modals.pontualidadeModalOpen}
          onClose={modals.closePontualidadeModal}
          data={modals.pontualidadeSelecionada}
        />

        <AbsenteismDetailsDialog
          open={modals.absenteismoModalOpen}
          onClose={modals.closeAbsenteismoModal}
          data={modals.absenteismoSelecionado}
        />

        <HoursDifferenceDialog
          open={modals.diferencaHorasModalOpen}
          onClose={modals.closeDiferencaHorasModal}
          data={modals.diferencaHorasSelecionada}
        />

        <ScheduledHoursDialog
          open={modals.horasEscaladasModalOpen}
          onClose={modals.closeHorasEscaladasModal}
          data={modals.horasEscaladasSelecionadas}
        />

        <UnitHoursDialog
          open={modals.horasUnidadeModalOpen}
          onClose={modals.closeHorasUnidadeModal}
          data={modals.horasUnidadeSelecionadas}
        />

        <InconsistencyDetailsDialog
          open={modals.inconsistenciaModalOpen}
          onClose={modals.closeInconsistenciaModal}
          data={modals.inconsistenciaSelecionada}
        />
      </Box>
    </LocalizationProvider>
  );
};

// ============================================
// Empty State Component
// ============================================

const EmptyState: React.FC = () => (
  <Card
    sx={{
      textAlign: 'center',
      py: 8,
      px: 4,
      background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)',
    }}
  >
    <DashboardIcon sx={{ fontSize: 120, color: 'primary.main', opacity: 0.3, mb: 3 }} />
    <Typography variant="h5" fontWeight={700} gutterBottom>
      Nenhuma busca realizada
    </Typography>
    <Typography variant="body1" color="text.secondary" paragraph>
      Para visualizar os dados de acessos e produtividade, selecione uma data de início e uma data
      de fim nos filtros acima e clique em "Buscar Acessos".
    </Typography>
    <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 4 }}>
      <Box
        sx={{
          bgcolor: 'background.paper',
          p: 2,
          borderRadius: 2,
          boxShadow: 1,
          flex: 1,
          maxWidth: 200,
        }}
      >
        <Typography variant="body2" fontWeight={600} color="primary">
          Passo 1
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Selecione as datas
        </Typography>
      </Box>
      <Box
        sx={{
          bgcolor: 'background.paper',
          p: 2,
          borderRadius: 2,
          boxShadow: 1,
          flex: 1,
          maxWidth: 200,
        }}
      >
        <Typography variant="body2" fontWeight={600} color="primary">
          Passo 2
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Clique em "Buscar Acessos"
        </Typography>
      </Box>
    </Box>
  </Card>
);

export default DashboardPage;
