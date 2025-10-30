import React, { useState, useEffect } from "react";
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
  Autocomplete,
} from "@mui/material";
import { DataGrid, GridColDef, GridToolbar } from "@mui/x-data-grid";
import { Edit, Delete, PersonAdd } from "@mui/icons-material";
import { supabase } from "../lib/supabase";
import {
  Usuario,
  UserRole,
  Contrato,
  UnidadeHospitalar,
} from "../types/database.types";
import { format, parseISO } from "date-fns";
import DeleteConfirmDialog from "../components/DeleteConfirmDialog";

const ESPECIALIDADES = [
  "Anestesiologia",
  "Cardiologia",
  "Cardiologia Pediátrica",
  "Cirurgia Cardiovascular",
  "Cirurgia Geral",
  "Cirurgia Pediátrica",
  "Cirurgia Plástica",
  "Cirurgia Vascular",
  "Clínica Geral",
  "Diagnóstico por Imagem",
  "Ecocardiografia",
  "Endoscopia",
  "Gastroenterologia",
  "Intervencionista",
  "Medicina Intensiva",
  "Medicina Intensiva Pediátrica",
  "Nefrologia",
  "Neurocirurgia Pediátrica",
  "Neurologia",
  "Nutrologia",
  "Ortopedia",
  "Pediatria",
];

const Usuarios: React.FC = () => {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [unidades, setUnidades] = useState<UnidadeHospitalar[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingUsuario, setEditingUsuario] = useState<Usuario | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [usuarioToDelete, setUsuarioToDelete] = useState<Usuario | null>(null);
  const [deleteBlocked, setDeleteBlocked] = useState(false);
  const [deleteBlockReason, setDeleteBlockReason] = useState("");
  const [deleteRelatedItems, setDeleteRelatedItems] = useState<any[]>([]);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    email: "",
    nome: "",
    cpf: "",
    tipo: "terceiro" as UserRole,
    contrato_id: "",
    codigomv: "",
    especialidade: [] as string[],
    unidade_hospitalar_id: "",
    password: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [
        { data: usuariosData },
        { data: contratosData },
        { data: unidadesData },
      ] = await Promise.all([
        supabase
          .from("usuarios")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase.from("contratos").select("*").eq("ativo", true),
        supabase
          .from("unidades_hospitalares")
          .select("*")
          .eq("ativo", true)
          .order("codigo"),
      ]);

      setUsuarios(usuariosData || []);
      setContratos(contratosData || []);
      setUnidades(unidadesData || []);
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
        contrato_id: usuario.contrato_id || "",
        codigomv: usuario.codigomv || "",
        especialidade: usuario.especialidade || [],
        unidade_hospitalar_id: usuario.unidade_hospitalar_id || "",
        password: "",
      });
    } else {
      setEditingUsuario(null);
      setFormData({
        email: "",
        nome: "",
        cpf: "",
        tipo: "terceiro",
        contrato_id: "",
        codigomv: "",
        especialidade: [],
        unidade_hospitalar_id: "",
        password: "",
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingUsuario(null);
    setError("");
  };

  const handleSave = async () => {
    try {
      setError("");
      setSuccess("");

      if (!formData.email || !formData.nome || !formData.cpf) {
        setError("Preencha todos os campos obrigatórios");
        return;
      }

      // Validar unidade para admin de planta
      if (
        formData.tipo === "administrador-agir-planta" &&
        !formData.unidade_hospitalar_id
      ) {
        setError(
          "Selecione uma Unidade Hospitalar para administradores de planta"
        );
        return;
      }

      // Validar codigomv e especialidade para usuários do tipo "terceiro"
      if (formData.tipo === "terceiro" && !formData.codigomv) {
        setError(
          "Código do Prestador no MV é obrigatório para usuários do tipo Terceiro"
        );
        return;
      }

      if (
        formData.tipo === "terceiro" &&
        (!formData.especialidade || formData.especialidade.length === 0)
      ) {
        setError(
          "Selecione pelo menos uma especialidade para usuários do tipo Terceiro"
        );
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
          codigomv: formData.tipo === "terceiro" ? formData.codigomv : null,
          especialidade:
            formData.tipo === "terceiro" ? formData.especialidade : null,
          unidade_hospitalar_id:
            formData.tipo === "administrador-agir-planta"
              ? formData.unidade_hospitalar_id
              : null,
        };
        const { error: updateError } = await supabase
          .from("usuarios")
          .update(updateData)
          .eq("id", editingUsuario.id);

        if (updateError) throw updateError;
        setSuccess("Usuário atualizado com sucesso!");
      } else {
        // Criar novo usuário no Supabase Auth
        if (!formData.password) {
          setError("Senha é obrigatória para novos usuários");
          return;
        }

        // Primeiro, verificar se o email ou CPF já existem
        const { data: existingUsers } = await supabase
          .from("usuarios")
          .select("id, email, cpf")
          .or(`email.eq.${formData.email},cpf.eq.${formData.cpf}`);

        if (existingUsers && existingUsers.length > 0) {
          const existing = existingUsers[0];
          if (existing.email === formData.email) {
            setError("Já existe um usuário com este email");
          } else if (existing.cpf === formData.cpf) {
            setError("Já existe um usuário com este CPF");
          }
          return;
        }

        const { data: authData, error: authError } = await supabase.auth.signUp(
          {
            email: formData.email,
            password: formData.password,
          }
        );

        if (authError) {
          // Verificar se o erro é de email já existente
          if (authError.message.includes("already registered")) {
            setError("Este email já está registrado no sistema");
          } else {
            throw authError;
          }
          return;
        }

        if (authData.user) {
          // Criar registro na tabela usuarios
          const { error: insertError } = await supabase
            .from("usuarios")
            .insert({
              id: authData.user.id,
              email: formData.email,
              nome: formData.nome,
              cpf: formData.cpf,
              tipo: formData.tipo,
              contrato_id: formData.contrato_id || null,
              codigomv: formData.tipo === "terceiro" ? formData.codigomv : null,
              especialidade:
                formData.tipo === "terceiro" ? formData.especialidade : null,
              unidade_hospitalar_id:
                formData.tipo === "administrador-agir-planta"
                  ? formData.unidade_hospitalar_id
                  : null,
            } as any);

          if (insertError) {
            // Se falhar ao inserir na tabela usuarios, precisamos limpar o usuário de auth
            console.error("Erro ao inserir usuário na tabela:", insertError);

            // Mostrar erro mais detalhado
            if (insertError.code === "23505") {
              // Unique violation
              setError("Email ou CPF já cadastrado no sistema");
            } else if (insertError.message.includes("policy")) {
              setError(
                "Erro de permissão. Verifique se você tem privilégios de administrador."
              );
            } else {
              setError(`Erro ao criar usuário: ${insertError.message}`);
            }
            return;
          }

          // Se for terceiro, criar vínculo com contrato
          if (formData.tipo !== "administrador-agir" && formData.contrato_id) {
            const { error: vinculoError } = await supabase
              .from("usuario_contrato")
              .insert({
                usuario_id: authData.user.id,
                contrato_id: formData.contrato_id,
                cpf: formData.cpf,
              } as any);

            if (vinculoError) {
              console.error("Erro ao criar vínculo:", vinculoError);
              // Não bloquear a criação do usuário, apenas avisar
              setSuccess(
                "Usuário criado, mas houve erro ao vincular ao contrato"
              );
              handleCloseDialog();
              loadData();
              return;
            }
          }

          setSuccess("Usuário criado com sucesso!");
        }
      }

      handleCloseDialog();
      loadData();
    } catch (err: any) {
      setError(err.message || "Erro ao salvar usuário");
    }
  };

  const handleOpenDeleteDialog = async (usuario: Usuario) => {
    setUsuarioToDelete(usuario);
    setDeleteBlocked(false);
    setDeleteBlockReason("");
    setDeleteRelatedItems([]);

    try {
      // Verificar vínculos com contratos
      const { data: vinculos, error: vinculosError } = await supabase
        .from("usuario_contrato")
        .select("contrato_id, contratos(nome)")
        .eq("usuario_id", usuario.id);

      if (vinculosError) throw vinculosError;

      const relatedItems = [];

      if (vinculos && vinculos.length > 0) {
        relatedItems.push({
          type: "Contrato(s) vinculado(s)",
          count: vinculos.length,
          items: vinculos.map((v: any) => v.contratos?.nome || "Contrato"),
        });
      }

      if (relatedItems.length > 0) {
        setDeleteBlocked(true);
        setDeleteBlockReason(
          "Este usuário não pode ser excluído pois possui contratos vinculados. Remova os vínculos antes de excluir."
        );
        setDeleteRelatedItems(relatedItems);
      }
    } catch (err: any) {
      console.error("Erro ao verificar vínculos:", err);
      setError("Erro ao verificar vínculos do usuário");
      return;
    }

    setDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setUsuarioToDelete(null);
    setDeleteBlocked(false);
    setDeleteBlockReason("");
    setDeleteRelatedItems([]);
  };

  const handleConfirmDelete = async () => {
    if (!usuarioToDelete || deleteBlocked) return;

    try {
      setDeleting(true);

      // Usar a função do banco de dados para deletar completamente o usuário
      const { data, error: rpcError } = await supabase.rpc(
        "delete_user_completely",
        {
          user_id: usuarioToDelete.id,
        }
      );

      if (rpcError) {
        console.error("Erro ao deletar usuário:", rpcError);
        // Se a função não existir, tentar o método antigo
        if (
          rpcError.message.includes("function") &&
          rpcError.message.includes("does not exist")
        ) {
          // Fallback: deletar apenas da tabela usuarios
          const { error: deleteError } = await supabase
            .from("usuarios")
            .delete()
            .eq("id", usuarioToDelete.id);

          if (deleteError) throw deleteError;
          setSuccess(
            "Usuário excluído da tabela. Nota: o registro de autenticação pode ainda existir."
          );
        } else {
          throw rpcError;
        }
      } else {
        setSuccess("Usuário excluído completamente do sistema!");
      }

      handleCloseDeleteDialog();
      loadData();
    } catch (err: any) {
      setError(err.message);
      handleCloseDeleteDialog();
    } finally {
      setDeleting(false);
    }
  };

  const getRoleColor = (
    tipo: UserRole
  ): "primary" | "secondary" | "default" | "info" => {
    const colors: Record<
      UserRole,
      "primary" | "secondary" | "default" | "info"
    > = {
      "administrador-agir-corporativo": "primary",
      "administrador-agir-planta": "info",
      "administrador-terceiro": "secondary",
      terceiro: "default",
    };
    return colors[tipo] || "default";
  };

  const columns: GridColDef[] = [
    {
      field: "nome",
      headerName: "Nome",
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
    { field: "cpf", headerName: "CPF", width: 140 },
    {
      field: "tipo",
      headerName: "Tipo",
      width: 200,
      renderCell: (params) => {
        const labels: Record<UserRole, string> = {
          "administrador-agir-corporativo": "Admin Corporativo",
          "administrador-agir-planta": "Admin Unidade",
          "administrador-terceiro": "Admin Terceiro",
          terceiro: "Terceiro",
        };
        return (
          <Chip
            label={labels[params.value as UserRole] || params.value}
            color={getRoleColor(params.value)}
            size="small"
          />
        );
      },
    },
    {
      field: "created_at",
      headerName: "Cadastro",
      width: 120,
      renderCell: (params) => format(parseISO(params.value), "dd/MM/yyyy"),
    },
    {
      field: "actions",
      headerName: "Ações",
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
            onClick={() => handleOpenDeleteDialog(params.row)}
          >
            <Delete fontSize="small" />
          </IconButton>
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <Box
        sx={{
          mb: 4,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
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
            height: 42,
            background: "linear-gradient(135deg, #0ea5e9 0%, #8b5cf6 100%)",
            color: "white",
            "&:hover": {
              background: "linear-gradient(135deg, #0284c7 0%, #7c3aed 100%)",
            },
          }}
        >
          Novo Usuário
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess("")}>
          {success}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Box sx={{ height: 600, width: "100%" }}>
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
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingUsuario ? "Editar Usuário" : "Novo Usuário"}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}>
            <TextField
              label="Nome Completo"
              value={formData.nome}
              onChange={(e) =>
                setFormData({ ...formData, nome: e.target.value })
              }
              fullWidth
              required
            />

            <TextField
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              fullWidth
              required
              disabled={!!editingUsuario}
            />

            <TextField
              label="CPF"
              value={formData.cpf}
              onChange={(e) =>
                setFormData({ ...formData, cpf: e.target.value })
              }
              fullWidth
              required
            />

            {!editingUsuario && (
              <TextField
                label="Senha"
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
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
                onChange={(e) =>
                  setFormData({ ...formData, tipo: e.target.value as UserRole })
                }
              >
                <MenuItem value="administrador-agir-corporativo">
                  Administrador Agir Corporativo
                </MenuItem>
                <MenuItem value="administrador-agir-planta">
                  Administrador Agir de Unidade
                </MenuItem>
                <MenuItem value="administrador-terceiro">
                  Administrador Terceiro
                </MenuItem>
                <MenuItem value="terceiro">Terceiro</MenuItem>
              </Select>
            </FormControl>

            {formData.tipo === "administrador-agir-planta" && (
              <Autocomplete
                value={
                  unidades.find(
                    (u) => u.id === formData.unidade_hospitalar_id
                  ) || null
                }
                onChange={(_, newValue) =>
                  setFormData({
                    ...formData,
                    unidade_hospitalar_id: newValue?.id || "",
                  })
                }
                options={unidades}
                getOptionLabel={(option) => `${option.codigo} - ${option.nome}`}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Unidade Hospitalar"
                    required
                    helperText="Selecione a unidade hospitalar para este administrador"
                  />
                )}
                fullWidth
              />
            )}

            {formData.tipo === "terceiro" && (
              <>
                <TextField
                  label="Código do Prestador no MV"
                  value={formData.codigomv}
                  onChange={(e) =>
                    setFormData({ ...formData, codigomv: e.target.value })
                  }
                  fullWidth
                  required
                  helperText="Código do prestador cadastrado no sistema MV"
                />

                <Autocomplete
                  multiple
                  options={ESPECIALIDADES}
                  value={formData.especialidade}
                  onChange={(_, newValue) =>
                    setFormData({ ...formData, especialidade: newValue })
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Especialidade"
                      required
                      helperText="Selecione uma ou mais especialidades"
                    />
                  )}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip
                        label={option}
                        {...getTagProps({ index })}
                        size="small"
                        color="primary"
                      />
                    ))
                  }
                />
              </>
            )}

            {formData.tipo !== "administrador-agir-corporativo" &&
              formData.tipo !== "administrador-agir-planta" && (
                <FormControl fullWidth>
                  <InputLabel>Contrato</InputLabel>
                  <Select
                    value={formData.contrato_id}
                    label="Contrato"
                    onChange={(e) =>
                      setFormData({ ...formData, contrato_id: e.target.value })
                    }
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

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
        onConfirm={handleConfirmDelete}
        title="Excluir Usuário"
        itemName={usuarioToDelete?.nome || ""}
        severity="warning"
        isBlocked={deleteBlocked}
        blockReason={deleteBlockReason}
        relatedItems={deleteRelatedItems}
        warningMessage={
          !deleteBlocked
            ? "Esta ação não poderá ser desfeita. O usuário e todos os seus dados serão permanentemente removidos do sistema, incluindo o acesso de autenticação."
            : undefined
        }
        loading={deleting}
      />
    </Box>
  );
};

export default Usuarios;
