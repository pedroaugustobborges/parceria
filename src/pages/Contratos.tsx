import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Alert,
  Chip,
  Switch,
  FormControlLabel,
} from '@mui/material';
import { DataGrid, GridColDef, GridToolbar } from '@mui/x-data-grid';
import { Add, Edit, Delete, Description } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../lib/supabase';
import { Contrato } from '../types/database.types';
import { format, parseISO } from 'date-fns';

const Contratos: React.FC = () => {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingContrato, setEditingContrato] = useState<Contrato | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    nome: '',
    empresa: '',
    data_inicio: null as Date | null,
    data_fim: null as Date | null,
    ativo: true,
  });

  useEffect(() => {
    loadContratos();
  }, []);

  const loadContratos = async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('contratos')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setContratos(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (contrato?: Contrato) => {
    if (contrato) {
      setEditingContrato(contrato);
      setFormData({
        nome: contrato.nome,
        empresa: contrato.empresa,
        data_inicio: parseISO(contrato.data_inicio),
        data_fim: contrato.data_fim ? parseISO(contrato.data_fim) : null,
        ativo: contrato.ativo,
      });
    } else {
      setEditingContrato(null);
      setFormData({
        nome: '',
        empresa: '',
        data_inicio: null,
        data_fim: null,
        ativo: true,
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingContrato(null);
    setError('');
  };

  const handleSave = async () => {
    try {
      setError('');
      setSuccess('');

      if (!formData.nome || !formData.empresa || !formData.data_inicio) {
        setError('Preencha todos os campos obrigatórios');
        return;
      }

      const contratoData = {
        nome: formData.nome,
        empresa: formData.empresa,
        data_inicio: formData.data_inicio.toISOString(),
        data_fim: formData.data_fim ? formData.data_fim.toISOString() : null,
        ativo: formData.ativo,
      };

      if (editingContrato) {
        const { error: updateError } = await supabase
          .from('contratos')
          .update(contratoData)
          .eq('id', editingContrato.id);

        if (updateError) throw updateError;
        setSuccess('Contrato atualizado com sucesso!');
      } else {
        const { error: insertError } = await supabase
          .from('contratos')
          .insert(contratoData);

        if (insertError) throw insertError;
        setSuccess('Contrato criado com sucesso!');
      }

      handleCloseDialog();
      loadContratos();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar contrato');
    }
  };

  const handleDelete = async (contrato: Contrato) => {
    if (!window.confirm(`Tem certeza que deseja excluir o contrato ${contrato.nome}?`)) return;

    try {
      const { error: deleteError } = await supabase
        .from('contratos')
        .delete()
        .eq('id', contrato.id);

      if (deleteError) throw deleteError;

      setSuccess('Contrato excluído com sucesso!');
      loadContratos();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleToggleAtivo = async (contrato: Contrato) => {
    try {
      const { error: updateError } = await supabase
        .from('contratos')
        .update({ ativo: !contrato.ativo })
        .eq('id', contrato.id);

      if (updateError) throw updateError;

      setSuccess(`Contrato ${!contrato.ativo ? 'ativado' : 'desativado'} com sucesso!`);
      loadContratos();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const columns: GridColDef[] = [
    {
      field: 'nome',
      headerName: 'Nome do Contrato',
      flex: 1,
      minWidth: 250,
      renderCell: (params) => (
        <Box>
          <Typography variant="body2" fontWeight={600}>
            {params.value}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {params.row.empresa}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'data_inicio',
      headerName: 'Início',
      width: 120,
      renderCell: (params) => format(parseISO(params.value), 'dd/MM/yyyy'),
    },
    {
      field: 'data_fim',
      headerName: 'Fim',
      width: 120,
      renderCell: (params) =>
        params.value ? format(parseISO(params.value), 'dd/MM/yyyy') : 'Indeterminado',
    },
    {
      field: 'ativo',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value ? 'Ativo' : 'Inativo'}
          color={params.value ? 'success' : 'default'}
          size="small"
          onClick={() => handleToggleAtivo(params.row)}
          sx={{ cursor: 'pointer' }}
        />
      ),
    },
    {
      field: 'created_at',
      headerName: 'Cadastro',
      width: 120,
      renderCell: (params) => format(parseISO(params.value), 'dd/MM/yyyy'),
    },
    {
      field: 'actions',
      headerName: 'Ações',
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <Box>
          <IconButton
            size="small"
            color="primary"
            onClick={() => handleOpenDialog(params.row)}
          >
            <Edit fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            color="error"
            onClick={() => handleDelete(params.row)}
          >
            <Delete fontSize="small" />
          </IconButton>
        </Box>
      ),
    },
  ];

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ptBR}>
      <Box>
        <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" fontWeight={700} gutterBottom>
              Gestão de Contratos
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Cadastre e gerencie os contratos com empresas terceiras
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => handleOpenDialog()}
            sx={{
              background: 'linear-gradient(135deg, #0ea5e9 0%, #8b5cf6 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #0284c7 0%, #7c3aed 100%)',
              },
            }}
          >
            Novo Contrato
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess('')}>
            {success}
          </Alert>
        )}

        <Card>
          <CardContent>
            <Box sx={{ height: 600, width: '100%' }}>
              <DataGrid
                rows={contratos}
                columns={columns}
                loading={loading}
                pageSizeOptions={[10, 25, 50]}
                initialState={{
                  pagination: { paginationModel: { pageSize: 25 } },
                }}
                slots={{ toolbar: GridToolbar }}
                slotProps={{
                  toolbar: {
                    showQuickFilter: true,
                  },
                }}
                disableRowSelectionOnClick
              />
            </Box>
          </CardContent>
        </Card>

        {/* Dialog de Cadastro/Edição */}
        <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Description color="primary" />
              {editingContrato ? 'Editar Contrato' : 'Novo Contrato'}
            </Box>
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              <TextField
                label="Nome do Contrato"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                fullWidth
                required
                helperText="Ex: Contrato de Manutenção 2024"
              />

              <TextField
                label="Empresa Contratada"
                value={formData.empresa}
                onChange={(e) => setFormData({ ...formData, empresa: e.target.value })}
                fullWidth
                required
                helperText="Nome da empresa terceirizada"
              />

              <DatePicker
                label="Data de Início"
                value={formData.data_inicio}
                onChange={(newValue) => setFormData({ ...formData, data_inicio: newValue })}
                slotProps={{ textField: { fullWidth: true, required: true } }}
              />

              <DatePicker
                label="Data de Fim (Opcional)"
                value={formData.data_fim}
                onChange={(newValue) => setFormData({ ...formData, data_fim: newValue })}
                slotProps={{ textField: { fullWidth: true } }}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={formData.ativo}
                    onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                    color="primary"
                  />
                }
                label="Contrato Ativo"
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancelar</Button>
            <Button onClick={handleSave} variant="contained">
              Salvar
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default Contratos;
