import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Autocomplete,
  Grid,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
} from '@mui/material';
import { DataGrid, GridColDef, GridToolbar } from '@mui/x-data-grid';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ptBR } from 'date-fns/locale';
import { FilterList, Refresh, TrendingUp, AccessTime, People } from '@mui/icons-material';
import { supabase } from '../lib/supabase';
import { Acesso, HorasCalculadas } from '../types/database.types';
import { useAuth } from '../contexts/AuthContext';
import { format, parseISO, differenceInMinutes } from 'date-fns';

const Dashboard: React.FC = () => {
  const { userProfile, isAdminTerceiro, isTerceiro } = useAuth();
  const [acessos, setAcessos] = useState<Acesso[]>([]);
  const [horasCalculadas, setHorasCalculadas] = useState<HorasCalculadas[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filtros
  const [filtroTipo, setFiltroTipo] = useState<string | null>(null);
  const [filtroMatricula, setFiltroMatricula] = useState<string | null>(null);
  const [filtroNome, setFiltroNome] = useState<string | null>(null);
  const [filtroCpf, setFiltroCpf] = useState<string | null>(null);
  const [filtroDataInicio, setFiltroDataInicio] = useState<Date | null>(null);
  const [filtroDataFim, setFiltroDataFim] = useState<Date | null>(null);

  useEffect(() => {
    loadAcessos();
  }, []);

  useEffect(() => {
    if (acessos.length > 0) {
      calcularHoras();
    }
  }, [acessos, filtroTipo, filtroMatricula, filtroNome, filtroCpf, filtroDataInicio, filtroDataFim]);

  const loadAcessos = async () => {
    try {
      setLoading(true);
      setError('');

      let query = supabase.from('acessos').select('*');

      // Aplicar filtros baseados no tipo de usuário
      if (isTerceiro && userProfile) {
        query = query.eq('cpf', userProfile.cpf);
      } else if (isAdminTerceiro && userProfile?.contrato_id) {
        // Buscar CPFs dos usuários vinculados ao contrato do administrador
        const { data: usuariosContrato } = await supabase
          .from('usuario_contrato')
          .select('cpf')
          .eq('contrato_id', userProfile.contrato_id);

        if (usuariosContrato && usuariosContrato.length > 0) {
          const cpfs = usuariosContrato.map((u: any) => u.cpf);
          query = query.in('cpf', cpfs);
        }
      }

      const { data, error: fetchError } = await query.order('data_acesso', { ascending: false });

      if (fetchError) throw fetchError;

      setAcessos(data || []);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar acessos');
      console.error('Erro:', err);
    } finally {
      setLoading(false);
    }
  };

  const calcularHoras = () => {
    const acessosFiltrados = acessos.filter((acesso) => {
      if (filtroTipo && acesso.tipo !== filtroTipo) return false;
      if (filtroMatricula && acesso.matricula !== filtroMatricula) return false;
      if (filtroNome && !acesso.nome.toLowerCase().includes(filtroNome.toLowerCase())) return false;
      if (filtroCpf && acesso.cpf !== filtroCpf) return false;
      if (filtroDataInicio && new Date(acesso.data_acesso) < filtroDataInicio) return false;
      if (filtroDataFim && new Date(acesso.data_acesso) > filtroDataFim) return false;
      return true;
    });

    // Agrupar por CPF
    const acessosPorCpf = acessosFiltrados.reduce((acc, acesso) => {
      if (!acc[acesso.cpf]) {
        acc[acesso.cpf] = [];
      }
      acc[acesso.cpf].push(acesso);
      return acc;
    }, {} as Record<string, Acesso[]>);

    // Calcular horas para cada CPF
    const resultado: HorasCalculadas[] = Object.entries(acessosPorCpf).map(([cpf, acessosCpf]) => {
      const entradas = acessosCpf.filter((a) => a.sentido === 'E').sort((a, b) =>
        new Date(a.data_acesso).getTime() - new Date(b.data_acesso).getTime()
      );
      const saidas = acessosCpf.filter((a) => a.sentido === 'S').sort((a, b) =>
        new Date(a.data_acesso).getTime() - new Date(b.data_acesso).getTime()
      );

      let totalMinutos = 0;

      // Parear entradas com saídas
      for (let i = 0; i < entradas.length; i++) {
        if (i < saidas.length) {
          const entrada = parseISO(entradas[i].data_acesso);
          const saida = parseISO(saidas[i].data_acesso);

          if (saida > entrada) {
            const minutos = differenceInMinutes(saida, entrada);
            totalMinutos += minutos;
          }
        }
      }

      const totalHoras = totalMinutos / 60;
      const ultimoAcesso = acessosCpf[0]; // Já está ordenado por data_acesso desc

      return {
        cpf,
        nome: ultimoAcesso.nome,
        matricula: ultimoAcesso.matricula,
        tipo: ultimoAcesso.tipo,
        totalHoras: parseFloat(totalHoras.toFixed(2)),
        entradas: entradas.length,
        saidas: saidas.length,
        ultimoAcesso: ultimoAcesso.data_acesso,
      };
    });

    setHorasCalculadas(resultado.sort((a, b) => b.totalHoras - a.totalHoras));
  };

  // Opções para autocomplete
  const tiposUnicos = useMemo(() => [...new Set(acessos.map((a) => a.tipo))].sort(), [acessos]);
  const matriculasUnicas = useMemo(() => [...new Set(acessos.map((a) => a.matricula))].sort(), [acessos]);
  const nomesUnicos = useMemo(() => [...new Set(acessos.map((a) => a.nome))].sort(), [acessos]);
  const cpfsUnicos = useMemo(() => [...new Set(acessos.map((a) => a.cpf))].sort(), [acessos]);

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
            {params.row.matricula}
          </Typography>
        </Box>
      ),
    },
    { field: 'cpf', headerName: 'CPF', width: 140 },
    {
      field: 'tipo',
      headerName: 'Tipo',
      width: 130,
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color="primary"
          variant="outlined"
        />
      ),
    },
    {
      field: 'totalHoras',
      headerName: 'Total de Horas',
      width: 140,
      type: 'number',
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <AccessTime fontSize="small" color="action" />
          <Typography variant="body2" fontWeight={600} color="primary">
            {params.value}h
          </Typography>
        </Box>
      ),
    },
    {
      field: 'entradas',
      headerName: 'Entradas',
      width: 100,
      type: 'number',
      renderCell: (params) => (
        <Chip label={params.value} size="small" color="success" />
      ),
    },
    {
      field: 'saidas',
      headerName: 'Saídas',
      width: 100,
      type: 'number',
      renderCell: (params) => (
        <Chip label={params.value} size="small" color="error" />
      ),
    },
    {
      field: 'ultimoAcesso',
      headerName: 'Último Acesso',
      width: 180,
      renderCell: (params) => (
        <Typography variant="body2">
          {format(parseISO(params.value), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
        </Typography>
      ),
    },
  ];

  // Estatísticas
  const totalPessoas = horasCalculadas.length;
  const totalHorasGeral = horasCalculadas.reduce((sum, item) => sum + item.totalHoras, 0);
  const mediaHoras = totalPessoas > 0 ? (totalHorasGeral / totalPessoas).toFixed(2) : '0';

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ptBR}>
      <Box>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Dashboard de Acessos
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Acompanhe e analise os acessos e horas trabalhadas
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Estatísticas */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={4}>
            <Card sx={{ height: '100%', background: 'linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'white' }}>
                  <Box>
                    <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                      Total de Pessoas
                    </Typography>
                    <Typography variant="h3" fontWeight={700}>
                      {totalPessoas}
                    </Typography>
                  </Box>
                  <People sx={{ fontSize: 48, opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <Card sx={{ height: '100%', background: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'white' }}>
                  <Box>
                    <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                      Total de Horas
                    </Typography>
                    <Typography variant="h3" fontWeight={700}>
                      {totalHorasGeral.toFixed(0)}h
                    </Typography>
                  </Box>
                  <AccessTime sx={{ fontSize: 48, opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <Card sx={{ height: '100%', background: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'white' }}>
                  <Box>
                    <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                      Média de Horas
                    </Typography>
                    <Typography variant="h3" fontWeight={700}>
                      {mediaHoras}h
                    </Typography>
                  </Box>
                  <TrendingUp sx={{ fontSize: 48, opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Filtros */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 1 }}>
              <FilterList color="primary" />
              <Typography variant="h6" fontWeight={600}>
                Filtros Avançados
              </Typography>
              <Box sx={{ flexGrow: 1 }} />
              <Tooltip title="Atualizar dados">
                <IconButton onClick={loadAcessos} color="primary">
                  <Refresh />
                </IconButton>
              </Tooltip>
            </Box>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <Autocomplete
                  value={filtroTipo}
                  onChange={(_, newValue) => setFiltroTipo(newValue)}
                  options={tiposUnicos}
                  renderInput={(params) => <TextField {...params} label="Tipo" />}
                  size="small"
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Autocomplete
                  value={filtroMatricula}
                  onChange={(_, newValue) => setFiltroMatricula(newValue)}
                  options={matriculasUnicas}
                  renderInput={(params) => <TextField {...params} label="Matrícula" />}
                  size="small"
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Autocomplete
                  value={filtroNome}
                  onChange={(_, newValue) => setFiltroNome(newValue)}
                  options={nomesUnicos}
                  renderInput={(params) => <TextField {...params} label="Nome" />}
                  size="small"
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Autocomplete
                  value={filtroCpf}
                  onChange={(_, newValue) => setFiltroCpf(newValue)}
                  options={cpfsUnicos}
                  renderInput={(params) => <TextField {...params} label="CPF" />}
                  size="small"
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <DatePicker
                  label="Data Início"
                  value={filtroDataInicio}
                  onChange={(newValue) => setFiltroDataInicio(newValue)}
                  slotProps={{ textField: { size: 'small', fullWidth: true } }}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <DatePicker
                  label="Data Fim"
                  value={filtroDataFim}
                  onChange={(newValue) => setFiltroDataFim(newValue)}
                  slotProps={{ textField: { size: 'small', fullWidth: true } }}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Tabela */}
        <Card>
          <CardContent>
            <Box sx={{ height: 600, width: '100%' }}>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <CircularProgress />
                </Box>
              ) : (
                <DataGrid
                  rows={horasCalculadas}
                  columns={columns}
                  getRowId={(row) => row.cpf}
                  pageSizeOptions={[10, 25, 50, 100]}
                  initialState={{
                    pagination: { paginationModel: { pageSize: 25 } },
                  }}
                  slots={{ toolbar: GridToolbar }}
                  slotProps={{
                    toolbar: {
                      showQuickFilter: true,
                      quickFilterProps: { debounceMs: 500 },
                    },
                  }}
                  disableRowSelectionOnClick
                  sx={{
                    border: 'none',
                    '& .MuiDataGrid-cell:focus': {
                      outline: 'none',
                    },
                  }}
                />
              )}
            </Box>
          </CardContent>
        </Card>
      </Box>
    </LocalizationProvider>
  );
};

export default Dashboard;
