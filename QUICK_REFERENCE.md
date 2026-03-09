# ParcerIA - Quick Reference Guide

## Resumo Executivo (5 minutos)

### O Que é?
Sistema SaaS para gestão de acessos e contratos de equipes terceirizadas em hospitais.

### Stack
- **Frontend:** React 18 + TypeScript + MUI + Vite
- **Backend:** Supabase (PostgreSQL + Auth + RLS)
- **Automação:** Python (scripts via cron)
- **IA:** OpenAI GPT-4o

### Funcionalidades
1. Dashboard de horas trabalhadas
2. Escalas médicas com workflow de aprovação
3. Gestão de contratos
4. Insights com IA (ChatBot)

### Migração para AWS
- **Tempo:** 8-12 semanas
- **Mapeamento:** Supabase → RDS + Cognito + Lambda + S3
- **Risco principal:** Reimplementar RLS como middleware

---

## Comandos Rápidos

### Desenvolvimento Frontend

```bash
# Instalar dependências
npm install

# Rodar em desenvolvimento
npm run dev

# Build de produção
npm run build

# Type check + build
npm run build:check

# Lint
npm run lint
```

### Supabase CLI

```bash
# Login
supabase login

# Linkar projeto
supabase link --project-ref qszqzdnlhxpglllyqtht

# Gerar tipos TypeScript
supabase gen types typescript > src/types/database.types.ts

# Deploy de Edge Function
supabase functions deploy chat-gateway

# Ver logs
supabase functions logs chat-gateway
```

### Scripts Python (Droplet)

```bash
# SSH no droplet
ssh root@<ip>

# Ver cron jobs
crontab -l

# Ver logs
tail -f /var/log/parceria/import.log

# Rodar script manualmente
cd /root/parceria && python3 importar-ultimos-10000-acessos.py

# Reiniciar script travado
ps aux | grep python
kill <PID>
```

### AWS CLI

```bash
# Ver logs de Lambda
aws logs tail /aws/lambda/parceria-chat-gateway --follow

# Invocar Lambda
aws lambda invoke --function-name parceria-chat-gateway \
  --payload '{"message": "teste"}' response.json

# Conectar ao RDS
psql -h parceria-db.xxx.sa-east-1.rds.amazonaws.com -U admin -d parceria
```

---

## Variáveis de Ambiente

### .env (Frontend)

```env
VITE_SUPABASE_URL=https://qszqzdnlhxpglllyqtht.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### .env (Scripts Python)

```env
SUPABASE_URL=https://qszqzdnlhxpglllyqtht.supabase.co
SUPABASE_SERVICE_ROLE_KEY=chave-service-role
RDS_HOST=db-rds-postgres.cx4bovrfmkbp.sa-east-1.rds.amazonaws.com
RDS_USER=admin
RDS_PASSWORD=senha
OPENAI_API_KEY=sk-...
```

---

## Estrutura de Diretórios

```
src/
├── App.tsx                    # Rotas
├── components/
│   ├── auth/ProtectedRoute.tsx
│   ├── layout/Layout.tsx
│   ├── ChatBot.tsx
│   └── dashboard/
├── contexts/
│   ├── AuthContext.tsx        # Estado de auth
│   └── ThemeContext.tsx
├── features/
│   ├── dashboard/
│   └── escalas-medicas/
├── lib/
│   ├── supabase.ts            # Cliente Supabase
│   └── theme.ts
├── pages/
│   ├── Dashboard.tsx
│   ├── EscalasMedicas.tsx
│   ├── Contratos.tsx
│   └── InsightsIA.tsx
└── services/
```

---

## Rotas da Aplicação

| Rota | Permissão | Descrição |
|------|-----------|-----------|
| `/login` | Público | Login |
| `/dashboard` | Admin Agir Any | Dashboard principal |
| `/escalas` | Admin/Escala | Escalas médicas |
| `/contratos` | Admin/Contrato | Contratos |
| `/usuarios` | Admin Agir | Usuários |
| `/insights-ia` | Admin Corporativo | ChatBot IA |

---

## Tipos de Usuário

| Tipo | Acesso |
|------|--------|
| `administrador-agir-corporativo` | Total |
| `administrador-agir-planta` | Unidade específica |
| `administrador-terceiro` | Seu contrato |
| `terceiro` | Próprios dados |

---

## Tabelas do Banco

```sql
usuarios              -- Perfis de usuário
acessos               -- Dados das catracas
contratos             -- Contratos
contrato_itens        -- Itens de contrato
escalas_medicas       -- Plantões
produtividade         -- Métricas MV
unidades_hospitalares -- Hospitais
insights_ia           -- Histórico de insights
documentos            -- PDFs e embeddings
```

---

## Scripts Python

| Script | Horário | Função |
|--------|---------|--------|
| `importar-ultimos-10000-acessos.py` | 06:00 | Importa catracas |
| `coletar-produtividade-mv.py` | 02:00 | Scraping MV |
| `recalcular-status-diario.py` | 14:00 | Atualiza status |

---

## Edge Functions

| Function | Função |
|----------|--------|
| `chat-gateway` | Roteia perguntas do ChatBot |
| `gerar-insights` | Gera insights diários |
| `processar-documento` | Vetoriza PDFs |

---

## URLs Importantes

| Serviço | URL |
|---------|-----|
| Supabase Dashboard | https://qszqzdnlhxpglllyqtht.supabase.co |
| Vercel Dashboard | https://vercel.com/dashboard |
| AWS Console | https://console.aws.amazon.com |
| Produção | https://parceria.agir.com.br |

---

## Troubleshooting Rápido

### "JWT expired"
```typescript
const { data } = await supabase.auth.refreshSession();
```

### "RLS policy violation"
- Verificar políticas no SQL Editor
- Testar como usuário afetado

### Scripts Python falhando
```bash
cd /root/parceria
pip install -r requirements.txt --upgrade
python3 script.py  # Rodar manualmente
```

### ChatBot não responde
```bash
supabase functions logs chat-gateway
# Verificar chave OpenAI no Dashboard
```

---

## Contatos de Emergência

| Sistema | Suporte |
|---------|---------|
| Supabase | support@supabase.io |
| Vercel | https://vercel.com/support |
| DigitalOcean | https://cloud.digitalocean.com/support |
| AWS | https://console.aws.amazon.com/support |

---

## Checklist de Deploy

### Frontend (Vercel)
- [ ] Push na branch `main`
- [ ] Build completou sem erros
- [ ] Variáveis de ambiente configuradas
- [ ] Testar login
- [ ] Testar dashboard

### Scripts Python (Droplet)
- [ ] Código no droplet
- [ ] Dependências instaladas
- [ ] Cron job configurado
- [ ] Logs verificando execução
- [ ] Email de alerta configurado

### Edge Functions (Supabase)
- [ ] `supabase functions deploy`
- [ ] Testar no Dashboard
- [ ] Verificar logs
- [ ] Testar do frontend

---

## Mapeamento AWS

| Supabase | AWS |
|----------|-----|
| PostgreSQL | RDS PostgreSQL |
| Auth | Cognito User Pools |
| Storage | S3 |
| Edge Functions | Lambda + API Gateway |
| RLS | IAM + Middleware |

---

## Links da Documentação

- **Completa:** `DOCUMENTACAO_HANDOVER_COMPLETA.md`
- **Apresentação:** `ROTEIRO_APRESENTACAO.md`
- **Técnica:** `DOCUMENTACAO_TECNICA_COMPLETA.md`
- **Parceria:** `DOCUMENTACAO_PARCERIA_COMPLETA.md`

---

**Versão:** 1.0  
**Atualizado:** Março 2026
