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
  Grid,
  Paper,
  Divider,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Tooltip,
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import {
  PersonAdd,
  Search,
  Close,
  Email,
  PersonOff,
  Delete,
  Add,
  Business,
  LocalHospital,
  Badge,
  AdminPanelSettings,
} from "@mui/icons-material";
import { supabase } from "../lib/supabase";
import {
  Usuario,
  UserRole,
  Contrato,
  UnidadeHospitalar,
} from "../types/database.types";
import { format, parseISO } from "date-fns";

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
  "Neurocirurgia"
  "Neurocirurgia Pediátrica",
  "Neurologia",
  "Neuropediatria"
  "Nutrologia",
  "Ortopedia",
  "Pediatria",
];

// Domínios de teste que devem ser bloqueados
const BLOCKED_EMAIL_DOMAINS = [
  "teste.com",
  "test.com",
  "example.com",
  "exemplo.com",
];

// Domínios corporativos que requerem atenção especial (avisar mas não bloquear)
const CORPORATE_DOMAINS = [
  "hugol.org.br",
];

// Função para validar domínio de email
const isEmailDomainBlocked = (email: string): boolean => {
  if (!email) return false;
  const domain = email.split("@")[1]?.toLowerCase();
  return BLOCKED_EMAIL_DOMAINS.some((blocked) => domain === blocked);
};

// Função para verificar se é domínio corporativo
const isCorporateDomain = (email: string): boolean => {
  if (!email) return false;
  const domain = email.split("@")[1]?.toLowerCase();
  return CORPORATE_DOMAINS.some((corp) => domain === corp);
};

// Função para obter mensagem de domínio bloqueado
const getBlockedDomainMessage = (email: string): string => {
  const domain = email.split("@")[1];
  return `O domínio @${domain} é um domínio de teste e está bloqueado. Use um email com domínio válido (ex: @gmail.com, @outlook.com, @hugol.org.br, etc).`;
};

interface UsuarioContrato {
  id: string;
  usuario_id: string;
  contrato_id: string;
  cpf: string;
  contratos?: Contrato;
}

const Usuarios: React.FC = () => {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [usuariosFiltrados, setUsuariosFiltrados] = useState<Usuario[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [unidades, setUnidades] = useState<UnidadeHospitalar[]>([]);
  const [usuarioContratos, setUsuarioContratos] = useState<UsuarioContrato[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);

  // Filter states
  const [filtroNome, setFiltroNome] = useState<string[]>([]);
  const [filtroCpf, setFiltroCpf] = useState<string[]>([]);
  const [filtroContrato, setFiltroContrato] = useState<Contrato | null>(null);
  const [filtroParceiro, setFiltroParceiro] = useState<string[]>([]);
  const [filtroEspecialidade, setFiltroEspecialidade] = useState<string[]>([]);

  // Dialog states
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Usuario | null>(null);
  const [userContracts, setUserContracts] = useState<UsuarioContrato[]>([]);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // Messages
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    email: "",
    nome: "",
    cpf: "",
    tipo: "terceiro" as UserRole,
    contrato_ids: [] as string[],
    codigomv: "",
    especialidade: [] as string[],
    unidade_hospitalar_id: "",
    password: "",
    createAuthUser: false, // New field to control if we create auth user
    sendInvitationAutomatically: false, // Control automatic invitation sending
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [{ data: contratosData }, { data: unidadesData }, { data: usuariosData }] =
        await Promise.all([
          supabase.from("contratos").select("*").eq("ativo", true),
          supabase
            .from("unidades_hospitalares")
            .select("*")
            .eq("ativo", true)
            .order("codigo"),
          supabase.from("usuarios").select("*"),
        ]);

      setContratos(contratosData || []);
      setUnidades(unidadesData || []);
      setUsuarios(usuariosData || []); // Load all users for autocomplete
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    try {
      setLoading(true);
      setError("");

      // Build query
      let query = supabase.from("usuarios").select("*");

      // Apply filters
      if (filtroNome.length > 0) {
        query = query.in("nome", filtroNome);
      }

      if (filtroCpf.length > 0) {
        query = query.in("cpf", filtroCpf);
      }

      if (filtroEspecialidade.length > 0) {
        // Filter by especialidade array overlap
        query = query.overlaps("especialidade", filtroEspecialidade);
      }

      const { data: usuariosData, error: usuariosError } = await query;

      if (usuariosError) throw usuariosError;

      let filteredUsers = usuariosData || [];

      // Filter by contract (need to check usuario_contrato table and usuarios.contrato_id)
      if (filtroContrato) {
        // Get users from usuario_contrato table
        const { data: usuarioContratosData } = await supabase
          .from("usuario_contrato")
          .select("usuario_id")
          .eq("contrato_id", filtroContrato.id);

        const userIdsFromContratos = usuarioContratosData?.map((uc) => uc.usuario_id) || [];

        // Filter users that match contract_id OR are in usuario_contrato table
        filteredUsers = filteredUsers.filter(
          (u) => u.contrato_id === filtroContrato.id || userIdsFromContratos.includes(u.id)
        );
      }

      // Filter by parceiro (empresa from contract)
      if (filtroParceiro.length > 0) {
        const contractsOfParceiro = contratos.filter((c) =>
          filtroParceiro.includes(c.empresa)
        );
        const contratoIds = contractsOfParceiro.map((c) => c.id);

        // Get users from usuario_contrato table
        const { data: usuarioContratosData } = await supabase
          .from("usuario_contrato")
          .select("usuario_id")
          .in("contrato_id", contratoIds);

        const userIdsFromContratos = usuarioContratosData?.map((uc) => uc.usuario_id) || [];

        filteredUsers = filteredUsers.filter(
          (u) => (u.contrato_id && contratoIds.includes(u.contrato_id)) || userIdsFromContratos.includes(u.id)
        );
      }

      setUsuariosFiltrados(filteredUsers);
      setSearchPerformed(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenUserDetails = async (usuario: Usuario) => {
    setSelectedUser(usuario);

    // Load user contracts from usuario_contrato table
    try {
      const { data: contratosFromTable } = await supabase
        .from("usuario_contrato")
        .select("*, contratos(*)")
        .eq("usuario_id", usuario.id);

      let allContracts = contratosFromTable || [];

      // Also check if user has contrato_id in usuarios table (for backward compatibility)
      if (usuario.contrato_id) {
        // Check if this contract is already in the list
        const alreadyExists = allContracts.some(
          (uc) => uc.contrato_id === usuario.contrato_id
        );

        if (!alreadyExists) {
          // Fetch the contract details
          const { data: contratoData } = await supabase
            .from("contratos")
            .select("*")
            .eq("id", usuario.contrato_id)
            .single();

          if (contratoData) {
            // Add it to the list with a synthetic ID
            allContracts.push({
              id: `synthetic_${usuario.contrato_id}`,
              usuario_id: usuario.id,
              contrato_id: usuario.contrato_id,
              cpf: usuario.cpf,
              contratos: contratoData,
            });
          }
        }
      }

      setUserContracts(allContracts);
    } catch (err) {
      console.error("Error loading user contracts:", err);
    }

    setDetailsDialogOpen(true);
  };

  const handleCloseUserDetails = () => {
    setDetailsDialogOpen(false);
    setSelectedUser(null);
    setUserContracts([]);
  };

  const handleOpenCreateDialog = () => {
    setEditMode(false);
    setFormData({
      email: "",
      nome: "",
      cpf: "",
      tipo: "terceiro",
      contrato_ids: [],
      codigomv: "",
      especialidade: [],
      unidade_hospitalar_id: "",
      password: "",
      createAuthUser: false,
      sendInvitationAutomatically: false,
    });
    setCreateDialogOpen(true);
  };

  const handleOpenEditDialog = () => {
    if (!selectedUser) return;

    setEditMode(true);
    setFormData({
      email: selectedUser.email,
      nome: selectedUser.nome,
      cpf: selectedUser.cpf,
      tipo: selectedUser.tipo,
      contrato_ids: userContracts.map((uc) => uc.contrato_id),
      codigomv: selectedUser.codigomv || "",
      especialidade: selectedUser.especialidade || [],
      unidade_hospitalar_id: selectedUser.unidade_hospitalar_id || "",
      password: "",
      createAuthUser: false,
      sendInvitationAutomatically: false,
    });
    setDetailsDialogOpen(false);
    setCreateDialogOpen(true);
  };

  const handleCloseCreateDialog = () => {
    setCreateDialogOpen(false);
    setEditMode(false);
    setError("");
  };

  const handleSaveTerceiro = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      if (!formData.nome || !formData.cpf) {
        setError("Nome e CPF são obrigatórios");
        setSaving(false);
        return;
      }

      const isAdmin = formData.tipo === "administrador-agir-corporativo" ||
                      formData.tipo === "administrador-agir-planta";

      // Se marcou para enviar convite automaticamente, email é obrigatório
      if (formData.sendInvitationAutomatically && !formData.email) {
        setError("Email é obrigatório para enviar convite automaticamente");
        setSaving(false);
        return;
      }

      // Validate email format if provided
      if (formData.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
          setError("Email inválido");
          setSaving(false);
          return;
        }

        // Check if email domain is blocked
        if (isEmailDomainBlocked(formData.email)) {
          setError(getBlockedDomainMessage(formData.email));
          setSaving(false);
          return;
        }
      }

      // Validar codigomv e especialidade para terceiros
      if (formData.tipo === "terceiro" && !formData.codigomv) {
        setError("Código do Prestador no MV é obrigatório");
        setSaving(false);
        return;
      }

      if (formData.tipo === "terceiro" && formData.especialidade.length === 0) {
        setError("Selecione pelo menos uma especialidade");
        setSaving(false);
        return;
      }

      if (editMode && selectedUser) {
        // Update existing user
        const updateData: any = {
          nome: formData.nome,
          cpf: formData.cpf,
          tipo: formData.tipo,
          codigomv: formData.tipo === "terceiro" ? formData.codigomv : null,
          especialidade: formData.tipo === "terceiro" ? formData.especialidade : null,
          unidade_hospitalar_id:
            formData.tipo === "administrador-agir-planta"
              ? formData.unidade_hospitalar_id
              : null,
        };

        // Only update email if user has auth account
        if (selectedUser.email) {
          updateData.email = formData.email;
        }

        const { error: updateError } = await supabase
          .from("usuarios")
          .update(updateData)
          .eq("id", selectedUser.id);

        if (updateError) throw updateError;

        // Update contracts
        // First, delete existing contracts
        await supabase
          .from("usuario_contrato")
          .delete()
          .eq("usuario_id", selectedUser.id);

        // Then, insert new contracts
        if (formData.contrato_ids.length > 0) {
          const contractInserts = formData.contrato_ids.map((contrato_id) => ({
            usuario_id: selectedUser.id,
            contrato_id,
            cpf: formData.cpf,
          }));

          const { error: contractError } = await supabase
            .from("usuario_contrato")
            .insert(contractInserts);

          if (contractError) {
            console.error("Error inserting contracts:", contractError);
            throw new Error(`Erro ao vincular contratos: ${contractError.message}`);
          }
        }

        // Also update contrato_id in usuarios table (for backward compatibility)
        if (formData.contrato_ids.length > 0) {
          await supabase
            .from("usuarios")
            .update({ contrato_id: formData.contrato_ids[0] })
            .eq("id", selectedUser.id);
        } else {
          await supabase
            .from("usuarios")
            .update({ contrato_id: null })
            .eq("id", selectedUser.id);
        }

        setSuccess("Usuário atualizado com sucesso!");
        setSaving(false);
        handleCloseCreateDialog();
        handleSearch(); // Refresh search
      } else {
        // Create new terceiro WITHOUT auth account

        // First, check if CPF already exists
        const { data: existingUser } = await supabase
          .from("usuarios")
          .select("id, cpf")
          .eq("cpf", formData.cpf)
          .maybeSingle();

        if (existingUser) {
          setError("Já existe um usuário com este CPF");
          setSaving(false);
          return;
        }

        // Generate a valid UUID for the user (will be replaced when auth is created)
        const tempUUID = crypto.randomUUID();

        const insertData: any = {
          id: tempUUID,
          email: formData.email || null,
          nome: formData.nome,
          cpf: formData.cpf,
          tipo: formData.tipo,
          codigomv: formData.tipo === "terceiro" ? formData.codigomv : null,
          especialidade: formData.tipo === "terceiro" ? formData.especialidade : null,
          unidade_hospitalar_id:
            formData.tipo === "administrador-agir-planta"
              ? formData.unidade_hospitalar_id
              : null,
        };

        // Add contrato_id for backward compatibility
        if (formData.contrato_ids.length > 0) {
          insertData.contrato_id = formData.contrato_ids[0];
        }

        console.log("Inserting user data:", insertData);

        const { data: newUser, error: insertError } = await supabase
          .from("usuarios")
          .insert(insertData)
          .select()
          .single();

        if (insertError) {
          console.error("Insert error details:", insertError);
          throw insertError;
        }

        // Create contract links (only if not admin or if admin has contracts)
        if (formData.contrato_ids.length > 0 && newUser) {
          const contractInserts = formData.contrato_ids.map((contrato_id) => ({
            usuario_id: newUser.id,
            contrato_id,
            cpf: formData.cpf,
          }));

          const { error: contractError } = await supabase
            .from("usuario_contrato")
            .insert(contractInserts);

          if (contractError) {
            console.error("Error inserting contracts:", contractError);
            throw new Error(`Erro ao vincular contratos: ${contractError.message}`);
          }
        }

        // Send invitation automatically if checkbox is marked
        if (formData.sendInvitationAutomatically && newUser && formData.email) {
          console.log('Enviando convite automaticamente...');

          // Extra warning for corporate domains
          const isCorp = isCorporateDomain(formData.email);
          const confirmMessage = isCorp
            ? `Confirma o envio de convite para o email: ${formData.email}?\n\n` +
              `⚠️ ATENÇÃO - EMAIL CORPORATIVO:\n` +
              `Você confirmou que este endereço de email JÁ EXISTE e está ATIVO no servidor de email da empresa?\n\n` +
              `Emails que não existem causam bloqueio temporário do sistema de envio.\n\n` +
              `Se não tiver certeza, clique em CANCELAR e verifique antes.`
            : `Confirma o envio de convite para o email: ${formData.email}?\n\n` +
              `⚠️ IMPORTANTE: Verifique se o email está correto. Emails inválidos podem causar bloqueio temporário do sistema de envio.`;

          // Confirm before sending to avoid bounced emails
          const confirmSend = window.confirm(confirmMessage);

          if (confirmSend) {
            try {
              await handleSendInvitation(newUser as Usuario);
              setSuccess(`Usuário criado com sucesso! Convite de acesso enviado para ${formData.email}.`);
            } catch (inviteError: any) {
              console.error("Erro ao enviar convite:", inviteError);
              setSuccess(`Usuário criado com sucesso, mas houve erro ao enviar convite: ${inviteError.message}. Use o botão 'Enviar Convite' manualmente.`);
            }
          } else {
            setSuccess("Usuário criado com sucesso! Envio de convite cancelado. Use o botão 'Enviar Convite' quando estiver pronto.");
          }
        } else {
          setSuccess(`Usuário criado com sucesso! ${formData.email ? "Use o botão 'Enviar Convite' para criar acesso ao sistema." : "Adicione um email e use o botão 'Enviar Convite' para criar acesso."}`);
        }

        setSaving(false);
        handleCloseCreateDialog();
        handleSearch(); // Refresh search
      }
    } catch (err: any) {
      setSaving(false);
      console.error("Error saving terceiro:", err);

      // Provide more specific error messages
      let errorMessage = "Erro ao salvar terceiro";

      if (err.code === "23505") {
        errorMessage = "Já existe um usuário com este CPF ou email";
      } else if (err.code === "23503") {
        errorMessage = "Erro de referência: verifique se o contrato ou unidade existe";
      } else if (err.message) {
        errorMessage = `Erro: ${err.message}`;

        // Add details if available
        if (err.details) {
          errorMessage += ` - Detalhes: ${err.details}`;
        }
        if (err.hint) {
          errorMessage += ` - Dica: ${err.hint}`;
        }
      }

      setError(errorMessage);
    }
  };

  const handleSendInvitation = async (usuario: Usuario) => {
    try {
      setError("");
      setSuccess("");

      if (!usuario.email) {
        setError("Email é obrigatório para enviar convite. Edite o usuário e adicione um email.");
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(usuario.email)) {
        setError("Email inválido");
        return;
      }

      // Check if email domain is blocked
      if (isEmailDomainBlocked(usuario.email)) {
        setError(getBlockedDomainMessage(usuario.email));
        return;
      }

      // Check if user might already have access (has email)
      // Always show confirmation when sending invitation
      const hasAccess = usuario.email;
      const isCorp = isCorporateDomain(usuario.email);

      let confirmMessage = "";
      if (hasAccess) {
        confirmMessage = "Usuário(a) já possui acesso ao ParcerIA, ao enviar novo convite você estará também criando uma nova senha. Deseja confirmar o envio?";
      } else if (isCorp) {
        confirmMessage =
          `⚠️ ATENÇÃO - EMAIL CORPORATIVO: ${usuario.email}\n\n` +
          `Você confirmou que este endereço de email JÁ EXISTE e está ATIVO no servidor de email da empresa (${usuario.email.split("@")[1]})?\n\n` +
          `Emails que não existem causam bloqueio temporário do sistema de envio.\n\n` +
          `Deseja continuar com o envio?`;
      } else {
        confirmMessage = `Enviar convite de acesso para ${usuario.email}?`;
      }

      if (!window.confirm(confirmMessage)) {
        return; // User cancelled
      }

      // Generate a temporary password (user should change it on first login)
      const tempPassword = `Temp@${Math.random().toString(36).substr(2, 9)}`;

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: usuario.email,
        password: tempPassword,
      });

      if (authError) {
        if (authError.message.includes("already registered")) {
          setError("Este email já está registrado no sistema");
        } else {
          throw authError;
        }
        return;
      }

      if (authData.user) {
        // We need to replace the old user record with a new one using the auth ID
        // 1. Save the old data
        const userData = {
          email: usuario.email,
          nome: usuario.nome,
          cpf: usuario.cpf,
          tipo: usuario.tipo,
          contrato_id: usuario.contrato_id,
          codigomv: usuario.codigomv,
          especialidade: usuario.especialidade,
          unidade_hospitalar_id: usuario.unidade_hospitalar_id,
        };

        // 2. Get all usuario_contrato records
        const { data: userContracts } = await supabase
          .from("usuario_contrato")
          .select("*")
          .eq("usuario_id", usuario.id);

        // 3. Delete old usuario record
        await supabase.from("usuarios").delete().eq("id", usuario.id);

        // 4. Insert new usuario record with auth ID
        const { error: insertError } = await supabase.from("usuarios").insert({
          id: authData.user.id,
          ...userData,
        });

        if (insertError) {
          console.error("Error creating user record:", insertError);
          setError("Conta criada, mas erro ao criar registro. Contate o suporte.");
          return;
        }

        // 5. Recreate usuario_contrato records with new ID
        if (userContracts && userContracts.length > 0) {
          const newContracts = userContracts.map((uc) => ({
            usuario_id: authData.user!.id,
            contrato_id: uc.contrato_id,
            cpf: uc.cpf,
          }));
          await supabase.from("usuario_contrato").insert(newContracts);
        }

        setSuccess(`Convite enviado para ${usuario.email}. Senha temporária: ${tempPassword}`);
        handleCloseUserDetails();
        handleSearch(); // Refresh
      }
    } catch (err: any) {
      console.error("Error sending invitation:", err);
      setError(err.message || "Erro ao enviar convite");
    }
  };

  const handleAddContract = async (contratoId: string) => {
    if (!selectedUser) return;

    try {
      const { error } = await supabase.from("usuario_contrato").insert({
        usuario_id: selectedUser.id,
        contrato_id: contratoId,
        cpf: selectedUser.cpf,
      });

      if (error) throw error;

      // Reload contracts
      const { data: contratos } = await supabase
        .from("usuario_contrato")
        .select("*, contratos(*)")
        .eq("usuario_id", selectedUser.id);

      setUserContracts(contratos || []);
      setSuccess("Contrato adicionado com sucesso!");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRemoveContract = async (usuarioContratoId: string) => {
    try {
      const { error } = await supabase
        .from("usuario_contrato")
        .delete()
        .eq("id", usuarioContratoId);

      if (error) throw error;

      // Reload contracts
      const { data: contratos } = await supabase
        .from("usuario_contrato")
        .select("*, contratos(*)")
        .eq("usuario_id", selectedUser!.id);

      setUserContracts(contratos || []);
      setSuccess("Contrato removido com sucesso!");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteUser = async (usuario: Usuario) => {
    if (!window.confirm(`Tem certeza que deseja excluir ${usuario.nome}?`)) {
      return;
    }

    try {
      setError("");

      // Delete usuario_contrato records
      await supabase
        .from("usuario_contrato")
        .delete()
        .eq("usuario_id", usuario.id);

      // Delete usuario
      const { error: deleteError } = await supabase
        .from("usuarios")
        .delete()
        .eq("id", usuario.id);

      if (deleteError) throw deleteError;

      // Try to delete from auth (if user has auth account)
      // Note: Deleting auth users requires admin privileges
      // This might fail for non-admin users or if user has no auth account, but we'll continue anyway
      try {
        await supabase.auth.admin.deleteUser(usuario.id);
      } catch (authErr) {
        console.error("Error deleting auth user (might not exist in auth):", authErr);
      }

      setSuccess("Usuário excluído com sucesso!");
      handleCloseUserDetails();
      handleSearch(); // Refresh
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Get unique names for autocomplete
  const nombresDisponiveis = Array.from(
    new Set(usuarios.map((u) => u.nome))
  ).sort();

  // Get unique CPFs for autocomplete
  const cpfsDisponiveis = Array.from(new Set(usuarios.map((u) => u.cpf))).sort();

  // Get unique parceiros (empresas from contratos)
  const parceirosDisponiveis = Array.from(
    new Set(contratos.map((c) => c.empresa))
  ).sort();

  // Role labels
  const roleLabels: Record<UserRole, string> = {
    "administrador-agir-corporativo": "Admin Corporativo",
    "administrador-agir-planta": "Admin Unidade",
    "administrador-terceiro": "Admin Terceiro",
    terceiro: "Terceiro",
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Gestão de Usuários
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Busque e gerencie os usuários do sistema
        </Typography>
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

      {/* Advanced Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Filtros Avançados
          </Typography>

          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6} lg={4}>
              <Autocomplete
                multiple
                options={nombresDisponiveis}
                value={filtroNome}
                onChange={(_, newValue) => setFiltroNome(newValue)}
                renderInput={(params) => (
                  <TextField {...params} label="Nome" placeholder="Selecione..." />
                )}
                size="small"
              />
            </Grid>

            <Grid item xs={12} md={6} lg={4}>
              <Autocomplete
                multiple
                options={cpfsDisponiveis}
                value={filtroCpf}
                onChange={(_, newValue) => setFiltroCpf(newValue)}
                renderInput={(params) => (
                  <TextField {...params} label="CPF" placeholder="Selecione..." />
                )}
                size="small"
              />
            </Grid>

            <Grid item xs={12} md={6} lg={4}>
              <Autocomplete
                options={contratos}
                value={filtroContrato}
                onChange={(_, newValue) => setFiltroContrato(newValue)}
                getOptionLabel={(option) => `${option.nome} - ${option.empresa}`}
                renderInput={(params) => (
                  <TextField {...params} label="Contrato" placeholder="Selecione..." />
                )}
                size="small"
              />
            </Grid>

            <Grid item xs={12} md={6} lg={4}>
              <Autocomplete
                multiple
                options={parceirosDisponiveis}
                value={filtroParceiro}
                onChange={(_, newValue) => setFiltroParceiro(newValue)}
                renderInput={(params) => (
                  <TextField {...params} label="Parceiro" placeholder="Selecione..." />
                )}
                size="small"
              />
            </Grid>

            <Grid item xs={12} md={6} lg={4}>
              <Autocomplete
                multiple
                options={ESPECIALIDADES}
                value={filtroEspecialidade}
                onChange={(_, newValue) => setFiltroEspecialidade(newValue)}
                renderInput={(params) => (
                  <TextField {...params} label="Especialidade" placeholder="Selecione..." />
                )}
                size="small"
              />
            </Grid>

            <Grid item xs={12} md={6} lg={4}>
              <Box sx={{ display: "flex", gap: 1, height: "100%" }}>
                <Button
                  variant="contained"
                  startIcon={<Search />}
                  onClick={handleSearch}
                  disabled={loading}
                  fullWidth
                  sx={{
                    background: "linear-gradient(135deg, #0ea5e9 0%, #8b5cf6 100%)",
                    color: "#ffffff",
                    fontWeight: 600,
                    boxShadow: "0 4px 12px rgba(14, 165, 233, 0.3)",
                    "&:hover": {
                      background: "linear-gradient(135deg, #0284c7 0%, #7c3aed 100%)",
                      boxShadow: "0 6px 16px rgba(14, 165, 233, 0.4)",
                    },
                    "&:disabled": {
                      background: "linear-gradient(135deg, #94a3b8 0%, #cbd5e1 100%)",
                      color: "#ffffff",
                    },
                  }}
                >
                  {loading ? "Buscando..." : "Buscar"}
                </Button>
                <Button
                  variant="contained"
                  startIcon={<PersonAdd />}
                  onClick={handleOpenCreateDialog}
                  sx={{
                    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    color: "#ffffff",
                    fontWeight: 600,
                    boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)",
                    "&:hover": {
                      background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                      boxShadow: "0 6px 16px rgba(16, 185, 129, 0.4)",
                    },
                  }}
                >
                  Criar
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Results */}
      {searchPerformed && (
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Resultados ({usuariosFiltrados.length})
            </Typography>

            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress />
              </Box>
            ) : usuariosFiltrados.length === 0 ? (
              <Box sx={{ textAlign: "center", py: 4 }}>
                <PersonOff sx={{ fontSize: 64, color: "text.disabled", mb: 2 }} />
                <Typography variant="body1" color="text.secondary">
                  Nenhum usuário encontrado
                </Typography>
              </Box>
            ) : (
              <Grid container spacing={2} sx={{ mt: 1 }}>
                {usuariosFiltrados.map((usuario) => (
                  <Grid item xs={12} md={6} lg={4} key={usuario.id}>
                    <Paper
                      sx={{
                        p: 2,
                        cursor: "pointer",
                        transition: "all 0.2s",
                        "&:hover": {
                          transform: "translateY(-4px)",
                          boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                        },
                      }}
                      onClick={() => handleOpenUserDetails(usuario)}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                        <AdminPanelSettings
                          sx={{ color: "primary.main", fontSize: 28 }}
                        />
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="subtitle1" fontWeight={600}>
                            {usuario.nome}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {usuario.cpf}
                          </Typography>
                        </Box>
                      </Box>

                      <Divider sx={{ my: 1 }} />

                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                        <Chip
                          label={roleLabels[usuario.tipo]}
                          size="small"
                          color="primary"
                        />
                        {usuario.email ? (
                          <Chip
                            label="Com Acesso"
                            size="small"
                            color="success"
                            icon={<Email />}
                          />
                        ) : (
                          <Chip
                            label="Sem Acesso"
                            size="small"
                            color="warning"
                            icon={<PersonOff />}
                          />
                        )}
                      </Box>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            )}
          </CardContent>
        </Card>
      )}

      {/* User Details Dialog */}
      <Dialog
        open={detailsDialogOpen}
        onClose={handleCloseUserDetails}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Typography variant="h6" fontWeight={600}>
              Detalhes do Usuário
            </Typography>
            <IconButton onClick={handleCloseUserDetails} size="small">
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedUser && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {/* User Information */}
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Informações Básicas
                </Typography>
                <Paper sx={{ p: 2, bgcolor: "grey.50" }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="text.secondary">
                        Nome
                      </Typography>
                      <Typography variant="body1" fontWeight={500}>
                        {selectedUser.nome}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="text.secondary">
                        CPF
                      </Typography>
                      <Typography variant="body1" fontWeight={500}>
                        {selectedUser.cpf}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="text.secondary">
                        Email
                      </Typography>
                      <Typography variant="body1" fontWeight={500}>
                        {selectedUser.email || "Não informado"}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="text.secondary">
                        Tipo
                      </Typography>
                      <Typography variant="body1" fontWeight={500}>
                        {roleLabels[selectedUser.tipo]}
                      </Typography>
                    </Grid>
                    {selectedUser.codigomv && (
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="text.secondary">
                          Código MV
                        </Typography>
                        <Typography variant="body1" fontWeight={500}>
                          {selectedUser.codigomv}
                        </Typography>
                      </Grid>
                    )}
                    {selectedUser.especialidade && selectedUser.especialidade.length > 0 && (
                      <Grid item xs={12}>
                        <Typography variant="caption" color="text.secondary">
                          Especialidades
                        </Typography>
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
                          {selectedUser.especialidade.map((esp) => (
                            <Chip key={esp} label={esp} size="small" color="primary" />
                          ))}
                        </Box>
                      </Grid>
                    )}
                  </Grid>
                </Paper>
              </Box>

              {/* Contracts */}
              <Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Contratos Vinculados
                  </Typography>
                </Box>
                <Paper sx={{ p: 2, bgcolor: "grey.50" }}>
                  {userContracts.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      Nenhum contrato vinculado
                    </Typography>
                  ) : (
                    <List dense>
                      {userContracts.map((uc) => (
                        <ListItem key={uc.id}>
                          <ListItemText
                            primary={uc.contratos?.nome}
                            secondary={uc.contratos?.empresa}
                          />
                          <ListItemSecondaryAction>
                            <IconButton
                              edge="end"
                              size="small"
                              onClick={() => handleRemoveContract(uc.id)}
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </ListItemSecondaryAction>
                        </ListItem>
                      ))}
                    </List>
                  )}

                  {/* Add Contract */}
                  <Autocomplete
                    options={contratos.filter(
                      (c) => !userContracts.some((uc) => uc.contrato_id === c.id)
                    )}
                    getOptionLabel={(option) => `${option.nome} - ${option.empresa}`}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Adicionar Contrato"
                        size="small"
                        sx={{ mt: 2 }}
                      />
                    )}
                    onChange={(_, newValue) => {
                      if (newValue) {
                        handleAddContract(newValue.id);
                      }
                    }}
                    value={null}
                  />
                </Paper>
              </Box>

              {/* Send Invitation */}
              {!selectedUser.email ? (
                <Alert severity="info">
                  Este usuário ainda não possui email cadastrado. Edite o usuário para adicionar um email e depois envie o convite.
                </Alert>
              ) : (
                <Button
                  variant="contained"
                  startIcon={<Email />}
                  onClick={() => handleSendInvitation(selectedUser)}
                  fullWidth
                  sx={{
                    background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                    "&:hover": {
                      background: "linear-gradient(135deg, #d97706 0%, #b45309 100%)",
                    },
                  }}
                >
                  Enviar Convite
                </Button>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleOpenEditDialog} color="primary">
            Editar
          </Button>
          <Button
            onClick={() => selectedUser && handleDeleteUser(selectedUser)}
            color="error"
          >
            Excluir
          </Button>
          <Button onClick={handleCloseUserDetails}>Fechar</Button>
        </DialogActions>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={handleCloseCreateDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editMode ? "Editar Usuário" : "Criar Novo Usuário"}
        </DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
              {error}
            </Alert>
          )}

          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}>
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
              required={formData.sendInvitationAutomatically}
              error={formData.email ? isEmailDomainBlocked(formData.email) : false}
              helperText={
                formData.email && isEmailDomainBlocked(formData.email)
                  ? getBlockedDomainMessage(formData.email)
                  : "Email necessário para enviar convite de acesso ao sistema. Verifique cuidadosamente se o email está correto."
              }
            />

            {/* Aviso especial para domínios corporativos */}
            {formData.email && isCorporateDomain(formData.email) && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  ⚠️ Email corporativo detectado: {formData.email.split("@")[1]}
                </Typography>
                <Typography variant="caption">
                  <strong>IMPORTANTE:</strong> Verifique se este endereço de email JÁ FOI CRIADO no servidor de email da empresa. Emails que não existem causam rejeição e podem bloquear temporariamente o sistema de envio.
                  <br /><br />
                  <strong>Antes de enviar o convite:</strong>
                  <br />
                  1. Confirme que o email {formData.email} existe e está ativo
                  <br />
                  2. Teste enviando um email de teste manualmente para verificar
                  <br />
                  3. Só marque "enviar automaticamente" se tiver certeza que o email existe
                </Typography>
              </Alert>
            )}

            <TextField
              label="CPF"
              value={formData.cpf}
              onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
              fullWidth
              required
            />

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
                value={unidades.find((u) => u.id === formData.unidade_hospitalar_id) || null}
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
                />

                <Autocomplete
                  multiple
                  options={ESPECIALIDADES}
                  value={formData.especialidade}
                  onChange={(_, newValue) =>
                    setFormData({ ...formData, especialidade: newValue })
                  }
                  renderInput={(params) => (
                    <TextField {...params} label="Especialidade" required />
                  )}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => {
                      const { key, ...tagProps } = getTagProps({ index });
                      return (
                        <Chip
                          key={key}
                          label={option}
                          {...tagProps}
                          size="small"
                          color="primary"
                        />
                      );
                    })
                  }
                />
              </>
            )}

            {/* Contratos - Apenas para terceiros e admin terceiro */}
            {formData.tipo !== "administrador-agir-corporativo" && formData.tipo !== "administrador-agir-planta" && (
              <Autocomplete
                multiple
                options={contratos}
                value={contratos.filter((c) => formData.contrato_ids.includes(c.id))}
                onChange={(_, newValue) =>
                  setFormData({
                    ...formData,
                    contrato_ids: newValue.map((c) => c.id),
                  })
                }
                getOptionLabel={(option) => `${option.nome} - ${option.empresa}`}
                renderInput={(params) => (
                  <TextField {...params} label="Contratos" />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => {
                    const { key, ...tagProps } = getTagProps({ index });
                    return (
                      <Chip
                        key={key}
                        label={option.nome}
                        {...tagProps}
                        size="small"
                        color="primary"
                      />
                    );
                  })
                }
              />
            )}

            {/* Envio automático de convite - apenas em modo de criação */}
            {!editMode && formData.email && (
              <Box sx={{ mt: 1 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.sendInvitationAutomatically}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          sendInvitationAutomatically: e.target.checked,
                        })
                      }
                      color="primary"
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight={600}>
                        Enviar convite de acesso automaticamente após criar usuário
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        O convite será enviado para o email informado. Uma confirmação será solicitada antes do envio.
                      </Typography>
                    </Box>
                  }
                />
              </Box>
            )}

            {/* Avisos */}
            {formData.tipo === "administrador-agir-corporativo" || formData.tipo === "administrador-agir-planta" ? (
              <Alert severity="info">
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Administradores Agir não precisam de vínculo com contrato
                </Typography>
                <Typography variant="caption">
                  Adicione um email válido e marque a opção acima para enviar o convite automaticamente.
                </Typography>
              </Alert>
            ) : !editMode ? (
              <Alert severity="info">
                <Typography variant="body2">
                  O usuário será criado sem acesso ao sistema. Use o botão "Enviar Convite" nos detalhes do usuário para criar o acesso, ou marque a opção acima para enviar automaticamente.
                </Typography>
              </Alert>
            ) : null}

            {/* Aviso importante sobre emails inválidos */}
            {!editMode && formData.sendInvitationAutomatically && (
              <Alert severity="warning">
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  ⚠️ Atenção: Verifique o email cuidadosamente
                </Typography>
                <Typography variant="caption">
                  Emails inválidos ou inexistentes causam bloqueio temporário no sistema de envio. Certifique-se de que o email está correto antes de prosseguir.
                </Typography>
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCreateDialog} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSaveTerceiro}
            variant="contained"
            color="primary"
            disabled={saving}
          >
            {saving
              ? "Salvando..."
              : editMode
              ? "Salvar Alterações"
              : formData.tipo === "administrador-agir-corporativo"
              ? "Criar Administrador Corporativo"
              : formData.tipo === "administrador-agir-planta"
              ? "Criar Administrador de Unidade"
              : formData.tipo === "administrador-terceiro"
              ? "Criar Administrador Terceiro"
              : "Criar Terceiro"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Usuarios;
