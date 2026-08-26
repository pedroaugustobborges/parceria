import React, { useState, useEffect, useRef } from "react";
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
} from "@mui/material";
import {
  PersonAdd,
  Search,
  Close,
  Email,
  PersonOff,
  Delete,
  AdminPanelSettings,
  LockReset,
  Add,
  FileDownload,
} from "@mui/icons-material";
import * as XLSX from "xlsx";
import { supabase } from "../lib/supabase";
import {
  Usuario,
  UserRole,
  Contrato,
  UnidadeHospitalar,
} from "../types/database.types";
import { format, parseISO } from "date-fns";
import { useAuth } from "../contexts/AuthContext";

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
  "Dermatologia",
  "Diagnóstico por Imagem",
  "Ecocardiografia",
  "Endocrinologia",
  "Endoscopia",
  "Gastroenterologia",
  "Ginecologia",
  "Hematologia",
  "Intervencionista",
  "Hemodinâmica",
  "Medicina Intensiva",
  "Medicina Intensiva Pediátrica",
  "Nefrologia",
  "Neurocirurgia",
  "Neurocirurgia Pediátrica",
  "Neurologia",
  "Neurologia Vascular",
  "Neuropediatria",
  "Nutrologia",
  "Ortopedia",
  "Pediatria",
  "Psiquiatria",
  "Reumatologia",
  "Urologia",
];

// Domínios de teste que devem ser bloqueados
const BLOCKED_EMAIL_DOMAINS = [
  "teste.com",
  "test.com",
  "example.com",
  "exemplo.com",
];

// Domínios corporativos que requerem atenção especial (avisar mas não bloquear)
const CORPORATE_DOMAINS = ["hugol.org.br"];

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

// Função para validar CPF (deve ter exatamente 11 dígitos numéricos)
const isValidCpf = (cpf: string): boolean => {
  const cleanCpf = cpf.replace(/\D/g, ""); // Remove non-digits
  return cleanCpf.length === 11 && /^\d+$/.test(cleanCpf);
};

// Mensagem de erro para CPF inválido
const CPF_ERROR_MESSAGE =
  "O CPF deve possuir 11 dígitos. Em caso de CPFs mais antigos que possuem menos que isso, por favor adicione zeros no início até que também possuam 11 dígitos.";

// Chaves de sessionStorage para persistência do rascunho do formulário
const RASCUNHO_FORM_KEY = "usuarios_rascunho_formulario";
const RASCUNHO_META_KEY = "usuarios_rascunho_meta";

interface UsuarioContrato {
  id: string;
  usuario_id: string;
  contrato_id: string;
  cpf: string;
  contratos?: Contrato;
}

interface CodigomvPar {
  codigomv: string;
  nm_unidade: string;
}

const Usuarios: React.FC = () => {
  const { isAdminAgirCorporativo, isAdminAgirPlanta } = useAuth();
  const jaRestaurouRef = useRef(false);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [usuariosFiltrados, setUsuariosFiltrados] = useState<Usuario[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [unidades, setUnidades] = useState<UnidadeHospitalar[]>([]);
  const [usuarioContratos, setUsuarioContratos] = useState<UsuarioContrato[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);

  // Filter states
  const [filtroNome, setFiltroNome] = useState<string[]>([]);
  const [filtroCpf, setFiltroCpf] = useState<string[]>([]);
  const [filtroContrato, setFiltroContrato] = useState<Contrato | null>(null);
  const [filtroParceiro, setFiltroParceiro] = useState<string[]>([]);
  const [filtroEspecialidade, setFiltroEspecialidade] = useState<string[]>([]);
  const [filtroEmail, setFiltroEmail] = useState<string[]>([]);

  // Dialog states
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Usuario | null>(null);
  const [userContracts, setUserContracts] = useState<UsuarioContrato[]>([]);
  const [userCodigomvs, setUserCodigomvs] = useState<CodigomvPar[]>([]);

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
    codigomvs: [] as CodigomvPar[],
    especialidade: [] as string[],
    unidade_hospitalar_id: "",
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  // Salva o rascunho do formulário no sessionStorage sempre que houver alteração e o dialog estiver aberto
  useEffect(() => {
    if (!createDialogOpen) return;
    try {
      sessionStorage.setItem(RASCUNHO_FORM_KEY, JSON.stringify(formData));
      sessionStorage.setItem(
        RASCUNHO_META_KEY,
        JSON.stringify({
          dialogAberto: true,
          modoEdicao: editMode,
          usuarioId: selectedUser?.id ?? null,
        }),
      );
    } catch {
      // ignora erros de quota
    }
  }, [formData, createDialogOpen, editMode, selectedUser]);

  // Restaura o rascunho do formulário após o carregamento inicial dos dados
  useEffect(() => {
    if (loading || jaRestaurouRef.current) return;
    jaRestaurouRef.current = true;
    try {
      const metaRaw = sessionStorage.getItem(RASCUNHO_META_KEY);
      const formRaw = sessionStorage.getItem(RASCUNHO_FORM_KEY);
      if (!metaRaw || !formRaw) return;

      const meta = JSON.parse(metaRaw);
      const form = JSON.parse(formRaw);

      if (!meta.dialogAberto) return;

      setFormData(form);
      setEditMode(meta.modoEdicao);

      if (meta.modoEdicao && meta.usuarioId) {
        const usuarioEncontrado = usuarios.find((u) => u.id === meta.usuarioId);
        if (usuarioEncontrado) setSelectedUser(usuarioEncontrado);
      }

      setCreateDialogOpen(true);
    } catch {
      limparRascunhoFormulario();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Busca todos os usuários paginando de 1000 em 1000 para contornar
  // o limite padrão do PostgREST (PGRST_DB_MAX_ROWS = 1000)
  const fetchAllUsuarios = async (): Promise<Usuario[]> => {
    const PAGE_SIZE = 1000;
    const allData: Usuario[] = [];
    let page = 0;

    while (true) {
      const { data, error } = await supabase
        .from("usuarios")
        .select("*")
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      allData.push(...data);
      if (data.length < PAGE_SIZE) break;
      page++;
    }

    return allData;
  };

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [{ data: contratosData }, { data: unidadesData }, usuariosData] =
        await Promise.all([
          supabase.from("contratos").select("*").eq("ativo", true),
          supabase
            .from("unidades_hospitalares")
            .select("*")
            .eq("ativo", true)
            .order("codigo"),
          fetchAllUsuarios(),
        ]);

      setContratos(contratosData || []);
      setUnidades(unidadesData || []);
      setUsuarios(usuariosData);
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

      const hasServerFilters =
        filtroNome.length > 0 ||
        filtroCpf.length > 0 ||
        filtroEspecialidade.length > 0 ||
        filtroEmail.length > 0;

      let filteredUsers: Usuario[] = [];

      if (hasServerFilters) {
        // Com filtros server-side: uma única query (resultado < 1000)
        let query = supabase.from("usuarios").select("*");

        if (filtroNome.length > 0) {
          const nomeFilter = filtroNome
            .map((n) => `nome.ilike.*${n}*`)
            .join(",");
          query = query.or(nomeFilter);
        }
        if (filtroCpf.length > 0) {
          query = query.in("cpf", filtroCpf);
        }
        if (filtroEspecialidade.length > 0) {
          query = query.overlaps("especialidade", filtroEspecialidade);
        }
        if (filtroEmail.length > 0) {
          const emailFilter = filtroEmail
            .map((e) => `email.ilike.*${e}*`)
            .join(",");
          query = query.or(emailFilter);
        }

        const { data, error: queryError } = await query;
        if (queryError) throw queryError;
        filteredUsers = data || [];
      } else {
        // Sem filtros server-side: paginar para buscar todos os usuários
        filteredUsers = await fetchAllUsuarios();
      }

      // Filter by contract (need to check usuario_contrato table and usuarios.contrato_id)
      if (filtroContrato) {
        // Get users from usuario_contrato table
        const { data: usuarioContratosData } = await supabase
          .from("usuario_contrato")
          .select("usuario_id")
          .eq("contrato_id", filtroContrato.id);

        const userIdsFromContratos =
          usuarioContratosData?.map((uc) => uc.usuario_id) || [];

        // Filter users that match contract_id OR are in usuario_contrato table
        filteredUsers = filteredUsers.filter(
          (u) =>
            u.contrato_id === filtroContrato.id ||
            userIdsFromContratos.includes(u.id),
        );
      }

      // Filter by parceiro (empresa from contract)
      if (filtroParceiro.length > 0) {
        const contractsOfParceiro = contratos.filter((c) =>
          filtroParceiro.includes(c.empresa),
        );
        const contratoIds = contractsOfParceiro.map((c) => c.id);

        // Get users from usuario_contrato table
        const { data: usuarioContratosData } = await supabase
          .from("usuario_contrato")
          .select("usuario_id")
          .in("contrato_id", contratoIds);

        const userIdsFromContratos =
          usuarioContratosData?.map((uc) => uc.usuario_id) || [];

        filteredUsers = filteredUsers.filter(
          (u) =>
            (u.contrato_id && contratoIds.includes(u.contrato_id)) ||
            userIdsFromContratos.includes(u.id),
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

    // Load codigomvs
    const { data: codigomvsData } = await supabase
      .from("usuario_codigomv")
      .select("codigomv, nm_unidade")
      .eq("usuario_id", usuario.id)
      .order("nm_unidade");
    setUserCodigomvs(codigomvsData || []);

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
          (uc) => uc.contrato_id === usuario.contrato_id,
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
    setUserCodigomvs([]);
  };

  const limparRascunhoFormulario = () => {
    sessionStorage.removeItem(RASCUNHO_FORM_KEY);
    sessionStorage.removeItem(RASCUNHO_META_KEY);
  };

  const handleOpenCreateDialog = () => {
    setEditMode(false);
    setFormData({
      email: "",
      nome: "",
      cpf: "",
      tipo: "terceiro",
      contrato_ids: [],
      codigomvs: [],
      especialidade: [],
      unidade_hospitalar_id: "",
    });
    setCreateDialogOpen(true);
  };

  const handleOpenEditDialog = async () => {
    if (!selectedUser) return;

    // Load codigomvs (may have already been loaded, but refresh to be sure)
    const { data: codigomvsData } = await supabase
      .from("usuario_codigomv")
      .select("codigomv, nm_unidade")
      .eq("usuario_id", selectedUser.id)
      .order("nm_unidade");

    const codigomvs = codigomvsData || [];

    // Fallback: if no entries in usuario_codigomv but has legacy codigomv field
    const legacyFallback: CodigomvPar[] =
      codigomvs.length === 0 && selectedUser.codigomv
        ? [{ codigomv: selectedUser.codigomv, nm_unidade: "" }]
        : codigomvs;

    setEditMode(true);
    setFormData({
      email: selectedUser.email ?? "",
      nome: selectedUser.nome,
      cpf: selectedUser.cpf,
      tipo: selectedUser.tipo as UserRole,
      contrato_ids: userContracts.map((uc) => uc.contrato_id),
      codigomvs: legacyFallback,
      especialidade: selectedUser.especialidade || [],
      unidade_hospitalar_id: selectedUser.unidade_hospitalar_id || "",
    });
    setDetailsDialogOpen(false);
    setCreateDialogOpen(true);
  };

  const handleCloseCreateDialog = () => {
    limparRascunhoFormulario();
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

      // Validar CPF (deve ter exatamente 11 dígitos)
      if (!isValidCpf(formData.cpf)) {
        setError(CPF_ERROR_MESSAGE);
        setSaving(false);
        return;
      }

      const isAdmin =
        formData.tipo === "administrador-agir-corporativo" ||
        formData.tipo === "administrador-agir-planta";

      // Email obrigatório para usuários com acesso ao sistema
      if (formData.tipo !== "terceiro" && !editMode && !formData.email) {
        setError("Email é obrigatório para usuários com acesso ao sistema");
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

      // Validar codigomvs e especialidade para terceiros
      if (formData.tipo === "terceiro") {
        if (formData.codigomvs.length === 0) {
          setError("Adicione pelo menos um Código MV com a respectiva unidade hospitalar");
          setSaving(false);
          return;
        }
        // Validate each pair
        for (const par of formData.codigomvs) {
          if (!par.codigomv.trim()) {
            setError("Preencha o código MV em todos os registros");
            setSaving(false);
            return;
          }
          if (!par.nm_unidade) {
            setError("Selecione a unidade hospitalar para todos os códigos MV");
            setSaving(false);
            return;
          }
        }
        // Check for duplicates within form
        const seenPairs = new Set<string>();
        for (const par of formData.codigomvs) {
          const key = `${par.codigomv.trim()}|${par.nm_unidade}`;
          if (seenPairs.has(key)) {
            setError(`Código MV "${par.codigomv}" já adicionado para a unidade "${par.nm_unidade}"`);
            setSaving(false);
            return;
          }
          seenPairs.add(key);
        }
      }

      if (formData.tipo === "terceiro" && formData.especialidade.length === 0) {
        setError("Selecione pelo menos uma especialidade");
        setSaving(false);
        return;
      }

      if (editMode && selectedUser) {
        // Update existing user
        const firstCodigomv =
          formData.tipo === "terceiro" && formData.codigomvs.length > 0
            ? formData.codigomvs[0].codigomv.trim()
            : null;
        const updateData: any = {
          nome: formData.nome,
          cpf: formData.cpf,
          tipo: formData.tipo,
          codigomv: firstCodigomv, // keep in sync for backward compat
          especialidade:
            formData.tipo === "terceiro" ? formData.especialidade : null,
          unidade_hospitalar_id:
            formData.tipo === "administrador-agir-planta"
              ? formData.unidade_hospitalar_id
              : null,
        };

        // Atualiza email para todos os tipos que possuem campo de email no formulário
        if (formData.tipo !== "terceiro") {
          updateData.email = formData.email || null;
        }

        const { error: updateError } = await supabase
          .from("usuarios")
          .update(updateData)
          .eq("id", selectedUser.id);

        if (updateError) throw updateError;

        // Sincroniza email no GoTrue quando o email mudou e o usuário tinha conta auth
        const emailMudou =
          formData.tipo !== "terceiro" &&
          formData.email &&
          formData.email !== selectedUser.email;
        if (emailMudou && selectedUser.email) {
          await supabase.functions.invoke("admin-users", {
            body: {
              action: "update-email",
              targetUserId: selectedUser.id,
              novoEmail: formData.email,
            },
          });
          // Não bloqueia em caso de erro: usuarios.email já foi salvo.
          // Usuário legado sem conta auth: admin usa "Redefinir Senha" depois.
        }

        // Se o email foi removido e o usuário tinha conta auth, exclui a conta
        // auth para liberar o email e evitar registros órfãos em auth.users.
        const emailFoiRemovido =
          formData.tipo !== "terceiro" &&
          !formData.email &&
          selectedUser.email;
        if (emailFoiRemovido) {
          await supabase.functions.invoke("admin-users", {
            body: {
              action: "remove-auth-user",
              targetUserId: selectedUser.id,
            },
          });
        }

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
            throw new Error(
              `Erro ao vincular contratos: ${contractError.message}`,
            );
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

        // Atualiza usuario_codigomv (para terceiros)
        if (formData.tipo === "terceiro") {
          await supabase
            .from("usuario_codigomv")
            .delete()
            .eq("usuario_id", selectedUser.id);

          if (formData.codigomvs.length > 0) {
            const { error: codigomvError } = await supabase
              .from("usuario_codigomv")
              .insert(
                formData.codigomvs.map((par) => ({
                  usuario_id: selectedUser.id,
                  codigomv: par.codigomv.trim(),
                  nm_unidade: par.nm_unidade,
                })),
              );
            if (codigomvError) {
              if (codigomvError.code === "23505") {
                throw new Error(
                  "Um dos códigos MV já está cadastrado para essa unidade hospitalar por outro usuário",
                );
              }
              throw new Error(`Erro ao salvar códigos MV: ${codigomvError.message}`);
            }
          }
        }

        setSuccess("Usuário atualizado com sucesso!");
        setSaving(false);
        limparRascunhoFormulario();
        handleCloseCreateDialog();
        loadInitialData(); // Atualiza autocompletes de nome/CPF
        handleSearch();
      } else {
        // Create new user

        if (formData.tipo === "terceiro") {
          // Terceiros: insert direto sem conta auth
          const { data: existingCpf } = await supabase
            .from("usuarios")
            .select("id")
            .eq("cpf", formData.cpf)
            .maybeSingle();

          if (existingCpf) {
            setError("Já existe um usuário com este CPF");
            setSaving(false);
            return;
          }

          const firstCodigomv =
            formData.codigomvs.length > 0
              ? formData.codigomvs[0].codigomv.trim()
              : null;

          const tempUUID = crypto.randomUUID();
          const { data: newUser, error: insertError } = await supabase
            .from("usuarios")
            .insert({
              id: tempUUID,
              email: null,
              nome: formData.nome,
              cpf: formData.cpf,
              tipo: formData.tipo,
              codigomv: firstCodigomv,
              especialidade: formData.especialidade,
              unidade_hospitalar_id: null,
              contrato_id:
                formData.contrato_ids.length > 0
                  ? formData.contrato_ids[0]
                  : null,
            })
            .select()
            .single();

          if (insertError) throw insertError;

          if (formData.contrato_ids.length > 0 && newUser) {
            const { error: contractError } = await supabase
              .from("usuario_contrato")
              .insert(
                formData.contrato_ids.map((contrato_id) => ({
                  usuario_id: newUser.id,
                  contrato_id,
                  cpf: formData.cpf,
                })),
              );
            if (contractError)
              throw new Error(
                `Erro ao vincular contratos: ${contractError.message}`,
              );
          }

          // Salva os códigos MV em usuario_codigomv
          if (newUser && formData.codigomvs.length > 0) {
            const { error: codigomvError } = await supabase
              .from("usuario_codigomv")
              .insert(
                formData.codigomvs.map((par) => ({
                  usuario_id: newUser.id,
                  codigomv: par.codigomv.trim(),
                  nm_unidade: par.nm_unidade,
                })),
              );
            if (codigomvError) {
              if (codigomvError.code === "23505") {
                throw new Error(
                  "Um dos códigos MV já está cadastrado para essa unidade hospitalar por outro usuário",
                );
              }
              throw new Error(`Erro ao salvar códigos MV: ${codigomvError.message}`);
            }
          }

          setSuccess("Terceiro criado com sucesso!");
        } else {
          // Não-terceiros: cria conta auth via edge function com senha padrão Agir@123
          const { data, error: fnError } = await supabase.functions.invoke(
            "admin-users",
            {
              body: {
                action: "create-user",
                email: formData.email,
                nome: formData.nome,
                cpf: formData.cpf,
                tipo: formData.tipo,
                unidade_hospitalar_id:
                  formData.tipo === "administrador-agir-planta"
                    ? formData.unidade_hospitalar_id
                    : null,
                contrato_ids: formData.contrato_ids,
              },
            },
          );

          if (fnError) {
            // Extract the specific error message from the edge function response body
            let msg = fnError.message;
            try {
              const body = await (fnError as any).context.json();
              if (body?.error) msg = body.error;
            } catch {}
            throw new Error(msg);
          }
          if (data?.error) throw new Error(data.error);

          setSuccess(
            `Usuário ${formData.nome} criado com sucesso! Senha padrão: Agir@123 — lembre de avisar o usuário para alterá-la no primeiro acesso.`,
          );
        }

        setSaving(false);
        limparRascunhoFormulario();
        handleCloseCreateDialog();
        loadInitialData(); // Atualiza autocompletes de nome/CPF
        handleSearch();
      }
    } catch (err: any) {
      setSaving(false);
      console.error("Error saving terceiro:", err);

      // Provide more specific error messages
      let errorMessage = "Erro ao salvar terceiro";

      if (err.code === "23505") {
        errorMessage = "Já existe um usuário com este CPF ou email";
      } else if (
        err.code === "23514" ||
        err.message?.includes("usuarios_cpf_length_check")
      ) {
        errorMessage = CPF_ERROR_MESSAGE;
      } else if (err.code === "23503") {
        errorMessage =
          "Erro de referência: verifique se o contrato ou unidade existe";
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

  const handleResetPassword = async (usuario: Usuario) => {
    if (
      !window.confirm(
        `Redefinir a senha de "${usuario.nome}" para a senha padrão Agir@123?\n\nLembre de avisar o usuário para alterá-la no próximo acesso.`,
      )
    )
      return;

    try {
      setError("");
      setSuccess("");

      const { data, error: fnError } = await supabase.functions.invoke(
        "admin-users",
        {
          body: { action: "reset-password", targetUserId: usuario.id },
        },
      );

      if (fnError) {
        let msg = fnError.message;
        try {
          const body = await (fnError as any).context.json();
          if (body?.error) msg = body.error;
        } catch {}
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);

      setSuccess(
        `Senha de ${usuario.nome} redefinida para "Agir@123". Avise o usuário para alterá-la no próximo login.`,
      );
    } catch (err: any) {
      setError(err.message || "Erro ao redefinir senha");
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

      // Delete usuario_contrato and usuario_codigomv records
      await supabase
        .from("usuario_contrato")
        .delete()
        .eq("usuario_id", usuario.id);

      await supabase
        .from("usuario_codigomv")
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
        console.error(
          "Error deleting auth user (might not exist in auth):",
          authErr,
        );
      }

      setSuccess("Usuário excluído com sucesso!");
      handleCloseUserDetails();
      loadInitialData(); // Atualiza autocompletes de nome/CPF
      handleSearch();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleExportExcel = () => {
    const rows = usuariosFiltrados.map((u) => ({
      Nome: u.nome,
      Tipo: roleLabels[u.tipo],
      CPF: u.cpf,
      "Código MV": u.codigomv ?? "",
      "E-mail": u.email ?? "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Usuários");
    XLSX.writeFile(
      workbook,
      `usuarios_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  // Get unique names for autocomplete
  const nombresDisponiveis = Array.from(
    new Set(usuarios.map((u) => u.nome)),
  ).sort();

  // Get unique CPFs for autocomplete
  const cpfsDisponiveis = Array.from(
    new Set(usuarios.map((u) => u.cpf)),
  ).sort();

  // Get unique emails for autocomplete
  const emailsDisponiveis = Array.from(
    new Set(
      usuarios
        .map((u) => u.email)
        .filter((e): e is string => Boolean(e)),
    ),
  ).sort();

  // Get unique parceiros (empresas from contratos)
  const parceirosDisponiveis = Array.from(
    new Set(contratos.map((c) => c.empresa)),
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
                freeSolo
                options={nombresDisponiveis}
                value={filtroNome}
                onChange={(_, newValue) => setFiltroNome(newValue as string[])}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Nome"
                    placeholder="Digite e pressione Enter..."
                  />
                )}
                size="small"
              />
            </Grid>

            <Grid item xs={12} md={6} lg={4}>
              <Autocomplete
                multiple
                freeSolo
                options={cpfsDisponiveis}
                value={filtroCpf}
                onChange={(_, newValue) => setFiltroCpf(newValue as string[])}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="CPF"
                    placeholder="Digite e pressione Enter..."
                  />
                )}
                size="small"
              />
            </Grid>

            <Grid item xs={12} md={6} lg={4}>
              <Autocomplete
                options={contratos}
                value={filtroContrato}
                onChange={(_, newValue) => setFiltroContrato(newValue)}
                getOptionLabel={(option) =>
                  `${option.nome} - ${option.empresa}${option.numero_contrato ? ` - ${option.numero_contrato}` : ''}`
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Contrato"
                    placeholder="Selecione..."
                  />
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
                  <TextField
                    {...params}
                    label="Parceiro"
                    placeholder="Selecione..."
                  />
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
                  <TextField
                    {...params}
                    label="Especialidade"
                    placeholder="Selecione..."
                  />
                )}
                size="small"
              />
            </Grid>

            <Grid item xs={12} md={6} lg={4}>
              <Autocomplete
                multiple
                freeSolo
                options={emailsDisponiveis}
                value={filtroEmail}
                onChange={(_, newValue) => setFiltroEmail(newValue as string[])}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Email"
                    placeholder="Digite e pressione Enter..."
                  />
                )}
                size="small"
              />
            </Grid>

            <Grid item xs={12}>
              <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
                <Button
                  variant="contained"
                  startIcon={<Search />}
                  onClick={handleSearch}
                  disabled={loading}
                  sx={{
                    background:
                      "linear-gradient(135deg, #0ea5e9 0%, #8b5cf6 100%)",
                    color: "#ffffff",
                    fontWeight: 600,
                    boxShadow: "0 4px 12px rgba(14, 165, 233, 0.3)",
                    "&:hover": {
                      background:
                        "linear-gradient(135deg, #0284c7 0%, #7c3aed 100%)",
                      boxShadow: "0 6px 16px rgba(14, 165, 233, 0.4)",
                    },
                    "&:disabled": {
                      background:
                        "linear-gradient(135deg, #94a3b8 0%, #cbd5e1 100%)",
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
                    background:
                      "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    color: "#ffffff",
                    fontWeight: 600,
                    boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)",
                    "&:hover": {
                      background:
                        "linear-gradient(135deg, #059669 0%, #047857 100%)",
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
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
              <Typography variant="h6" fontWeight={600}>
                Resultados ({usuariosFiltrados.length})
              </Typography>
              <Tooltip title="Exportar dados em Excel">
                <span>
                  <Button
                    variant="outlined"
                    startIcon={<FileDownload />}
                    onClick={handleExportExcel}
                    disabled={usuariosFiltrados.length === 0}
                    sx={{
                      borderColor: "#10b981",
                      color: "#10b981",
                      "&:hover": {
                        borderColor: "#059669",
                        bgcolor: "rgba(16, 185, 129, 0.08)",
                      },
                    }}
                  >
                    Excel
                  </Button>
                </span>
              </Tooltip>
            </Box>

            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress />
              </Box>
            ) : usuariosFiltrados.length === 0 ? (
              <Box sx={{ textAlign: "center", py: 4 }}>
                <PersonOff
                  sx={{ fontSize: 64, color: "text.disabled", mb: 2 }}
                />
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
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          mb: 1,
                        }}
                      >
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
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
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
                <Typography
                  variant="subtitle2"
                  color="text.secondary"
                  gutterBottom
                >
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
                    {userCodigomvs.length > 0 && (
                      <Grid item xs={12}>
                        <Typography variant="caption" color="text.secondary">
                          Códigos MV
                        </Typography>
                        <Box sx={{ mt: 0.5, display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                          {userCodigomvs.map((par, i) => (
                            <Chip
                              key={i}
                              label={`${par.codigomv} — ${par.nm_unidade}`}
                              size="small"
                              variant="outlined"
                              color="secondary"
                            />
                          ))}
                        </Box>
                      </Grid>
                    )}
                    {selectedUser.especialidade &&
                      selectedUser.especialidade.length > 0 && (
                        <Grid item xs={12}>
                          <Typography variant="caption" color="text.secondary">
                            Especialidades
                          </Typography>
                          <Box
                            sx={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 0.5,
                              mt: 0.5,
                            }}
                          >
                            {selectedUser.especialidade.map((esp) => (
                              <Chip
                                key={esp}
                                label={esp}
                                size="small"
                                color="primary"
                              />
                            ))}
                          </Box>
                        </Grid>
                      )}
                  </Grid>
                </Paper>
              </Box>

              {/* Contracts */}
              <Box>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 1,
                  }}
                >
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
                            primary={(() => {
                              const unidade = unidades.find((u) => u.id === uc.contratos?.unidade_hospitalar_id);
                              const prefixo = unidade ? `${unidade.codigo} - ` : '';
                              return `${prefixo}${uc.contratos?.nome}${uc.contratos?.numero_contrato ? ` - ${uc.contratos.numero_contrato}` : ''}`;
                            })()}
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
                      (c) =>
                        !userContracts.some((uc) => uc.contrato_id === c.id),
                    )}
                    getOptionLabel={(option) => {
                      const unidade = unidades.find((u) => u.id === option.unidade_hospitalar_id);
                      const prefixo = unidade ? `${unidade.codigo} - ` : '';
                      return `${prefixo}${option.nome} - ${option.empresa}${option.numero_contrato ? ` - ${option.numero_contrato}` : ''}`;
                    }}
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

              {/* Reset Password - visível apenas para quem tem permissão */}
              {selectedUser.email &&
                (isAdminAgirCorporativo ||
                  (isAdminAgirPlanta &&
                    ["administrador-terceiro", "terceiro"].includes(
                      selectedUser.tipo,
                    ))) && (
                  <Button
                    variant="contained"
                    startIcon={<LockReset />}
                    onClick={() => handleResetPassword(selectedUser)}
                    fullWidth
                    sx={{
                      background:
                        "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                      "&:hover": {
                        background:
                          "linear-gradient(135deg, #d97706 0%, #b45309 100%)",
                      },
                    }}
                  >
                    Redefinir Senha para Padrão (Agir@123)
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
              onChange={(e) =>
                setFormData({ ...formData, nome: e.target.value })
              }
              fullWidth
              required
            />

            <FormControl fullWidth required>
              <InputLabel>Tipo de Usuário</InputLabel>
              <Select
                value={formData.tipo}
                label="Tipo de Usuário"
                onChange={(e) => {
                  const newTipo = e.target.value as UserRole;
                  setFormData({
                    ...formData,
                    tipo: newTipo,
                    ...(newTipo === "terceiro" && { email: "" }),
                  });
                }}
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

            {/* Email - apenas para tipos que não são terceiro */}
            {formData.tipo !== "terceiro" && (
              <TextField
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                fullWidth
                required={!editMode}
                error={
                  formData.email ? isEmailDomainBlocked(formData.email) : false
                }
                helperText={
                  formData.email && isEmailDomainBlocked(formData.email)
                    ? getBlockedDomainMessage(formData.email)
                    : "Email utilizado como login no sistema. Verifique cuidadosamente se está correto."
                }
              />
            )}

            <TextField
              label="CPF"
              value={formData.cpf}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  cpf: e.target.value.replace(/\D/g, ""),
                })
              }
              fullWidth
              required
              error={formData.cpf.length > 0 && !isValidCpf(formData.cpf)}
              helperText={
                formData.cpf.length > 0 && !isValidCpf(formData.cpf)
                  ? CPF_ERROR_MESSAGE
                  : "O CPF deve conter exatamente 11 dígitos numéricos"
              }
              inputProps={{ maxLength: 11 }}
            />

            {formData.tipo === "administrador-agir-planta" && (
              <Autocomplete
                value={
                  unidades.find(
                    (u) => u.id === formData.unidade_hospitalar_id,
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
                  <TextField {...params} label="Unidade Hospitalar" required />
                )}
                fullWidth
              />
            )}

            {formData.tipo === "terceiro" && (
              <>
                {/* Códigos MV por unidade hospitalar */}
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Códigos no MV *
                  </Typography>

                  {formData.codigomvs.map((par, index) => (
                    <Box
                      key={index}
                      sx={{ display: "flex", gap: 1, mb: 1, alignItems: "center" }}
                    >
                      <TextField
                        label="Código Prestador MV"
                        value={par.codigomv}
                        onChange={(e) => {
                          const updated = [...formData.codigomvs];
                          updated[index] = { ...par, codigomv: e.target.value };
                          setFormData({ ...formData, codigomvs: updated });
                        }}
                        size="small"
                        sx={{ flex: 1 }}
                        required
                      />
                      <FormControl size="small" sx={{ minWidth: 160 }} required>
                        <InputLabel>Unidade</InputLabel>
                        <Select
                          value={par.nm_unidade}
                          label="Unidade"
                          onChange={(e) => {
                            const updated = [...formData.codigomvs];
                            updated[index] = { ...par, nm_unidade: e.target.value };
                            setFormData({ ...formData, codigomvs: updated });
                          }}
                        >
                          {unidades.map((u) => (
                            <MenuItem key={u.id} value={u.codigo}>
                              {u.codigo}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <IconButton
                        size="small"
                        onClick={() => {
                          const updated = formData.codigomvs.filter(
                            (_, i) => i !== index,
                          );
                          setFormData({ ...formData, codigomvs: updated });
                        }}
                        title="Remover"
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}

                  <Button
                    startIcon={<Add />}
                    onClick={() =>
                      setFormData({
                        ...formData,
                        codigomvs: [
                          ...formData.codigomvs,
                          { codigomv: "", nm_unidade: "" },
                        ],
                      })
                    }
                    variant="outlined"
                    size="small"
                    sx={{ mt: 0.5 }}
                  >
                    Adicionar Código MV
                  </Button>
                </Box>

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
            {formData.tipo !== "administrador-agir-corporativo" &&
              formData.tipo !== "administrador-agir-planta" && (
                <Autocomplete
                  multiple
                  options={contratos}
                  value={contratos.filter((c) =>
                    formData.contrato_ids.includes(c.id),
                  )}
                  onChange={(_, newValue) =>
                    setFormData({
                      ...formData,
                      contrato_ids: newValue.map((c) => c.id),
                    })
                  }
                  getOptionLabel={(option) => {
                    const unidade = unidades.find((u) => u.id === option.unidade_hospitalar_id);
                    const prefixo = unidade ? `${unidade.codigo} - ` : '';
                    return `${prefixo}${option.nome} - ${option.empresa}${option.numero_contrato ? ` - ${option.numero_contrato}` : ''}`;
                  }}
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

            {/* Avisos por tipo */}
            {(formData.tipo === "administrador-agir-corporativo" ||
              formData.tipo === "administrador-agir-planta") && (
              <Alert severity="info">
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Administradores Agir não precisam de vínculo com contrato
                </Typography>
              </Alert>
            )}

            {formData.tipo === "terceiro" && !editMode && (
              <Alert severity="info">
                <Typography variant="body2">
                  Terceiros são criados apenas para registro e controle de
                  escalas. Eles não possuem acesso ao sistema.
                </Typography>
              </Alert>
            )}

            {/* Lembrete de senha padrão - apenas ao criar usuário com acesso */}
            {!editMode && formData.tipo !== "terceiro" && (
              <Alert
                severity="success"
                icon={<LockReset fontSize="inherit" />}
                sx={{
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: "success.light",
                  "& .MuiAlert-message": { width: "100%" },
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                  Senha padrão: Agir@123
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  O usuário receberá acesso imediato com esta senha. Lembre-se
                  de avisá-lo para alterá-la no primeiro login.
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
