/**
 * EscalasMedicasPage Component
 *
 * Main page component - thin orchestrator that composes
 * all the extracted hooks and components.
 *
 * This replaces the original 3000+ line monolithic component.
 */

import React, { useCallback, useState } from 'react';
import { Box, Alert, Card, Typography, IconButton, Tooltip, Button } from '@mui/material';
import { CalendarViewWeek, ViewModule, ChevronLeft, ChevronRight } from '@mui/icons-material';
import { CalendarMonth } from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ptBR } from 'date-fns/locale';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';

// Hooks
import { useAuth } from '../../../contexts/AuthContext';
import { useEscalas } from '../hooks/useEscalas';
import { useEscalaForm } from '../hooks/useEscalaForm';

// Services
import { exportToCSV, exportToPDF } from '../services/escalasExportService';

// Components
import { EscalasHeader } from './header/EscalasHeader';
import { EscalasFilterBar } from './filters/EscalasFilterBar';
import { EscalasScorecards } from './scorecards/EscalasScorecards';
import { CalendarView } from './views/CalendarView';
import { CardView } from './views/CardView';
import { BulkActionsBar } from './bulk-actions/BulkActionsBar';

// Dialogs
import { WizardDialog } from './dialogs/WizardDialog';
import { StatusDialog } from './dialogs/StatusDialog';
import { BulkStatusDialog } from './dialogs/BulkStatusDialog';
import { DeleteDialog } from './dialogs/DeleteDialog';
import { BulkDeleteDialog } from './dialogs/BulkDeleteDialog';
import { DetailsDialog } from './dialogs/DetailsDialog';
import { CsvImportDialog } from './dialogs/CsvImportDialog';
import { CsvPreviewDialog } from './dialogs/CsvPreviewDialog';

// Types
import type { EscalaMedica, StatusEscala, CsvPreviewRow, Usuario } from '../types/escalas.types';

// ============================================
// Component
// ============================================

export const EscalasMedicasPage: React.FC = () => {
  const { isAdminAgir, isAdminTerceiro, isTerceiro, isAdminAgirCorporativo, isAdminAgirPlanta } = useAuth();

  // ============================================
  // Main Data Hook
  // ============================================

  const escalas = useEscalas();

  // ============================================
  // Form Hook
  // ============================================

  const form = useEscalaForm({
    contratos: escalas.auxiliaryData.contratos,
    onSaveSuccess: escalas.buscarEscalas,
    setError: escalas.setError,
    setSuccess: escalas.setSuccess,
    loadUsuariosByContrato: escalas.loadUsuariosByContrato,
    loadItensContrato: escalas.loadItensContrato,
  });

  // ============================================
  // Status Dialog State
  // ============================================

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [escalaParaStatus, setEscalaParaStatus] = useState<EscalaMedica | null>(null);
  const [novoStatus, setNovoStatus] = useState<StatusEscala>('Programado');
  const [novaJustificativa, setNovaJustificativa] = useState('');

  // ============================================
  // Bulk Status Dialog State
  // ============================================

  const [bulkStatusDialogOpen, setBulkStatusDialogOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<StatusEscala>('Aprovado');
  const [bulkJustificativa, setBulkJustificativa] = useState('');

  // ============================================
  // Delete Dialog State (for terceiro/admin-terceiro)
  // ============================================

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [escalaParaExcluir, setEscalaParaExcluir] = useState<EscalaMedica | null>(null);
  const [deleteJustificativa, setDeleteJustificativa] = useState('');

  // ============================================
  // Bulk Delete Dialog State (for terceiro/admin-terceiro)
  // ============================================

  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkDeleteJustificativa, setBulkDeleteJustificativa] = useState('');

  // ============================================
  // Details Dialog State
  // ============================================

  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [escalaDetalhes, setEscalaDetalhes] = useState<EscalaMedica | null>(null);
  const [usuarioAlterouStatus, setUsuarioAlterouStatus] = useState<Usuario | null>(null);
  const [acessosMedico, setAcessosMedico] = useState<any[]>([]);
  const [produtividadeMedico, setProdutividadeMedico] = useState<any | null>(null);
  const [loadingDetalhes, setLoadingDetalhes] = useState(false);

  // ============================================
  // CSV Import State
  // ============================================

  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [csvPreviewData, setCsvPreviewData] = useState<CsvPreviewRow[]>([]);
  const [csvPreviewOpen, setCsvPreviewOpen] = useState(false);
  const [importingCsv, setImportingCsv] = useState(false);

  // ============================================
  // Export Handlers
  // ============================================

  const handleExportCSV = useCallback(() => {
    try {
      if (escalas.escalasFiltradas.length === 0) {
        escalas.setError('Nenhuma escala filtrada para exportar');
        return;
      }

      exportToCSV({
        escalas: escalas.escalasFiltradas,
        contratos: escalas.auxiliaryData.contratos,
        unidades: escalas.auxiliaryData.unidades,
        todosItensContrato: escalas.auxiliaryData.todosItensContrato,
      });

      escalas.setSuccess(`${escalas.escalasFiltradas.length} escala(s) exportada(s) com sucesso!`);
    } catch (err: any) {
      escalas.setError('Erro ao exportar CSV: ' + err.message);
    }
  }, [escalas]);

  const handleExportPDF = useCallback(async () => {
    try {
      if (escalas.escalasFiltradas.length === 0) {
        escalas.setError('Nenhuma escala filtrada para exportar');
        return;
      }

      await exportToPDF({
        escalas: escalas.escalasFiltradas,
        contratos: escalas.auxiliaryData.contratos,
        unidades: escalas.auxiliaryData.unidades,
        todosItensContrato: escalas.auxiliaryData.todosItensContrato,
        contratoItens: escalas.auxiliaryData.contratoItens,
      });

      escalas.setSuccess(`PDF gerado com ${escalas.escalasFiltradas.length} escala(s)!`);
    } catch (err: any) {
      escalas.setError('Erro ao gerar PDF: ' + err.message);
    }
  }, [escalas]);

  // ============================================
  // Recalculate Status Handler
  // ============================================

  const handleRecalcularStatus = useCallback(async () => {
    if (
      !window.confirm(
        'Deseja recalcular automaticamente o status de todas as escalas não finalizadas com base nos registros de acesso?'
      )
    ) {
      return;
    }

    await escalas.recalcularStatus();
  }, [escalas]);

  // ============================================
  // Clear Filters Handler
  // ============================================

  const handleClearFilters = useCallback(() => {
    escalas.filters.clearFilters();
    escalas.setSuccess('Filtros limpos com sucesso!');
    setTimeout(() => escalas.setSuccess(''), 3000);
  }, [escalas]);

  // ============================================
  // Status Dialog Handlers
  // ============================================

  const handleOpenStatusDialog = useCallback((escala: EscalaMedica) => {
    setEscalaParaStatus(escala);
    setNovoStatus(escala.status);
    setNovaJustificativa(escala.justificativa || '');
    setStatusDialogOpen(true);
  }, []);

  const handleDeleteEscala = useCallback((escala: EscalaMedica) => {
    // Admin-agir users use the status dialog (can change to any status)
    // Terceiro/admin-terceiro users use the dedicated delete dialog (can ONLY delete)
    if (isAdminAgir) {
      setEscalaParaStatus(escala);
      setNovoStatus('Excluída');
      setNovaJustificativa('');
      setStatusDialogOpen(true);
    } else {
      setEscalaParaExcluir(escala);
      setDeleteJustificativa('');
      setDeleteDialogOpen(true);
    }
  }, [isAdminAgir]);

  const handleCloseStatusDialog = useCallback(() => {
    setStatusDialogOpen(false);
    setEscalaParaStatus(null);
    setNovoStatus('Programado');
    setNovaJustificativa('');
  }, []);

  // ============================================
  // Delete Dialog Handlers (for terceiro/admin-terceiro)
  // ============================================

  const handleCloseDeleteDialog = useCallback(() => {
    setDeleteDialogOpen(false);
    setEscalaParaExcluir(null);
    setDeleteJustificativa('');
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!escalaParaExcluir) return;

    try {
      await escalas.updateEscalaStatus(escalaParaExcluir.id, 'Excluída', deleteJustificativa);
      handleCloseDeleteDialog();
      escalas.setSuccess('Escala excluída com sucesso!');
      await escalas.buscarEscalas();
    } catch (err: any) {
      escalas.setError('Erro ao excluir escala: ' + err.message);
    }
  }, [escalaParaExcluir, deleteJustificativa, escalas, handleCloseDeleteDialog]);

  // ============================================
  // Bulk Delete Dialog Handlers (for terceiro/admin-terceiro)
  // ============================================

  const handleOpenBulkDeleteDialog = useCallback(() => {
    setBulkDeleteJustificativa('');
    setBulkDeleteDialogOpen(true);
  }, []);

  const handleCloseBulkDeleteDialog = useCallback(() => {
    setBulkDeleteDialogOpen(false);
    setBulkDeleteJustificativa('');
  }, []);

  const handleConfirmBulkDelete = useCallback(async () => {
    try {
      await escalas.bulkUpdateStatus('Excluída', bulkDeleteJustificativa);
      handleCloseBulkDeleteDialog();
      escalas.setSuccess(`${escalas.selectedEscalas.size} escala(s) excluída(s) com sucesso!`);
      escalas.deselectAll();
      await escalas.buscarEscalas();
    } catch (err: any) {
      escalas.setError('Erro ao excluir escalas em massa: ' + err.message);
    }
  }, [bulkDeleteJustificativa, escalas, handleCloseBulkDeleteDialog]);

  const handleSaveStatus = useCallback(async () => {
    if (!escalaParaStatus) return;

    try {
      await escalas.updateEscalaStatus(escalaParaStatus.id, novoStatus, novaJustificativa);
      handleCloseStatusDialog();
      escalas.setSuccess('Status atualizado com sucesso!');
      await escalas.buscarEscalas();
    } catch (err: any) {
      escalas.setError('Erro ao atualizar status: ' + err.message);
    }
  }, [escalaParaStatus, novoStatus, novaJustificativa, escalas, handleCloseStatusDialog]);

  // ============================================
  // Bulk Status Dialog Handlers
  // ============================================

  const handleOpenBulkStatusDialog = useCallback((presetStatus?: StatusEscala) => {
    if (presetStatus) {
      setBulkStatus(presetStatus);
    }
    setBulkJustificativa('');
    setBulkStatusDialogOpen(true);
  }, []);

  const handleCloseBulkStatusDialog = useCallback(() => {
    setBulkStatusDialogOpen(false);
    setBulkStatus('Aprovado');
    setBulkJustificativa('');
  }, []);

  const handleBulkStatusUpdate = useCallback(async () => {
    try {
      await escalas.bulkUpdateStatus(bulkStatus, bulkJustificativa);
      handleCloseBulkStatusDialog();
      escalas.setSuccess(`${escalas.selectedEscalas.size} escala(s) atualizada(s) com sucesso!`);
      escalas.deselectAll();
      await escalas.buscarEscalas();
    } catch (err: any) {
      escalas.setError('Erro ao atualizar status em massa: ' + err.message);
    }
  }, [bulkStatus, bulkJustificativa, escalas, handleCloseBulkStatusDialog]);

  // ============================================
  // Details Dialog Handlers
  // ============================================

  const handleOpenDetailsDialog = useCallback(async (escala: EscalaMedica) => {
    setEscalaDetalhes(escala);
    setDetailsDialogOpen(true);
    setLoadingDetalhes(true);

    try {
      // Load additional details
      const details = await escalas.loadEscalaDetails(escala);
      setUsuarioAlterouStatus(details.usuarioAlterouStatus);
      setAcessosMedico(details.acessosMedico);
      setProdutividadeMedico(details.produtividadeMedico);
    } catch (err) {
      console.error('Error loading escala details:', err);
    } finally {
      setLoadingDetalhes(false);
    }
  }, [escalas]);

  const handleCloseDetailsDialog = useCallback(() => {
    setDetailsDialogOpen(false);
    setEscalaDetalhes(null);
    setUsuarioAlterouStatus(null);
    setAcessosMedico([]);
    setProdutividadeMedico(null);
  }, []);

  // ============================================
  // CSV Import Handlers
  // ============================================

  const handleOpenCsvDialog = useCallback(() => {
    setCsvFile(null);
    setCsvErrors([]);
    setCsvDialogOpen(true);
  }, []);

  const handleCloseCsvDialog = useCallback(() => {
    setCsvDialogOpen(false);
    setCsvFile(null);
    setCsvErrors([]);
  }, []);

  const handleProcessCsv = useCallback(async () => {
    if (!csvFile) return;

    setImportingCsv(true);
    try {
      const result = await escalas.validateCsvFile(csvFile, form.formData.contrato_id);
      if (result.isValid) {
        setCsvPreviewData(result.previewData);
        setCsvDialogOpen(false);
        setCsvPreviewOpen(true);
        setCsvErrors([]);
      } else {
        setCsvErrors(result.errors);
      }
    } catch (err: any) {
      setCsvErrors([err.message]);
    } finally {
      setImportingCsv(false);
    }
  }, [csvFile, form.formData.contrato_id, escalas]);

  const handleConfirmCsvImport = useCallback(async () => {
    setImportingCsv(true);
    try {
      await escalas.importCsvData(
        csvPreviewData,
        form.formData.contrato_id,
        form.formData.item_contrato_id
      );
      setCsvPreviewOpen(false);
      setCsvPreviewData([]);
      form.closeDialog();
      escalas.setSuccess(`${csvPreviewData.length} escala(s) importada(s) com sucesso!`);
      await escalas.buscarEscalas();
    } catch (err: any) {
      escalas.setError('Erro ao importar CSV: ' + err.message);
    } finally {
      setImportingCsv(false);
    }
  }, [csvPreviewData, form, escalas]);

  const handleCancelCsvImport = useCallback(() => {
    setCsvPreviewOpen(false);
    setCsvPreviewData([]);
    setCsvDialogOpen(true);
  }, []);

  // ============================================
  // Render
  // ============================================

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ptBR}>
      <Box>
        {/* Header */}
        <EscalasHeader
          onExportCSV={handleExportCSV}
          onExportPDF={handleExportPDF}
          canExport={escalas.escalasFiltradas.length > 0}
          onRecalcularStatus={handleRecalcularStatus}
          recalculando={escalas.recalculando}
          showRecalcular={isAdminAgir}
          onNewEscala={() => form.openDialog()}
          canCreateEscala={!isTerceiro}
        />

        {/* Messages */}
        {escalas.error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => escalas.setError('')}>
            {escalas.error}
          </Alert>
        )}
        {escalas.success && (
          <Alert severity="success" sx={{ mb: 3 }} onClose={() => escalas.setSuccess('')}>
            {escalas.success}
          </Alert>
        )}

        {/* Filters */}
        <EscalasFilterBar
          filtroContrato={escalas.filters.filtroContrato}
          filtroItemContrato={escalas.filters.filtroItemContrato}
          filtroUnidade={escalas.filters.filtroUnidade}
          filtroNome={escalas.filters.filtroNome}
          filtroCpf={escalas.filters.filtroCpf}
          filtroStatus={escalas.filters.filtroStatus}
          filtroDataInicio={escalas.filters.filtroDataInicio}
          filtroDataFim={escalas.filters.filtroDataFim}
          buscaRealizada={escalas.filters.buscaRealizada}
          contratosUnicos={escalas.filters.contratosUnicos}
          itensContratoUnicos={escalas.filters.itensContratoUnicos}
          unidadesUnicas={escalas.filters.unidadesUnicas}
          nomesUnicos={escalas.filters.nomesUnicos}
          cpfsUnicos={escalas.filters.cpfsUnicos}
          setFiltroContrato={escalas.filters.setFiltroContrato}
          setFiltroItemContrato={escalas.filters.setFiltroItemContrato}
          setFiltroUnidade={escalas.filters.setFiltroUnidade}
          setFiltroNome={escalas.filters.setFiltroNome}
          setFiltroCpf={escalas.filters.setFiltroCpf}
          setFiltroStatus={escalas.filters.setFiltroStatus}
          setFiltroDataInicio={escalas.filters.setFiltroDataInicio}
          setFiltroDataFim={escalas.filters.setFiltroDataFim}
          onBuscar={escalas.buscarEscalas}
          onClearFilters={handleClearFilters}
          loading={escalas.loading}
          isAdminAgirCorporativo={isAdminAgirCorporativo}
          isAdminAgirPlanta={isAdminAgirPlanta}
        />

        {/* Content */}
        {!escalas.filters.buscaRealizada ? (
          <EmptyState />
        ) : (
          <Box>
            {/* Scorecards */}
            <EscalasScorecards
              metrics={escalas.metrics}
              isAdminAgirCorporativo={isAdminAgirCorporativo}
              isAdminAgirPlanta={isAdminAgirPlanta}
            />

            {/* Bulk Actions */}
            {escalas.escalasFiltradas.length > 0 && (
              <BulkActionsBar
                selectedCount={escalas.selectedEscalas.size}
                totalSelectableCount={
                  escalas.escalasFiltradas.filter(
                    (e) => e.status !== 'Aprovado' && e.status !== 'Reprovado' && e.status !== 'Excluída'
                  ).length
                }
                onSelectAll={escalas.selectAll}
                onDeselectAll={escalas.deselectAll}
                onApproveSelected={() => handleOpenBulkStatusDialog('Aprovado')}
                onRejectSelected={() => handleOpenBulkStatusDialog('Reprovado')}
                onDeleteSelected={() => {
                  // Admin-agir uses BulkStatusDialog, others use BulkDeleteDialog
                  if (isAdminAgir) {
                    handleOpenBulkStatusDialog('Excluída');
                  } else {
                    handleOpenBulkDeleteDialog();
                  }
                }}
                onChangeStatus={() => handleOpenBulkStatusDialog()}
                isAdminAgir={isAdminAgir}
                isAdminTerceiro={isAdminTerceiro}
                isTerceiro={isTerceiro}
              />
            )}

            {/* View Header - Always Visible */}
            <Box
              sx={{
                mb: 3,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 2,
              }}
            >
              {/* Week Label / Card Count */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h6" fontWeight={600}>
                  {escalas.viewMode === 'calendar'
                    ? `${format(escalas.currentWeekStart, 'dd MMM', { locale: ptBR })} - ${format(
                        endOfWeek(escalas.currentWeekStart, { weekStartsOn: 0 }),
                        'dd MMM yyyy',
                        { locale: ptBR }
                      )}`
                    : `${escalas.escalasFiltradas.length} escala${escalas.escalasFiltradas.length !== 1 ? 's' : ''}`}
                </Typography>
              </Box>

              {/* Controls */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {/* Week Navigation - Only for Calendar */}
                {escalas.viewMode === 'calendar' && (
                  <>
                    <Tooltip title="Semana anterior">
                      <IconButton
                        onClick={() => escalas.setCurrentWeekStart((prev: Date) => subWeeks(prev, 1))}
                        size="small"
                      >
                        <ChevronLeft />
                      </IconButton>
                    </Tooltip>

                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => escalas.setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }))}
                      sx={{ minWidth: 'auto', px: 2 }}
                    >
                      Hoje
                    </Button>

                    <Tooltip title="Próxima semana">
                      <IconButton
                        onClick={() => escalas.setCurrentWeekStart((prev: Date) => addWeeks(prev, 1))}
                        size="small"
                      >
                        <ChevronRight />
                      </IconButton>
                    </Tooltip>
                  </>
                )}

                {/* View Toggle - Always Visible */}
                <Box
                  sx={{
                    display: 'flex',
                    bgcolor: 'action.hover',
                    borderRadius: 1,
                    p: 0.5,
                  }}
                >
                  <Tooltip title="Visualização em calendário">
                    <IconButton
                      size="small"
                      onClick={() => escalas.setViewMode('calendar')}
                      sx={{
                        bgcolor: escalas.viewMode === 'calendar' ? 'background.paper' : 'transparent',
                        boxShadow: escalas.viewMode === 'calendar' ? 1 : 0,
                        borderRadius: 1,
                      }}
                    >
                      <CalendarViewWeek color={escalas.viewMode === 'calendar' ? 'primary' : 'inherit'} />
                    </IconButton>
                  </Tooltip>

                  <Tooltip title="Visualização em cards">
                    <IconButton
                      size="small"
                      onClick={() => escalas.setViewMode('card')}
                      sx={{
                        bgcolor: escalas.viewMode === 'card' ? 'background.paper' : 'transparent',
                        boxShadow: escalas.viewMode === 'card' ? 1 : 0,
                        borderRadius: 1,
                      }}
                    >
                      <ViewModule color={escalas.viewMode === 'card' ? 'primary' : 'inherit'} />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            </Box>

            {/* Calendar View */}
            {escalas.viewMode === 'calendar' && (
              <CalendarView
                escalas={escalas.escalasFiltradas}
                currentWeekStart={escalas.currentWeekStart}
                onEscalaClick={handleOpenDetailsDialog}
              />
            )}

            {/* Card View */}
            {escalas.viewMode === 'card' && (
              <CardView
                escalas={escalas.escalasFiltradas}
                onEscalaClick={handleOpenDetailsDialog}
              />
            )}
          </Box>
        )}

        {/* Wizard Dialog */}
        <WizardDialog
          open={form.dialogOpen}
          onClose={form.closeDialog}
          editingEscala={form.editingEscala}
          activeStep={form.activeStep}
          setActiveStep={form.setActiveStep}
          formData={form.formData}
          setFormData={form.setFormData}
          previewData={form.previewData}
          contratos={escalas.auxiliaryData.contratos}
          itensContrato={escalas.auxiliaryData.itensContrato}
          usuarios={escalas.auxiliaryData.usuarios}
          loadingUsuarios={escalas.loadingUsuarios}
          error={escalas.error}
          setError={escalas.setError}
          onContratoChange={form.handleContratoChange}
          onNext={form.handleNext}
          onBack={form.handleBack}
          onSave={form.handleSave}
          onOpenCsvDialog={handleOpenCsvDialog}
          isTerceiro={isTerceiro}
        />

        {/* Status Dialog */}
        <StatusDialog
          open={statusDialogOpen}
          onClose={handleCloseStatusDialog}
          escala={escalaParaStatus}
          contratos={escalas.auxiliaryData.contratos}
          novoStatus={novoStatus}
          setNovoStatus={setNovoStatus}
          justificativa={novaJustificativa}
          setJustificativa={setNovaJustificativa}
          onSave={handleSaveStatus}
        />

        {/* Bulk Status Dialog */}
        <BulkStatusDialog
          open={bulkStatusDialogOpen}
          onClose={handleCloseBulkStatusDialog}
          selectedCount={escalas.selectedEscalas.size}
          bulkStatus={bulkStatus}
          setBulkStatus={setBulkStatus}
          justificativa={bulkJustificativa}
          setJustificativa={setBulkJustificativa}
          onSave={handleBulkStatusUpdate}
          loading={escalas.loading}
        />

        {/* Delete Dialog (for terceiro/admin-terceiro - single escala) */}
        <DeleteDialog
          open={deleteDialogOpen}
          onClose={handleCloseDeleteDialog}
          escala={escalaParaExcluir}
          contratos={escalas.auxiliaryData.contratos}
          justificativa={deleteJustificativa}
          setJustificativa={setDeleteJustificativa}
          onConfirm={handleConfirmDelete}
          loading={escalas.loading}
        />

        {/* Bulk Delete Dialog (for terceiro/admin-terceiro - multiple escalas) */}
        <BulkDeleteDialog
          open={bulkDeleteDialogOpen}
          onClose={handleCloseBulkDeleteDialog}
          selectedCount={escalas.selectedEscalas.size}
          justificativa={bulkDeleteJustificativa}
          setJustificativa={setBulkDeleteJustificativa}
          onConfirm={handleConfirmBulkDelete}
          loading={escalas.loading}
        />

        {/* Details Dialog */}
        <DetailsDialog
          open={detailsDialogOpen}
          onClose={handleCloseDetailsDialog}
          escala={escalaDetalhes}
          contratos={escalas.auxiliaryData.contratos}
          todosItensContrato={escalas.auxiliaryData.todosItensContrato}
          usuarioAlterouStatus={usuarioAlterouStatus}
          acessosMedico={acessosMedico}
          produtividadeMedico={produtividadeMedico}
          loadingDetalhes={loadingDetalhes}
          isAdminAgir={isAdminAgir}
          isAdminTerceiro={isAdminTerceiro}
          isTerceiro={isTerceiro}
          onEdit={(escala) => {
            handleCloseDetailsDialog();
            form.openDialog(escala);
          }}
          onChangeStatus={(escala) => {
            handleCloseDetailsDialog();
            handleOpenStatusDialog(escala);
          }}
          onDelete={(escala) => {
            handleCloseDetailsDialog();
            handleDeleteEscala(escala);
          }}
        />

        {/* CSV Import Dialog */}
        <CsvImportDialog
          open={csvDialogOpen}
          onClose={handleCloseCsvDialog}
          csvFile={csvFile}
          setCsvFile={setCsvFile}
          csvErrors={csvErrors}
          onProcess={handleProcessCsv}
          processing={importingCsv}
        />

        {/* CSV Preview Dialog */}
        <CsvPreviewDialog
          open={csvPreviewOpen}
          onClose={handleCancelCsvImport}
          previewData={csvPreviewData}
          contratos={escalas.auxiliaryData.contratos}
          itensContrato={escalas.auxiliaryData.itensContrato}
          contratoId={form.formData.contrato_id}
          itemContratoId={form.formData.item_contrato_id}
          onConfirm={handleConfirmCsvImport}
          importing={importingCsv}
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
    <CalendarMonth sx={{ fontSize: 120, color: 'primary.main', opacity: 0.3, mb: 3 }} />
    <Typography variant="h5" fontWeight={700} gutterBottom>
      Nenhuma busca realizada
    </Typography>
    <Typography variant="body1" color="text.secondary" paragraph>
      Para visualizar as escalas médicas, selecione uma data de início e uma data de fim nos
      filtros acima e clique em "Buscar Escalas".
    </Typography>
    <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 4 }}>
      <Box
        sx={{
          bgcolor: 'background.paper',
          p: 2,
          borderRadius: 2,
          boxShadow: 1,
          flex: 1,
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
        }}
      >
        <Typography variant="body2" fontWeight={600} color="primary">
          Passo 2
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Clique em "Buscar Escalas"
        </Typography>
      </Box>
    </Box>
  </Card>
);

export default EscalasMedicasPage;
