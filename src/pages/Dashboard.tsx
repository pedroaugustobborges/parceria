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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
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
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ptBR } from 'date-fns/locale';
import { FilterList, Refresh, TrendingUp, AccessTime, People, Download, Close, LoginOutlined, LogoutOutlined, Warning } from '@mui/icons-material';
import { supabase } from '../lib/supabase';
import { Acesso, HorasCalculadas, Contrato } from '../types/database.types';
import { useAuth } from '../contexts/AuthContext';
import { format, parseISO, differenceInMinutes } from 'date-fns';

const Dashboard: React.FC = () => {
  const { userProfile, isAdminTerceiro, isTerceiro } = useAuth();
  const [acessos, setAcessos] = useState<Acesso[]>([]);
  const [horasCalculadas, setHorasCalculadas] = useState<HorasCalculadas[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filtros - Agora com múltiplas seleções
  const [filtroTipo, setFiltroTipo] = useState<string[]>([]);
  const [filtroMatricula, setFiltroMatricula] = useState<string[]>([]);
  const [filtroNome, setFiltroNome] = useState<string[]>([]);
  const [filtroCpf, setFiltroCpf] = useState<string[]>([]);
  const [filtroContrato, setFiltroContrato] = useState<Contrato | null>(null);
  const [filtroDataInicio, setFiltroDataInicio] = useState<Date | null>(null);
  const [filtroDataFim, setFiltroDataFim] = useState<Date | null>(null);

  // Modal de detalhes
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<HorasCalculadas | null>(null);
  const [personAcessos, setPersonAcessos] = useState<Acesso[]>([]);

  // Modal de aviso de contrato
  const [contratoWarningOpen, setContratoWarningOpen] = useState(false);
  const [pendingContrato, setPendingContrato] = useState<Contrato | null>(null);

  useEffect(() => {
    loadAcessos();
    loadContratos();
  }, []);

  useEffect(() => {
    if (acessos.length > 0) {
      calcularHoras();
    }
  }, [acessos, filtroTipo, filtroMatricula, filtroNome, filtroCpf, filtroContrato, filtroDataInicio, filtroDataFim]);

  const loadContratos = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('contratos')
        .select('*')
        .eq('ativo', true)
        .order('nome');

      if (fetchError) throw fetchError;
      setContratos(data || []);
    } catch (err: any) {
      console.error('Erro ao carregar contratos:', err);
    }
  };

  const loadAcessos = async () => {
    try {
      setLoading(true);
      setError('');

      // Carregar todos os registros usando paginação
      const pageSize = 1000;
      let allAcessos: Acesso[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from('acessos')
          .select('*')
          .order('data_acesso', { ascending: false })
          .range(from, from + pageSize - 1);

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

        const { data, error: fetchError } = await query;

        if (fetchError) throw fetchError;

        if (data && data.length > 0) {
          allAcessos = [...allAcessos, ...data];
          from += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      setAcessos(allAcessos);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar acessos');
      console.error('Erro:', err);
    } finally {
      setLoading(false);
    }
  };

  const calcularHoras = async () => {
    // Se há filtro de contrato, buscar CPFs vinculados
    let cpfsDoContrato: string[] = [];
    if (filtroContrato) {
      try {
        const { data: usuariosContrato } = await supabase
          .from('usuario_contrato')
          .select('cpf')
          .eq('contrato_id', filtroContrato.id);

        if (usuariosContrato && usuariosContrato.length > 0) {
          cpfsDoContrato = usuariosContrato.map((u: any) => u.cpf);
        }
      } catch (err) {
        console.error('Erro ao buscar CPFs do contrato:', err);
      }
    }

    const acessosFiltrados = acessos.filter((acesso) => {
      // Filtro de múltiplas seleções
      if (filtroTipo.length > 0 && !filtroTipo.includes(acesso.tipo)) return false;
      if (filtroMatricula.length > 0 && !filtroMatricula.includes(acesso.matricula)) return false;
      if (filtroNome.length > 0 && !filtroNome.includes(acesso.nome)) return false;
      if (filtroCpf.length > 0 && !filtroCpf.includes(acesso.cpf)) return false;

      // Filtro de contrato
      if (filtroContrato && cpfsDoContrato.length > 0 && !cpfsDoContrato.includes(acesso.cpf)) return false;

      // Filtros de data
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
      // Ordenar todos os acessos por data
      const acessosOrdenados = acessosCpf.sort((a, b) =>
        new Date(a.data_acesso).getTime() - new Date(b.data_acesso).getTime()
      );

      // Agrupar por dia (YYYY-MM-DD)
      const acessosPorDia = acessosOrdenados.reduce((acc, acesso) => {
        const data = format(parseISO(acesso.data_acesso), 'yyyy-MM-dd');
        if (!acc[data]) {
          acc[data] = [];
        }
        acc[data].push(acesso);
        return acc;
      }, {} as Record<string, Acesso[]>);

      let totalMinutos = 0;
      let totalEntradas = 0;
      let totalSaidas = 0;

      // Para cada dia, calcular a diferença entre primeira entrada e última saída
      const diasOrdenados = Object.keys(acessosPorDia).sort();

      for (let i = 0; i < diasOrdenados.length; i++) {
        const dia = diasOrdenados[i];
        const acessosDia = acessosPorDia[dia];

        const entradasDia = acessosDia.filter((a) => a.sentido === 'E');
        const saidasDia = acessosDia.filter((a) => a.sentido === 'S');

        totalEntradas += entradasDia.length;
        totalSaidas += saidasDia.length;

        if (entradasDia.length > 0) {
          const primeiraEntrada = parseISO(entradasDia[0].data_acesso);

          // Se há saída no mesmo dia, usar a última saída do dia
          if (saidasDia.length > 0) {
            const ultimaSaida = parseISO(saidasDia[saidasDia.length - 1].data_acesso);

            if (ultimaSaida > primeiraEntrada) {
              const minutos = differenceInMinutes(ultimaSaida, primeiraEntrada);
              totalMinutos += minutos;
            }
          } else {
            // Último registro do dia é entrada, buscar primeira saída do dia seguinte
            let saidaEncontrada = false;
            for (let j = i + 1; j < diasOrdenados.length; j++) {
              const proximoDia = diasOrdenados[j];
              const acessosProximoDia = acessosPorDia[proximoDia];
              const saidasProximoDia = acessosProximoDia.filter((a) => a.sentido === 'S');

              if (saidasProximoDia.length > 0) {
                const primeiraSaidaProximoDia = parseISO(saidasProximoDia[0].data_acesso);
                const minutos = differenceInMinutes(primeiraSaidaProximoDia, primeiraEntrada);
                totalMinutos += minutos;
                saidaEncontrada = true;
                break;
              }
            }

            // Se não encontrou saída em nenhum dia seguinte, não contabilizar essa entrada
            if (!saidaEncontrada) {
              // Não adiciona nada ao totalMinutos
            }
          }
        }
      }

      const totalHoras = totalMinutos / 60;
      const ultimoAcesso = acessosCpf.sort((a, b) =>
        new Date(b.data_acesso).getTime() - new Date(a.data_acesso).getTime()
      )[0];

      return {
        cpf,
        nome: ultimoAcesso.nome,
        matricula: ultimoAcesso.matricula,
        tipo: ultimoAcesso.tipo,
        totalHoras: parseFloat(totalHoras.toFixed(2)),
        entradas: totalEntradas,
        saidas: totalSaidas,
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

  const handleOpenModal = (person: HorasCalculadas) => {
    setSelectedPerson(person);
    const personAccessHistory = acessos
      .filter((a) => a.cpf === person.cpf)
      .sort((a, b) => new Date(b.data_acesso).getTime() - new Date(a.data_acesso).getTime());
    setPersonAcessos(personAccessHistory);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedPerson(null);
    setPersonAcessos([]);
  };

  const handleContratoChange = (_: any, newValue: Contrato | null) => {
    if (newValue && !filtroContrato) {
      // Se está selecionando um contrato pela primeira vez, mostrar aviso
      setPendingContrato(newValue);
      setContratoWarningOpen(true);
    } else {
      // Se está removendo o filtro de contrato
      setFiltroContrato(newValue);
    }
  };

  const handleContratoWarningAccept = () => {
    setFiltroContrato(pendingContrato);
    setContratoWarningOpen(false);
    setPendingContrato(null);
  };

  const handleContratoWarningClose = () => {
    setContratoWarningOpen(false);
    setPendingContrato(null);
  };

  const handleExportCSV = () => {
    if (!selectedPerson || personAcessos.length === 0) return;

    // Prepare CSV header
    const headers = ['Data/Hora', 'Tipo', 'Matrícula', 'Nome', 'CPF', 'Sentido', 'Local'];

    // Prepare CSV rows
    const rows = personAcessos.map((acesso) => [
      format(parseISO(acesso.data_acesso), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR }),
      acesso.tipo,
      acesso.matricula,
      acesso.nome,
      acesso.cpf,
      acesso.sentido === 'E' ? 'Entrada' : 'Saída',
      '', // Local field (not available in current schema)
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Create blob and download
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `acessos_${selectedPerson.nome.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const columns: GridColDef[] = [
    {
      field: 'nome',
      headerName: 'Nome',
      flex: 1,
      minWidth: 200,
      renderCell: (params) => (
        <Box
          sx={{
            cursor: 'pointer',
            '&:hover': {
              '& .MuiTypography-root': {
                color: 'primary.main',
              },
            },
          }}
          onClick={() => handleOpenModal(params.row)}
        >
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
              <Grid item xs={12} sm={6} md={4}>
                <Autocomplete
                  multiple
                  value={filtroTipo}
                  onChange={(_, newValue) => setFiltroTipo(newValue)}
                  options={tiposUnicos}
                  renderInput={(params) => <TextField {...params} label="Tipo" placeholder="Selecione um ou mais" />}
                  size="small"
                  limitTags={2}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <Autocomplete
                  multiple
                  value={filtroMatricula}
                  onChange={(_, newValue) => setFiltroMatricula(newValue)}
                  options={matriculasUnicas}
                  renderInput={(params) => <TextField {...params} label="Matrícula" placeholder="Selecione uma ou mais" />}
                  size="small"
                  limitTags={2}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <Autocomplete
                  multiple
                  value={filtroNome}
                  onChange={(_, newValue) => setFiltroNome(newValue)}
                  options={nomesUnicos}
                  renderInput={(params) => <TextField {...params} label="Nome" placeholder="Selecione um ou mais" />}
                  size="small"
                  limitTags={2}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <Autocomplete
                  multiple
                  value={filtroCpf}
                  onChange={(_, newValue) => setFiltroCpf(newValue)}
                  options={cpfsUnicos}
                  renderInput={(params) => <TextField {...params} label="CPF" placeholder="Selecione um ou mais" />}
                  size="small"
                  limitTags={2}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <Autocomplete
                  value={filtroContrato}
                  onChange={handleContratoChange}
                  options={contratos}
                  getOptionLabel={(option) => `${option.nome} - ${option.empresa}`}
                  renderInput={(params) => <TextField {...params} label="Contrato" placeholder="Selecione um contrato" />}
                  size="small"
                />
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <DatePicker
                  label="Data Início"
                  value={filtroDataInicio}
                  onChange={(newValue) => setFiltroDataInicio(newValue)}
                  slotProps={{ textField: { size: 'small', fullWidth: true } }}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
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

        {/* Modal de Detalhes de Acessos */}
        <Dialog
          open={modalOpen}
          onClose={handleCloseModal}
          maxWidth="lg"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 2,
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            },
          }}
        >
          <DialogTitle sx={{ pb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="h5" fontWeight={700}>
                  Histórico de Acessos
                </Typography>
                {selectedPerson && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {selectedPerson.nome}
                  </Typography>
                )}
              </Box>
              <IconButton onClick={handleCloseModal} size="small">
                <Close />
              </IconButton>
            </Box>
          </DialogTitle>

          <Divider />

          <DialogContent sx={{ pt: 3 }}>
            {selectedPerson && (
              <>
                {/* Informações do Colaborador */}
                <Grid container spacing={3} sx={{ mb: 3 }}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ bgcolor: 'primary.50', border: '1px solid', borderColor: 'primary.200' }}>
                      <CardContent sx={{ py: 2 }}>
                        <Typography variant="caption" color="text.secondary" gutterBottom>
                          CPF
                        </Typography>
                        <Typography variant="h6" fontWeight={600}>
                          {selectedPerson.cpf}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ bgcolor: 'success.50', border: '1px solid', borderColor: 'success.200' }}>
                      <CardContent sx={{ py: 2 }}>
                        <Typography variant="caption" color="text.secondary" gutterBottom>
                          Matrícula
                        </Typography>
                        <Typography variant="h6" fontWeight={600}>
                          {selectedPerson.matricula}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ bgcolor: 'warning.50', border: '1px solid', borderColor: 'warning.200' }}>
                      <CardContent sx={{ py: 2 }}>
                        <Typography variant="caption" color="text.secondary" gutterBottom>
                          Tipo
                        </Typography>
                        <Typography variant="h6" fontWeight={600}>
                          {selectedPerson.tipo}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ bgcolor: 'info.50', border: '1px solid', borderColor: 'info.200' }}>
                      <CardContent sx={{ py: 2 }}>
                        <Typography variant="caption" color="text.secondary" gutterBottom>
                          Total de Horas
                        </Typography>
                        <Typography variant="h6" fontWeight={600}>
                          {selectedPerson.totalHoras}h
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                {/* Tabela de Acessos */}
                <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                  Registros de Acesso ({personAcessos.length})
                </Typography>

                <TableContainer
                  component={Paper}
                  sx={{
                    maxHeight: 400,
                    boxShadow: 'none',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                  }}
                >
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50' }}>
                          Data/Hora
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50' }}>
                          Sentido
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50' }}>
                          Tipo
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.50' }}>
                          Matrícula
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {personAcessos.map((acesso, index) => (
                        <TableRow
                          key={index}
                          sx={{
                            '&:hover': { bgcolor: 'action.hover' },
                            '&:last-child td': { border: 0 },
                          }}
                        >
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <AccessTime fontSize="small" color="action" />
                              <Typography variant="body2">
                                {format(parseISO(acesso.data_acesso), 'dd/MM/yyyy HH:mm:ss', {
                                  locale: ptBR,
                                })}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip
                              icon={
                                acesso.sentido === 'E' ? (
                                  <LoginOutlined fontSize="small" />
                                ) : (
                                  <LogoutOutlined fontSize="small" />
                                )
                              }
                              label={acesso.sentido === 'E' ? 'Entrada' : 'Saída'}
                              size="small"
                              color={acesso.sentido === 'E' ? 'success' : 'error'}
                              sx={{ fontWeight: 600 }}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">{acesso.tipo}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">{acesso.matricula}</Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </DialogContent>

          <Divider />

          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={handleCloseModal} variant="outlined">
              Fechar
            </Button>
            <Button
              onClick={handleExportCSV}
              variant="contained"
              startIcon={<Download />}
              sx={{ ml: 1 }}
            >
              Exportar CSV
            </Button>
          </DialogActions>
        </Dialog>

        {/* Modal de Aviso de Contrato */}
        <Dialog
          open={contratoWarningOpen}
          onClose={handleContratoWarningClose}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 3,
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            },
          }}
        >
          <DialogContent sx={{ pt: 4, pb: 3 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <Box
                sx={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  bgcolor: 'warning.50',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 2,
                }}
              >
                <Warning sx={{ fontSize: 32, color: 'warning.main' }} />
              </Box>

              <Typography variant="h5" fontWeight={700} gutterBottom>
                Atenção
              </Typography>

              <Typography variant="body1" color="text.secondary" sx={{ mt: 1, lineHeight: 1.7 }}>
                Ao selecionar um contrato, você estará visualizando todos os acessos de parceiros que estão
                vinculados ao número desse contrato. No entanto, isso não significa <em>necessariamente</em> que
                os acessos sejam referentes a esse contrato, uma vez que um parceiro pode participar de diferentes
                contratos.
              </Typography>
            </Box>
          </DialogContent>

          <Divider />

          <DialogActions sx={{ px: 3, py: 2, justifyContent: 'center' }}>
            <Button
              onClick={handleContratoWarningAccept}
              variant="contained"
              sx={{
                minWidth: 120,
                background: 'linear-gradient(135deg, #0ea5e9 0%, #8b5cf6 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #0284c7 0%, #7c3aed 100%)',
                },
              }}
            >
              Entendido
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default Dashboard;
