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
  Autocomplete,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Divider,
} from '@mui/material';
import { DataGrid, GridColDef, GridToolbar } from '@mui/x-data-grid';
import { Add, Edit, Delete, Description, Remove, Inventory } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../lib/supabase';
import { Contrato, ItemContrato, ContratoItem, Parceiro } from '../types/database.types';
import { format, parseISO } from 'date-fns';

interface ItemSelecionado {
  item: ItemContrato;
  quantidade: number;
  valor_unitario: number;
  observacoes: string;
}

const Contratos: React.FC = () => {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingContrato, setEditingContrato] = useState<Contrato | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Items state
  const [itensDisponiveis, setItensDisponiveis] = useState<ItemContrato[]>([]);
  const [itensSelecionados, setItensSelecionados] = useState<ItemSelecionado[]>([]);
  const [itemParaAdicionar, setItemParaAdicionar] = useState<ItemContrato | null>(null);

  // Parceiros state
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    nome: '',
    numero_contrato: '',
    empresa: '',
    data_inicio: null as Date | null,
    data_fim: null as Date | null,
    ativo: true,
  });

  useEffect(() => {
    loadContratos();
    loadItens();
    loadParceiros();
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

  const loadItens = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('itens_contrato')
        .select('*')
        .eq('ativo', true)
        .order('nome');

      if (fetchError) throw fetchError;
      setItensDisponiveis(data || []);
    } catch (err: any) {
      console.error('Erro ao carregar itens:', err);
    }
  };

  const loadParceiros = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('parceiros')
        .select('*')
        .eq('ativo', true)
        .order('nome');

      if (fetchError) throw fetchError;
      setParceiros(data || []);
    } catch (err: any) {
      console.error('Erro ao carregar parceiros:', err);
    }
  };

  const loadContratoItens = async (contratoId: string) => {
    try {
      const { data, error } = await supabase
        .from('contrato_itens')
        .select('*, item:itens_contrato(*)')
        .eq('contrato_id', contratoId);

      if (error) throw error;

      const itens: ItemSelecionado[] = (data || []).map((ci: any) => ({
        item: ci.item,
        quantidade: ci.quantidade,
        valor_unitario: ci.valor_unitario || 0,
        observacoes: ci.observacoes || '',
      }));

      setItensSelecionados(itens);
    } catch (err: any) {
      console.error('Erro ao carregar itens do contrato:', err);
    }
  };

  const handleOpenDialog = async (contrato?: Contrato) => {
    if (contrato) {
      setEditingContrato(contrato);
      setFormData({
        nome: contrato.nome,
        numero_contrato: contrato.numero_contrato || '',
        empresa: contrato.empresa,
        data_inicio: parseISO(contrato.data_inicio),
        data_fim: contrato.data_fim ? parseISO(contrato.data_fim) : null,
        ativo: contrato.ativo,
      });
      await loadContratoItens(contrato.id);
    } else {
      setEditingContrato(null);
      setFormData({
        nome: '',
        numero_contrato: '',
        empresa: '',
        data_inicio: null,
        data_fim: null,
        ativo: true,
      });
      setItensSelecionados([]);
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingContrato(null);
    setItensSelecionados([]);
    setItemParaAdicionar(null);
    setError('');
  };

  const handleAdicionarItem = () => {
    if (!itemParaAdicionar) return;

    // Check if item already added
    if (itensSelecionados.some(is => is.item.id === itemParaAdicionar.id)) {
      setError('Este item já foi adicionado ao contrato');
      return;
    }

    setItensSelecionados([
      ...itensSelecionados,
      {
        item: itemParaAdicionar,
        quantidade: 1,
        valor_unitario: 0,
        observacoes: '',
      },
    ]);
    setItemParaAdicionar(null);
  };

  const handleRemoverItem = (itemId: string) => {
    setItensSelecionados(itensSelecionados.filter(is => is.item.id !== itemId));
  };

  const handleUpdateItemQuantidade = (itemId: string, quantidade: number) => {
    setItensSelecionados(
      itensSelecionados.map(is =>
        is.item.id === itemId ? { ...is, quantidade } : is
      )
    );
  };

  const handleUpdateItemValor = (itemId: string, valor_unitario: number) => {
    setItensSelecionados(
      itensSelecionados.map(is =>
        is.item.id === itemId ? { ...is, valor_unitario } : is
      )
    );
  };

  const handleSave = async () => {
    try {
      setError('');
      setSuccess('');

      if (!formData.nome || !formData.empresa || !formData.data_inicio) {
        setError('Preencha todos os campos obrigatórios');
        return;
      }

      const contratoData: any = {
        nome: formData.nome,
        numero_contrato: formData.numero_contrato || null,
        empresa: formData.empresa,
        data_inicio: formData.data_inicio.toISOString(),
        data_fim: formData.data_fim ? formData.data_fim.toISOString() : null,
        ativo: formData.ativo,
      };

      let contratoId: string;

      if (editingContrato) {
        // Update contract
        const { error: updateError } = await supabase
          .from('contratos')
          .update(contratoData)
          .eq('id', editingContrato.id);

        if (updateError) throw updateError;
        contratoId = editingContrato.id;

        // Delete existing items and insert new ones
        await supabase
          .from('contrato_itens')
          .delete()
          .eq('contrato_id', contratoId);

        setSuccess('Contrato atualizado com sucesso!');
      } else {
        // Create new contract
        const { data: newContrato, error: insertError } = await supabase
          .from('contratos')
          .insert(contratoData)
          .select()
          .single();

        if (insertError) throw insertError;
        contratoId = newContrato.id;
        setSuccess('Contrato criado com sucesso!');
      }

      // Insert contract items
      if (itensSelecionados.length > 0) {
        const contratoItensData = itensSelecionados.map(is => ({
          contrato_id: contratoId,
          item_id: is.item.id,
          quantidade: is.quantidade,
          valor_unitario: is.valor_unitario,
          observacoes: is.observacoes,
        }));

        const { error: itensError } = await supabase
          .from('contrato_itens')
          .insert(contratoItensData);

        if (itensError) throw itensError;
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
      const updateData: any = { ativo: !contrato.ativo };
      const { error: updateError } = await supabase
        .from('contratos')
        .update(updateData)
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
      field: 'numero_contrato',
      headerName: 'Número',
      width: 150,
      renderCell: (params) => params.value || '-',
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
                label="Número do Contrato"
                value={formData.numero_contrato}
                onChange={(e) => setFormData({ ...formData, numero_contrato: e.target.value })}
                fullWidth
                helperText="Ex: 001/2024, CT-2024-001, etc."
              />

              <Autocomplete
                value={parceiros.find(p => p.nome === formData.empresa) || null}
                onChange={(_, newValue) => setFormData({ ...formData, empresa: newValue?.nome || '' })}
                options={parceiros}
                getOptionLabel={(option) => option.nome}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Empresa Contratada"
                    required
                    helperText="Selecione a empresa parceira"
                  />
                )}
                fullWidth
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

              <Divider sx={{ my: 2 }} />

              {/* Seção de Itens do Contrato */}
              <Box>
                <Typography variant="h6" fontWeight={600} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Inventory color="primary" />
                  Itens do Contrato
                </Typography>

                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <Autocomplete
                    value={itemParaAdicionar}
                    onChange={(_, newValue) => setItemParaAdicionar(newValue)}
                    options={itensDisponiveis}
                    getOptionLabel={(option) => `${option.nome} (${option.unidade_medida})`}
                    renderInput={(params) => <TextField {...params} label="Selecione um item" size="small" />}
                    sx={{ flex: 1 }}
                    size="small"
                  />
                  <Button
                    variant="contained"
                    onClick={handleAdicionarItem}
                    disabled={!itemParaAdicionar}
                    size="small"
                  >
                    Adicionar
                  </Button>
                </Box>

                {itensSelecionados.length > 0 && (
                  <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 300 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Item</TableCell>
                          <TableCell width={100}>Quantidade</TableCell>
                          <TableCell width={50}>Ações</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {itensSelecionados.map((is) => (
                          <TableRow key={is.item.id}>
                            <TableCell>
                              <Typography variant="body2" fontWeight={600}>
                                {is.item.nome}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {is.item.unidade_medida}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <TextField
                                type="number"
                                value={is.quantidade}
                                onChange={(e) =>
                                  handleUpdateItemQuantidade(is.item.id, parseFloat(e.target.value) || 0)
                                }
                                size="small"
                                inputProps={{ min: 0, step: 0.01 }}
                                fullWidth
                              />
                            </TableCell>
                            <TableCell>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleRemoverItem(is.item.id)}
                              >
                                <Remove fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}

                {itensSelecionados.length === 0 && (
                  <Alert severity="info">Nenhum item adicionado ao contrato</Alert>
                )}
              </Box>
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
