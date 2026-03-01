/**
 * WizardDialog Component
 *
 * Multi-step dialog for creating and editing escalas.
 * Steps: Dados Básicos → Visualizar Escala → Confirmar
 */

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Paper,
  Stepper,
  Step,
  StepLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Autocomplete,
  Alert,
  CircularProgress,
  useTheme,
} from '@mui/material';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import MultiDatePicker from 'react-multi-date-picker';
import 'react-multi-date-picker/styles/backgrounds/bg-dark.css';
import {
  ArrowBack,
  CalendarMonth,
  Check,
  Info,
  Person,
  Schedule,
  UploadFile,
} from '@mui/icons-material';
import { format } from 'date-fns';
import type {
  EscalaMedica,
  Contrato,
  ItemContrato,
  Usuario,
  MedicoEscala,
} from '../../types/escalas.types';

// ============================================
// Types
// ============================================

export interface WizardFormData {
  contrato_id: string;
  item_contrato_id: string;
  data_inicio: Date[];
  horario_entrada: Date | null;
  horario_saida: Date | null;
  medicos_selecionados: Usuario[];
  observacoes: string;
}

export interface PreviewData {
  contrato: Contrato | null;
  medicos: MedicoEscala[];
}

// ============================================
// Props
// ============================================

export interface WizardDialogProps {
  open: boolean;
  onClose: () => void;
  editingEscala: EscalaMedica | null;
  activeStep: number;
  setActiveStep: (step: number) => void;
  formData: WizardFormData;
  setFormData: (data: WizardFormData) => void;
  previewData: PreviewData;
  contratos: Contrato[];
  itensContrato: ItemContrato[];
  usuarios: Usuario[];
  loadingUsuarios: boolean;
  error: string;
  setError: (error: string) => void;
  onContratoChange: (contrato: Contrato | null) => void;
  onNext: () => void;
  onBack: () => void;
  onSave: () => void;
  onOpenCsvDialog: () => void;
  isTerceiro: boolean;
}

// ============================================
// Constants
// ============================================

const STEPS = ['Dados Básicos', 'Visualizar Escala', 'Confirmar'];

// ============================================
// Component
// ============================================

export const WizardDialog: React.FC<WizardDialogProps> = ({
  open,
  onClose,
  editingEscala,
  activeStep,
  setActiveStep: _setActiveStep,
  formData,
  setFormData,
  previewData,
  contratos,
  itensContrato,
  usuarios,
  loadingUsuarios,
  error,
  setError,
  onContratoChange,
  onNext,
  onBack,
  onSave,
  onOpenCsvDialog,
  isTerceiro,
}) => {
  const theme = useTheme();

  const handleClose = () => {
    // Dialog will not close on backdrop click or ESC, only on Cancel button
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={(_event, reason) => {
        // Prevent closing on backdrop click or ESC key
        if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
          return;
        }
        handleClose();
      }}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle sx={{ fontWeight: 700 }}>
        {editingEscala ? 'Editar Escala Médica' : 'Nova Escala Médica'}
      </DialogTitle>

      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ mb: 4, mt: 2 }}>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* Error message inside dialog */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* Step 0: Dados Básicos */}
        {activeStep === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
            <Autocomplete
              value={contratos.find((c) => c.id === formData.contrato_id) || null}
              onChange={(_, newValue) => onContratoChange(newValue)}
              options={contratos}
              getOptionLabel={(option) => `${option.nome} - ${option.empresa}`}
              renderInput={(params) => <TextField {...params} label="Contrato" required />}
              fullWidth
            />

            <Autocomplete
              value={itensContrato.find((i) => i.id === formData.item_contrato_id) || null}
              onChange={(_, newValue) =>
                setFormData({
                  ...formData,
                  item_contrato_id: newValue?.id || '',
                })
              }
              options={itensContrato}
              getOptionLabel={(option) => `${option.nome} (${option.unidade_medida})`}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Item de Contrato"
                  required
                  helperText="Selecione o item de contrato relacionado a esta escala"
                />
              )}
              disabled={!formData.contrato_id}
              fullWidth
            />

            {/* CSV Import Button - Appears after selecting contract and item */}
            {!editingEscala &&
              !isTerceiro &&
              formData.contrato_id &&
              formData.item_contrato_id && (
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    bgcolor: '#f0f9ff',
                    border: '1px dashed #0ea5e9',
                  }}
                >
                  <Box display="flex" alignItems="center" justifyContent="space-between" gap={2}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Info sx={{ color: '#0ea5e9' }} />
                      <Typography variant="body2" color="text.secondary">
                        Deseja importar múltiplas escalas de uma vez?
                      </Typography>
                    </Box>
                    <Button
                      variant="outlined"
                      startIcon={<UploadFile />}
                      onClick={onOpenCsvDialog}
                      sx={{
                        borderColor: '#0ea5e9',
                        color: '#0ea5e9',
                        '&:hover': {
                          borderColor: '#0284c7',
                          bgcolor: '#f0f9ff',
                        },
                      }}
                    >
                      Importar CSV
                    </Button>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Formato do CSV: cpf (8-13 dígitos), data_inicio (YYYY-MM-DD), horario_entrada,
                    horario_saida (HH:MM ou HH:MM:SS)
                  </Typography>
                </Box>
              )}

            {/* Multi-Date Picker */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                Datas de Início *
              </Typography>
              <Box
                sx={{
                  border: '1px solid',
                  borderColor:
                    theme.palette.mode === 'dark'
                      ? 'rgba(255, 255, 255, 0.23)'
                      : 'rgba(0, 0, 0, 0.23)',
                  borderRadius: 1,
                  padding: 2,
                  '&:hover': {
                    borderColor:
                      theme.palette.mode === 'dark'
                        ? 'rgba(255, 255, 255, 0.87)'
                        : 'rgba(0, 0, 0, 0.87)',
                  },
                }}
              >
                <MultiDatePicker
                  value={formData.data_inicio}
                  onChange={(dates: any) => {
                    const dateArray = Array.isArray(dates)
                      ? dates.map((d: any) => d.toDate?.() || d)
                      : [];
                    setFormData({ ...formData, data_inicio: dateArray });
                  }}
                  multiple
                  format="DD/MM/YYYY"
                  placeholder="Selecione uma ou mais datas"
                  style={{
                    width: '100%',
                    height: '40px',
                    fontSize: '16px',
                    padding: '8px',
                    backgroundColor: theme.palette.background.paper,
                    color: theme.palette.text.primary,
                    border: 'none',
                  }}
                  containerStyle={{
                    width: '100%',
                  }}
                  calendarPosition="bottom"
                />
                {formData.data_inicio.length > 0 && (
                  <Box
                    sx={{
                      mt: 1,
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 0.5,
                    }}
                  >
                    {formData.data_inicio.map((date, index) => (
                      <Chip
                        key={index}
                        label={format(date, 'dd/MM/yyyy')}
                        size="small"
                        onDelete={() => {
                          const newDates = formData.data_inicio.filter((_, i) => i !== index);
                          setFormData({
                            ...formData,
                            data_inicio: newDates,
                          });
                        }}
                      />
                    ))}
                  </Box>
                )}
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                Clique nas datas no calendário para selecionar múltiplas datas
              </Typography>
            </Box>

            {/* Time Pickers */}
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TimePicker
                  label="Horário de Entrada"
                  value={formData.horario_entrada}
                  onChange={(newValue) => setFormData({ ...formData, horario_entrada: newValue })}
                  slotProps={{
                    textField: { fullWidth: true, required: true },
                  }}
                  ampm={false}
                />
              </Grid>
              <Grid item xs={6}>
                <TimePicker
                  label="Horário de Saída"
                  value={formData.horario_saida}
                  onChange={(newValue) => setFormData({ ...formData, horario_saida: newValue })}
                  slotProps={{
                    textField: { fullWidth: true, required: true },
                  }}
                  ampm={false}
                />
              </Grid>
            </Grid>

            {/* Doctors Selection */}
            <Autocomplete
              multiple
              value={formData.medicos_selecionados}
              onChange={(_, newValue) => setFormData({ ...formData, medicos_selecionados: newValue })}
              options={usuarios}
              getOptionLabel={(option) => `${option.nome} - CPF: ${option.cpf}`}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              loading={loadingUsuarios}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Médicos"
                  required
                  helperText={
                    !formData.contrato_id
                      ? 'Selecione um contrato primeiro'
                      : loadingUsuarios
                        ? 'Carregando médicos...'
                        : usuarios.length === 0
                          ? 'Nenhum médico vinculado a este contrato'
                          : 'Selecione o médico vinculado a este contrato'
                  }
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {loadingUsuarios ? <CircularProgress color="inherit" size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              disabled={!formData.contrato_id || loadingUsuarios}
              noOptionsText="Nenhum médico encontrado para este contrato"
              fullWidth
            />

            {/* Observations */}
            <TextField
              label="Observações"
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              multiline
              rows={3}
              fullWidth
            />
          </Box>
        )}

        {/* Step 1: Visualizar Escala */}
        {activeStep === 1 && (
          <Box sx={{ mt: 2 }}>
            <Card
              sx={{
                mb: 3,
                bgcolor: 'primary.50',
                borderLeft: '4px solid',
                borderColor: 'primary.main',
              }}
            >
              <CardContent>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  {previewData.contrato?.nome}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {previewData.contrato?.empresa}
                </Typography>
                <Box display="flex" gap={2} mt={2} flexWrap="wrap">
                  {formData.data_inicio.length > 0 ? (
                    formData.data_inicio.map((date, index) => (
                      <Chip
                        key={index}
                        icon={<CalendarMonth />}
                        label={format(date, 'dd/MM/yyyy')}
                        color="primary"
                      />
                    ))
                  ) : (
                    <Chip icon={<CalendarMonth />} label="Nenhuma data selecionada" color="default" />
                  )}
                  <Chip
                    icon={<Schedule />}
                    label={`${
                      formData.horario_entrada ? format(formData.horario_entrada, 'HH:mm') : ''
                    } - ${formData.horario_saida ? format(formData.horario_saida, 'HH:mm') : ''}`}
                    color="primary"
                  />
                  <Chip
                    label={
                      itensContrato.find((i) => i.id === formData.item_contrato_id)?.nome ||
                      'Item não encontrado'
                    }
                    color="secondary"
                    variant="outlined"
                  />
                </Box>
              </CardContent>
            </Card>

            <Typography variant="h6" fontWeight={600} gutterBottom>
              Médicos Escalados ({previewData.medicos.length})
            </Typography>

            <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e0e0e0' }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.50' }}>
                    <TableCell>
                      <strong>Nome</strong>
                    </TableCell>
                    <TableCell>
                      <strong>CPF</strong>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {previewData.medicos.map((medico, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Person color="primary" />
                          {medico.nome}
                        </Box>
                      </TableCell>
                      <TableCell>{medico.cpf}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {formData.observacoes && (
              <Box mt={3}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Observações:</strong>
                </Typography>
                <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                  <Typography variant="body2">{formData.observacoes}</Typography>
                </Paper>
              </Box>
            )}
          </Box>
        )}

        {/* Step 2: Confirmar */}
        {activeStep === 2 && (
          <Box sx={{ mt: 2, textAlign: 'center', py: 4 }}>
            <Check sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h5" fontWeight={600} gutterBottom>
              Pronto para Salvar!
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Clique em "Salvar" para confirmar a criação da escala médica.
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={handleClose}>Cancelar</Button>
        {activeStep > 0 && (
          <Button onClick={onBack} startIcon={<ArrowBack />}>
            Voltar
          </Button>
        )}
        {activeStep < STEPS.length - 1 && (
          <Button onClick={onNext} variant="contained">
            Próximo
          </Button>
        )}
        {activeStep === STEPS.length - 1 && (
          <Button onClick={onSave} variant="contained" color="success" startIcon={<Check />}>
            Salvar
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default WizardDialog;
