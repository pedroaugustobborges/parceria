/**
 * Script para criar Administradores Corporativos com senha fixa
 *
 * REQUISITOS:
 * - Node.js instalado
 * - Biblioteca @supabase/supabase-js instalada
 *
 * INSTALAÇÃO:
 * npm install @supabase/supabase-js
 *
 * USO:
 * 1. Configure as variáveis SUPABASE_URL e SUPABASE_SERVICE_KEY abaixo
 * 2. Execute: node criar_admins_com_senha.js
 */

import { createClient } from "@supabase/supabase-js";

// ====================================================================
// CONFIGURAÇÃO - SUBSTITUA COM SUAS CREDENCIAIS
// ====================================================================
const SUPABASE_URL = "https://qszqzdnlhxpglllyqtht.supabase.co";
const SUPABASE_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzenF6ZG5saHhwZ2xsbHlxdGh0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDI4MzcxNCwiZXhwIjoyMDc1ODU5NzE0fQ.NbzZAKa3X1mkSVetR_JQoq1UoE1mUtaETVkndBs-wgk"; // Obtenha em Settings → API

// ====================================================================
// DADOS DOS USUÁRIOS
// ====================================================================
const usuarios = [
  {
    nome: "MARYLUZA CRISTINA DOS SANTOS",
    cpf: "81247982149",
    email: "analistas.suadm@hugol.org.br",
    tipo: "administrador-agir-corporativo",
    senha: "Agir@123",
  },
  {
    nome: "HALANA ALVES LOPES DA TRINDADE",
    cpf: "01966698127",
    email: "halana.alves@hugol.org.br",
    tipo: "administrador-agir-corporativo",
    senha: "Agir@123",
  },
  {
    nome: "LUANA DE SOUSA MORAIS",
    cpf: "02446867188",
    email: "lu.ana.de@hotmail.com",
    tipo: "administrador-agir-corporativo",
    senha: "Agir@123",
  },
];

// ====================================================================
// FUNÇÃO PRINCIPAL
// ====================================================================
async function criarAdministradores() {
  console.log("🚀 Iniciando criação de administradores...\n");

  // Criar cliente Supabase com Service Role Key (tem permissões de admin)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  for (const usuario of usuarios) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`📝 Processando: ${usuario.nome}`);
    console.log(`   Email: ${usuario.email}`);
    console.log(`   CPF: ${usuario.cpf}`);
    console.log("=".repeat(60));

    try {
      // PASSO 1: Verificar se usuário já existe (por email ou CPF)
      console.log("\n🔍 PASSO 1: Verificando usuário existente...");

      const { data: existingUser } = await supabase
        .from("usuarios")
        .select("id, email, cpf, nome")
        .or(`email.eq.${usuario.email},cpf.eq.${usuario.cpf}`)
        .maybeSingle();

      if (existingUser) {
        console.log(`   ⚠️  Usuário encontrado no banco de dados:`);
        console.log(`      ID: ${existingUser.id}`);
        console.log(`      Nome: ${existingUser.nome}`);
        console.log(`      Email: ${existingUser.email}`);
        console.log(`      CPF: ${existingUser.cpf}`);

        // PASSO 2: Excluir registros relacionados (usuario_contrato)
        console.log("\n🗑️  PASSO 2: Excluindo vínculos de contrato...");
        const { error: deleteContractError } = await supabase
          .from("usuario_contrato")
          .delete()
          .eq("usuario_id", existingUser.id);

        if (deleteContractError) {
          console.log(
            `   ⚠️  Aviso ao excluir contratos: ${deleteContractError.message}`
          );
        } else {
          console.log("   ✅ Vínculos de contrato excluídos");
        }

        // PASSO 3: Excluir registro da tabela usuarios
        console.log("\n🗑️  PASSO 3: Excluindo registro da tabela usuarios...");
        const { error: deleteUserError } = await supabase
          .from("usuarios")
          .delete()
          .eq("id", existingUser.id);

        if (deleteUserError) {
          console.log(
            `   ⚠️  Aviso ao excluir usuário: ${deleteUserError.message}`
          );
        } else {
          console.log("   ✅ Registro excluído da tabela usuarios");
        }

        // PASSO 4: Excluir usuário de autenticação
        console.log("\n🗑️  PASSO 4: Excluindo usuário de autenticação...");
        try {
          const { error: deleteAuthError } =
            await supabase.auth.admin.deleteUser(existingUser.id);

          if (deleteAuthError) {
            console.log(
              `   ⚠️  Aviso ao excluir auth: ${deleteAuthError.message}`
            );
          } else {
            console.log("   ✅ Usuário de autenticação excluído");
          }
        } catch (authDeleteError) {
          console.log(`   ⚠️  Aviso: ${authDeleteError.message}`);
        }

        console.log("\n   ✅ Usuário existente completamente removido!");
        console.log("   ⏳ Aguardando 2 segundos antes de recriar...");
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } else {
        console.log("   ✅ Nenhum usuário existente encontrado");
      }

      // PASSO 5: Criar novo usuário de autenticação
      console.log("\n➕ PASSO 5: Criando nova conta de autenticação...");
      const { data: authData, error: authError } =
        await supabase.auth.admin.createUser({
          email: usuario.email,
          password: usuario.senha,
          email_confirm: true, // Confirma email automaticamente
          user_metadata: {
            nome: usuario.nome,
            cpf: usuario.cpf,
          },
        });

      if (authError) {
        throw new Error(`Erro ao criar autenticação: ${authError.message}`);
      }

      const userId = authData.user.id;
      console.log(`   ✅ Conta de autenticação criada`);
      console.log(`   📋 ID: ${userId}`);

      // PASSO 6: Criar registro na tabela usuarios
      console.log("\n➕ PASSO 6: Criando registro na tabela usuarios...");
      const { error: userError } = await supabase.from("usuarios").insert({
        id: userId,
        email: usuario.email,
        nome: usuario.nome,
        cpf: usuario.cpf,
        tipo: usuario.tipo,
        codigomv: null,
        especialidade: null,
        unidade_hospitalar_id: null,
        contrato_id: null,
      });

      if (userError) {
        console.error(`   ❌ Erro ao criar registro: ${userError.message}`);
        // Reverter criação do auth user se falhar
        console.log("   🔄 Revertendo criação do usuário de autenticação...");
        await supabase.auth.admin.deleteUser(userId);
        throw new Error("Falha ao criar registro na tabela usuarios");
      }

      console.log("   ✅ Registro criado na tabela usuarios");

      console.log("\n" + "🎉".repeat(30));
      console.log(`✅ SUCESSO! Usuário ${usuario.nome} criado!`);
      console.log(`   📧 Email: ${usuario.email}`);
      console.log(`   🔑 Senha: ${usuario.senha}`);
      console.log(`   👤 Tipo: Administrador Corporativo`);
      console.log("🎉".repeat(30));
    } catch (error) {
      console.error(`\n❌ ERRO ao processar usuário: ${error.message}`);
      console.error("   Stack:", error.stack);
    }
  }

  console.log("\n\n✅ Processo concluído!");
  console.log("\n📋 CREDENCIAIS DE ACESSO:");
  console.log("━".repeat(60));
  usuarios.forEach((u) => {
    console.log(`\nUsuário: ${u.nome}`);
    console.log(`Email: ${u.email}`);
    console.log(`Senha: ${u.senha}`);
    console.log(`Tipo: Administrador Corporativo`);
  });
  console.log("\n" + "━".repeat(60));
  console.log(
    "\n⚠️  IMPORTANTE: Oriente os usuários a alterarem a senha no primeiro acesso!\n"
  );
}

// ====================================================================
// EXECUTAR
// ====================================================================
criarAdministradores()
  .then(() => {
    console.log("✅ Script finalizado com sucesso!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erro fatal:", error);
    process.exit(1);
  });
