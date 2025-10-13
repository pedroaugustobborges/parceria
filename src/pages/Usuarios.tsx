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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Alert,
  Chip,
} from '@mui/material';
import { DataGrid, GridColDef, GridToolbar } from '@mui/x-data-grid';
import { Edit, Delete, PersonAdd } from '@mui/icons-material';
import { supabase } from '../lib/supabase';
import { Usuario, UserRole, Contrato } from '../types/database.types';
import { format, parseISO } from 'date-fns';

const Usuarios: React.FC = () => {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingUsuario, setEditingUsuario] = useState<Usuario | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    nome: '',
    cpf: '',
    tipo: 'terceiro' as UserRole,
    contrato_id: '',
    password: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [{ data: usuariosData }, { data: contratosData }] = await Promise.all([
        supabase.from('usuarios').select('*').order('created_at', { ascending: false }),
        supabase.from('contratos').select('*').eq('ativo', true),
      ]);

      setUsuarios(usuariosData || []);
      setContratos(contratosData || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (usuario?: Usuario) => {
    if (usuario) {
      setEditingUsuario(usuario);
      setFormData({
        email: usuario.email,
        nome: usuario.nome,
        cpf: usuario.cpf,
        tipo: usuario.tipo,
        contrato_id: usuario.contrato_id || '',
        password: '',
      });
    } else {
      setEditingUsuario(null);
      setFormData({
        email: '',
        nome: '',
        cpf: '',
        tipo: 'terceiro',
        contrato_id: '',
        password: '',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingUsuario(null);
    setError('');
  };

  const handleSave = async () => {
    try {
      setError('');
      setSuccess('');

      if (!formData.email || !formData.nome || !formData.cpf) {
        setError('Preencha todos os campos obrigatórios');
        return;
      }

      if (editingUsuario) {
        // Atualizar usuário existente
        const updateData: any = {
          email: formData.email,
          nome: formData.nome,
          cpf: formData.cpf,
          tipo: formData.tipo,
          contrato_id: formData.contrato_id || null,
        };
        const { error: updateError } = await supabase
          .from('usuarios')
          .update(updateData)
          .eq('id', editingUsuario.id);

        if (updateError) throw updateError;
        setSuccess('Usuário atualizado com sucesso!');
      } else {
        // Criar novo usuário no Supabase Auth
        if (!formData.password) {
          setError('Senha é obrigatória para novos usuários');
          return;
        }

        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
        });

        if (authError) throw authError;

        if (authData.user) {
          // Criar registro na tabela usuarios
          const { error: insertError } = await supabase
            .from('usuarios')
            .insert({
              id: authData.user.id,
              email: formData.email,
              nome: formData.nome,
              cpf: formData.cpf,
              tipo: formData.tipo,
              contrato_id: formData.contrato_id || null,
            } as any);

          if (insertError) throw insertError;

          // Se for terceiro, criar vínculo com contrato
          if (formData.tipo !== 'administrador-agir' && formData.contrato_id) {
            await supabase.from('usuario_contrato').insert({
              usuario_id: authData.user.id,
              contrato_id: formData.contrato_id,
              cpf: formData.cpf,
            } as any);
          }

          setSuccess('Usuário criado com sucesso!');
        }
      }

      handleCloseDialog();
      loadData();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar usuário');
    }
  };

  const handleDelete = async (usuario: Usuario) => {
    if (!window.confirm(`Tem certeza que deseja excluir ${usuario.nome}?`)) return;

    try {
      const { error: deleteError } = await supabase
        .from('usuarios')
        .delete()
        .eq('id', usuario.id);

      if (deleteError) throw deleteError;

      setSuccess('Usuário excluído com sucesso!');
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const getRoleColor = (tipo: UserRole): 'primary' | 'secondary' | 'default' => {
    const colors: Record<UserRole, 'primary' | 'secondary' | 'default'> = {
      'administrador-agir': 'primary',
      'administrador-terceiro': 'secondary',
      'terceiro': 'default',
    };
    return colors[tipo];
  };

  const columns: GridColDef[] = [
    {
      field: 'nome',
      headerName: 'Nome',
      flex: 1,
      minWidth: 200,
      renderCell: (params) => (
        <Box>
          <Typography variant="body2" fontWeight={600}>
            {params.value}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {params.row.email}
          </Typography>
        </Box>
      ),
    },
    { field: 'cpf', headerName: 'CPF', width: 140 },
    {
      field: 'tipo',
      headerName: 'Tipo',
      width: 180,
      renderCell: (params) => (
        <Chip
          label={
            params.value === 'administrador-agir'
              ? 'Admin Agir'
              : params.value === 'administrador-terceiro'
              ? 'Admin Terceiro'
              : 'Terceiro'
          }
          color={getRoleColor(params.value)}
          size="small"
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
    <Box>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Gestão de Usuários
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Cadastre e gerencie os usuários do sistema
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<PersonAdd />}
          onClick={() => handleOpenDialog()}
          sx={{
            background: 'linear-gradient(135deg, #0ea5e9 0%, #8b5cf6 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #0284c7 0%, #7c3aed 100%)',
            },
          }}
        >
          Novo Usuário
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
              rows={usuarios}
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
          {editingUsuario ? 'Editar Usuário' : 'Novo Usuário'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              label="Nome Completo"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              fullWidth
              required
            />

            <TextField
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              fullWidth
              required
              disabled={!!editingUsuario}
            />

            <TextField
              label="CPF"
              value={formData.cpf}
              onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
              fullWidth
              required
            />

            {!editingUsuario && (
              <TextField
                label="Senha"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                fullWidth
                required
                helperText="Mínimo 6 caracteres"
              />
            )}

            <FormControl fullWidth required>
              <InputLabel>Tipo de Usuário</InputLabel>
              <Select
                value={formData.tipo}
                label="Tipo de Usuário"
                onChange={(e) => setFormData({ ...formData, tipo: e.target.value as UserRole })}
              >
                <MenuItem value="administrador-agir">Administrador Agir</MenuItem>
                <MenuItem value="administrador-terceiro">Administrador Terceiro</MenuItem>
                <MenuItem value="terceiro">Terceiro</MenuItem>
              </Select>
            </FormControl>

            {formData.tipo !== 'administrador-agir' && (
              <FormControl fullWidth>
                <InputLabel>Contrato</InputLabel>
                <Select
                  value={formData.contrato_id}
                  label="Contrato"
                  onChange={(e) => setFormData({ ...formData, contrato_id: e.target.value })}
                >
                  <MenuItem value="">Nenhum</MenuItem>
                  {contratos.map((contrato) => (
                    <MenuItem key={contrato.id} value={contrato.id}>
                      {contrato.nome} - {contrato.empresa}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
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
  );
};

export default Usuarios;
