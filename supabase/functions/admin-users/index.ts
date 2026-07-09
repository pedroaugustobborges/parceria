// admin-users/index.ts
// Edge function para operações administrativas de usuários:
//   - create-user: cria auth user + usuarios record com senha padrão Agir@123
//   - reset-password: redefine senha para Agir@123 (com fallback para usuários legados)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_PASSWORD = "Agir@123";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Não autorizado" }, 401);
    }

    // Client com JWT do chamador — para verificar identidade e role
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Admin client — usa service_role, bypassa RLS
    const adminClient = createClient(supabaseUrl, serviceKey);

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Sessão inválida" }, 401);

    const { data: callerProfile, error: profileError } = await adminClient
      .from("usuarios")
      .select("tipo, unidade_hospitalar_id")
      .eq("id", user.id)
      .single();

    if (profileError || !callerProfile) return json({ error: "Perfil não encontrado" }, 403);

    const body = await req.json();
    const { action } = body;

    // ================================================================
    // ACTION: create-user
    // Cria auth user com senha padrão + insere em usuarios
    // ================================================================
    if (action === "create-user") {
      if (!["administrador-agir-corporativo", "administrador-agir-planta"].includes(callerProfile.tipo)) {
        return json({ error: "Sem permissão para criar usuários" }, 403);
      }

      const { email, nome, cpf, tipo, codigomv, especialidade, unidade_hospitalar_id, contrato_ids } = body;

      if (!email || !nome || !cpf || !tipo) {
        return json({ error: "Campos obrigatórios ausentes: email, nome, cpf, tipo" }, 400);
      }

      // Verifica se CPF já existe
      const { data: existingCpf } = await adminClient
        .from("usuarios")
        .select("id")
        .eq("cpf", cpf)
        .maybeSingle();

      if (existingCpf) return json({ error: "Já existe um usuário com este CPF" }, 409);

      // Cria auth user com senha padrão
      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
        user_metadata: { nome },
      });

      if (authError) {
        if (authError.message.includes("already been registered") || authError.message.includes("already registered")) {
          return json({ error: "Este email já está cadastrado no sistema" }, 409);
        }
        throw authError;
      }

      const authUserId = authData.user.id;

      // Insere em usuarios com o UUID real do auth
      const { error: insertError } = await adminClient.from("usuarios").insert({
        id: authUserId,
        email,
        nome,
        cpf,
        tipo,
        codigomv: tipo === "terceiro" ? (codigomv || null) : null,
        especialidade: tipo === "terceiro" ? (especialidade || null) : null,
        unidade_hospitalar_id: tipo === "administrador-agir-planta" ? (unidade_hospitalar_id || null) : null,
        contrato_id: contrato_ids?.length > 0 ? contrato_ids[0] : null,
      });

      if (insertError) {
        // Rollback: remove auth user criado
        await adminClient.auth.admin.deleteUser(authUserId);
        throw insertError;
      }

      // Vincula contratos
      if (contrato_ids?.length > 0) {
        const contractInserts = (contrato_ids as string[]).map((contrato_id) => ({
          usuario_id: authUserId,
          contrato_id,
          cpf,
        }));
        const { error: contractError } = await adminClient.from("usuario_contrato").insert(contractInserts);
        if (contractError) throw contractError;
      }

      return json({ success: true, userId: authUserId });
    }

    // ================================================================
    // ACTION: reset-password
    // Redefine senha para Agir@123. Se usuário não tiver conta auth
    // (criado com fluxo antigo de convite), cria a conta automaticamente.
    // ================================================================
    if (action === "reset-password") {
      const { targetUserId } = body;
      if (!targetUserId) return json({ error: "targetUserId é obrigatório" }, 400);

      // Busca perfil do usuário alvo
      const { data: targetProfile } = await adminClient
        .from("usuarios")
        .select("tipo, unidade_hospitalar_id, email, nome, cpf, codigomv, especialidade, contrato_id")
        .eq("id", targetUserId)
        .single();

      if (!targetProfile) return json({ error: "Usuário não encontrado" }, 404);

      // Verificação de permissão
      const isCorporativo = callerProfile.tipo === "administrador-agir-corporativo";
      const isPlanta = callerProfile.tipo === "administrador-agir-planta";

      if (!isCorporativo && !isPlanta) {
        return json({ error: "Sem permissão para redefinir senhas" }, 403);
      }

      if (isPlanta) {
        // Admin de planta só pode redefinir senhas de admin-terceiro e terceiro
        if (!["administrador-terceiro", "terceiro"].includes(targetProfile.tipo)) {
          return json({ error: "Sem permissão para redefinir a senha deste tipo de usuário" }, 403);
        }

        // Verifica se o usuário alvo tem contrato vinculado à planta do admin
        const { data: plantContracts } = await adminClient
          .from("contratos")
          .select("id")
          .eq("unidade_hospitalar_id", callerProfile.unidade_hospitalar_id);

        const plantContractIds = (plantContracts || []).map((c: any) => c.id);

        if (plantContractIds.length > 0) {
          const { data: userContracts } = await adminClient
            .from("usuario_contrato")
            .select("contrato_id")
            .eq("usuario_id", targetUserId)
            .in("contrato_id", plantContractIds);

          if (!userContracts || userContracts.length === 0) {
            return json({ error: "Este usuário não está vinculado à sua planta" }, 403);
          }
        } else {
          return json({ error: "Nenhum contrato encontrado para sua planta" }, 403);
        }
      }

      // Tenta redefinir a senha diretamente
      const { error: resetError } = await adminClient.auth.admin.updateUserById(targetUserId, {
        password: DEFAULT_PASSWORD,
      });

      if (resetError) {
        // Usuário não tem conta auth (fluxo legado com UUID temporário)
        // Tenta criar a conta auth e revincula o registro
        if (!targetProfile.email) {
          return json({
            error: "Usuário não possui email cadastrado. Edite o usuário e adicione um email antes de definir acesso.",
          }, 422);
        }

        const { data: newAuthUser, error: createError } = await adminClient.auth.admin.createUser({
          email: targetProfile.email,
          password: DEFAULT_PASSWORD,
          email_confirm: true,
          user_metadata: { nome: targetProfile.nome },
        });

        if (createError) {
          if (createError.message.includes("already been registered") || createError.message.includes("already registered")) {
            return json({ error: "Este email já está registrado no sistema de autenticação, mas com outro ID. Contate o suporte." }, 409);
          }
          throw createError;
        }

        const newAuthId = newAuthUser.user.id;

        // Busca contratos do usuário legado
        const { data: legacyContracts } = await adminClient
          .from("usuario_contrato")
          .select("*")
          .eq("usuario_id", targetUserId);

        // Swap: remove registro antigo e cria novo com ID real do auth
        await adminClient.from("usuario_contrato").delete().eq("usuario_id", targetUserId);
        await adminClient.from("usuarios").delete().eq("id", targetUserId);

        await adminClient.from("usuarios").insert({
          id: newAuthId,
          email: targetProfile.email,
          nome: targetProfile.nome,
          cpf: targetProfile.cpf,
          tipo: targetProfile.tipo,
          codigomv: targetProfile.codigomv,
          especialidade: targetProfile.especialidade,
          unidade_hospitalar_id: targetProfile.unidade_hospitalar_id,
          contrato_id: targetProfile.contrato_id,
        });

        if (legacyContracts && legacyContracts.length > 0) {
          await adminClient.from("usuario_contrato").insert(
            legacyContracts.map((c: any) => ({
              contrato_id: c.contrato_id,
              cpf: c.cpf,
              usuario_id: newAuthId,
            }))
          );
        }
      }

      return json({ success: true });
    }

    return json({ error: "Ação desconhecida" }, 400);

  } catch (err: any) {
    console.error("admin-users error:", err);
    return json({ error: err.message || "Erro interno do servidor" }, 500);
  }
});

function json(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
