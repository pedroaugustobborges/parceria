# Documentação Técnica - ParcerIA

## Sistema Inteligente de Gestão de Acessos e Contratos

**Versão:** 1.0.0
**Data:** Dezembro 2025

---

## Sumário

1. [Visão Geral da Aplicação](#1-visão-geral-da-aplicação)
2. [Arquitetura Técnica](#2-arquitetura-técnica)
3. [Frontend - React + TypeScript](#3-frontend---react--typescript)
4. [Backend - Supabase (Detalhado)](#4-backend---supabase-detalhado)
5. [Segurança e Autenticação](#5-segurança-e-autenticação)
6. [Scripts Python de Automação](#6-scripts-python-de-automação)
7. [Banco de Dados](#7-banco-de-dados)
8. [Deploy e Infraestrutura](#8-deploy-e-infraestrutura)
9. [Manutenção e Troubleshooting](#9-manutenção-e-troubleshooting)
10. [Perguntas Frequentes (FAQ)](#10-perguntas-frequentes-faq)

---

## 1. Visão Geral da Aplicação

### 1.1 O que é o ParcerIA?

ParcerIA é um sistema SaaS desenvolvido para a equipe de gestão financeira da Agir Saúde monitorar, gerenciar e controlar contratos com equipes médicas terceirizadas. A aplicação integra dados de múltiplas fontes para fornecer uma visão completa da utilização da força de trabalho contratada.

### 1.2 Funcionalidades Principais

1. **Dashboard de Acessos em Tempo Real**

   - Monitoramento de entradas/saídas das catracas de reconhecimento facial
   - Cálculo automático de horas trabalhadas
   - Filtros avançados (tipo, matrícula, nome, CPF, períodos)
   - Estatísticas consolidadas
   - Exportação para CSV/PDF

2. **Gestão de Usuários**

   - 4 níveis de permissão (Administrador Corporativo, Administrador de Planta, Administrador Terceiro, Terceiro)
   - CRUD completo de usuários
   - Associação com contratos e unidades hospitalares

3. **Gestão de Contratos**

   - Criação e edição de contratos
   - Controle de vigência
   - Alertas de vencimento
   - Associação com unidades hospitalares

4. **Escalas Médicas**

   - Criação de escalas com múltiplos médicos
   - Sistema de aprovação com 7 status diferentes
   - Cálculo automático de status baseado em horas trabalhadas
   - Importação em lote via CSV

5. **Produtividade Médica**

   - Coleta automática de dados do sistema MV
   - 13 métricas diferentes (cirurgias, consultas, etc.)
   - Visualização de tendências

6. **Insights com IA**
   - ChatBot integrado com DeepSeek API
   - Análise contextual baseada em permissões
   - Recomendações inteligentes

### 1.3 Usuários e Permissões

- **Administrador Agir Corporativo**: Acesso total ao sistema
- **Administrador Agir Planta**: Acesso limitado a uma unidade hospitalar específica
- **Administrador Terceiro**: Acesso aos dados do próprio contrato
- **Terceiro**: Visualização apenas dos próprios dados

---

## 2. Arquitetura Técnica

### 2.1 Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Vercel)                       │
│                  React 18 + TypeScript + Vite                   │
│                      Material-UI + Tailwind                     │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          │ HTTPS / JWT Auth
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                    SUPABASE (Backend as a Service)              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Auth JWT   │  │  PostgreSQL  │  │  Real-time   │         │
│  │              │  │   Database   │  │  Subscript.  │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                 │
│  Row Level Security (RLS) - Segurança nativa no banco          │
└─────────────────────────────────────────────────────────────────┘
                          │
                          │ Service Role Key
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                  SCRIPTS PYTHON (DigitalOcean Droplet)          │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  • importar-ultimos-10000-acessos.py (diário 6h)      │    │
│  │  • coletar-produtividade-mv.py (diário 2h)            │    │
│  │  • recalcular-status-diario.py (diário 14h)           │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          │ PostgreSQL Connection
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│              DATA WAREHOUSE (AWS RDS PostgreSQL)                │
│         db-rds-postgres.cx4bovrfmkbp.sa-east-1.rds...          │
│                  Dados das catracas faciais                     │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Stack Tecnológico Completo

**Frontend:**

- React 18.2.0
- TypeScript 5.2.2
- Vite 5.1.0 (build tool)
- Material-UI v5 (componentes UI)
- React Router v6 (navegação)
- Tailwind CSS 3.4.1
- Recharts 3.3.0 (gráficos)
- jsPDF (geração de PDFs)
- PapaParse (manipulação CSV)

**Backend:**

- Supabase (PostgreSQL + Auth + Real-time)
- @supabase/supabase-js 2.86.0 (SDK)

**Automação:**

- Python 3.x
- Selenium (web scraping)
- psycopg2 (PostgreSQL)
- python-dotenv

**Infraestrutura:**

- Vercel (hospedagem frontend)
- DigitalOcean Droplet (scripts Python via cron)
- AWS RDS (data warehouse)

---

## 3. Frontend - React + TypeScript

### 3.1 Estrutura de Diretórios

```
src/
├── components/          # Componentes reutilizáveis
│   ├── auth/           # ProtectedRoute.tsx
│   ├── dashboard/      # MetricCard, FilterSection
│   └── layout/         # Layout.tsx (sidebar + header)
│
├── contexts/           # Gerenciamento de estado global
│   ├── AuthContext.tsx      # Estado de autenticação
│   └── ThemeContext.tsx     # Tema claro/escuro
│
├── hooks/              # Hooks customizados
│   ├── useContractExpirationAlert.ts
│   ├── useDashboardData.ts
│   ├── useContractCPFs.ts
│   └── usePersistentState.ts
│
├── lib/                # Bibliotecas core
│   ├── supabase.ts    # Cliente Supabase
│   └── theme.ts       # Configuração tema MUI
│
├── pages/              # Páginas (rotas)
│   ├── Login.tsx
│   ├── Dashboard.tsx
│   ├── Usuarios.tsx
│   ├── Contratos.tsx
│   ├── EscalasMedicas.tsx
│   └── InsightsIA.tsx
│
├── services/           # Lógica de negócio
│   ├── chatService.ts
│   └── statusAnalysisService.ts
│
├── types/              # Definições TypeScript
│   └── database.types.ts
│
├── utils/              # Utilitários
│   ├── dateUtils.ts
│   ├── hoursCalculation.ts
│   └── csvExport.ts
│
├── App.tsx             # Componente principal
└── main.tsx            # Ponto de entrada React
```

### 3.2 Rotas da Aplicação

**Arquivo:** `src/App.tsx`

```typescript
/                       → Redirect para /login
/login                  → Página de login
/forgot-password        → Recuperação de senha
/reset-password         → Reset de senha (via token)
/dashboard              → Dashboard principal (protegido)
/usuarios               → Gestão de usuários (admin only)
/contratos              → Gestão de contratos (admin only)
/escalas-medicas        → Escalas médicas (admin only)
/itens                  → Itens de contrato (admin only)
/parceiros              → Parceiros (admin only)
/unidades-hospitalares  → Unidades hospitalares (admin only)
/insights-ia            → ChatBot IA (todos os usuários autenticados)
```

### 3.3 Componentes Importantes

#### 3.3.1 AuthContext (src/contexts/AuthContext.tsx)

Gerencia toda a autenticação da aplicação:

```typescript
// Estado disponível globalmente
{
  user: User | null,              // Usuário autenticado
  userProfile: UserProfile | null, // Perfil do banco de dados
  loading: boolean,
  isAdminAgirCorporativo: boolean,
  isAdminAgirPlanta: boolean,
  isAdminTerceiro: boolean,
  isTerceiro: boolean,
  signIn: (email, password) => Promise<void>,
  signOut: () => Promise<void>,
  resetPassword: (email) => Promise<void>,
  updatePassword: (newPassword) => Promise<void>
}
```

#### 3.3.2 ProtectedRoute (src/components/auth/ProtectedRoute.tsx)

Protege rotas baseado em permissões:

```typescript
<ProtectedRoute requiredRole="administrador-agir-corporativo">
  <MinhaPageAdmin />
</ProtectedRoute>
```

#### 3.3.3 Layout (src/components/layout/Layout.tsx)

Layout padrão com sidebar, header e tema:

- Sidebar responsiva com navegação
- Switch de tema claro/escuro
- Informações do usuário logado
- Logout

### 3.4 Hooks Customizados

#### usePersistentState

Hook que persiste estado no sessionStorage:

```typescript
const [filters, setFilters] = usePersistentState(
  "dashboard-filters",
  defaultFilters
);
```

Benefícios:

- Mantém filtros após refresh da página
- Gerencia quota exceeded automaticamente
- Suporta objetos complexos e Dates

#### useDashboardData

Centraliza toda lógica de busca e filtro do dashboard:

- Busca dados do Supabase
- Aplica filtros
- Calcula estatísticas
- Memoização para performance

### 3.5 Build e Deploy

**Desenvolvimento:**

```bash
npm run dev
# Abre em http://localhost:5173
```

**Build de Produção:**

```bash
npm run build
# Gera pasta dist/ com arquivos otimizados
```

**Preview de Produção:**

```bash
npm run preview
```

---

## 4. Backend - Supabase (Detalhado)

### 4.1 O que é Supabase?

**Supabase** é uma alternativa open-source ao Firebase. É um "Backend as a Service" (BaaS) que fornece:

1. **Banco de dados PostgreSQL**: Banco relacional completo e robusto
2. **Autenticação**: Sistema JWT integrado
3. **APIs automáticas**: REST e GraphQL geradas automaticamente
4. **Real-time**: Subscriptions para mudanças no banco
5. **Storage**: Armazenamento de arquivos (não usado no ParcerIA)
6. **Edge Functions**: Funções serverless (não usado no ParcerIA)

**Por que Supabase foi escolhido:**

- PostgreSQL completo (não um NoSQL limitado)
- Row Level Security nativo no banco de dados
- APIs REST automáticas (sem necessidade de criar backend)
- Open-source (sem vendor lock-in)
- Hospedagem gerenciada (sem gerenciar servidores)
- Excelente para times pequenos

### 4.2 Configuração do Cliente Supabase

**Arquivo:** `src/lib/supabase.ts`

```typescript
import { createClient } from "@supabase/supabase-js";
import { Database } from "../types/database.types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true, // Renova token automaticamente
    persistSession: true, // Mantém sessão no localStorage
    detectSessionInUrl: true, // Detecta token na URL (reset password)
  },
});
```

### 4.3 Variáveis de Ambiente

**Arquivo:** `.env`

```bash
# URL do projeto Supabase
VITE_SUPABASE_URL=https://qszqzdnlhxpglllyqtht.supabase.co

# Chave pública (anon key) - pode ser exposta no frontend
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Chave de serviço (service role) - NUNCA expor no frontend!
# Usada apenas nos scripts Python
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**IMPORTANTE:**

- `ANON_KEY`: Chave pública, segura para usar no frontend
- `SERVICE_ROLE_KEY`: Chave administrativa, apenas para backend/scripts

### 4.4 Como Funciona a Autenticação no Supabase

#### 4.4.1 Fluxo de Login

```
1. Usuário insere email/senha no formulário
   ↓
2. Frontend chama: supabase.auth.signInWithPassword({ email, password })
   ↓
3. Supabase valida credenciais na tabela auth.users
   ↓
4. Retorna JWT token + refresh token
   ↓
5. Tokens armazenados no localStorage automaticamente
   ↓
6. Frontend busca perfil do usuário na tabela 'usuarios'
   ↓
7. AuthContext disponibiliza dados do usuário globalmente
```

#### 4.4.2 JWT (JSON Web Token)

O Supabase usa JWT para autenticação. Cada requisição ao banco inclui o token:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

O JWT contém:

- User ID (UUID)
- Email
- Role (anon, authenticated, service_role)
- Timestamp de expiração

**Renovação automática:**

- Token expira em 1 hora
- `autoRefreshToken: true` renova automaticamente antes de expirar

#### 4.4.3 Criação de Usuários

**Processo em 2 etapas:**

1. Criar usuário na autenticação:

```typescript
const { data, error } = await supabase.auth.signUp({
  email: "usuario@example.com",
  password: "senha123",
});
```

2. Criar perfil na tabela usuarios:

```typescript
await supabase.from("usuarios").insert({
  id: data.user.id, // Mesmo UUID do auth.users
  email: "usuario@example.com",
  nome: "Nome do Usuário",
  cpf: "12345678900",
  tipo: "terceiro",
});
```

### 4.5 Como Funciona Row Level Security (RLS)

RLS é o coração da segurança do Supabase. É uma funcionalidade nativa do PostgreSQL que permite definir políticas de acesso **no nível do banco de dados**.

#### 4.5.1 Conceito

Diferente de validar permissões no backend (Node.js, PHP, etc.), o RLS valida **no próprio banco de dados**:

```sql
-- Sem RLS (tradicional - inseguro se vazarem as credenciais)
SELECT * FROM usuarios;  -- Retorna TODOS os usuários

-- Com RLS ativado
SELECT * FROM usuarios;  -- Retorna apenas o que o usuário PODE ver
```

#### 4.5.2 Como Ativar RLS

```sql
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
```

Após ativar, **nenhuma linha** é retornada até que políticas sejam criadas.

#### 4.5.3 Políticas de Exemplo

**Política 1: Usuário pode ver o próprio perfil**

```sql
CREATE POLICY "Usuários podem ver seu próprio perfil"
ON usuarios FOR SELECT
USING (auth.uid() = id);
```

Explicação:

- `auth.uid()`: Função do Supabase que retorna o UUID do usuário logado
- `id`: Campo da tabela usuarios
- Se `auth.uid() = id`, a linha é retornada

**Política 2: Admins podem ver todos os usuários**

```sql
CREATE POLICY "Administradores Agir podem ver todos os usuários"
ON usuarios FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid()
    AND tipo IN ('administrador-agir-corporativo', 'administrador-agir-planta')
  )
);
```

Explicação:

- Verifica se o usuário logado (`auth.uid()`) tem tipo admin
- Se sim, permite ver todos os registros
- Se não, não retorna nada (a menos que outra política permita)

#### 4.5.4 Políticas para Acessos (mais complexo)

```sql
-- Terceiros veem apenas seus acessos
CREATE POLICY "Terceiros podem ver seus próprios acessos"
ON acessos FOR SELECT
USING (
  cpf IN (
    SELECT cpf FROM usuarios WHERE id = auth.uid()
  )
);

-- Admin Terceiro vê acessos dos colaboradores do contrato
CREATE POLICY "Admin Terceiros podem ver acessos de seus colaboradores"
ON acessos FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM usuarios u
    JOIN usuario_contrato uc ON u.id = uc.usuario_id
    WHERE u.id = auth.uid()
    AND u.tipo = 'administrador-terceiro'
    AND uc.cpf = acessos.cpf
  )
);

-- Admin Agir vê tudo
CREATE POLICY "Administradores Agir podem ver todos os acessos"
ON acessos FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid()
    AND tipo IN ('administrador-agir-corporativo', 'administrador-agir-planta')
  )
);
```

#### 4.5.5 Vantagens do RLS

1. **Segurança Nativa**: Impossível burlar, está no banco
2. **DRY**: Não precisa repetir lógica de permissão no código
3. **Performance**: Filtros aplicados no nível SQL (muito rápido)
4. **Auditável**: Políticas visíveis e centralizadas
5. **Proteção contra SQL Injection**: PostgreSQL gerencia

### 4.6 APIs Automáticas do Supabase

O Supabase gera automaticamente APIs REST para cada tabela:

#### 4.6.1 SELECT (buscar dados)

```typescript
// Buscar todos os contratos (respeitando RLS)
const { data, error } = await supabase.from("contratos").select("*");

// Buscar com filtros
const { data, error } = await supabase
  .from("acessos")
  .select("*")
  .eq("cpf", "12345678900") // WHERE cpf = '...'
  .gte("data_acesso", "2025-01-01") // WHERE data_acesso >= '...'
  .order("data_acesso", { ascending: false }); // ORDER BY

// Buscar com JOIN
const { data, error } = await supabase.from("usuarios").select(`
    *,
    contrato:contratos(*)
  `);
```

#### 4.6.2 INSERT (inserir dados)

```typescript
const { data, error } = await supabase.from("contratos").insert({
  nome: "Contrato Teste",
  empresa: "Empresa XYZ",
  data_inicio: "2025-01-01",
  ativo: true,
});
```

#### 4.6.3 UPDATE (atualizar dados)

```typescript
const { data, error } = await supabase
  .from("contratos")
  .update({ ativo: false })
  .eq("id", contratoId);
```

#### 4.6.4 DELETE (deletar dados)

```typescript
const { data, error } = await supabase
  .from("contratos")
  .delete()
  .eq("id", contratoId);
```

### 4.7 Real-time (Subscriptions)

O Supabase permite ouvir mudanças no banco em tempo real:

```typescript
// Ouvir novas inserções na tabela acessos
const subscription = supabase
  .channel("acessos-changes")
  .on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "acessos",
    },
    (payload) => {
      console.log("Novo acesso:", payload.new);
      // Atualizar UI automaticamente
    }
  )
  .subscribe();

// Cancelar subscription
subscription.unsubscribe();
```

**Nota:** ParcerIA não usa real-time atualmente, mas está disponível.

### 4.8 Segurança do Supabase

#### 4.8.1 É Seguro?

**SIM!** Supabase é extremamente seguro quando configurado corretamente:

1. **Row Level Security**: Proteção no nível do banco
2. **JWT Authentication**: Padrão indústria
3. **HTTPS obrigatório**: Todas as requisições criptografadas
4. **Certificação SOC 2**: Supabase é certificado
5. **Backups automáticos**: Backups diários
6. **Criptografia em repouso**: Dados criptografados no disco

#### 4.8.2 O que Protege o Sistema?

1. **ANON_KEY é pública**: Mas RLS impede acesso não autorizado
2. **Sem RLS = inseguro**: SEMPRE ativar RLS em todas as tabelas
3. **Policies bem escritas**: Validar lógica cuidadosamente
4. **SERVICE_ROLE_KEY privada**: Nunca expor no frontend

#### 4.8.3 Teste de Segurança

Você pode testar RLS no SQL Editor do Supabase:

```sql
-- Desabilitar RLS temporariamente (apenas para teste)
ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;

-- Buscar como usuário específico
SELECT * FROM usuarios WHERE auth.uid() = 'uuid-do-usuario';

-- Reabilitar RLS
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
```

---

## 5. Segurança e Autenticação

### 5.1 Fluxo Completo de Autenticação

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Usuário acessa /login                                        │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Digita email/senha e clica em "Entrar"                       │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Frontend: supabase.auth.signInWithPassword({ email, pass }) │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼ HTTPS
┌─────────────────────────────────────────────────────────────────┐
│ 4. Supabase valida credenciais em auth.users                    │
│    - Senha hasheada com bcrypt                                  │
│    - Verifica se email confirmado (se config ativada)           │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Supabase gera JWT token                                      │
│    - Access token (expira 1h)                                   │
│    - Refresh token (expira 30 dias)                             │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. Frontend armazena tokens no localStorage                     │
│    - supabase.auth.session                                      │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. AuthContext busca perfil:                                    │
│    supabase.from('usuarios').select('*').eq('id', user.id)      │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 8. Redirect para /dashboard                                     │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Níveis de Permissão

| Tipo de Usuário                  | Permissões                                                                                                            | Use Case                          |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `administrador-agir-corporativo` | - Ver todos os dados<br>- Criar/editar/deletar tudo<br>- Acesso a todas as unidades hospitalares<br>- Aprovar escalas | Gestão corporativa da Agir        |
| `administrador-agir-planta`      | - Ver dados da sua unidade hospitalar<br>- Gerenciar contratos da sua planta<br>- Aprovar escalas da sua planta       | Gestão de uma unidade específica  |
| `administrador-terceiro`         | - Ver dados do próprio contrato<br>- Ver escalas e acessos dos colaboradores<br>- Solicitar aprovações                | Gestor da empresa terceirizada    |
| `terceiro`                       | - Ver apenas os próprios acessos<br>- Ver próprias escalas<br>- Ver própria produtividade                             | Médico ou profissional contratado |

### 5.3 Implementação de Permissões no Frontend

**Arquivo:** `src/contexts/AuthContext.tsx`

```typescript
// Helpers de permissão
const isAdminAgirCorporativo =
  userProfile?.tipo === "administrador-agir-corporativo";
const isAdminAgirPlanta = userProfile?.tipo === "administrador-agir-planta";
const isAdminTerceiro = userProfile?.tipo === "administrador-terceiro";
const isTerceiro = userProfile?.tipo === "terceiro";
const isAdminAgir = isAdminAgirCorporativo || isAdminAgirPlanta;
const isAdmin = isAdminAgir || isAdminTerceiro;
```

**Protegendo rotas:**

```typescript
<ProtectedRoute requiredRole="administrador-agir-corporativo">
  <Usuarios />
</ProtectedRoute>
```

**Protegendo UI:**

```typescript
{
  isAdminAgir && <Button onClick={handleDelete}>Deletar</Button>;
}
```

### 5.4 Recuperação de Senha

**Fluxo:**

1. Usuário clica em "Esqueci minha senha"
2. Digita email
3. Frontend: `supabase.auth.resetPasswordForEmail(email)`
4. Supabase envia email com link mágico
5. Link contém token: `https://parceria.com/reset-password#access_token=...`
6. Página `/reset-password` detecta token
7. Usuário digita nova senha
8. Frontend: `supabase.auth.updateUser({ password: newPassword })`

### 5.5 Tokens e Sessões

**Access Token:**

- JWT válido por 1 hora
- Incluído automaticamente em todas as requisições
- Contém: user_id, email, role, exp (expiração)

**Refresh Token:**

- Válido por 30 dias
- Usado para obter novo access token
- Armazenado apenas no cliente (localStorage)

**Auto-refresh:**

- `autoRefreshToken: true` no cliente Supabase
- 10 minutos antes de expirar, renova automaticamente
- Transparente para o usuário

### 5.6 Boas Práticas de Segurança

1. **Nunca armazenar SERVICE_ROLE_KEY no frontend**
2. **Sempre usar HTTPS em produção**
3. **Validar entrada do usuário** (frontend E backend)
4. **Usar prepared statements** (Supabase faz automaticamente)
5. **Revisar políticas RLS periodicamente**
6. **Ativar 2FA para admins** (em produção)
7. **Logs de auditoria** para ações sensíveis

---

## 6. Scripts Python de Automação

### 6.1 Visão Geral

O ParcerIA usa 3 scripts Python principais que rodam automaticamente via **cron** em um droplet DigitalOcean:

| Script                              | Horário      | Função                       |
| ----------------------------------- | ------------ | ---------------------------- |
| `importar-ultimos-10000-acessos.py` | Diário 06:00 | Importa acessos das catracas |
| `coletar-produtividade-mv.py`       | Diário 02:00 | Coleta produtividade do MV   |
| `recalcular-status-diario.py`       | Diário 14:00 | Recalcula status das escalas |

### 6.2 Script 1: Importar Acessos das Catracas

**Arquivo:** `importar-ultimos-10000-acessos.py`

**O que faz:**

1. Conecta no Data Warehouse (AWS RDS PostgreSQL)
2. Busca CPFs da tabela `usuarios` no Supabase
3. Para cada CPF, busca os últimos 50 acessos do tipo "Terceiro"
4. Verifica se acesso já existe no Supabase (evita duplicação)
5. Insere novos acessos na tabela `acessos`

**Configuração:**

```python
# Data Warehouse (origem dos dados)
DW_CONFIG = {
    'host': 'db-rds-postgres.cx4bovrfmkbp.sa-east-1.rds.amazonaws.com',
    'port': 5432,
    'database': 'db_rds_01',
    'user': 'gest_contratos',
    'password': 'asdgRTFG98'
}

# Supabase (destino dos dados)
SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('VITE_SUPABASE_SERVICE_ROLE_KEY')
```

**Query principal:**

```sql
SELECT
    tipo, matricula, nome, cpf,
    data_acesso AT TIME ZONE 'America/Sao_Paulo' as data_acesso,
    sentido, planta, codin
FROM public.acessos
WHERE cpf = %s AND tipo = 'Terceiro'
ORDER BY data_acesso DESC
LIMIT 50
```

**Evitando duplicação:**

```python
# Verifica se acesso já existe
existing = supabase.table('acessos').select('id') \
    .eq('cpf', cpf) \
    .eq('data_acesso', data_acesso) \
    .eq('sentido', sentido) \
    .execute()

if not existing.data:
    # Insere apenas se não existir
    supabase.table('acessos').insert(registro).execute()
```

**Logs:**

- Progresso em tempo real
- Contadores de inserções/duplicações
- Erros detalhados

### 6.3 Script 2: Coletar Produtividade MV

**Arquivo:** `coletar-produtividade-mv.py`

**O que faz:**

1. Inicia navegador Firefox com Selenium
2. Faz login no sistema MV (sistema hospitalar)
3. Navega até relatório de produtividade
4. Para cada médico cadastrado:
   - Busca código MV do médico
   - Seleciona médico no dropdown
   - Seleciona período (dia anterior)
   - Executa relatório
   - Extrai métricas da tabela HTML
   - Salva no Supabase

**Métricas coletadas (13 campos):**

- Procedimento
- Cirurgia
- Consulta
- Laudo médico solicitado
- Laudo médico completo
- Prescrição
- Evolução
- Atendimento de urgência
- Atendimento ambulatorial
- Evolução UTI dia
- Evolução UTI noite
- Evolução UTI tarde
- Atendimento (geral)

**Resilência:**

- Retries automáticos em caso de falha
- Restart do driver Firefox se travar
- Logs detalhados em `/var/log/produtividade-mv.log`
- Timeout de 30 segundos por operação

**Exemplo de código:**

```python
# Login no MV
driver.get('https://mv.agirsaude.org.br')
driver.find_element(By.ID, 'username').send_keys(MV_USER)
driver.find_element(By.ID, 'password').send_keys(MV_PASSWORD)
driver.find_element(By.ID, 'login-btn').click()

# Navega até relatório
driver.get('https://mv.agirsaude.org.br/relatorio-produtividade')

# Seleciona médico
select_medico = Select(driver.find_element(By.ID, 'medico'))
select_medico.select_by_value(codigo_mv)

# Extrai dados da tabela
table = driver.find_element(By.ID, 'tabela-produtividade')
rows = table.find_elements(By.TAG_NAME, 'tr')

# Processa métricas
for row in rows:
    cols = row.find_elements(By.TAG_NAME, 'td')
    metrica = cols[0].text
    valor = int(cols[1].text)
    dados[metrica] = valor
```

**Dependências:**

```bash
pip install selenium
pip install python-dotenv
pip install supabase

# Firefox deve estar instalado no servidor
sudo apt-get install firefox firefox-geckodriver
```

### 6.4 Script 3: Recalcular Status de Escalas

**Arquivo:** `recalcular-status-diario.py`

**O que faz:**

1. Busca escalas do dia anterior com status "Pré-Agendado" ou "Programado"
2. Para cada escala:
   - Busca acessos (entradas/saídas) dos médicos
   - Calcula horas trabalhadas
   - Compara com horas escaladas
   - Define novo status automaticamente
3. Atualiza status no banco

**Lógica de Status:**

```python
def analisar_escala(horas_escaladas, medicos_status):
    todos_pre_aprovados = all(m['status'] == 'Pré-Aprovado' for m in medicos_status)
    algum_atencao = any(m['status'] == 'Atenção' for m in medicos_status)
    algum_parcial = any(m['status'] == 'Aprovação Parcial' for m in medicos_status)

    if todos_pre_aprovados:
        return 'Pré-Aprovado'
    elif algum_atencao:
        return 'Atenção'
    elif algum_parcial:
        return 'Aprovação Parcial'
    else:
        return 'Programado'
```

**Status por Médico:**

| Condição                               | Status            |
| -------------------------------------- | ----------------- |
| Sem acessos                            | Atenção           |
| Horas trabalhadas >= 90% das escaladas | Pré-Aprovado      |
| Horas trabalhadas < 90% das escaladas  | Aprovação Parcial |

**Cálculo de Horas:**

```python
def calcular_horas_trabalhadas(cpf, data_escala, horario_entrada, horario_saida):
    # Busca acessos do médico no dia
    acessos = supabase.table('acessos').select('*') \
        .eq('cpf', cpf) \
        .gte('data_acesso', f'{data_escala}T00:00:00') \
        .lte('data_acesso', f'{data_escala}T23:59:59') \
        .order('data_acesso').execute()

    # Pareia entradas com saídas (janela de 3h)
    entradas = [a for a in acessos if a['sentido'] == 'E']
    saidas = [a for a in acessos if a['sentido'] == 'S']

    # Lógica de pareamento...
    # Retorna total de horas
```

**Logs:**

```
2025-12-15 14:00:01 - INFO - Iniciando recálculo de status das escalas
2025-12-15 14:00:02 - INFO - Processando escalas do dia 2025-12-14
2025-12-15 14:00:03 - INFO - 15 escalas encontradas
2025-12-15 14:00:04 - INFO - Escala ID abc123: Pré-Agendado → Pré-Aprovado
2025-12-15 14:00:05 - INFO - Escala ID def456: Programado → Atenção (médico XYZ sem acessos)
...
```

### 6.5 Configuração do Cron

**Arquivo:** `/etc/crontab` ou `crontab -e`

```bash
# Importar acessos às 6h da manhã
0 6 * * * cd /root/gestaodeacesso && /usr/bin/python3 importar-ultimos-10000-acessos.py >> /var/log/import-acessos.log 2>&1

# Coletar produtividade às 2h da manhã
0 2 * * * cd /root/gestaodeacesso && /usr/bin/python3 coletar-produtividade-mv.py >> /var/log/produtividade-mv.log 2>&1

# Recalcular status às 14h
0 14 * * * cd /root/gestaodeacesso && /usr/bin/python3 recalcular-status-diario.py >> /var/log/recalcular-status.log 2>&1
```

**Verificar logs:**

```bash
tail -f /var/log/import-acessos.log
tail -f /var/log/produtividade-mv.log
tail -f /var/log/recalcular-status.log
```

### 6.6 Troubleshooting Scripts Python

**Problema: Script não executa no cron**

```bash
# Verificar se cron está rodando
systemctl status cron

# Verificar logs do cron
grep CRON /var/log/syslog

# Testar script manualmente
cd /root/gestaodeacesso
python3 importar-ultimos-10000-acessos.py
```

**Problema: Erro de conexão com Supabase**

```bash
# Verificar variáveis de ambiente
cat .env

# Testar conexão
python3 -c "from supabase import create_client; import os; from dotenv import load_dotenv; load_dotenv(); print('OK')"
```

**Problema: Firefox/Selenium não inicia**

```bash
# Verificar Firefox instalado
firefox --version

# Verificar geckodriver
geckodriver --version

# Instalar se necessário
sudo apt-get update
sudo apt-get install firefox firefox-geckodriver
```

**Problema: Dados não aparecem no Supabase**

```bash
# Verificar se SERVICE_ROLE_KEY está correta
# Verificar se RLS permite inserção
# Verificar logs do script para erros
```

---

## 7. Banco de Dados

### 7.1 Estrutura de Tabelas

#### 7.1.1 Tabela: usuarios

Armazena perfis de usuários (diferente de `auth.users`):

```sql
CREATE TABLE usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  cpf TEXT NOT NULL UNIQUE,
  tipo TEXT NOT NULL CHECK (tipo IN (
    'administrador-agir-corporativo',
    'administrador-agir-planta',
    'administrador-terceiro',
    'terceiro'
  )),
  contrato_id UUID REFERENCES contratos(id) ON DELETE SET NULL,
  codigomv TEXT,  -- Código do médico no sistema MV
  especialidade TEXT[],  -- Array de especialidades médicas
  unidade_hospitalar_id UUID REFERENCES unidades_hospitalares(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_usuarios_cpf ON usuarios(cpf);
CREATE INDEX idx_usuarios_tipo ON usuarios(tipo);
CREATE INDEX idx_usuarios_contrato ON usuarios(contrato_id);
```

**Campos importantes:**

- `id`: UUID sincronizado com `auth.users`
- `tipo`: Define permissões do usuário
- `codigomv`: Usado para coletar produtividade
- `especialidade`: Array (ex: `['Cardiologia', 'Clínica Geral']`)

#### 7.1.2 Tabela: contratos

```sql
CREATE TABLE contratos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  numero_contrato TEXT,
  empresa TEXT NOT NULL,
  data_inicio TIMESTAMPTZ NOT NULL,
  data_fim TIMESTAMPTZ,  -- NULL = sem data de término
  ativo BOOLEAN DEFAULT TRUE,
  unidade_hospitalar_id UUID REFERENCES unidades_hospitalares(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contratos_ativo ON contratos(ativo);
CREATE INDEX idx_contratos_data_fim ON contratos(data_fim);
```

#### 7.1.3 Tabela: acessos

Registros das catracas de reconhecimento facial:

```sql
CREATE TABLE acessos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,  -- 'Terceiro', 'Funcionário', etc.
  matricula TEXT NOT NULL,
  nome TEXT NOT NULL,
  cpf TEXT NOT NULL,
  data_acesso TIMESTAMPTZ NOT NULL,
  sentido TEXT NOT NULL CHECK (sentido IN ('E', 'S')),  -- Entrada ou Saída
  planta TEXT,  -- Localização física
  codin TEXT,  -- Código interno da catraca
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices críticos para performance
CREATE INDEX idx_acessos_cpf ON acessos(cpf);
CREATE INDEX idx_acessos_data ON acessos(data_acesso DESC);
CREATE INDEX idx_acessos_sentido ON acessos(sentido);
CREATE INDEX idx_acessos_cpf_data ON acessos(cpf, data_acesso DESC);
```

**Volume estimado:** 10.000+ registros/dia

#### 7.1.4 Tabela: escalas_medicas

```sql
CREATE TABLE escalas_medicas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id UUID NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
  item_contrato_id UUID REFERENCES itens_contrato(id),
  data_inicio DATE NOT NULL,
  horario_entrada TIME NOT NULL,
  horario_saida TIME NOT NULL,
  medicos JSONB NOT NULL,  -- Array de objetos: [{ cpf, nome, codigomv, especialidade }]
  status TEXT NOT NULL CHECK (status IN (
    'Pré-Agendado',
    'Programado',
    'Pré-Aprovado',
    'Aprovação Parcial',
    'Atenção',
    'Aprovado',
    'Reprovado'
  )) DEFAULT 'Pré-Agendado',
  justificativa TEXT,  -- Usado quando Aprovado/Reprovado manualmente
  observacoes TEXT,
  status_alterado_por UUID REFERENCES usuarios(id),
  status_alterado_em TIMESTAMPTZ,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES usuarios(id)
);

CREATE INDEX idx_escalas_data ON escalas_medicas(data_inicio DESC);
CREATE INDEX idx_escalas_status ON escalas_medicas(status);
CREATE INDEX idx_escalas_contrato ON escalas_medicas(contrato_id);
```

**Estrutura do campo `medicos` (JSONB):**

```json
[
  {
    "cpf": "12345678900",
    "nome": "Dr. João Silva",
    "codigomv": "MED001",
    "especialidade": "Cardiologia"
  },
  {
    "cpf": "98765432100",
    "nome": "Dra. Maria Santos",
    "codigomv": "MED002",
    "especialidade": "Clínica Geral"
  }
]
```

#### 7.1.5 Tabela: produtividade

```sql
CREATE TABLE produtividade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_mv TEXT NOT NULL,
  nome TEXT NOT NULL,
  especialidade TEXT,
  vinculo TEXT,
  data DATE,
  procedimento INTEGER DEFAULT 0,
  cirurgia INTEGER DEFAULT 0,
  consulta INTEGER DEFAULT 0,
  laudo_medico_solicitado INTEGER DEFAULT 0,
  laudo_medico_completo INTEGER DEFAULT 0,
  prescricao INTEGER DEFAULT 0,
  evolucao INTEGER DEFAULT 0,
  atendimento_urgencia INTEGER DEFAULT 0,
  atendimento_ambulatorial INTEGER DEFAULT 0,
  evolucao_uti_dia INTEGER DEFAULT 0,
  evolucao_uti_noite INTEGER DEFAULT 0,
  evolucao_uti_tarde INTEGER DEFAULT 0,
  atendimento INTEGER DEFAULT 0,
  unidade_hospitalar_id UUID REFERENCES unidades_hospitalares(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_produtividade_codigo ON produtividade(codigo_mv);
CREATE INDEX idx_produtividade_data ON produtividade(data DESC);

-- Constraint única para evitar duplicação
CREATE UNIQUE INDEX idx_produtividade_unique
ON produtividade(codigo_mv, data, unidade_hospitalar_id);
```

#### 7.1.6 Outras Tabelas

**unidades_hospitalares:**

```sql
CREATE TABLE unidades_hospitalares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT UNIQUE,
  nome TEXT NOT NULL,
  endereco TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**itens_contrato:**

```sql
CREATE TABLE itens_contrato (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  unidade_medida TEXT NOT NULL,  -- 'horas', 'plantão', 'procedimento', etc.
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**contrato_itens (junction table):**

```sql
CREATE TABLE contrato_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id UUID NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES itens_contrato(id) ON DELETE CASCADE,
  quantidade DECIMAL(10,2),
  valor_unitario DECIMAL(10,2),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**parceiros:**

```sql
CREATE TABLE parceiros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cnpj TEXT UNIQUE,
  telefone TEXT,
  email TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 7.2 Relacionamentos

```
usuarios ──┬─── auth.users (1:1 obrigatório)
           ├─── contratos (N:1 opcional)
           └─── unidades_hospitalares (N:1 opcional)

contratos ──┬─── usuarios (1:N)
            ├─── escalas_medicas (1:N)
            ├─── unidades_hospitalares (N:1 opcional)
            └─── contrato_itens (1:N)

escalas_medicas ──┬─── contratos (N:1 obrigatório)
                  ├─── itens_contrato (N:1 opcional)
                  ├─── usuarios (created_by, N:1)
                  └─── usuarios (status_alterado_por, N:1 opcional)

acessos ── (sem FK, usa CPF para relacionar)

produtividade ──── unidades_hospitalares (N:1 opcional)
```

### 7.3 Triggers e Funções

**Trigger para updated_at:**

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar em todas as tabelas com updated_at
CREATE TRIGGER update_usuarios_updated_at
BEFORE UPDATE ON usuarios
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Repetir para: contratos, escalas_medicas, produtividade, etc.
```

### 7.4 Queries Importantes

**Buscar acessos com horas calculadas:**

```sql
SELECT
  a.cpf,
  a.nome,
  DATE(a.data_acesso) as data,
  MIN(CASE WHEN a.sentido = 'E' THEN a.data_acesso END) as primeira_entrada,
  MAX(CASE WHEN a.sentido = 'S' THEN a.data_acesso END) as ultima_saida,
  EXTRACT(EPOCH FROM (
    MAX(CASE WHEN a.sentido = 'S' THEN a.data_acesso END) -
    MIN(CASE WHEN a.sentido = 'E' THEN a.data_acesso END)
  )) / 3600 as horas_trabalhadas
FROM acessos a
WHERE a.cpf = '12345678900'
  AND a.data_acesso >= '2025-01-01'
GROUP BY a.cpf, a.nome, DATE(a.data_acesso)
ORDER BY data DESC;
```

**Buscar escalas com detalhes:**

```sql
SELECT
  e.*,
  c.nome as contrato_nome,
  c.empresa,
  u.nome as criado_por_nome,
  uh.nome as unidade_hospitalar
FROM escalas_medicas e
LEFT JOIN contratos c ON e.contrato_id = c.id
LEFT JOIN usuarios u ON e.created_by = u.id
LEFT JOIN unidades_hospitalares uh ON c.unidade_hospitalar_id = uh.id
WHERE e.data_inicio >= '2025-01-01'
  AND e.ativo = TRUE
ORDER BY e.data_inicio DESC;
```

**Buscar produtividade agregada:**

```sql
SELECT
  codigo_mv,
  nome,
  especialidade,
  COUNT(*) as dias_trabalhados,
  SUM(procedimento) as total_procedimentos,
  SUM(cirurgia) as total_cirurgias,
  SUM(consulta) as total_consultas,
  AVG(atendimento) as media_atendimentos_dia
FROM produtividade
WHERE data >= '2025-01-01' AND data <= '2025-01-31'
GROUP BY codigo_mv, nome, especialidade
ORDER BY total_procedimentos DESC;
```

### 7.5 Backup e Restore

**Supabase faz backups automáticos diários**, mas você pode fazer backup manual:

**Via Supabase Dashboard:**

1. Acesse https://supabase.com/dashboard
2. Projeto → Database → Backups
3. Download do backup

**Via pg_dump (requer acesso direto ao PostgreSQL):**

```bash
# Backup completo
pg_dump -h db.qszqzdnlhxpglllyqtht.supabase.co -U postgres -d postgres > backup.sql

# Backup de tabela específica
pg_dump -h db.qszqzdnlhxpglllyqtht.supabase.co -U postgres -d postgres -t acessos > acessos_backup.sql

# Restore
psql -h db.qszqzdnlhxpglllyqtht.supabase.co -U postgres -d postgres < backup.sql
```

**IMPORTANTE:** Credenciais de conexão direta disponíveis no Dashboard do Supabase em Settings → Database.

---

## 8. Deploy e Infraestrutura

### 8.1 Arquitetura de Deploy

```
┌───────────────────────────────────────────────────────────┐
│                    USUÁRIOS FINAIS                        │
└────────────────────┬──────────────────────────────────────┘
                     │
                     │ HTTPS
                     ▼
┌───────────────────────────────────────────────────────────┐
│                  VERCEL (Frontend)                        │
│  • CDN Global                                             │
│  • Auto-deploy do Git (branch main)                       │
│  • Build automático com Vite                              │
│  • Domínio: parceria-agir.vercel.app                      │
└────────────────────┬──────────────────────────────────────┘
                     │
                     │ API Calls
                     ▼
┌───────────────────────────────────────────────────────────┐
│              SUPABASE (Backend/Database)                  │
│  • PostgreSQL 15                                          │
│  • Auth gerenciado                                        │
│  • APIs REST automáticas                                  │
│  • URL: qszqzdnlhxpglllyqtht.supabase.co                  │
└───────────────────────────────────────────────────────────┘
                     ▲
                     │
                     │ Service Role Key
                     │
┌───────────────────────────────────────────────────────────┐
│         DIGITALOCEAN DROPLET (Scripts Python)             │
│  • Ubuntu 22.04 LTS                                       │
│  • Python 3.10+                                           │
│  • Cron jobs (3 scripts automáticos)                      │
│  • IP: [Configurar conforme necessário]                   │
└────────────────────┬──────────────────────────────────────┘
                     │
                     │ PostgreSQL Connection
                     ▼
┌───────────────────────────────────────────────────────────┐
│          AWS RDS (Data Warehouse - Origem)                │
│  • PostgreSQL 13                                          │
│  • Dados das catracas faciais                            │
│  • db-rds-postgres...sa-east-1.rds.amazonaws.com         │
└───────────────────────────────────────────────────────────┘
```

### 8.2 Deploy do Frontend (Vercel)

**Configuração inicial:**

1. Conectar repositório Git ao Vercel
2. Configurar build settings:

```json
// vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

3. Configurar variáveis de ambiente no Dashboard Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

**Deploy automático:**

- Push para branch `main` → deploy automático
- Pull requests → preview deployments

**Build local para teste:**

```bash
npm run build
npm run preview
# Abre em http://localhost:4173
```

**Verificar build:**

```bash
npm run build:check
# Roda TypeScript check antes do build
```

### 8.3 Configuração do Supabase

**Passos iniciais:**

1. Criar projeto em https://supabase.com
2. Executar SQL de inicialização (`supabase-init.sql`)
3. Executar migrações adicionais
4. Configurar autenticação:
   - Settings → Authentication → Email Auth: Enabled
   - Confirmation email: Opcional (desabilitado em dev)
   - Password requirements: Mínimo 6 caracteres

**Políticas RLS:**

- Definidas em `supabase-init.sql`
- Revisar no Dashboard: Authentication → Policies

**Variáveis de ambiente:**

- Anon Key: Settings → API → Project API keys → anon public
- Service Role Key: Settings → API → Project API keys → service_role (⚠️ PRIVADA)

### 8.4 Setup do DigitalOcean Droplet

**1. Criar Droplet:**

- Imagem: Ubuntu 22.04 LTS
- Tamanho: Basic (1 GB RAM suficiente)
- Região: São Paulo 1 (mesma região do RDS)
- SSH keys configurados

**2. Instalar dependências:**

```bash
# Atualizar sistema
sudo apt-get update
sudo apt-get upgrade -y

# Instalar Python 3 e pip
sudo apt-get install python3 python3-pip -y

# Instalar PostgreSQL client
sudo apt-get install postgresql-client -y

# Instalar Firefox e Selenium (para produtividade)
sudo apt-get install firefox -y
wget https://github.com/mozilla/geckodriver/releases/download/v0.33.0/geckodriver-v0.33.0-linux64.tar.gz
tar -xvzf geckodriver-v0.33.0-linux64.tar.gz
sudo mv geckodriver /usr/local/bin/
sudo chmod +x /usr/local/bin/geckodriver

# Instalar bibliotecas Python
pip3 install psycopg2-binary supabase python-dotenv selenium
```

**3. Clonar repositório:**

```bash
cd /root
git clone https://github.com/seu-usuario/gestaodeacesso.git
cd gestaodeacesso
```

**4. Configurar .env:**

```bash
nano .env

# Adicionar:
VITE_SUPABASE_URL=https://qszqzdnlhxpglllyqtht.supabase.co
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
```

**5. Configurar cron jobs:**

```bash
crontab -e

# Adicionar:
0 6 * * * cd /root/gestaodeacesso && /usr/bin/python3 importar-ultimos-10000-acessos.py >> /var/log/import-acessos.log 2>&1
0 2 * * * cd /root/gestaodeacesso && /usr/bin/python3 coletar-produtividade-mv.py >> /var/log/produtividade-mv.log 2>&1
0 14 * * * cd /root/gestaodeacesso && /usr/bin/python3 recalcular-status-diario.py >> /var/log/recalcular-status.log 2>&1
```

**6. Testar scripts manualmente:**

```bash
cd /root/gestaodeacesso
python3 importar-ultimos-10000-acessos.py
# Verificar se executou sem erros

python3 recalcular-status-diario.py
# Verificar se executou sem erros
```

**7. Monitorar logs:**

```bash
tail -f /var/log/import-acessos.log
tail -f /var/log/produtividade-mv.log
tail -f /var/log/recalcular-status.log
```

### 8.5 Domínio Customizado (Opcional)

**Configurar domínio próprio no Vercel:**

1. Vercel Dashboard → Projeto → Settings → Domains
2. Adicionar domínio: `parceria.agirsaude.org.br`
3. Configurar DNS:

```
Type: CNAME
Name: parceria
Value: cname.vercel-dns.com
```

4. Aguardar propagação (até 48h)

---

## 9. Manutenção e Troubleshooting

### 9.1 Monitoramento

**Frontend (Vercel):**

- Dashboard: https://vercel.com/dashboard
- Analytics: Ver métricas de performance e erros
- Logs: Ver logs de build e runtime

**Backend (Supabase):**

- Dashboard: https://supabase.com/dashboard
- Database: Monitorar queries lentas
- Auth: Ver logins e erros de autenticação
- Logs: Ver logs de API

**Scripts Python:**

- SSH no droplet: `ssh root@IP_DO_DROPLET`
- Ver logs: `tail -f /var/log/*.log`
- Verificar cron: `crontab -l`
- Verificar processos: `ps aux | grep python`

### 9.2 Problemas Comuns

#### 9.2.1 Usuário não consegue fazer login

**Possíveis causas:**

1. **Senha incorreta:**

   - Resetar senha via "Esqueci minha senha"

2. **Usuário não existe em auth.users:**

   - Verificar no Supabase Dashboard → Authentication → Users
   - Se não existir, criar via Dashboard ou código

3. **Usuário existe em auth.users mas não em usuarios:**

   - SQL: `SELECT * FROM usuarios WHERE id = 'UUID';`
   - Se não existir, inserir manualmente

4. **RLS bloqueando acesso:**
   - Verificar políticas no Supabase Dashboard
   - Testar desabilitando RLS temporariamente (apenas para debug)

**Como verificar:**

```sql
-- Buscar usuário por email em auth.users
SELECT * FROM auth.users WHERE email = 'usuario@example.com';

-- Buscar perfil em usuarios
SELECT * FROM usuarios WHERE email = 'usuario@example.com';

-- Se auth.users existe mas usuarios não:
INSERT INTO usuarios (id, email, nome, cpf, tipo)
VALUES (
  'UUID_DO_AUTH_USERS',
  'usuario@example.com',
  'Nome do Usuário',
  'CPF',
  'terceiro'
);
```

#### 9.2.2 Dados não aparecem no Dashboard

**Possíveis causas:**

1. **RLS bloqueando visualização:**

   - Verificar tipo de usuário
   - Admin Planta só vê dados da sua unidade
   - Terceiro só vê próprios dados

2. **Filtros muito restritivos:**

   - Limpar filtros no Dashboard
   - Verificar sessionStorage: `sessionStorage.clear()`

3. **Dados não foram importados:**
   - Verificar logs dos scripts Python
   - Executar scripts manualmente

**Como verificar:**

```sql
-- Verificar se há acessos no banco
SELECT COUNT(*) FROM acessos;

-- Verificar acessos de um CPF específico
SELECT * FROM acessos WHERE cpf = '12345678900' ORDER BY data_acesso DESC LIMIT 10;

-- Desabilitar RLS temporariamente (apenas admin)
ALTER TABLE acessos DISABLE ROW LEVEL SECURITY;
-- LEMBRAR DE REABILITAR!!!
ALTER TABLE acessos ENABLE ROW LEVEL SECURITY;
```

#### 9.2.3 Script Python falha no cron

**Possíveis causas:**

1. **Variáveis de ambiente não carregadas:**

   - Verificar se .env existe
   - Verificar se path está correto no cron

2. **Permissões:**

   - Script precisa ser executável
   - Logs precisam ter permissão de escrita

3. **Dependências faltando:**
   - Verificar se todas as libs estão instaladas

**Como debugar:**

```bash
# Testar script manualmente
cd /root/gestaodeacesso
python3 importar-ultimos-10000-acessos.py

# Verificar se .env é carregado
python3 -c "from dotenv import load_dotenv; import os; load_dotenv(); print(os.getenv('VITE_SUPABASE_URL'))"

# Verificar cron job
crontab -l

# Ver logs do cron
grep CRON /var/log/syslog

# Dar permissão de execução
chmod +x importar-ultimos-10000-acessos.py

# Criar diretório de logs se não existir
mkdir -p /var/log
touch /var/log/import-acessos.log
chmod 666 /var/log/import-acessos.log
```

#### 9.2.4 Status de escala não atualiza automaticamente

**Possíveis causas:**

1. **Script recalcular-status-diario.py não rodou:**

   - Verificar logs: `tail -f /var/log/recalcular-status.log`
   - Executar manualmente

2. **Médico sem acessos:**

   - Verificar se CPF do médico está correto
   - Verificar se há acessos na tabela acessos

3. **Escala já aprovada/reprovada manualmente:**
   - Script não altera escalas já aprovadas/reprovadas

**Como corrigir:**

```bash
# Executar script manualmente
cd /root/gestaodeacesso
python3 recalcular-status-diario.py

# Verificar acessos de um médico
python3 -c "
from supabase import create_client;
import os;
from dotenv import load_dotenv;
load_dotenv();
sb = create_client(os.getenv('VITE_SUPABASE_URL'), os.getenv('VITE_SUPABASE_SERVICE_ROLE_KEY'));
acessos = sb.table('acessos').select('*').eq('cpf', '12345678900').execute();
print(len(acessos.data), 'acessos encontrados')
"
```

#### 9.2.5 Selenium/Firefox falha na coleta de produtividade

**Possíveis causas:**

1. **Firefox não instalado:**

   - Instalar: `sudo apt-get install firefox`

2. **Geckodriver desatualizado:**

   - Atualizar geckodriver

3. **Site MV mudou estrutura:**

   - Atualizar seletores no script

4. **Timeout:**
   - Aumentar timeouts no script

**Como debugar:**

```bash
# Verificar Firefox
firefox --version

# Verificar geckodriver
geckodriver --version

# Executar script com output verbose
cd /root/gestaodeacesso
python3 coletar-produtividade-mv.py

# Ver logs detalhados
tail -f /var/log/produtividade-mv.log
```

### 9.3 Tarefas de Manutenção Rotineiras

**Diariamente:**

- Verificar logs dos scripts Python
- Monitorar dashboard do Vercel para erros

**Semanalmente:**

- Revisar performance do banco (queries lentas)
- Verificar uso de storage no Supabase
- Backup manual se necessário

**Mensalmente:**

- Atualizar dependências NPM: `npm update`
- Atualizar dependências Python: `pip3 install --upgrade supabase psycopg2-binary selenium`
- Revisar políticas RLS

**Trimestralmente:**

- Revisar e limpar dados antigos (se necessário)
- Auditoria de segurança
- Review de logs de acesso

### 9.4 Comandos Úteis

**Supabase CLI (opcional):**

```bash
# Instalar Supabase CLI
npm install -g supabase

# Login
supabase login

# Conectar ao projeto
supabase link --project-ref qszqzdnlhxpglllyqtht

# Criar migration
supabase migration new add_nova_coluna

# Aplicar migrations
supabase db push
```

**Git:**

```bash
# Pull latest changes
git pull origin main

# Deploy frontend (push to main)
git add .
git commit -m "Mensagem do commit"
git push origin main
# Vercel faz deploy automático

# Atualizar scripts Python no droplet
ssh root@IP_DO_DROPLET
cd /root/gestaodeacesso
git pull origin main
```

**PostgreSQL direto:**

```bash
# Conectar ao Supabase PostgreSQL
psql "postgresql://postgres:[PASSWORD]@db.qszqzdnlhxpglllyqtht.supabase.co:5432/postgres"

# Comandos úteis:
\dt          # Listar tabelas
\d usuarios  # Descrever tabela
\q           # Sair
```

---

## 10. Perguntas Frequentes (FAQ)

### 10.1 Sobre Supabase

**P: O que é Supabase?**
R: Supabase é uma plataforma Backend-as-a-Service (BaaS) open-source que fornece banco de dados PostgreSQL, autenticação, APIs REST automáticas, real-time subscriptions e storage. É uma alternativa open-source ao Firebase do Google.

**P: Por que Supabase ao invés de criar um backend tradicional?**
R: Supabase elimina a necessidade de criar e manter um backend Node.js/PHP/Java. Ele fornece:

- APIs REST automáticas (sem código)
- Autenticação pronta
- Row Level Security nativo
- Infraestrutura gerenciada
- Reduz tempo de desenvolvimento em 70%+

**P: Supabase é seguro?**
R: Sim! Supabase usa:

- PostgreSQL com Row Level Security (RLS)
- JWT para autenticação
- HTTPS obrigatório
- Certificação SOC 2 Type II
- Criptografia em repouso e em trânsito
- Backups automáticos diários

**P: O que acontece se o Supabase sair do ar?**
R: Supabase tem SLA de 99.9% uptime. Em caso de problemas:

- É open-source: você pode migrar para self-hosted
- Backups automáticos permitem restauração
- Histórico de uptime é excelente

**P: Como migrar do Supabase se necessário?**
R: Supabase usa PostgreSQL padrão. Para migrar:

1. Export do banco via pg_dump
2. Import em qualquer PostgreSQL (AWS RDS, Google Cloud SQL, etc.)
3. Reescrever autenticação (JWT continua funcionando)
4. Reescrever APIs REST (ou usar PostgREST self-hosted)

**P: Qual o custo do Supabase?**
R: Plano gratuito inclui:

- 500 MB de banco de dados
- 1 GB de armazenamento
- 50.000 usuários autenticados/mês
- 2 GB de largura de banda

Plano Pro ($25/mês):

- 8 GB de banco de dados
- 100 GB de armazenamento
- 100.000 usuários autenticados/mês
- Backups point-in-time

**P: O que é Row Level Security (RLS)?**
R: RLS é uma feature nativa do PostgreSQL que filtra linhas retornadas baseado em políticas SQL. No ParcerIA, RLS garante que:

- Terceiros vejam apenas seus próprios dados
- Admins de planta vejam apenas dados da sua unidade
- Admins corporativos vejam tudo
  Tudo isso no nível do banco, impossível de burlar.

**P: O que são as chaves ANON_KEY e SERVICE_ROLE_KEY?**
R:

- **ANON_KEY**: Chave pública, segura para usar no frontend. RLS protege os dados.
- **SERVICE_ROLE_KEY**: Chave administrativa que BYPASSA RLS. Nunca expor no frontend! Usar apenas em scripts backend/Python.

### 10.2 Sobre a Aplicação

**P: Como criar o primeiro usuário administrador?**
R:

1. Criar usuário no Supabase Dashboard → Authentication → Add User
2. Inserir perfil na tabela usuarios:

```sql
INSERT INTO usuarios (id, email, nome, cpf, tipo)
VALUES (
  'UUID_DO_AUTH_USERS',
  'admin@agirsaude.org.br',
  'Administrador',
  '00000000000',
  'administrador-agir-corporativo'
);
```

**P: Como adicionar um novo médico terceiro?**
R:

1. Login como admin
2. Ir em "Usuários" → "Novo Usuário"
3. Preencher dados:
   - Nome, Email, CPF
   - Tipo: "Terceiro"
   - Contrato: Selecionar contrato
   - Código MV: Código do médico no sistema MV
   - Especialidade: Selecionar especialidades
4. Salvar

**P: Como funciona o cálculo de horas trabalhadas?**
R: O sistema:

1. Busca todos os acessos (E/S) do médico no dia
2. Pareia entradas com saídas usando janela de 3 horas
3. Calcula diferença entre entrada e saída
4. Soma total de horas
5. Compara com horas escaladas

**P: O que significa cada status de escala?**
R:

- **Pré-Agendado**: Escala recém criada, ainda não passou
- **Programado**: Escala futura (ainda vai acontecer)
- **Pré-Aprovado**: Todos os médicos trabalharam >= 90% das horas
- **Aprovação Parcial**: Alguns médicos trabalharam < 90% das horas
- **Atenção**: Algum médico não teve acessos (faltou)
- **Aprovado**: Admin aprovou manualmente
- **Reprovado**: Admin reprovou manualmente

**P: Como importar escalas em lote via CSV?**
R:

1. Preparar CSV com colunas: data, horario_entrada, horario_saida, cpf_medico1, cpf_medico2, ...
2. Ir em "Escalas Médicas" → "Importar CSV"
3. Fazer upload do arquivo
4. Revisar e confirmar

**P: Onde ficam os logs dos scripts Python?**
R: No droplet DigitalOcean:

- `/var/log/import-acessos.log`
- `/var/log/produtividade-mv.log`
- `/var/log/recalcular-status.log`

Acesso via SSH: `tail -f /var/log/import-acessos.log`

**P: Como exportar dados do Dashboard?**
R: Dashboard tem botões de exportação:

- **CSV**: Baixa dados filtrados em formato CSV (abre no Excel)
- **PDF**: Gera relatório PDF com tabela e estatísticas

**P: Como adicionar uma nova unidade hospitalar?**
R:

1. Login como admin corporativo
2. "Unidades Hospitalares" → "Nova Unidade"
3. Preencher: código, nome, endereço
4. Salvar

**P: Como fazer backup do banco de dados?**
R: Opções:

1. **Automático**: Supabase faz backup diário automaticamente
2. **Manual via Dashboard**: Supabase Dashboard → Database → Backups → Download
3. **Manual via pg_dump**:

```bash
pg_dump -h db.qszqzdnlhxpglllyqtht.supabase.co -U postgres > backup.sql
```

### 10.3 Troubleshooting

**P: Usuário esqueceu a senha, como resetar?**
R:

1. Usuário clica em "Esqueci minha senha" no login
2. Digita email
3. Recebe email com link de reset
4. Clica no link e define nova senha

Como admin, você pode resetar via Supabase Dashboard:

- Authentication → Users → [selecionar usuário] → Reset Password

**P: Build no Vercel falha, como corrigir?**
R:

1. Ver logs no Vercel Dashboard
2. Causas comuns:
   - TypeScript errors: rodar `npm run build:check` localmente
   - Dependências faltando: rodar `npm install`
   - Variáveis de ambiente: verificar no Vercel Dashboard

**P: Script Python não roda no cron, mas funciona manualmente**
R: Causas comuns:

1. Path errado no cron: usar path absoluto

```bash
# Errado
0 6 * * * python3 script.py

# Correto
0 6 * * * cd /root/gestaodeacesso && /usr/bin/python3 script.py
```

2. .env não carregado: verificar se .env está no diretório correto
3. Logs não aparecem: verificar permissões e redirecionamento

**P: Dados duplicados na tabela acessos**
R: Scripts verificam duplicação antes de inserir. Se houver duplicatas:

1. Verificar se script rodou múltiplas vezes manualmente
2. Limpar duplicatas:

```sql
DELETE FROM acessos a
USING acessos b
WHERE a.id > b.id
  AND a.cpf = b.cpf
  AND a.data_acesso = b.data_acesso
  AND a.sentido = b.sentido;
```

**P: Como adicionar uma nova métrica de produtividade?**
R:

1. Adicionar coluna na tabela produtividade:

```sql
ALTER TABLE produtividade ADD COLUMN nova_metrica INTEGER DEFAULT 0;
```

2. Atualizar `database.types.ts`:

```typescript
export interface Produtividade {
  // ... campos existentes ...
  nova_metrica: number;
}
```

3. Atualizar script `coletar-produtividade-mv.py` para extrair novo campo

4. Atualizar Dashboard para exibir nova métrica

**P: Consultas estão lentas, como otimizar?**
R:

1. Identificar queries lentas no Supabase Dashboard → Database → Query Performance
2. Adicionar índices:

```sql
CREATE INDEX idx_acessos_cpf_data ON acessos(cpf, data_acesso DESC);
```

3. Otimizar queries no código (evitar N+1, usar select específico)
4. Considerar materialized views para queries complexas

**P: Como adicionar um novo tipo de usuário?**
R:

1. Atualizar constraint na tabela:

```sql
ALTER TABLE usuarios DROP CONSTRAINT usuarios_tipo_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_tipo_check
CHECK (tipo IN (
  'administrador-agir-corporativo',
  'administrador-agir-planta',
  'administrador-terceiro',
  'terceiro',
  'novo-tipo'
));
```

2. Atualizar `database.types.ts`
3. Adicionar políticas RLS para novo tipo
4. Atualizar AuthContext para incluir novo tipo

---

## 11. Contatos e Recursos

### 11.1 Documentação Oficial

- **Supabase Docs**: https://supabase.com/docs
- **React Docs**: https://react.dev
- **TypeScript Docs**: https://www.typescriptlang.org/docs
- **Material-UI Docs**: https://mui.com
- **Vite Docs**: https://vitejs.dev

### 11.2 Repositórios

- **Código-fonte**: [Inserir URL do repositório Git]
- **Issues**: [Inserir URL de issues]

### 11.3 Ambientes

- **Produção**: https://parceria-agir.vercel.app (ou domínio customizado)
- **Supabase Dashboard**: https://supabase.com/dashboard/project/qszqzdnlhxpglllyqtht
- **Vercel Dashboard**: https://vercel.com/dashboard

### 11.4 Equipe Original

- **Desenvolvedor Principal**: Pedro Borges (pedro.borges@agirsaude.org.br)

---

## 12. Changelog e Versionamento

### Versão 1.0.0 (Atual)

- Sistema completo em produção
- 4 níveis de usuário
- Dashboard com filtros avançados
- Escalas médicas com aprovação automática
- Coleta de produtividade via Selenium
- Insights com IA (DeepSeek)

### Próximas Funcionalidades Planejadas

- Notificações push para aprovações
- Relatórios financeiros automáticos
- Integração com sistema de folha de pagamento
- App mobile (React Native)

---

## Conclusão

Este documento cobriu todos os aspectos técnicos do ParcerIA. Para dúvidas adicionais, consulte a documentação oficial das tecnologias ou entre em contato com a equipe de desenvolvimento.

**Lembre-se:**

- Sempre testar mudanças em ambiente de desenvolvimento primeiro
- Fazer backup antes de alterações no banco de dados
- Revisar políticas RLS ao adicionar novas tabelas
- Monitorar logs regularmente
- Manter dependências atualizadas

Boa sorte na manutenção do sistema! 🚀
