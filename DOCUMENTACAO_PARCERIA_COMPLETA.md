# ParcerIA - Documentação Técnica Completa

## Para Equipe de Desenvolvimento da Agir

**Autor:** Desenvolvedor Original
**Data:** Março de 2026
**Versão:** 1.0
**Tempo de Leitura Estimado:** 15 minutos

---

# PARTE 1: APRESENTAÇÃO EXECUTIVA (Texto para Leitura de 15 minutos)

## Introdução

Bom dia a todos. Hoje vou apresentar o ParcerIA, uma plataforma que desenvolvi para gestão de acesso e produtividade hospitalar. Vocês serão os responsáveis pela manutenção e, eventualmente, pela migração para a infraestrutura AWS da Agir.

### O Que é o ParcerIA?

O ParcerIA é um sistema SaaS (Software as a Service) desenvolvido para gerenciar o controle de acesso, escalas médicas e produtividade de trabalhadores terceirizados nas unidades hospitalares parceiras da Agir Saúde. O nome "ParcerIA" combina "Parceria" com "IA" (Inteligência Artificial), refletindo a integração com modelos de linguagem para análise de dados.

### Problema que Resolvemos

Antes do ParcerIA, a Agir enfrentava desafios críticos:

1. **Fragmentação de Dados**: Informações de catracas de reconhecimento facial, escalas médicas e contratos estavam em sistemas separados
2. **Falta de Visibilidade**: Gestores não tinham visão consolidada de horas trabalhadas vs. contratadas
3. **Processos Manuais**: Importação de escalas e análise de produtividade eram feitos manualmente em planilhas
4. **Ausência de Insights**: Não havia análise preditiva ou inteligente sobre os dados

### Arquitetura em Alto Nível

O sistema segue uma arquitetura moderna de três camadas:

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (SPA)                           │
│         React 18 + TypeScript + Material-UI + Vite              │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND (Supabase)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │    Auth     │  │   Storage   │  │    Edge Functions       │ │
│  │   (JWT)     │  │  (S3-like)  │  │  (Serverless/Deno)      │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              PostgreSQL + pgvector                          ││
│  │           (com Row Level Security)                          ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    INTEGRAÇÕES EXTERNAS                         │
│       OpenAI GPT-4o  │  Catracas Biométricas  │  Portais Web    │
└─────────────────────────────────────────────────────────────────┘
```

### Stack Tecnológico

**Frontend:**
- React 18.2 com TypeScript 5.2
- Material-UI v5 (MUI) para componentes
- Vite como bundler (muito mais rápido que Webpack)
- Tailwind CSS para estilos utilitários
- Recharts para gráficos
- React Router v6 para navegação

**Backend (Supabase):**
- PostgreSQL 13 como banco de dados principal
- Supabase Auth para autenticação JWT
- Row Level Security (RLS) para autorização
- Edge Functions em Deno/TypeScript
- Supabase Storage para arquivos
- pgvector para busca semântica (IA)

**Integrações:**
- OpenAI GPT-4o para insights e chat com dados
- Scripts Python para coleta de dados (Selenium, psycopg2)

### Funcionalidades Principais

#### 1. Dashboard de Acessos (`/dashboard`)
O coração operacional do sistema. Exibe:
- Total de trabalhadores que acessaram
- Horas trabalhadas consolidadas
- Média de horas por pessoa
- Análise de pontualidade
- Tracking de absenteísmo
- Discrepâncias de horas (trabalhadas vs. contratadas)

Os dados vêm das catracas de reconhecimento facial instaladas nas unidades.

#### 2. Escalas Médicas (`/escalas`)
Módulo para gestão de plantões médicos:
- Importação em lote via CSV
- Detecção automática de conflitos de horário
- Workflow de aprovação (Programado → Confirmado → Aprovado)
- Visualização em calendário ou cards
- Exportação para PDF/CSV

#### 3. Gestão de Contratos (`/contratos`)
- Cadastro e edição de contratos com terceiros
- Associação de itens contratuais (serviços, valores)
- Upload de documentos PDF
- Alertas de vencimento
- Cálculo automático de valores

#### 4. Insights com IA (`/insights-ia`)
O diferencial do sistema:
- Chat em linguagem natural com os dados
- Geração automática de SQL a partir de perguntas
- Busca semântica em documentos (RAG)
- Análises preditivas diárias
- Histórico de insights

### Modelo de Dados Simplificado

```
usuarios ─────┐
              │
contratos ────┼──── acessos (dados das catracas)
              │
escalas_medicas    produtividade (dados de produção)
              │
unidades_hospitalares
```

**Tabelas Principais:**
- `usuarios`: Usuários do sistema com roles
- `contratos`: Contratos com terceiros
- `acessos`: Registros de entrada/saída das catracas
- `produtividade`: Dados consolidados de produtividade
- `escalas_medicas`: Plantões programados
- `unidades_hospitalares`: Hospitais/unidades

### Sistema de Permissões

O sistema possui 4 níveis de usuário:

| Tipo | Acesso |
|------|--------|
| `administrador-agir-corporativo` | Acesso total, todas as unidades |
| `administrador-agir-planta` | Admin de uma unidade específica |
| `administrador-terceiro` | Admin do parceiro terceirizado |
| `terceiro` | Usuário final (apenas próprios dados) |

A segurança é implementada em duas camadas:
1. **Frontend**: `ProtectedRoute` verifica o tipo de usuário
2. **Backend**: Row Level Security (RLS) no PostgreSQL

### Fluxo de Dados

1. **Catracas** → Scripts Python coletam dados → Tabela `acessos`
2. **Portais Web** → Selenium scraping → Tabela `produtividade`
3. **Usuários** → Interface React → Supabase API → PostgreSQL
4. **IA** → Edge Functions → OpenAI → Resposta com streaming

### O Que Vocês Precisam Entender sobre Supabase

O Supabase é frequentemente chamado de "Firebase open-source" ou "Backend as a Service". Para quem vem da AWS, aqui está o mapeamento mental:

| Supabase | AWS Equivalente |
|----------|-----------------|
| PostgreSQL | RDS PostgreSQL |
| Auth | Cognito |
| Storage | S3 |
| Edge Functions | Lambda@Edge ou Lambda |
| Realtime | AppSync / IoT Core |
| Row Level Security | IAM Policies (no nível do DB) |

A grande vantagem do Supabase é que tudo está integrado: autenticação, banco, storage e functions compartilham o mesmo contexto de segurança.

### Por Que Migrar para AWS?

A Agir padronizou sua infraestrutura na AWS. A migração trará:

1. **Conformidade**: Alinhamento com políticas de segurança corporativa
2. **Integração**: Conectividade com outros sistemas Agir
3. **Suporte**: Equipe interna já conhece AWS
4. **Escala**: Recursos de auto-scaling da AWS
5. **Compliance**: Atender requisitos de auditoria (dados em território nacional)

### Visão Geral da Migração

A migração será feita em fases:

1. **Fase 1**: Banco de dados (PostgreSQL → RDS)
2. **Fase 2**: Autenticação (Supabase Auth → Cognito)
3. **Fase 3**: Storage (Supabase Storage → S3)
4. **Fase 4**: Functions (Edge Functions → Lambda)
5. **Fase 5**: Frontend (Deploy no CloudFront + S3)

O código frontend (React) permanecerá praticamente idêntico. As principais mudanças serão nos arquivos de configuração e serviços de conexão.

### Pontos de Atenção

1. **RLS para IAM**: A lógica de Row Level Security precisará ser reimplementada como policies no IAM ou middleware na API
2. **Realtime**: Se precisarmos de updates em tempo real, considerar AppSync ou WebSocket API Gateway
3. **Edge Functions**: Migrar de Deno para Node.js (Lambda)
4. **pgvector**: Garantir que a extensão esteja disponível no RDS

### Próximos Passos

1. Revisem esta documentação completa
2. Estudem os arquivos de serviço (`src/services/`, `src/lib/supabase.ts`)
3. Entendam as migrations SQL (`migrations/`)
4. Testem localmente com o Supabase CLI
5. Planejem a migração em sprints

### Conclusão

O ParcerIA é um sistema robusto, bem estruturado e pronto para produção. A arquitetura baseada em componentes React e a separação clara entre frontend e backend facilitarão a migração para AWS. As principais funcionalidades - dashboard de acessos, escalas médicas e insights com IA - são críticas para a operação da Agir e devem ser priorizadas na migração.

Estou disponível para tirar dúvidas e apoiar no processo de transição.

---

# PARTE 2: DOCUMENTAÇÃO TÉCNICA DETALHADA

## 1. Estrutura do Projeto

```
gestaodeacesso/
├── src/                           # Código-fonte do frontend
│   ├── App.tsx                    # Configuração de rotas
│   ├── main.tsx                   # Ponto de entrada
│   ├── components/                # Componentes reutilizáveis
│   │   ├── auth/
│   │   │   └── ProtectedRoute.tsx # Wrapper de autorização
│   │   ├── layout/
│   │   │   └── Layout.tsx         # Layout principal
│   │   ├── dashboard/
│   │   │   ├── FilterSection.tsx  # Filtros do dashboard
│   │   │   └── MetricCard.tsx     # Cards de métricas
│   │   ├── ChatBot.tsx            # Assistente IA
│   │   └── DeleteConfirmDialog.tsx
│   ├── contexts/                  # Contextos React
│   │   ├── AuthContext.tsx        # Estado de autenticação
│   │   └── ThemeContext.tsx       # Tema claro/escuro
│   ├── features/                  # Módulos por funcionalidade
│   │   ├── dashboard/             # Dashboard de acessos
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   ├── types/
│   │   │   └── utils/
│   │   └── escalas-medicas/       # Escalas médicas
│   │       ├── components/
│   │       ├── hooks/
│   │       ├── services/
│   │       ├── types/
│   │       └── utils/
│   ├── pages/                     # Páginas da aplicação
│   ├── services/                  # Serviços de API
│   ├── hooks/                     # Hooks customizados
│   ├── lib/                       # Bibliotecas e configs
│   │   ├── supabase.ts            # Cliente Supabase
│   │   └── theme.ts               # Tema Material-UI
│   ├── types/                     # Tipos TypeScript
│   └── utils/                     # Funções utilitárias
├── supabase/                      # Configuração Supabase
│   ├── config.toml                # Config do projeto
│   └── functions/                 # Edge Functions
│       ├── chat-gateway/          # Gateway de chat IA
│       ├── gerar-insights/        # Geração de insights
│       └── processar-documento/   # Processamento de docs
├── migrations/                    # Migrações SQL (25+ arquivos)
├── package.json                   # Dependências npm
├── tsconfig.json                  # Config TypeScript
├── vite.config.ts                 # Config Vite
└── tailwind.config.js             # Config Tailwind
```

## 2. Configuração do Ambiente

### 2.1 Variáveis de Ambiente (`.env`)

```env
# Supabase
VITE_SUPABASE_URL=https://qszqzdnlhxpglllyqtht.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Para scripts Python (arquivo separado ou sistema)
SUPABASE_URL=https://qszqzdnlhxpglllyqtht.supabase.co
SUPABASE_API_KEY=sua-chave-aqui
SUPABASE_SERVICE_ROLE_KEY=chave-service-role
OPENAI_API_KEY=sk-...
```

### 2.2 Instalação e Execução

```bash
# Instalar dependências
npm install

# Desenvolvimento
npm run dev

# Build de produção
npm run build

# Preview da build
npm run preview

# Lint
npm run lint
```

## 3. Autenticação e Autorização

### 3.1 Cliente Supabase (`src/lib/supabase.ts`)

```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient<Database>(supabaseUrl, supabaseKey)
```

### 3.2 Contexto de Autenticação (`src/contexts/AuthContext.tsx`)

O AuthContext gerencia:
- Estado de login/logout
- Dados do usuário atual
- Refresh automático de tokens
- Verificação de permissões

```typescript
interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  isAdmin: () => boolean
  isCorporativo: () => boolean
}
```

### 3.3 Proteção de Rotas (`src/components/auth/ProtectedRoute.tsx`)

```typescript
<ProtectedRoute allowedTypes={['administrador-agir-corporativo']}>
  <AdminPage />
</ProtectedRoute>
```

### 3.4 Row Level Security (RLS)

Cada tabela possui políticas RLS. Exemplo para `acessos`:

```sql
-- Usuários corporativos veem tudo
CREATE POLICY "corporativo_select_all" ON acessos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo = 'administrador-agir-corporativo'
    )
  );

-- Usuários de planta veem apenas sua unidade
CREATE POLICY "planta_select_own" ON acessos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo = 'administrador-agir-planta'
      AND usuarios.unidade_hospitalar_id = acessos.unidade_id
    )
  );
```

## 4. Módulos Principais

### 4.1 Dashboard de Acessos

**Arquivo Principal:** `src/pages/Dashboard.tsx`

**Hooks:**
- `useDashboardData()`: Carrega dados com paginação
- `useDashboardFilters()`: Gerencia filtros
- `useDashboardModals()`: Controla diálogos
- `useHoursCalculation()`: Calcula horas trabalhadas

**Serviço:** `src/features/dashboard/services/dashboardService.ts`

```typescript
export const dashboardService = {
  loadContratos: async () => { ... },
  loadAcessos: async (filters: FilterParams) => { ... },
  loadProdutividade: async (dateRange: DateRange) => { ... },
}
```

### 4.2 Escalas Médicas

**Arquivo Principal:** `src/pages/EscalasMedicas.tsx` (dentro de features)

**Hooks:**
- `useEscalas()`: CRUD de escalas
- `useEscalaFilters()`: Filtros por status, data, contrato
- `useEscalaForm()`: Validação de formulário

**Serviço:** `src/features/escalas-medicas/services/escalasService.ts`

```typescript
export const escalasService = {
  fetchEscalas: async () => { ... },
  createEscalas: async (escalas: Escala[]) => { ... },
  updateEscala: async (id: string, data: Partial<Escala>) => { ... },
  deleteEscala: async (id: string) => { ... },
  detectConflicts: async (escala: Escala) => { ... },
}
```

### 4.3 Insights com IA

**Arquivo Principal:** `src/pages/InsightsIA.tsx`

**Edge Function:** `supabase/functions/gerar-insights/index.ts`

O fluxo é:
1. Frontend chama Edge Function
2. Function busca dados dos últimos 30 dias
3. Monta prompt com contexto
4. Envia para OpenAI GPT-4o
5. Salva insight na tabela `insights_ia`
6. Retorna para o frontend

**Chat Gateway:** `supabase/functions/chat-gateway/`

Arquitetura do chat:
```
index.ts (entrada)
    │
    ├── classificador.ts (decide a rota)
    │       │
    │       ├── SQL Route → gerador-sql.ts
    │       │
    │       ├── RAG Route → recuperador-rag.ts
    │       │
    │       └── Hybrid Route → hibrido.ts
    │
    └── contexto-usuario.ts (dados do usuário)
```

## 5. Banco de Dados

### 5.1 Diagrama ER Simplificado

```
┌──────────────────┐       ┌──────────────────┐
│    usuarios      │       │    contratos     │
├──────────────────┤       ├──────────────────┤
│ id (PK, FK auth) │───┐   │ id (PK)          │
│ email            │   │   │ nome             │
│ nome             │   │   │ empresa          │
│ cpf              │   │   │ data_inicio      │
│ tipo             │   │   │ data_fim         │
│ contrato_id (FK) │───┼──▶│ ativo            │
│ unidade_id (FK)  │   │   │ unidade_id (FK)  │
└──────────────────┘   │   └──────────────────┘
                       │            │
                       │            ▼
┌──────────────────┐   │   ┌──────────────────┐
│     acessos      │   │   │  contrato_itens  │
├──────────────────┤   │   ├──────────────────┤
│ id (PK)          │   │   │ id (PK)          │
│ tipo             │   │   │ contrato_id (FK) │
│ matricula        │   │   │ item_id (FK)     │
│ nome             │   │   │ quantidade       │
│ cpf              │   │   │ valor_unitario   │
│ data_acesso      │   │   └──────────────────┘
│ sentido (E/S)    │   │
│ cod_planta       │   │   ┌──────────────────┐
│ unidade_id       │   │   │ escalas_medicas  │
└──────────────────┘   │   ├──────────────────┤
                       │   │ id (PK)          │
┌──────────────────┐   │   │ contrato_id (FK) │
│  produtividade   │   │   │ data_inicio      │
├──────────────────┤   │   │ horario_entrada  │
│ id (PK)          │   │   │ horario_saida    │
│ cpf              │   │   │ medicos (JSONB)  │
│ data             │   │   │ status           │
│ horas_trabalhadas│   │   │ observacoes      │
│ horas_agendadas  │   │   │ ativo            │
│ status           │   │   └──────────────────┘
│ unidade_id (FK)  │   │
└──────────────────┘   │   ┌──────────────────┐
                       │   │ unidades_hosp.   │
                       │   ├──────────────────┤
                       └──▶│ id (PK)          │
                           │ codigo           │
                           │ nome             │
                           │ endereco         │
                           │ ativo            │
                           └──────────────────┘
```

### 5.2 Migrações Importantes

| Arquivo | Descrição |
|---------|-----------|
| `001_multi_tenancy_setup.sql` | Setup de multi-tenancy |
| `007_create_escalas_medicas.sql` | Tabela de escalas |
| `011_habilitar_pgvector.sql` | Extensão para IA |
| `012_criar_tabelas_documentos.sql` | Tabelas de documentos |
| `016_funcao_executar_sql.sql` | Função para chat SQL |

### 5.3 Extensões PostgreSQL

```sql
-- Habilitadas no Supabase
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";    -- Criptografia
CREATE EXTENSION IF NOT EXISTS "vector";       -- pgvector para IA
```

## 6. Edge Functions (Serverless)

### 6.1 Estrutura

```
supabase/functions/
├── chat-gateway/
│   ├── index.ts           # Handler principal
│   ├── classificador.ts   # Classifica tipo de query
│   ├── gerador-sql.ts     # Gera SQL de linguagem natural
│   ├── recuperador-rag.ts # Busca em documentos
│   ├── hibrido.ts         # Combina SQL + RAG
│   └── contexto-usuario.ts
├── gerar-insights/
│   └── index.ts           # Gera análises diárias
└── processar-documento/
    └── index.ts           # Processa e vetoriza PDFs
```

### 6.2 Deploy de Functions

```bash
# Deploy de uma function específica
supabase functions deploy chat-gateway

# Deploy de todas
supabase functions deploy
```

### 6.3 Exemplo de Function

```typescript
// supabase/functions/gerar-insights/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Buscar dados dos últimos 30 dias
  const { data: acessos } = await supabase
    .from('acessos')
    .select('*')
    .gte('data_acesso', thirtyDaysAgo)

  // Chamar OpenAI
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  // Salvar insight
  await supabase.from('insights_ia').insert({ conteudo: insight })

  return new Response(JSON.stringify({ success: true }))
})
```

## 7. Scripts Python (Backend de Coleta)

### 7.1 Estrutura

```
├── coletar-produtividade-*.py  # Coleta de portais web
├── importar-acessos-*.py       # Importa dados de catracas
├── recalcular-status-diario.py # Recálculo de status
└── requirements.txt            # Dependências Python
```

### 7.2 Dependências Python

```
psycopg2-binary>=2.9.0
supabase>=2.22.0
python-dotenv>=1.0.0
selenium>=4.0.0
tqdm>=4.0.0
pandas>=2.0.0
```

### 7.3 Exemplo de Script

```python
# coletar-produtividade.py
from supabase import create_client
from selenium import webdriver
import os

supabase = create_client(
    os.getenv('SUPABASE_URL'),
    os.getenv('SUPABASE_SERVICE_ROLE_KEY')
)

# Coletar dados do portal
driver = webdriver.Chrome()
# ... scraping logic ...

# Inserir no Supabase
supabase.table('produtividade').insert(dados).execute()
```

---

# PARTE 3: GUIA DE MIGRAÇÃO SUPABASE → AWS

## 1. Mapeamento de Serviços

| Supabase | AWS | Observações |
|----------|-----|-------------|
| PostgreSQL | **RDS PostgreSQL** | Versão 13+ recomendada |
| Auth | **Cognito** | User Pools + Identity Pools |
| Storage | **S3** | Com CloudFront para CDN |
| Edge Functions | **Lambda** | Com API Gateway |
| Realtime | **AppSync** ou **WebSocket API** | Se necessário |
| RLS | **IAM + Middleware** | Reimplementar no código |
| pgvector | **RDS + extensão** | Ou Amazon OpenSearch |

## 2. Arquitetura AWS Proposta

```
┌─────────────────────────────────────────────────────────────────┐
│                         CloudFront                              │
│                      (CDN + SSL/TLS)                            │
└─────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
                ▼               ▼               ▼
        ┌───────────┐   ┌───────────┐   ┌───────────┐
        │    S3     │   │    API    │   │  Cognito  │
        │ (Frontend)│   │  Gateway  │   │  (Auth)   │
        └───────────┘   └───────────┘   └───────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
                ▼               ▼               ▼
        ┌───────────┐   ┌───────────┐   ┌───────────┐
        │  Lambda   │   │  Lambda   │   │  Lambda   │
        │ (chat)    │   │ (insights)│   │ (docs)    │
        └───────────┘   └───────────┘   └───────────┘
                │               │               │
                └───────────────┼───────────────┘
                                │
                                ▼
                        ┌───────────────┐
                        │      RDS      │
                        │  PostgreSQL   │
                        │ + pgvector    │
                        └───────────────┘
                                │
                                ▼
                        ┌───────────────┐
                        │      S3       │
                        │  (Documentos) │
                        └───────────────┘
```

## 3. Passo a Passo da Migração

### Fase 1: Preparação (Semana 1)

#### 1.1 Criar Infraestrutura AWS Base

```bash
# Usando AWS CLI ou Terraform

# Criar VPC
aws ec2 create-vpc --cidr-block 10.0.0.0/16

# Criar subnets (mínimo 2 AZs para RDS)
aws ec2 create-subnet --vpc-id vpc-xxx --cidr-block 10.0.1.0/24 --availability-zone us-east-1a
aws ec2 create-subnet --vpc-id vpc-xxx --cidr-block 10.0.2.0/24 --availability-zone us-east-1b

# Criar Security Groups
aws ec2 create-security-group --group-name parceria-db --description "RDS PostgreSQL"
```

#### 1.2 Criar RDS PostgreSQL

```bash
aws rds create-db-instance \
  --db-instance-identifier parceria-db \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --engine-version 13.14 \
  --master-username admin \
  --master-user-password <senha-segura> \
  --allocated-storage 100 \
  --vpc-security-group-ids sg-xxx \
  --db-subnet-group-name parceria-subnet-group \
  --backup-retention-period 7 \
  --multi-az
```

#### 1.3 Habilitar pgvector no RDS

```sql
-- Conectar ao RDS e executar:
CREATE EXTENSION IF NOT EXISTS vector;
```

### Fase 2: Migração do Banco (Semana 2)

#### 2.1 Exportar Dados do Supabase

```bash
# Usar pg_dump para exportar
pg_dump -h db.qszqzdnlhxpglllyqtht.supabase.co \
  -U postgres \
  -d postgres \
  -F c \
  -f backup_parceria.dump

# Exportar apenas schema (sem dados sensíveis de auth)
pg_dump -h db.qszqzdnlhxpglllyqtht.supabase.co \
  -U postgres \
  -d postgres \
  --schema-only \
  -f schema_parceria.sql
```

#### 2.2 Importar no RDS

```bash
# Restaurar no RDS
pg_restore -h parceria-db.xxx.us-east-1.rds.amazonaws.com \
  -U admin \
  -d parceria \
  -F c \
  backup_parceria.dump
```

#### 2.3 Executar Migrações

```bash
# Aplicar cada arquivo de migração
psql -h <rds-endpoint> -U admin -d parceria -f migrations/001_multi_tenancy_setup.sql
# ... repetir para cada arquivo
```

### Fase 3: Migração da Autenticação (Semana 3)

#### 3.1 Criar User Pool no Cognito

```bash
aws cognito-idp create-user-pool \
  --pool-name parceria-users \
  --policies "PasswordPolicy={MinimumLength=8,RequireUppercase=true,RequireLowercase=true,RequireNumbers=true}" \
  --auto-verified-attributes email \
  --username-attributes email
```

#### 3.2 Criar App Client

```bash
aws cognito-idp create-user-pool-client \
  --user-pool-id us-east-1_xxxxx \
  --client-name parceria-web \
  --generate-secret false \
  --explicit-auth-flows ALLOW_USER_SRP_AUTH ALLOW_REFRESH_TOKEN_AUTH
```

#### 3.3 Migrar Usuários

Opção A: **Migração Lazy** (recomendada)
- Configurar Lambda trigger de migração
- Usuários são migrados no primeiro login

Opção B: **Migração em Lote**
```python
import boto3
import csv

cognito = boto3.client('cognito-idp')

with open('usuarios_export.csv') as f:
    for row in csv.DictReader(f):
        cognito.admin_create_user(
            UserPoolId='us-east-1_xxxxx',
            Username=row['email'],
            UserAttributes=[
                {'Name': 'email', 'Value': row['email']},
                {'Name': 'custom:tipo', 'Value': row['tipo']},
                {'Name': 'custom:cpf', 'Value': row['cpf']},
            ],
            MessageAction='SUPPRESS'  # Não enviar email
        )
```

#### 3.4 Atualizar Frontend

**Antes (Supabase):**
```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(url, key)

// Login
const { data, error } = await supabase.auth.signInWithPassword({ email, password })
```

**Depois (Cognito):**
```typescript
// src/lib/auth.ts
import { Amplify } from 'aws-amplify'
import { signIn, signOut, getCurrentUser } from 'aws-amplify/auth'

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: 'us-east-1_xxxxx',
      userPoolClientId: 'xxxxx',
    }
  }
})

// Login
const { isSignedIn, nextStep } = await signIn({ username: email, password })
```

### Fase 4: Migração do Storage (Semana 4)

#### 4.1 Criar Bucket S3

```bash
aws s3api create-bucket \
  --bucket parceria-documentos \
  --region us-east-1

# Configurar CORS
aws s3api put-bucket-cors \
  --bucket parceria-documentos \
  --cors-configuration file://cors.json
```

**cors.json:**
```json
{
  "CORSRules": [
    {
      "AllowedOrigins": ["https://parceria.agir.com.br"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"]
    }
  ]
}
```

#### 4.2 Migrar Arquivos

```python
import boto3
from supabase import create_client

supabase = create_client(url, key)
s3 = boto3.client('s3')

# Listar arquivos no Supabase Storage
files = supabase.storage.from_('documentos').list()

for file in files:
    # Download do Supabase
    data = supabase.storage.from_('documentos').download(file['name'])

    # Upload para S3
    s3.put_object(
        Bucket='parceria-documentos',
        Key=file['name'],
        Body=data
    )
```

#### 4.3 Atualizar Referências no Código

**Antes (Supabase Storage):**
```typescript
const { data, error } = await supabase.storage
  .from('documentos')
  .upload(`contratos/${id}/${file.name}`, file)
```

**Depois (S3):**
```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const s3 = new S3Client({ region: 'us-east-1' })

await s3.send(new PutObjectCommand({
  Bucket: 'parceria-documentos',
  Key: `contratos/${id}/${file.name}`,
  Body: file,
}))
```

### Fase 5: Migração das Edge Functions para Lambda (Semanas 5-6)

#### 5.1 Estrutura de Projeto Lambda

```
lambda-functions/
├── chat-gateway/
│   ├── index.js
│   ├── classificador.js
│   ├── gerador-sql.js
│   ├── recuperador-rag.js
│   └── package.json
├── gerar-insights/
│   ├── index.js
│   └── package.json
└── processar-documento/
    ├── index.js
    └── package.json
```

#### 5.2 Converter Deno para Node.js

**Antes (Deno - Edge Function):**
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  // ...
  return new Response(JSON.stringify(data))
})
```

**Depois (Node.js - Lambda):**
```javascript
const { Client } = require('pg')

exports.handler = async (event) => {
  const client = new Client({
    host: process.env.RDS_HOST,
    database: 'parceria',
    user: process.env.RDS_USER,
    password: process.env.RDS_PASSWORD,
  })

  await client.connect()
  // ...

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }
}
```

#### 5.3 Deploy das Lambdas

```bash
# Criar função
aws lambda create-function \
  --function-name parceria-chat-gateway \
  --runtime nodejs18.x \
  --handler index.handler \
  --role arn:aws:iam::xxx:role/lambda-execution-role \
  --zip-file fileb://chat-gateway.zip \
  --environment Variables="{RDS_HOST=xxx,RDS_USER=xxx,OPENAI_API_KEY=xxx}"
```

#### 5.4 Configurar API Gateway

```bash
# Criar API HTTP
aws apigatewayv2 create-api \
  --name parceria-api \
  --protocol-type HTTP

# Criar rota
aws apigatewayv2 create-route \
  --api-id xxxxx \
  --route-key "POST /chat" \
  --target integrations/xxxxx
```

### Fase 6: Atualização do Frontend (Semana 7)

#### 6.1 Novo Arquivo de Configuração

**Criar `src/lib/aws.ts`:**
```typescript
import { Amplify } from 'aws-amplify'

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: process.env.VITE_COGNITO_USER_POOL_ID!,
      userPoolClientId: process.env.VITE_COGNITO_CLIENT_ID!,
    }
  },
  API: {
    REST: {
      parceriaApi: {
        endpoint: process.env.VITE_API_GATEWAY_URL!,
      }
    }
  },
  Storage: {
    S3: {
      bucket: process.env.VITE_S3_BUCKET!,
      region: 'us-east-1',
    }
  }
})
```

#### 6.2 Criar Serviço de API

**Criar `src/services/apiService.ts`:**
```typescript
import { get, post, put, del } from 'aws-amplify/api'
import { fetchAuthSession } from 'aws-amplify/auth'

const getAuthHeaders = async () => {
  const session = await fetchAuthSession()
  return {
    Authorization: `Bearer ${session.tokens?.idToken?.toString()}`
  }
}

export const apiService = {
  get: async (path: string) => {
    const headers = await getAuthHeaders()
    return get({ apiName: 'parceriaApi', path, options: { headers } })
  },

  post: async (path: string, body: any) => {
    const headers = await getAuthHeaders()
    return post({ apiName: 'parceriaApi', path, options: { headers, body } })
  },
}
```

#### 6.3 Atualizar Serviços Existentes

**Antes (`dashboardService.ts` com Supabase):**
```typescript
export const loadAcessos = async (filters: FilterParams) => {
  const { data, error } = await supabase
    .from('acessos')
    .select('*')
    .gte('data_acesso', filters.startDate)
    .lte('data_acesso', filters.endDate)

  return data
}
```

**Depois (com API Gateway):**
```typescript
export const loadAcessos = async (filters: FilterParams) => {
  const response = await apiService.get(
    `/acessos?startDate=${filters.startDate}&endDate=${filters.endDate}`
  )
  return response.body
}
```

#### 6.4 Implementar Autorização no Backend

Como RLS não existe nativamente na AWS, implementar middleware:

```javascript
// middleware/authorize.js
const jwt = require('jsonwebtoken')
const { Client } = require('pg')

module.exports.authorize = async (event, allowedTypes) => {
  // Extrair token do header
  const token = event.headers.Authorization?.replace('Bearer ', '')
  if (!token) throw new Error('Unauthorized')

  // Decodificar JWT do Cognito
  const decoded = jwt.decode(token)
  const userId = decoded.sub

  // Buscar usuário e verificar tipo
  const client = new Client({ /* config */ })
  await client.connect()

  const result = await client.query(
    'SELECT tipo, unidade_hospitalar_id FROM usuarios WHERE id = $1',
    [userId]
  )

  const user = result.rows[0]
  if (!allowedTypes.includes(user.tipo)) {
    throw new Error('Forbidden')
  }

  return user
}
```

### Fase 7: Deploy e Testes (Semana 8)

#### 7.1 Deploy do Frontend no S3 + CloudFront

```bash
# Build
npm run build

# Upload para S3
aws s3 sync dist/ s3://parceria-frontend --delete

# Invalidar cache do CloudFront
aws cloudfront create-invalidation \
  --distribution-id XXXXX \
  --paths "/*"
```

#### 7.2 Configurar CloudFront

```bash
aws cloudfront create-distribution \
  --origin-domain-name parceria-frontend.s3.amazonaws.com \
  --default-root-object index.html \
  --aliases parceria.agir.com.br
```

#### 7.3 Testes de Integração

```bash
# Testar autenticação
curl -X POST https://api.parceria.agir.com.br/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"teste@agir.com.br","password":"xxx"}'

# Testar API
curl https://api.parceria.agir.com.br/acessos \
  -H "Authorization: Bearer <token>"
```

## 4. Checklist de Migração

### Pré-Migração
- [ ] Backup completo do Supabase
- [ ] Documentar todas as variáveis de ambiente
- [ ] Mapear todas as policies RLS
- [ ] Inventariar Edge Functions
- [ ] Listar arquivos no Storage

### Banco de Dados
- [ ] Criar RDS PostgreSQL
- [ ] Habilitar pgvector
- [ ] Migrar schema
- [ ] Migrar dados
- [ ] Verificar índices
- [ ] Testar queries principais

### Autenticação
- [ ] Criar User Pool Cognito
- [ ] Configurar atributos customizados
- [ ] Migrar usuários
- [ ] Atualizar frontend (Amplify)
- [ ] Testar fluxo de login
- [ ] Testar refresh token

### Storage
- [ ] Criar bucket S3
- [ ] Configurar CORS
- [ ] Migrar arquivos
- [ ] Atualizar referências no código
- [ ] Configurar URLs assinadas (se necessário)

### Functions
- [ ] Converter Deno → Node.js
- [ ] Criar Lambdas
- [ ] Configurar API Gateway
- [ ] Configurar variáveis de ambiente
- [ ] Testar endpoints

### Frontend
- [ ] Atualizar bibliotecas
- [ ] Substituir cliente Supabase
- [ ] Atualizar serviços
- [ ] Build e deploy no S3
- [ ] Configurar CloudFront

### Pós-Migração
- [ ] Testes E2E completos
- [ ] Monitoramento (CloudWatch)
- [ ] Configurar alertas
- [ ] Documentar nova arquitetura
- [ ] Treinar equipe

## 5. Estimativa de Custos AWS

| Serviço | Especificação | Custo Mensal Estimado |
|---------|--------------|----------------------|
| RDS PostgreSQL | db.t3.medium, Multi-AZ | ~$150 |
| Lambda | 1M requests, 512MB | ~$20 |
| API Gateway | HTTP API, 1M requests | ~$10 |
| S3 | 50GB storage | ~$5 |
| CloudFront | 100GB transfer | ~$10 |
| Cognito | 10k MAU | Gratuito |
| **Total** | | **~$195/mês** |

*Valores aproximados para us-east-1. Podem variar.*

---

# PARTE 4: PERGUNTAS FREQUENTES (FAQ)

## Sobre a Aplicação

### P1: Por que o ParcerIA foi desenvolvido com Supabase e não direto na AWS?

**R:** A escolha do Supabase foi estratégica para o MVP:
1. **Velocidade de desenvolvimento**: Setup de auth, database e storage em minutos
2. **Custo inicial**: Tier gratuito generoso para desenvolvimento
3. **Integração nativa**: Auth + DB + Storage compartilham contexto
4. **RLS built-in**: Segurança no nível do banco sem código adicional

A migração para AWS sempre foi planejada para a fase de produção corporativa.

### P2: Como funciona o sistema de permissões?

**R:** Duas camadas:
1. **Frontend**: `ProtectedRoute` verifica `user.tipo` antes de renderizar
2. **Backend**: RLS no PostgreSQL filtra dados automaticamente

Exemplo: Um `administrador-agir-planta` só vê dados da sua `unidade_hospitalar_id`.

### P3: De onde vêm os dados de acesso das catracas?

**R:** Scripts Python (`importar-acessos-*.py`) executam periodicamente:
1. Conectam no sistema das catracas (variado por unidade)
2. Exportam CSV ou consultam API
3. Inserem na tabela `acessos` via Supabase client

Os scripts rodam em um servidor separado (cron job).

### P4: Como funciona a IA do sistema?

**R:** Três componentes:
1. **Chat Gateway**: Recebe pergunta → classifica rota → gera SQL ou busca docs
2. **Insights Diários**: Edge Function analisa 30 dias de dados com GPT-4o
3. **RAG**: Documentos são vetorizados com embeddings para busca semântica

A chave OpenAI fica no servidor (Edge Function), nunca no frontend.

### P5: O que é pgvector e por que é importante?

**R:** pgvector é uma extensão PostgreSQL para armazenar e buscar vetores (embeddings). Permite:
- Busca semântica em documentos
- Comparação de similaridade
- Fundação para RAG (Retrieval Augmented Generation)

Sem pgvector, precisaríamos de um serviço separado (Pinecone, OpenSearch).

## Sobre a Migração

### P6: Como transferir o repositório do GitHub pessoal para o GitHub da Agir?

**R:** Existem três abordagens, da mais simples à mais completa:

**Opção 1: Fork + Transfer (Recomendada)**
```bash
# No GitHub da Agir, criar repositório vazio: agir/parceria

# No seu computador, clonar o repo original
git clone https://github.com/seu-usuario/gestaodeacesso.git
cd gestaodeacesso

# Adicionar o remote da Agir
git remote add agir https://github.com/agir/parceria.git

# Verificar remotes
git remote -v
# origin    https://github.com/seu-usuario/gestaodeacesso.git (fetch)
# agir      https://github.com/agir/parceria.git (fetch)

# Push de todas as branches e tags para o novo remote
git push agir --all
git push agir --tags

# Opcionalmente, mudar o origin padrão para o da Agir
git remote set-url origin https://github.com/agir/parceria.git
```

**Opção 2: GitHub Import (via interface)**
1. Acessar https://github.com/new/import
2. Inserir URL do repositório original
3. Escolher a organização "agir" como destino
4. Definir nome do novo repositório
5. Clicar em "Begin import"

**Opção 3: Mirror completo (preserva tudo)**
```bash
# Clone bare (apenas metadados git)
git clone --bare https://github.com/seu-usuario/gestaodeacesso.git

# Entrar no diretório
cd gestaodeacesso.git

# Push mirror para o novo destino
git push --mirror https://github.com/agir/parceria.git

# Limpar
cd ..
rm -rf gestaodeacesso.git
```

**Pós-transferência:**
1. Atualizar URLs nos arquivos de configuração (package.json, README)
2. Configurar branch protection rules no novo repo
3. Adicionar equipe com permissões apropriadas
4. Configurar secrets para CI/CD (AWS credentials, etc.)
5. Verificar webhooks e integrações

**Importante:** O repositório original pode ser arquivado ou deletado após confirmar que tudo está funcionando no novo destino.

---

### P7: Será necessário recriar toda a lógica de negócio do backend?

**R:** **Não!** Esta é uma dúvida comum e a resposta é tranquilizadora.

**O que NÃO precisa ser recriado:**

| Componente | Situação |
|------------|----------|
| Schema do banco (tabelas, colunas, tipos) | **Mantido 100%** - PostgreSQL é PostgreSQL |
| Queries SQL | **Mantidas 100%** - Mesma sintaxe |
| Lógica de cálculo de horas | **Mantida** - Está no frontend |
| Validações de formulário | **Mantidas** - Estão no frontend |
| Regras de negócio em hooks | **Mantidas** - React puro |
| Componentes UI | **Mantidos** - React + MUI |
| Tipos TypeScript | **Mantidos** - Tipagem é agnóstica |

**O que PRECISA ser adaptado (não recriado):**

1. **Camada de conexão com banco**
   - De: `supabase.from('tabela').select()`
   - Para: API REST que faz a mesma query

2. **Autenticação**
   - De: `supabase.auth.signIn()`
   - Para: `Amplify.Auth.signIn()`

3. **Upload de arquivos**
   - De: `supabase.storage.upload()`
   - Para: `S3.putObject()`

4. **Edge Functions → Lambda**
   - Mesma lógica, sintaxe ligeiramente diferente
   - De: Deno (TypeScript)
   - Para: Node.js (JavaScript/TypeScript)

**Analogia:** É como mudar de apartamento. Você leva todos os móveis (lógica de negócio), só precisa adaptar às tomadas diferentes (APIs).

---

### P8: Como fazer a adaptação do backend na prática?

**R:** Vou mostrar o passo a passo com exemplos reais do código.

**Passo 1: Criar camada de API intermediária**

Ao invés de chamar Supabase diretamente, criar um serviço que abstrai a fonte:

```typescript
// ANTES: src/services/dashboardService.ts (acoplado ao Supabase)
import { supabase } from '../lib/supabase'

export const loadAcessos = async (filters: FilterParams) => {
  const { data, error } = await supabase
    .from('acessos')
    .select('*')
    .gte('data_acesso', filters.startDate)
    .lte('data_acesso', filters.endDate)

  if (error) throw error
  return data
}
```

```typescript
// DEPOIS: src/services/dashboardService.ts (desacoplado)
import { api } from '../lib/api'  // Abstração

export const loadAcessos = async (filters: FilterParams) => {
  const response = await api.get('/acessos', {
    params: {
      startDate: filters.startDate,
      endDate: filters.endDate
    }
  })
  return response.data
}
```

```typescript
// src/lib/api.ts (a abstração)
import axios from 'axios'
import { fetchAuthSession } from 'aws-amplify/auth'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL
})

// Interceptor para adicionar token JWT
api.interceptors.request.use(async (config) => {
  const session = await fetchAuthSession()
  const token = session.tokens?.idToken?.toString()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export { api }
```

**Passo 2: Criar Lambda que replica a lógica**

```javascript
// lambda/acessos/index.js
const { Client } = require('pg')

const client = new Client({
  host: process.env.RDS_HOST,
  database: process.env.RDS_DATABASE,
  user: process.env.RDS_USER,
  password: process.env.RDS_PASSWORD,
  ssl: { rejectUnauthorized: false }
})

let isConnected = false

exports.handler = async (event) => {
  // Conectar (reutiliza conexão em warm starts)
  if (!isConnected) {
    await client.connect()
    isConnected = true
  }

  const { startDate, endDate } = event.queryStringParameters || {}

  // MESMA QUERY que o Supabase fazia internamente
  const result = await client.query(`
    SELECT * FROM acessos
    WHERE data_acesso >= $1
      AND data_acesso <= $2
    ORDER BY data_acesso DESC
  `, [startDate, endDate])

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(result.rows)
  }
}
```

**Passo 3: Migrar RLS para middleware**

O Row Level Security do Supabase precisa virar código:

```javascript
// lambda/middleware/authorize.js
const jwt = require('jsonwebtoken')
const jwksClient = require('jwks-rsa')

const client = jwksClient({
  jwksUri: `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}/.well-known/jwks.json`
})

const getKey = (header, callback) => {
  client.getSigningKey(header.kid, (err, key) => {
    callback(null, key.publicKey || key.rsaPublicKey)
  })
}

exports.authorize = (allowedTypes) => {
  return async (event) => {
    const token = event.headers.Authorization?.replace('Bearer ', '')

    if (!token) {
      return { authorized: false, error: 'Token não fornecido' }
    }

    try {
      const decoded = await new Promise((resolve, reject) => {
        jwt.verify(token, getKey, { algorithms: ['RS256'] }, (err, decoded) => {
          if (err) reject(err)
          else resolve(decoded)
        })
      })

      // Buscar perfil do usuário no banco
      const userResult = await client.query(
        'SELECT tipo, unidade_hospitalar_id FROM usuarios WHERE id = $1',
        [decoded.sub]
      )

      const user = userResult.rows[0]

      if (!user || !allowedTypes.includes(user.tipo)) {
        return { authorized: false, error: 'Acesso negado' }
      }

      return {
        authorized: true,
        user: {
          id: decoded.sub,
          email: decoded.email,
          tipo: user.tipo,
          unidadeId: user.unidade_hospitalar_id
        }
      }
    } catch (error) {
      return { authorized: false, error: error.message }
    }
  }
}
```

```javascript
// Uso no Lambda de acessos
const { authorize } = require('./middleware/authorize')

exports.handler = async (event) => {
  // Verificar autorização
  const auth = await authorize(['administrador-agir-corporativo', 'administrador-agir-planta'])(event)

  if (!auth.authorized) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: auth.error })
    }
  }

  // Aplicar filtro por unidade (equivalente ao RLS)
  let query = 'SELECT * FROM acessos WHERE data_acesso >= $1 AND data_acesso <= $2'
  const params = [startDate, endDate]

  // Se não for corporativo, filtrar por unidade
  if (auth.user.tipo !== 'administrador-agir-corporativo') {
    query += ' AND unidade_id = $3'
    params.push(auth.user.unidadeId)
  }

  const result = await client.query(query, params)
  // ...
}
```

**Passo 4: Migrar Edge Functions (Deno → Node.js)**

```typescript
// ANTES: supabase/functions/gerar-insights/index.ts (Deno)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: acessos } = await supabase
    .from('acessos')
    .select('*')
    .gte('data_acesso', thirtyDaysAgo)

  // Chamar OpenAI...

  return new Response(JSON.stringify({ success: true }))
})
```

```javascript
// DEPOIS: lambda/gerar-insights/index.js (Node.js)
const { Client } = require('pg')
const OpenAI = require('openai')

const pgClient = new Client({ /* config */ })
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

exports.handler = async (event) => {
  await pgClient.connect()

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { rows: acessos } = await pgClient.query(`
    SELECT * FROM acessos
    WHERE data_acesso >= $1
  `, [thirtyDaysAgo.toISOString()])

  // Chamar OpenAI (mesma lógica)
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }]
  })

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true })
  }
}
```

**Resumo da Migração de Backend:**

| Etapa | Esforço | Complexidade |
|-------|---------|--------------|
| Criar Lambdas para cada endpoint | Médio | Baixa (copiar lógica) |
| Configurar API Gateway | Baixo | Baixa (interface AWS) |
| Migrar autenticação | Médio | Média (Cognito) |
| Reimplementar RLS como middleware | Médio | Média (lógica clara) |
| Converter Edge Functions | Baixo | Baixa (Deno ≈ Node) |
| **Total** | **~2-3 semanas** | **Média** |

**Dica:** Criar os Lambdas incrementalmente. Comece pelos endpoints mais usados (login, acessos, escalas) e vá migrando os demais.

---

### P9: Qual o maior desafio técnico específico da migração?

**R:** Além do RLS (já coberto na P8), outros desafios:

1. **Streaming SSE no Lambda**: O chat usa Server-Sent Events. Lambda tem timeout de 15min e não suporta streaming nativo. Soluções:
   - Lambda Response Streaming (novo recurso AWS)
   - Ou migrar para ECS/Fargate para o endpoint de chat

2. **Cold starts**: Lambdas podem demorar 1-2s no primeiro request. Mitigações:
   - Provisioned Concurrency
   - Manter conexão DB fora do handler

3. **Variáveis de ambiente**: Muitas configs para gerenciar. Usar:
   - AWS Secrets Manager para credenciais
   - Parameter Store para configs

### P10: Podemos manter parte no Supabase e parte na AWS?

**R:** Tecnicamente sim (arquitetura híbrida), mas não recomendo:
- Complexidade de manutenção
- Latência entre serviços
- Dois pontos de falha
- Custos duplicados

Melhor migrar completamente em fases.

### P11: O código frontend muda muito?

**R:** Principais mudanças:
1. Substituir `@supabase/supabase-js` por `aws-amplify`
2. Atualizar `src/lib/supabase.ts` → `src/lib/aws.ts`
3. Atualizar serviços para usar API Gateway
4. Atualizar upload de arquivos para S3

A lógica de componentes, hooks e páginas permanece igual.

### P12: Como migrar os usuários sem perder senhas?

**R:** Duas opções:
1. **Migração Lazy**: Lambda trigger no Cognito autentica no Supabase na primeira vez, cria usuário no Cognito, depois segue normal
2. **Reset obrigatório**: Migrar emails, forçar reset de senha

Recomendo opção 1 para melhor UX.

### P13: Quanto tempo leva a migração?

**R:** Estimativa conservadora: **8 semanas** com equipe dedicada:
- Semana 1: Infraestrutura AWS
- Semana 2: Banco de dados
- Semana 3: Autenticação
- Semana 4: Storage
- Semanas 5-6: Functions
- Semana 7: Frontend
- Semana 8: Testes e deploy

### P14: Podemos usar Terraform ou CloudFormation?

**R:** Absolutamente! Recomendo Infrastructure as Code:
```hcl
# terraform/main.tf
resource "aws_db_instance" "parceria" {
  identifier        = "parceria-db"
  engine            = "postgres"
  engine_version    = "13.14"
  instance_class    = "db.t3.medium"
  allocated_storage = 100
  # ...
}
```

Facilita reproduzir ambientes (dev, staging, prod).

### P15: Como lidar com o pgvector na AWS?

**R:** RDS PostgreSQL suporta extensões, incluindo pgvector:
```sql
CREATE EXTENSION vector;
```

Alternativamente, considerar Amazon OpenSearch para features mais avançadas de busca.

### P16: E o Realtime do Supabase?

**R:** Se precisarmos de updates em tempo real:
1. **WebSocket API Gateway + Lambda**: Mais controle
2. **AWS AppSync**: GraphQL subscriptions nativo
3. **IoT Core**: Para padrão pub/sub

Atualmente o sistema usa polling, então não é crítico no MVP.

### P17: Como fazer rollback se algo der errado?

**R:** Estratégia de rollback:
1. Manter Supabase ativo durante migração
2. Feature flag para alternar backends
3. Backup diário do RDS
4. Scripts de reversão prontos

```typescript
// Feature flag
const useAWS = process.env.VITE_USE_AWS === 'true'

export const db = useAWS ? awsClient : supabaseClient
```

### P18: Quais métricas monitorar após migração?

**R:** CloudWatch dashboards para:
- Latência de API (<200ms p95)
- Taxa de erro (<1%)
- Tempo de resposta do RDS
- Custo por request
- Logins bem-sucedidos vs. falhos
- Uso de memória das Lambdas

## Sobre Manutenção

### P19: Como debugar problemas de produção?

**R:**
1. **Logs**: CloudWatch Logs para Lambdas
2. **Traces**: X-Ray para requests distribuídos
3. **Métricas**: CloudWatch Metrics
4. **Alertas**: SNS para notificações

### P20: Como fazer deploy de atualizações?

**R:** Pipeline CI/CD recomendado:
```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run build
      - run: aws s3 sync dist/ s3://parceria-frontend
      - run: aws cloudfront create-invalidation --distribution-id ${{ secrets.CF_ID }} --paths "/*"
```

### P21: Precisamos de ambiente de staging?

**R:** Sim! Recomendo:
- **Dev**: Desenvolvimento local + Supabase local (docker)
- **Staging**: Infraestrutura AWS espelhada, dados de teste
- **Prod**: Infraestrutura AWS produção

### P22: Como escalar se o número de usuários crescer?

**R:** Arquitetura já é escalável:
- **Lambda**: Auto-scaling por default (1000 concurrent)
- **RDS**: Upgrade de instance ou read replicas
- **S3/CloudFront**: Escala automaticamente
- **Cognito**: 50M usuários por pool

Para escala extrema, considerar Aurora Serverless.

### P23: Qual a política de backup?

**R:** Recomendações:
- **RDS**: Automated backups (7 dias) + snapshots manuais
- **S3**: Versionamento habilitado + lifecycle rules
- **Cognito**: Export periódico de usuários
- **Código**: Git (já implementado)

---

# PARTE 5: GLOSSÁRIO TÉCNICO

| Termo | Definição |
|-------|-----------|
| **RLS** | Row Level Security - Políticas de segurança no nível de linha do PostgreSQL |
| **JWT** | JSON Web Token - Token de autenticação assinado |
| **Edge Function** | Função serverless executada próxima ao usuário (CDN edge) |
| **Lambda** | Serviço de funções serverless da AWS |
| **Cognito** | Serviço de autenticação/autorização da AWS |
| **pgvector** | Extensão PostgreSQL para armazenar/buscar vetores |
| **RAG** | Retrieval Augmented Generation - Técnica de IA que busca contexto antes de gerar |
| **SSE** | Server-Sent Events - Protocolo para streaming server→client |
| **SPA** | Single Page Application - App que roda no browser sem reload |
| **Multi-tenancy** | Arquitetura onde um sistema serve múltiplos "inquilinos" isolados |
| **Embedding** | Representação vetorial de texto para busca semântica |
| **VPC** | Virtual Private Cloud - Rede isolada na AWS |
| **CDN** | Content Delivery Network - Rede de distribuição de conteúdo |
| **IaC** | Infrastructure as Code - Infraestrutura definida em código |

---

# PARTE 6: CONTATOS E RECURSOS

## Documentação Oficial

- **Supabase Docs**: https://supabase.com/docs
- **AWS Docs**: https://docs.aws.amazon.com
- **React Docs**: https://react.dev
- **Material-UI**: https://mui.com
- **TypeScript**: https://typescriptlang.org

## Repositório

- **GitHub**: [URL do repositório interno]
- **Branch principal**: `main`
- **Branch de migração**: `feature/aws-migration` (a criar)

## Desenvolvedor Original

- **Nome**: [Seu nome]
- **Email**: [Seu email]
- **Disponibilidade**: Suporte durante período de transição

---

*Documento gerado em Março de 2026. Versão 1.0.*
