# 🚀 Deploy no Vercel - Guia Completo

## Pré-requisitos

- ✅ Código commitado no GitHub
- ✅ Conta no Vercel (gratuita)
- ✅ Credenciais do Supabase

---

## 📋 Passo a Passo

### 1️⃣ Criar Conta no Vercel

1. Acesse: https://vercel.com
2. Clique em **Sign Up**
3. Escolha **Continue with GitHub**
4. Autorize o Vercel a acessar seus repositórios

### 2️⃣ Importar Projeto do GitHub

1. No dashboard do Vercel, clique em **Add New...** > **Project**
2. Procure por `parceria` na lista de repositórios
3. Clique em **Import** ao lado do repositório

### 3️⃣ Configurar o Projeto

Na tela de configuração:

#### Build Settings (já detecta automaticamente)
- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

#### Root Directory
- Deixe como `.` (raiz do projeto)

### 4️⃣ Adicionar Variáveis de Ambiente

**MUITO IMPORTANTE**: Clique em **Environment Variables** e adicione:

| Name | Value |
|------|-------|
| `VITE_SUPABASE_URL` | `https://qszqzdnlhxpglllyqtht.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (sua chave) |
| `VITE_SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (sua chave) |

**Dica**: Copie os valores do seu arquivo `.env` local!

⚠️ **Marque todas as variáveis para**: Production, Preview e Development

### 5️⃣ Deploy

1. Clique em **Deploy**
2. Aguarde o build (leva ~2-3 minutos)
3. ✅ Deploy concluído!

---

## 🎉 Após o Deploy

### URL da Aplicação

Sua aplicação estará disponível em:
```
https://parceria-seunome.vercel.app
```

### Configurar Domínio Customizado (Opcional)

1. No projeto no Vercel, vá em **Settings** > **Domains**
2. Adicione seu domínio personalizado
3. Configure o DNS conforme instruções do Vercel

---

## 🔄 Deploy Automático

**Boas notícias**: O Vercel faz deploy automático!

Sempre que você fizer um `git push` para o GitHub:
- ✅ Vercel detecta automaticamente
- ✅ Faz build e deploy da nova versão
- ✅ Mantém versões anteriores disponíveis

---

## 🛠️ Comandos Úteis Locais

### Testar Build Local (antes do deploy)
```bash
npm run build
npm run preview
```

Isso simula o ambiente de produção localmente.

---

## 🔧 Troubleshooting

### Erro no Build

**Problema**: Build falha no Vercel

**Solução**:
1. Teste localmente: `npm run build`
2. Corrija os erros
3. Faça commit e push

### Variáveis de Ambiente Não Funcionam

**Problema**: Aplicação não conecta com Supabase

**Solução**:
1. Verifique se as variáveis começam com `VITE_`
2. No Vercel, vá em **Settings** > **Environment Variables**
3. Confira se os valores estão corretos
4. Clique em **Redeploy** após alterar

### Página 404 ao Recarregar

**Problema**: Ao recarregar a página, aparece 404

**Solução**: O `vercel.json` já está configurado com rewrites. Se o problema persistir:
1. Vá em **Settings** > **General**
2. Em **Build & Development Settings**
3. Confirme que **Output Directory** está como `dist`

---

## 📊 Monitoramento

### Analytics (Gratuito)

O Vercel oferece analytics gratuitos:
1. Vá em **Analytics** no menu do projeto
2. Veja: Page views, unique visitors, top pages

### Logs

Para ver logs de erro:
1. Vá em **Deployments**
2. Clique no deployment
3. Veja **Function Logs** e **Build Logs**

---

## 🔐 Segurança

### HTTPS

✅ HTTPS já vem habilitado automaticamente

### Proteção de Credenciais

⚠️ **NUNCA** commite o arquivo `.env` no GitHub!

O `.gitignore` já está configurado para ignorar `.env`.

Sempre use **Environment Variables** no Vercel para produção.

---

## 💡 Dicas Pro

### 1. Preview Deployments

Cada Pull Request gera um preview automático:
- URL única para testar
- Não afeta a produção

### 2. Rollback Rápido

Se algo der errado:
1. Vá em **Deployments**
2. Encontre o deployment anterior funcionando
3. Clique em **...** > **Promote to Production**

### 3. Performance

O Vercel otimiza automaticamente:
- ✅ CDN global
- ✅ Compressão
- ✅ Cache de assets
- ✅ Image optimization

---

## 🎯 Checklist Final

Antes de compartilhar a URL:

- [ ] Deploy concluído com sucesso
- [ ] Login funcionando
- [ ] Dashboard carregando
- [ ] Filtros funcionando
- [ ] Gestão de usuários OK (admin)
- [ ] Gestão de contratos OK (admin)
- [ ] RLS ativo no Supabase

---

## 📱 Compartilhar

Após deploy bem-sucedido, compartilhe:

```
🎉 ParcerIA está no ar!

🔗 URL: https://parceria-seunome.vercel.app

📧 Login de teste:
   Email: [seu email]
   Senha: [sua senha]

🚀 Sistema de Gestão de Acessos e Contratos
   Desenvolvido com React + Supabase
```

---

## 🆘 Suporte

- Documentação Vercel: https://vercel.com/docs
- Comunidade: https://github.com/vercel/vercel/discussions
- Status: https://www.vercel-status.com

---

**Boa sorte com o deploy! 🚀**
