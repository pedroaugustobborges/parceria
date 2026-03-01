/**
 * useEscalaForm Hook
 *
 * Manages wizard form state for creating/editing escalas.
 * Includes draft persistence and validation.
 */

import { useState, useEffect, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { useAuth } from '../../../contexts/AuthContext';
import * as escalasService from '../services/escalasService';
import { checkConflictingSchedules } from '../services/conflictDetectionService';
import { getInitialStatus, canEditStatus, getCannotEditStatusMessage } from '../utils/escalasStatusUtils';
import type {
  EscalaMedica,
  EscalaFormData,
  EscalaPreviewData,
  MedicoEscala,
  Contrato,
  Usuario,
  CreateEscalaInput,
  FormDraft,
} from '../types/escalas.types';

// ============================================
// Constants
// ============================================

const FORM_STORAGE_KEY = 'escalas_medicas_form_draft';
const DRAFT_MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours

const INITIAL_FORM_DATA: EscalaFormData = {
  contrato_id: '',
  item_contrato_id: '',
  data_inicio: [],
  horario_entrada: null,
  horario_saida: null,
  medicos_selecionados: [],
  observacoes: '',
};

const INITIAL_PREVIEW_DATA: EscalaPreviewData = {
  contrato: null,
  medicos: [],
};

// ============================================
// Hook Props
// ============================================

export interface UseEscalaFormProps {
  contratos: Contrato[];
  onSaveSuccess: () => Promise<void>;
  setError: (error: string) => void;
  setSuccess: (success: string) => void;
  loadUsuariosByContrato: (contratoId: string) => Promise<void>;
  loadItensContrato: (contratoId: string) => Promise<void>;
}

// ============================================
// Hook Return Type
// ============================================

export interface UseEscalaFormReturn {
  // State
  formData: EscalaFormData;
  previewData: EscalaPreviewData;
  activeStep: number;
  editingEscala: EscalaMedica | null;
  dialogOpen: boolean;

  // Actions
  setFormData: React.Dispatch<React.SetStateAction<EscalaFormData>>;
  setActiveStep: (step: number) => void;
  openDialog: (escala?: EscalaMedica) => Promise<void>;
  closeDialog: () => void;
  handleNext: () => boolean;
  handleBack: () => void;
  handleContratoChange: (contrato: Contrato | null) => void;
  handleSave: () => Promise<void>;

  // CSV Import
  csvDialogOpen: boolean;
  setCsvDialogOpen: (open: boolean) => void;
}

// ============================================
// Hook Implementation
// ============================================

export function useEscalaForm(props: UseEscalaFormProps): UseEscalaFormReturn {
  const { contratos, onSaveSuccess, setError, setSuccess, loadUsuariosByContrato, loadItensContrato } = props;
  const { isAdminAgir, isAdminTerceiro, userContratoIds } = useAuth();

  // ============================================
  // Form State
  // ============================================

  const [formData, setFormData] = useState<EscalaFormData>(INITIAL_FORM_DATA);
  const [previewData, setPreviewData] = useState<EscalaPreviewData>(INITIAL_PREVIEW_DATA);
  const [activeStep, setActiveStep] = useState(0);
  const [editingEscala, setEditingEscala] = useState<EscalaMedica | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // CSV Import State
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);

  // ============================================
  // Draft Persistence - Restore on Mount
  // ============================================

  useEffect(() => {
    try {
      const savedDraft = sessionStorage.getItem(FORM_STORAGE_KEY);
      if (savedDraft) {
        const parsed: FormDraft = JSON.parse(savedDraft);

        // Only restore if the draft is recent and dialog was open
        const draftAge = new Date().getTime() - new Date(parsed.timestamp).getTime();

        if (draftAge < DRAFT_MAX_AGE_MS && parsed.dialogOpen) {
          // Restore form data with proper Date object conversion
          if (parsed.formData) {
            setFormData({
              ...parsed.formData,
              data_inicio: parsed.formData.data_inicio?.map((d: any) => new Date(d)) || [],
              horario_entrada: parsed.formData.horario_entrada
                ? new Date(parsed.formData.horario_entrada)
                : null,
              horario_saida: parsed.formData.horario_saida
                ? new Date(parsed.formData.horario_saida)
                : null,
            });
          }

          // Restore dialog state
          setDialogOpen(true);
          setActiveStep(parsed.activeStep || 0);

          console.log(
            '📝 Restored form draft from sessionStorage (age: ' +
              Math.round(draftAge / 1000 / 60) +
              ' minutes)'
          );
        } else {
          // Draft is too old or dialog wasn't open, clear it
          sessionStorage.removeItem(FORM_STORAGE_KEY);
        }
      }
    } catch (error) {
      console.error('Error restoring form draft:', error);
      sessionStorage.removeItem(FORM_STORAGE_KEY);
    }
  }, []);

  // ============================================
  // Draft Persistence - Save on Change
  // ============================================

  useEffect(() => {
    if (dialogOpen) {
      try {
        const draft: FormDraft = {
          formData,
          dialogOpen,
          activeStep,
          timestamp: new Date().toISOString(),
        };
        sessionStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(draft));
      } catch (error) {
        console.error('Error saving form draft:', error);
      }
    }
  }, [formData, dialogOpen, activeStep]);

  // ============================================
  // Open Dialog
  // ============================================

  const openDialog = useCallback(
    async (escala?: EscalaMedica) => {
      if (escala) {
        // Check if user can edit this escala
        const canEdit = canEditStatus(escala.status, isAdminAgir, isAdminTerceiro);

        if (!canEdit) {
          setError(getCannotEditStatusMessage(escala.status, isAdminTerceiro));
          return;
        }

        // Check contract access for admin-terceiro
        if (isAdminTerceiro && userContratoIds.length > 0 && !userContratoIds.includes(escala.contrato_id)) {
          setError('Você não tem permissão para editar escalas de outros contratos.');
          return;
        }

        setEditingEscala(escala);

        // Find associated contract
        const contratoAssociado = contratos.find((c) => c.id === escala.contrato_id);

        // Load users for this contract
        let medicosUsuarios: Usuario[] = [];
        if (contratoAssociado) {
          try {
            medicosUsuarios = await escalasService.loadUsuariosByContrato(escala.contrato_id);
            await loadItensContrato(contratoAssociado.id);
          } catch (err: any) {
            console.error('Erro ao carregar usuários:', err);
          }
        }

        // Parse date
        const dataInicio = parseISO(escala.data_inicio);

        // Parse time strings to Date objects
        const [horaE, minE] = escala.horario_entrada.split(':').map(Number);
        const [horaS, minS] = escala.horario_saida.split(':').map(Number);

        const horarioEntrada = new Date();
        horarioEntrada.setHours(horaE, minE, 0, 0);

        const horarioSaida = new Date();
        horarioSaida.setHours(horaS, minS, 0, 0);

        // Map medicos from escala to usuarios
        const medicosEscalados = escala.medicos
          .map((m) => medicosUsuarios.find((u) => u.cpf === m.cpf))
          .filter((u): u is Usuario => u !== undefined);

        setFormData({
          contrato_id: escala.contrato_id,
          item_contrato_id: escala.item_contrato_id,
          data_inicio: [dataInicio],
          horario_entrada: horarioEntrada,
          horario_saida: horarioSaida,
          medicos_selecionados: medicosEscalados,
          observacoes: escala.observacoes || '',
        });

        setPreviewData({
          contrato: contratoAssociado || null,
          medicos: escala.medicos,
        });
      } else {
        // New escala
        setEditingEscala(null);
        setFormData(INITIAL_FORM_DATA);
        setPreviewData(INITIAL_PREVIEW_DATA);
      }

      setActiveStep(0);
      setDialogOpen(true);
    },
    [contratos, isAdminAgir, isAdminTerceiro, userContratoIds, setError, loadItensContrato]
  );

  // ============================================
  // Close Dialog
  // ============================================

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setEditingEscala(null);
    setActiveStep(0);
    sessionStorage.removeItem(FORM_STORAGE_KEY);
    setFormData(INITIAL_FORM_DATA);
    setPreviewData(INITIAL_PREVIEW_DATA);
  }, []);

  // ============================================
  // Handle Contract Change
  // ============================================

  const handleContratoChange = useCallback(
    (contrato: Contrato | null) => {
      setFormData((prev) => ({
        ...prev,
        contrato_id: contrato?.id || '',
        item_contrato_id: '',
        medicos_selecionados: [],
      }));

      if (contrato) {
        loadUsuariosByContrato(contrato.id);
        loadItensContrato(contrato.id);
      }
    },
    [loadUsuariosByContrato, loadItensContrato]
  );

  // ============================================
  // Step Navigation
  // ============================================

  const handleNext = useCallback((): boolean => {
    if (activeStep === 0) {
      // Validate basic data
      if (
        !formData.contrato_id ||
        !formData.item_contrato_id ||
        !formData.data_inicio ||
        formData.data_inicio.length === 0 ||
        !formData.horario_entrada ||
        !formData.horario_saida
      ) {
        setError('Preencha todos os campos obrigatórios');
        return false;
      }

      if (!formData.medicos_selecionados || formData.medicos_selecionados.length === 0) {
        setError('Selecione pelo menos um médico');
        return false;
      }

      // Prepare preview
      const contrato = contratos.find((c) => c.id === formData.contrato_id);
      const medicos: MedicoEscala[] = formData.medicos_selecionados.map((medico) => ({
        nome: medico.nome,
        cpf: medico.cpf,
      }));

      setPreviewData({ contrato: contrato || null, medicos });
      setError('');
    }

    setActiveStep((prev) => prev + 1);
    return true;
  }, [activeStep, formData, contratos, setError]);

  const handleBack = useCallback(() => {
    setActiveStep((prev) => prev - 1);
  }, []);

  // ============================================
  // Save
  // ============================================

  const handleSave = useCallback(async () => {
    try {
      setError('');
      setSuccess('');

      const statusInicial = getInitialStatus(isAdminAgir);
      const horarioEntrada = format(formData.horario_entrada!, 'HH:mm:ss');
      const horarioSaida = format(formData.horario_saida!, 'HH:mm:ss');

      if (editingEscala) {
        // Editing existing escala
        const escalaMedica: CreateEscalaInput = {
          contrato_id: formData.contrato_id,
          item_contrato_id: formData.item_contrato_id,
          data_inicio: format(formData.data_inicio[0], 'yyyy-MM-dd'),
          horario_entrada: horarioEntrada,
          horario_saida: horarioSaida,
          medicos: previewData.medicos,
          observacoes: formData.observacoes || null,
          status: statusInicial,
        };

        // Check conflicts for each doctor
        for (const medico of previewData.medicos) {
          const conflictCheck = await checkConflictingSchedules(
            medico.cpf,
            escalaMedica.data_inicio,
            escalaMedica.horario_entrada,
            escalaMedica.horario_saida,
            editingEscala.id
          );

          if (conflictCheck.hasConflict) {
            setError(conflictCheck.conflictDetails || 'Conflito de agendamento detectado.');
            return;
          }
        }

        await escalasService.updateEscala({
          id: editingEscala.id,
          ...escalaMedica,
        });

        setSuccess('Escala atualizada com sucesso!');
      } else {
        // Creating new escalas
        const escalasToCreate: CreateEscalaInput[] = [];
        const conflictErrors: string[] = [];

        // Check conflicts for each date-doctor combination
        for (const dataInicio of formData.data_inicio) {
          const dataInicioFormatada = format(dataInicio, 'yyyy-MM-dd');

          for (const medico of previewData.medicos) {
            const conflictCheck = await checkConflictingSchedules(
              medico.cpf,
              dataInicioFormatada,
              horarioEntrada,
              horarioSaida
            );

            if (conflictCheck.hasConflict) {
              conflictErrors.push(conflictCheck.conflictDetails || '');
            } else {
              // No conflict - create escala for this doctor on this date
              escalasToCreate.push({
                contrato_id: formData.contrato_id,
                item_contrato_id: formData.item_contrato_id,
                data_inicio: dataInicioFormatada,
                horario_entrada: horarioEntrada,
                horario_saida: horarioSaida,
                medicos: [medico],
                observacoes: formData.observacoes || null,
                status: statusInicial,
              });
            }
          }
        }

        // If all escalas have conflicts, show error
        if (escalasToCreate.length === 0 && conflictErrors.length > 0) {
          setError(conflictErrors.join('\n'));
          return;
        }

        // Create escalas
        if (escalasToCreate.length > 0) {
          await escalasService.createEscalas(escalasToCreate);

          const numEscalas = escalasToCreate.length;
          const numDates = formData.data_inicio.length;
          const numDoctors = previewData.medicos.length;

          let successMessage = `${numEscalas} escala${numEscalas > 1 ? 's' : ''} criada${numEscalas > 1 ? 's' : ''} com sucesso! (${numDates} data${numDates > 1 ? 's' : ''} × ${numDoctors} médico${numDoctors > 1 ? 's' : ''})`;

          // If there were some conflicts but some escalas were created, warn
          if (conflictErrors.length > 0) {
            successMessage += `\n\nAtenção: ${conflictErrors.length} combinação${conflictErrors.length > 1 ? 'ões' : ''} foi${conflictErrors.length > 1 ? 'ram' : ''} ignorada${conflictErrors.length > 1 ? 's' : ''} devido a conflitos:\n${conflictErrors.join('\n')}`;
          }

          setSuccess(successMessage);
        }
      }

      closeDialog();
      await onSaveSuccess();
    } catch (err: any) {
      setError(err.message);
    }
  }, [
    formData,
    previewData,
    editingEscala,
    isAdminAgir,
    setError,
    setSuccess,
    closeDialog,
    onSaveSuccess,
  ]);

  // ============================================
  // Return
  // ============================================

  return {
    // State
    formData,
    previewData,
    activeStep,
    editingEscala,
    dialogOpen,

    // Actions
    setFormData,
    setActiveStep,
    openDialog,
    closeDialog,
    handleNext,
    handleBack,
    handleContratoChange,
    handleSave,

    // CSV Import
    csvDialogOpen,
    setCsvDialogOpen,
  };
}
