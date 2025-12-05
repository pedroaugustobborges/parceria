# 📘 Instruções para Criar Administradores

Este documento explica como criar os 3 administradores corporativos no sistema.

---

## 👥 Usuários a Serem Criados

| Nome | CPF | Email | Senha | Tipo |
|------|-----|-------|-------|------|
| MARYLUZA CRISTINA DOS SANTOS | 81247982149 | analistas.suadm@hugol.org.br | Agir@123 | Admin Corporativo |
| HALANA ALVES LOPES DA TRINDADE | 01966698127 | halana.alves@hugol.org.br | Agir@123 | Admin Corporativo |
| LUANA DE SOUSA MORAIS | 02446867188 | lu.ana.de@hotmail.com | Agir@123 | Admin Corporativo |

---

## 🚀 OPÇÃO 1: Script Node.js (RECOMENDADO)

### ✅ Vantagens
- ✅ Cria usuários com senha fixa `Agir@123`
- ✅ Email confirmado automaticamente (não precisa verificar)
- ✅ Exclui e recria usuários existentes automaticamente
- ✅ Processo completamente automatizado
- ✅ Log detalhado de cada passo

### 📋 Pré-requisitos
```bash
# 1. Node.js instalado (verifique com):
node --version

# 2. Instalar dependência
npm install @supabase/supabase-js
```

### 🔧 Configuração

1. **Obter Service Role Key do Supabase:**
   - Acesse: https://supabase.com/dashboard/project/qszqzdnlhxpglllyqtht
   - Vá em: **Settings → API**
   - Copie a **service_role key** (secret)

2. **Editar o arquivo `criar_admins_com_senha.js`:**
   ```javascript
   // Linha 17 - Cole sua Service Role Key aqui:
   const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // Cole aqui
   ```

### ▶️ Execução

```bash
# No terminal, execute:
node criar_admins_com_senha.js
```

### 📊 Exemplo de Saída

```
🚀 Iniciando criação de administradores...

============================================================
📝 Processando: MARYLUZA CRISTINA DOS SANTOS
   Email: analistas.suadm@hugol.org.br
   CPF: 81247982149
============================================================

🔍 PASSO 1: Verificando usuário existente...
   ⚠️  Usuário encontrado no banco de dados:
      ID: abc123...
      Nome: MARYLUZA CRISTINA DOS SANTOS
      Email: analistas.suadm@hugol.org.br

🗑️  PASSO 2: Excluindo vínculos de contrato...
   ✅ Vínculos de contrato excluídos

🗑️  PASSO 3: Excluindo registro da tabela usuarios...
   ✅ Registro excluído da tabela usuarios

🗑️  PASSO 4: Excluindo usuário de autenticação...
   ✅ Usuário de autenticação excluído

   ✅ Usuário existente completamente removido!
   ⏳ Aguardando 2 segundos antes de recriar...

➕ PASSO 5: Criando nova conta de autenticação...
   ✅ Conta de autenticação criada
   📋 ID: def456...

➕ PASSO 6: Criando registro na tabela usuarios...
   ✅ Registro criado na tabela usuarios

🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉
✅ SUCESSO! Usuário MARYLUZA CRISTINA DOS SANTOS criado!
   📧 Email: analistas.suadm@hugol.org.br
   🔑 Senha: Agir@123
   👤 Tipo: Administrador Corporativo
🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉

[... processo se repete para os outros 2 usuários ...]

✅ Processo concluído!

📋 CREDENCIAIS DE ACESSO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Usuário: MARYLUZA CRISTINA DOS SANTOS
Email: analistas.suadm@hugol.org.br
Senha: Agir@123
Tipo: Administrador Corporativo
...
```

---

## 🗄️ OPÇÃO 2: SQL Editor (Mais Simples, mas Manual)

### ✅ Vantagens
- ✅ Não requer Node.js
- ✅ Execução direta no Supabase
- ✅ Mais simples para quem não tem experiência com programação

### ⚠️ Desvantagens
- ⚠️ Não define senha fixa (cria senha temporária aleatória)
- ⚠️ Requer envio manual de convites pela interface
- ⚠️ Usuários precisam verificar email

### ▶️ Execução

1. **Acesse o SQL Editor do Supabase:**
   - https://supabase.com/dashboard/project/qszqzdnlhxpglllyqtht/editor

2. **Cole e execute o conteúdo do arquivo `criar_admins.sql`**

3. **Após executar, você verá:**
   ```
   Query executed successfully. 3 rows affected.
   ```

4. **Enviar convites manualmente:**
   - Acesse a página "Usuários" no sistema
   - Busque cada usuário pelo CPF
   - Clique em "Detalhes"
   - Clique em "Enviar Convite"
   - O sistema gerará senha temporária aleatória

---

## ✅ Verificação Pós-Criação

Após criar os usuários (por qualquer método), verifique:

### 1. **No Banco de Dados (SQL Editor):**
```sql
SELECT
  nome,
  email,
  cpf,
  tipo,
  created_at
FROM usuarios
WHERE cpf IN ('81247982149', '01966698127', '02446867188')
ORDER BY nome;
```

Deve retornar 3 usuários.

### 2. **No Sistema:**
- Acesse a página "Usuários"
- Busque por cada CPF
- Verifique se aparecem com status "Com Acesso" (verde)

### 3. **Teste de Login:**
```
Email: analistas.suadm@hugol.org.br
Senha: Agir@123
```

Se conseguir fazer login, os usuários foram criados corretamente! ✅

---

## 🔒 Segurança

### ⚠️ IMPORTANTE

1. **Service Role Key é SECRETA:**
   - Nunca compartilhe a Service Role Key
   - Nunca commite em repositórios públicos
   - Tem permissões totais no banco de dados

2. **Orientar usuários a trocar senha:**
   - A senha `Agir@123` é temporária
   - Oriente os usuários a alterarem no primeiro acesso
   - Configure política de senha forte se necessário

3. **Logs:**
   - Monitore os logs de autenticação em: Settings → Auth → Logs
   - Verifique tentativas de login suspeitas

---

## ❓ Troubleshooting

### Erro: "User already registered"
**Solução:** O script já detecta e exclui usuários existentes automaticamente.

### Erro: "Invalid service_role key"
**Solução:** Verifique se copiou a chave correta do Supabase (Settings → API → service_role).

### Erro: "Cannot read property 'id' of null"
**Solução:** Verifique se a tabela `usuarios` existe no banco de dados.

### Usuário criado mas não consegue fazer login
**Solução:**
1. Verifique se o email foi confirmado (email_confirm: true no script)
2. Verifique se a senha está correta: `Agir@123`
3. Verifique logs de auth no Supabase

### Email não chega (se usar OPÇÃO 2)
**Solução:**
1. Verifique se configurou SMTP customizado (veja instruções anteriores)
2. Verifique spam
3. Verifique se o email é válido

---

## 📞 Suporte

Se encontrar problemas:
1. Verifique a seção de Troubleshooting acima
2. Consulte os logs detalhados do script
3. Verifique os logs do Supabase (Settings → Auth → Logs)

---

## 📝 Resumo das Credenciais

**IMPORTANTE: Guarde este resumo em local seguro!**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREDENCIAIS DOS ADMINISTRADORES CORPORATIVOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Usuário 1:
  Nome: MARYLUZA CRISTINA DOS SANTOS
  Email: analistas.suadm@hugol.org.br
  Senha: Agir@123
  CPF: 81247982149
  Tipo: Administrador Corporativo

Usuário 2:
  Nome: HALANA ALVES LOPES DA TRINDADE
  Email: halana.alves@hugol.org.br
  Senha: Agir@123
  CPF: 01966698127
  Tipo: Administrador Corporativo

Usuário 3:
  Nome: LUANA DE SOUSA MORAIS
  Email: lu.ana.de@hotmail.com
  Senha: Agir@123
  CPF: 02446867188
  Tipo: Administrador Corporativo

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TODOS DEVEM TROCAR A SENHA NO PRIMEIRO ACESSO!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
