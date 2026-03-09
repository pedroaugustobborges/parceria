# ParcerIA - Documentação Completa para Equipe de Desenvolvimento

## Sistema Inteligente de Gestão de Acessos e Contratos Hospitalares

**Autor:** Desenvolvedor Original  
**Data:** Março de 2026  
**Versão:** 1.0  
**Público-alvo:** Equipe de Desenvolvimento Agir (Backend + Frontend)  
**Tempo de Leitura:** 15-20 minutos

---

# SUMÁRIO

1. [Apresentação Executiva (Texto para Leitura)](#1-apresentação-executiva)
2. [Visão Geral do Sistema](#2-visão-geral-do-sistema)
3. [Arquitetura Técnica](#3-arquitetura-técnica)
4. [Frontend - React + TypeScript](#4-frontend---react--typescript)
5. [Backend - Supabase Detalhado](#5-backend---supabase-detalhado)
6. [Scripts Python de Automação](#6-scripts-python-de-automação)
7. [Guia de Migração para AWS](#7-guia-de-migração-para-aws)
8. [FAQ - Perguntas Frequentes](#8-faq---perguntas-frequentes)
9. [Checklist de Handover](#9-checklist-de-handover)

---

# 1. APRESENTAÇÃO EXECUTIVA

## Bom dia, equipe. Vou apresentar o ParcerIA.

Meu nome é [SEU NOME] e sou o desenvolvedor responsável pela criação e manutenção do ParcerIA até hoje. A partir de agora, vocês serão os responsáveis pela evolução e manutenção deste sistema. Sei que muitos de vocês não têm experiência com Supabase, mas são especialistas em AWS - e isso é ótimo, porque uma das partes importantes desta transição será justamente o planejamento da migração para a infraestrutura AWS da Agir.

### O Que é o ParcerIA?

ParcerIA é um sistema SaaS (Software as a Service) que desenvolvi para a gestão financeira da Agir Saúde. O nome vem da combinação de "Parceria" + "IA" (Inteligência Artificial). 

O sistema resolve um problema crítico: **gerenciar contratos com equipes médicas terceirizadas e monitorar o uso real dessa força de trabalho**.

### O Problema que o ParcerIA Resolve

Antes do ParcerIA, a Agir enfrentava:

1. **Dados fragmentados**: Informações de catracas, escalas e contratos em sistemas separados
2. **Falta de visibilidade**: Gestores não sabiam quantas horas estavam sendo realmente trabalhadas vs. contratadas
3. **Processos manuais**: Importação de escalas via planilhas Excel, análise de produtividade feita à mão
4. **Zero inteligência**: Nenhuma análise preditiva ou insights automáticos sobre os dados

### O Que o ParcerIA Faz

O sistema integra três fontes principais de dados:

1. **Catracas de reconhecimento facial** → Registro de entradas e saídas dos trabalhadores
2. **Escalas médicas** → Plantões programados por contrato
3. **Sistemas de produtividade (MV)** → Métricas de produção médica (cirurgias, consultas, etc.)

E fornece:

- Dashboard de horas trabalhadas em tempo real
- Gestão completa de contratos e escalas
- Insights automáticos gerados por IA
- ChatBot que responde perguntas em linguagem natural sobre os dados

### Stack Tecnológico

**Frontend:**
- React 18 + TypeScript
- Material-UI (MUI) v5
- Vite como bundler
- Tailwind CSS
- Recharts para gráficos

**Backend:**
- **Supabase** (PostgreSQL + Auth + Storage + Edge Functions)
- Row Level Security (RLS) para autorização
- pgvector para busca semântica (IA)

**Automação:**
- Python 3 (scripts rodando via cron em um droplet DigitalOcean)
- Selenium para scraping de portais web
- psycopg2 para conexão com bancos PostgreSQL

**IA:**
- OpenAI GPT-4o para geração de insights
- Edge Functions (Deno/TypeScript) para processamento

### Por Que Supabase?

Quando comecei o projeto, avaliei várias opções:

| Opção | Por que não escolhi |
|-------|---------------------|
| Firebase | NoSQL não servia para dados relacionais complexos |
| AWS pura | Overhead muito alto para um desenvolvedor solo |
| Backend próprio (Node/Python) | Tempo de desenvolvimento muito longo |
| **Supabase** | PostgreSQL completo + Auth integrado + RLS nativo |

**Supabase é um "Backend as a Service" open-source** que fornece:
- PostgreSQL gerenciado
- Autenticação JWT pronta
- APIs REST automáticas
- Row Level Security (segurança no banco)
- Edge Functions serverless
- Storage tipo S3

Para um projeto que eu estava desenvolvendo sozinho, foi a escolha certa: **produtividade máxima com segurança enterprise**.

### A Realidade Atual

O sistema está em produção e funciona bem. Porém:

1. **A Agir padronizou tudo em AWS** - faz sentido migrar
2. **Vocês são especialistas em AWS** - não em Supabase
3. **Supabase tem vendor lock-in** - mesmo sendo open-source

Por isso, preparei esta documentação com duas partes:
1. **Como o sistema funciona hoje** (para manutenção imediata)
2. **Como migrar para AWS** (para médio prazo)

### Arquitetura Atual (Simplificada)

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (Vercel)                    │
│              React + TypeScript + MUI                   │
└─────────────────────────┬───────────────────────────────┘
                          │ HTTPS + JWT
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   SUPABASE (BaaS)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │   Auth   │  │ Postgres │  │  Edge    │              │
│  │  (JWT)   │  │  + RLS   │  │ Functions│              │
│  └──────────┘  └──────────┘  └──────────┘              │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              SCRIPTS PYTHON (DigitalOcean)              │
│         Rodam via cron e coletam dados externos         │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              DATA WAREHOUSE (AWS RDS)                   │
│         Dados brutos das catracas (PostgreSQL)          │
└─────────────────────────────────────────────────────────┘
```

### O Que Vocês Precisam Manter

**Prioridade 1 (Crítico):**
- Dashboard de acessos (funcionalidade principal)
- Autenticação e permissões
- Importação de dados das catracas

**Prioridade 2 (Importante):**
- Gestão de escalas médicas
- Gestão de contratos
- Scripts de produtividade

**Prioridade 3 (Diferencial):**
- Insights com IA
- ChatBot
- Busca semântica em documentos

### A Migração para AWS

Não vou entrar em detalhes agora (temos uma seção completa depois), mas o mapeamento mental é:

| Supabase | AWS |
|----------|-----|
| PostgreSQL | RDS PostgreSQL |
| Auth | Cognito User Pools |
| Storage | S3 |
| Edge Functions | Lambda + API Gateway |
| RLS | IAM Policies ou middleware na API |

**Boa notícia:** O frontend React praticamente não muda. A maior parte do trabalho será no backend e na infraestrutura.

### Minha Recomendação

1. **Primeiras 2 semanas**: Foquem em entender o sistema atual
2. **Semanas 3-4**: Comecem a planejar a migração (infra AWS)
3. **Mês 2**: Migrem o banco de dados primeiro (RDS)
4. **Mês 3**: Migrem autenticação (Cognito)
5. **Mês 4+**: Migrem functions e storage

Não tenham pressa. O sistema está estável no Supabase. A migração deve ser feita com cuidado para não quebrar nada.

### Estou à Disposição

Vou estar disponível nas próximas semanas para:
- Reuniões de handover
- Tirar dúvidas específicas
- Revisar o plano de migração

Agora, vamos à documentação técnica detalhada.

---

# 2. VISÃO GERAL DO SISTEMA

## 2.1 Funcionalidades Principais

### Dashboard de Acessos (`/dashboard`)

**O que é:** A tela principal do sistema. Mostra quem acessou as unidades hospitalares.

**Dados exibidos:**
- Total de pessoas que acessaram no período
- Total de horas trabalhadas
- Média de horas por pessoa
- Tabela detalhada com nome, CPF, tipo, horas, entradas/saídas

**Filtros disponíveis:**
- Tipo de colaborador
- Matrícula
- Nome (busca parcial)
- CPF
- Período (data início/fim)

**Regra de negócio importante:**
O cálculo de horas funciona "pareando" entradas e saídas:
- Cada entrada (sentido 'E') é pareada com a próxima saída (sentido 'S')
- Se houver entrada sem saída, não conta as horas
- Se houver saída sem entrada, ignora

### Escalas Médicas (`/escalas`)

**O que é:** Gestão de plantões médicos programados.

**Funcionalidades:**
- Criar escalas individuais ou em lote (via CSV)
- Associar médicos a um plantão (campo JSONB)
- Definir horários de entrada/saída
- Sistema de aprovação com 7 status:
  - `programado` → `confirmado` → `aprovado_pela_agir` → `em_andamento` → `concluido` → `cancelado` → `recusado`

**Regra de negócio importante:**
O status é recalculado automaticamente todo dia às 14h por um script Python que compara:
- Horas agendadas vs. horas trabalhadas (da tabela `acessos`)
- Se o médico trabalhou ≥ 80% do agendado → status avança
- Se faltou → status pode ser `recusado`

### Gestão de Contratos (`/contratos`)

**O que é:** Cadastro de contratos com empresas terceirizadas.

**Campos principais:**
- Nome do contrato
- Empresa contratada
- Data de início/fim
- Unidade hospitalar vinculada
- Status (ativo/inativo)
- Valor total do contrato

**Itens de contrato:**
Cada contrato pode ter múltiplos itens (serviços contratados):
- Ex: "Médico cardiologista", "Enfermeiro", "Técnico de enfermagem"
- Cada item tem quantidade, valor unitário e valor total

### Insights com IA (`/insights-ia`)

**O que é:** ChatBot que responde perguntas sobre os dados em linguagem natural.

**Como funciona:**
1. Usuário digita: "Quantas horas os médicos trabalharam em janeiro?"
2. Edge Function classifica a pergunta
3. Gera SQL automaticamente ou busca em documentos (RAG)
4. Chama OpenAI GPT-4o
5. Retorna resposta em português

**Tipos de pergunta:**
- **SQL Query**: Perguntas sobre dados estruturados ("quantos acessos em janeiro?")
- **RAG (Retrieval Augmented Generation)**: Perguntas sobre documentos ("o que o contrato X diz sobre horas extras?")
- **Híbrido**: Combina os dois

### Gestão de Usuários (`/usuarios`)

**O que é:** CRUD de usuários do sistema.

**4 tipos de usuário:**
| Tipo | Acesso |
|------|--------|
| `administrador-agir-corporativo` | Acesso total, todas as unidades |
| `administrador-agir-planta` | Admin de uma unidade específica |
| `administrador-terceiro` | Admin do parceiro terceirizado |
| `terceiro` | Apenas próprios dados |

### Unidades Hospitalares (`/unidades`)

**O que é:** Cadastro de hospitais/unidades da Agir.

**Campos:**
- Código (ex: "HMD", "HPM")
- Nome completo
- Endereço
- Status ativo/inativo

## 2.2 Fluxo de Uso Típico

### Cenário 1: Gestor da Agir quer ver horas trabalhadas

1. Login no sistema
2. Vai para Dashboard
3. Aplica filtro: Unidade = "HMD", Período = "01/03/2026 a 31/03/2026"
4. Vê total de horas: 1.240h
5. Exporta relatório para CSV
6. Usa no fechamento mensal com a terceirizada

### Cenário 2: Admin Terceiro quer confirmar escala

1. Login no sistema
2. Vai para Escalas
3. Cria nova escala (ou importa CSV)
4. Status inicial: `programado`
5. Gestor da Agir revisa e muda para `confirmado`
6. No dia seguinte, script recalcula e muda para `aprovado_pela_agir` se horas baterem

### Cenário 3: Usuário quer saber algo sobre os dados

1. Login no sistema
2. Vai para Insights IA
3. Digita: "Qual contrato tem mais horas trabalhadas?"
4. ChatBot responde: "O contrato XYZ tem 2.340h trabalhadas em março..."
5. Usuário pode fazer follow-up: "E qual a média por médico?"

## 2.3 Modelo de Dados (Simplificado)

```
┌──────────────────┐       ┌──────────────────┐
│    usuarios      │       │    contratos     │
├──────────────────┤       ├──────────────────┤
│ id (PK, FK auth) │───┐   │ id (PK)          │
│ email            │   │   │ nome             │
│ nome             │   │   │ empresa          │
│ cpf              │   │   │ data_inicio      │
│ tipo             │   │   │ unidade_id (FK)  │
│ contrato_id (FK) │   │   │ ativo            │
│ unidade_id (FK)  │   │   └──────────────────┘
└──────────────────┘   │            │
                       │            ▼
┌──────────────────┐   │   ┌──────────────────┐
│     acessos      │   │   │  contrato_itens  │
├──────────────────┤   │   ├──────────────────┤
│ id (PK)          │   │   │ id (PK)          │
│ tipo             │   │   │ contrato_id (FK) │
│ matricula        │   │   │ item_id (FK)     │
│ nome             │   │   │ quantidade       │
│ cpf              │   │   │ valor_unitario   │
│ data_acesso      │   │   │ valor_total      │
│ sentido (E/S)    │   │   └──────────────────┘
│ unidade_id (FK)  │   │
└──────────────────┘   │   ┌──────────────────┐
                       │   │ escalas_medicas  │
┌──────────────────┐   │   ├──────────────────┤
│  produtividade   │   │   │ id (PK)          │
├──────────────────┤   │   │ contrato_id (FK) │
│ id (PK)          │   │   │ data_inicio      │
│ cpf              │   │   │ medicos (JSONB)  │
│ data             │   │   │ status           │
│ horas_trabalhadas│   │   │ item_contrato_id │
│ horas_agendadas  │   │   └──────────────────┘
│ unidade_id (FK)  │   │
└──────────────────┘   │   ┌──────────────────┐
                       └──▶│ unidades_hosp.   │
                           ├──────────────────┤
                           │ id (PK)          │
                           │ codigo           │
                           │ nome             │
                           └──────────────────┘
```

---

# 3. ARQUITETURA TÉCNICA

## 3.1 Diagrama de Arquitetura Completo

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            CAMADA DE APRESENTAÇÃO                       │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    FRONTEND (Vercel)                            │   │
│  │  React 18 + TypeScript + Vite + Material-UI + Tailwind          │   │
│  │                                                                 │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌───────────┐ │   │
│  │  │  Dashboard │  │  Escalas   │  │ Contratos  │  │ Insights  │ │   │
│  │  │   Page     │  │   Page     │  │   Page     │  │   Page    │ │   │
│  │  └────────────┘  └────────────┘  └────────────┘  └───────────┘ │   │
│  │                                                                 │   │
│  │  ┌───────────────────────────────────────────────────────────┐ │   │
│  │  │              Contextos Globais                            │ │   │
│  │  │  AuthContext (estado de login, usuário, permissões)      │ │   │
│  │  │  ThemeContext (tema claro/escuro)                        │ │   │
│  │  └───────────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS + JWT Token
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            CAMADA DE BACKEND                            │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    SUPABASE (BaaS)                              │   │
│  │                                                                 │   │
│  │  ┌───────────────────────────────────────────────────────────┐ │   │
│  │  │  Supabase Auth (JWT)                                      │ │   │
│  │  │  - Login/logout                                           │ │   │
│  │  │  - Refresh token automático                               │ │   │
│  │  │  - Recuperação de senha                                   │ │   │
│  │  └───────────────────────────────────────────────────────────┘ │   │
│  │                                                                 │   │
│  │  ┌───────────────────────────────────────────────────────────┐ │   │
│  │  │  PostgreSQL Database                                      │ │   │
│  │  │  - Tabelas: usuarios, acessos, contratos, escalas, etc.   │ │   │
│  │  │  - Row Level Security (RLS) para autorização              │ │   │
│  │  │  - pgvector para busca semântica (IA)                     │ │   │
│  │  │  - Views materializadas para performance                  │ │   │
│  │  └───────────────────────────────────────────────────────────┘ │   │
│  │                                                                 │   │
│  │  ┌───────────────────────────────────────────────────────────┐ │   │
│  │  │  Edge Functions (Deno/TypeScript)                         │ │   │
│  │  │  - chat-gateway: Roteamento de perguntas do ChatBot       │ │   │
│  │  │  - gerar-insights: Análise automática diária              │ │   │
│  │  │  - processar-documento: Upload e vetorização de PDFs      │ │   │
│  │  └───────────────────────────────────────────────────────────┘ │   │
│  │                                                                 │   │
│  │  ┌───────────────────────────────────────────────────────────┐ │   │
│  │  │  Supabase Storage (S3-like)                               │ │   │
│  │  │  - Bucket: documentos-gestao                              │ │   │
│  │  │  - PDFs de contratos, documentos oficiais                 │ │   │
│  │  └───────────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ PostgreSQL Connection (Service Role Key)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         AUTOMAÇÃO PYTHON                                │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  DigitalOcean Droplet (Ubuntu)                                  │   │
│  │                                                                 │   │
│  │  ┌───────────────────────────────────────────────────────────┐ │   │
│  │  │  Scripts Python (via cron)                                │ │   │
│  │  │  - importar-ultimos-10000-acessos.py (diário 06:00)       │ │   │
│  │  │  - coletar-produtividade-mv.py (diário 02:00)             │ │   │
│  │  │  - recalcular-status-diario.py (diário 14:00)             │ │   │
│  │  └───────────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ PostgreSQL Connection
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      DATA WAREHOUSE (AWS RDS)                           │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  db-rds-postgres.cx4bovrfmkbp.sa-east-1.rds.amazonaws.com       │   │
│  │  - Tabela: acessos_brutos (dados das catracas)                  │   │
│  │  - Dados históricos de anos                                     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ API Externa
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      SERVIÇOS EXTERNOS                                  │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                 │
│  │   OpenAI     │  │  Portal MV   │  │  Catracas    │                 │
│  │   GPT-4o     │  │  (Scraping)  │  │  (Dados)     │                 │
│  └──────────────┘  └──────────────┘  └──────────────┘                 │
└─────────────────────────────────────────────────────────────────────────┘
```

## 3.2 Stack Tecnológico Detalhado

### Frontend

| Tecnologia | Versão | Finalidade |
|------------|--------|------------|
| React | 18.2.0 | Framework UI |
| TypeScript | 5.2.2 | Tipagem estática |
| Vite | 5.1.0 | Build tool (substitui Webpack) |
| Material-UI | 5.15.10 | Componentes UI |
| Tailwind CSS | 3.4.1 | Estilos utilitários |
| React Router | 6.22.0 | Navegação entre páginas |
| MUI DataGrid | 6.19.4 | Tabelas avançadas |
| MUI Date Pickers | 6.19.4 | Seleção de datas |
| Recharts | 3.3.0 | Gráficos |
| jsPDF | 3.0.3 | Geração de PDFs |
| PapaParse | 5.5.3 | Leitura/escrita CSV |
| date-fns | 2.30.0 | Manipulação de datas |
| React Markdown | 10.1.0 | Renderizar respostas do ChatBot |

### Backend (Supabase)

| Tecnologia | Finalidade |
|------------|------------|
| PostgreSQL 13 | Banco de dados principal |
| Supabase Auth | Autenticação JWT |
| Row Level Security | Autorização no banco |
| Edge Functions (Deno) | Functions serverless |
| Supabase Storage | Armazenamento de arquivos |
| pgvector | Embeddings para IA |

### Automação Python

| Biblioteca | Versão | Finalidade |
|------------|--------|------------|
| psycopg2-binary | 2.9.9 | Conexão PostgreSQL |
| supabase | 2.22.0 | Cliente Supabase Python |
| python-dotenv | 1.0.0 | Variáveis de ambiente |
| selenium | 4.x | Web scraping |
| tqdm | 4.x | Barras de progresso |

### Infraestrutura

| Serviço | Provedor | Finalidade |
|---------|----------|------------|
| Vercel | Vercel Inc. | Hospedagem frontend (CDN global) |
| Supabase | Supabase Inc. | Backend completo (PostgreSQL + Auth) |
| DigitalOcean Droplet | DigitalOcean | Scripts Python (cron jobs) |
| AWS RDS | Amazon | Data warehouse (dados das catracas) |
| OpenAI API | OpenAI | Geração de insights com IA |

## 3.3 Estrutura de Diretórios

```
gestaodeacesso/
├── src/
│   ├── App.tsx                    # Configuração de rotas
│   ├── main.tsx                   # Ponto de entrada React
│   ├── index.css                  # Estilos globais
│   │
│   ├── components/                # Componentes reutilizáveis
│   │   ├── auth/
│   │   │   └── ProtectedRoute.tsx # Wrapper de autorização
│   │   ├── layout/
│   │   │   └── Layout.tsx         # Sidebar + Header
│   │   ├── dashboard/
│   │   │   ├── FilterSection.tsx  # Filtros do dashboard
│   │   │   └── MetricCard.tsx     # Cards de métricas
│   │   ├── ChatBot.tsx            # Componente do ChatBot
│   │   └── DeleteConfirmDialog.tsx
│   │
│   ├── contexts/                  # Contextos React (estado global)
│   │   ├── AuthContext.tsx        # Autenticação e usuário
│   │   └── ThemeContext.tsx       # Tema claro/escuro
│   │
│   ├── features/                  # Módulos por funcionalidade
│   │   ├── dashboard/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   ├── types/
│   │   │   └── utils/
│   │   └── escalas-medicas/
│   │       ├── components/
│   │       ├── hooks/
│   │       ├── services/
│   │       ├── types/
│   │       └── utils/
│   │
│   ├── hooks/                     # Hooks customizados
│   │   ├── useContractExpirationAlert.ts
│   │   ├── useDashboardData.ts
│   │   ├── useContractCPFs.ts
│   │   └── usePersistentState.ts
│   │
│   ├── lib/                       # Bibliotecas core
│   │   ├── supabase.ts            # Cliente Supabase
│   │   └── theme.ts               # Configuração tema MUI
│   │
│   ├── pages/                     # Páginas (rotas)
│   │   ├── Login.tsx
│   │   ├── ForgotPassword.tsx
│   │   ├── ResetPassword.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Usuarios.tsx
│   │   ├── Contratos.tsx
│   │   ├── Itens.tsx
│   │   ├── Parceiros.tsx
│   │   ├── UnidadesHospitalares.tsx
│   │   └── InsightsIA.tsx
│   │
│   ├── services/                  # Serviços de API
│   │   ├── chatService.ts
│   │   └── statusAnalysisService.ts
│   │
│   ├── types/                     # Tipos TypeScript
│   │   └── database.types.ts      # Tipos gerados do Supabase
│   │
│   └── utils/                     # Funções utilitárias
│       ├── dateUtils.ts
│       ├── hoursCalculation.ts
│       └── csvExport.ts
│
├── supabase/                      # Configuração Supabase
│   ├── config.toml
│   └── functions/                 # Edge Functions
│       ├── chat-gateway/
│       │   ├── index.ts
│       │   ├── classificador.ts
│       │   ├── gerador-sql.ts
│       │   ├── recuperador-rag.ts
│       │   └── hibrido.ts
│       ├── gerar-insights/
│       │   └── index.ts
│       └── processar-documento/
│           └── index.ts
│
├── migrations/                    # Migrações SQL (25 arquivos)
│   ├── 000_pre_migration_fix.sql
│   ├── 001_multi_tenancy_setup.sql
│   ├── ...
│   └── 025_storage_gestao.sql
│
├── public/                        # Assets estáticos
│   ├── logodaagir.png
│   └── apresentacao-parceria.html
│
├── .env                           # Variáveis de ambiente (NÃO COMMITAR)
├── .env.example                   # Exemplo de .env
├── package.json                   # Dependências npm
├── tsconfig.json                  # Config TypeScript
├── vite.config.ts                 # Config Vite
├── tailwind.config.js             # Config Tailwind
├── requirements.txt               # Dependências Python
└── README.md                      # Documentação básica
```

---

# 4. FRONTEND - REACT + TYPESCRIPT

## 4.1 Configuração e Execução

### Instalação

```bash
# Clonar repositório
git clone <url-do-repositorio>
cd gestaodeacesso

# Instalar dependências
npm install

# Copiar variáveis de ambiente
cp .env.example .env
# Editar .env com as credenciais do Supabase

# Rodar em desenvolvimento
npm run dev
# Abre em http://localhost:5173
```

### Scripts Disponíveis

```bash
npm run dev          # Desenvolvimento (hot reload)
npm run build        # Build de produção (pasta dist/)
npm run build:check  # Type check + build
npm run lint         # ESLint
npm run preview      # Preview da build
```

### Variáveis de Ambiente (.env)

```env
# URL do projeto Supabase
VITE_SUPABASE_URL=https://qszqzdnlhxpglllyqtht.supabase.co

# Chave pública (anon key) - segura para frontend
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Chave de serviço (service role) - NUNCA expor no frontend!
# Usada apenas nos scripts Python
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**IMPORTANTE:**
- `ANON_KEY`: Pode ser exposta no frontend (RLS protege os dados)
- `SERVICE_ROLE_KEY`: Chave administrativa, apenas para backend/scripts

## 4.2 Rotas da Aplicação

| Rota | Componente | Permissão | Descrição |
|------|------------|-----------|-----------|
| `/login` | Login | Público | Tela de login |
| `/forgot-password` | ForgotPassword | Público | Recuperação de senha |
| `/reset-password` | ResetPassword | Token | Reset via token |
| `/dashboard` | Dashboard | Admin Agir Any | Dashboard principal |
| `/usuarios` | Usuarios | Admin Agir | Gestão de usuários |
| `/contratos` | Contratos | Admin/Contrato | Gestão de contratos |
| `/itens` | Itens | Admin Agir | Itens de contrato |
| `/parceiros` | Parceiros | Admin Agir | Parceiros |
| `/unidades` | UnidadesHospitalares | Admin Agir | Unidades hospitalares |
| `/escalas` | EscalasMedicas | Admin/Escala | Escalas médicas |
| `/insights-ia` | InsightsIA | Admin Corporativo | ChatBot IA |
| `/` | Redirect | Autenticado | Redireciona para /escalas |

## 4.3 Componentes Principais

### 4.3.1 AuthContext (`src/contexts/AuthContext.tsx`)

**O que faz:** Gerencia todo o estado de autenticação da aplicação.

**Estado disponibilizado:**

```typescript
interface AuthContextType {
  user: User | null;                    // Usuário do Supabase Auth
  userProfile: UserProfile | null;      // Perfil da tabela 'usuarios'
  loading: boolean;
  
  // Helpers de permissão
  isAdminAgirCorporativo: boolean;
  isAdminAgirPlanta: boolean;
  isAdminTerceiro: boolean;
  isTerceiro: boolean;
  
  // Métodos
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
}
```

**Como usar:**

```typescript
import { useAuth } from '../contexts/AuthContext';

function MeuComponente() {
  const { user, userProfile, isAdminAgir, signOut } = useAuth();
  
  return (
    <div>
      <p>Olá, {userProfile?.nome}</p>
      {isAdminAgir && <button>Ação de Admin</button>}
      <button onClick={signOut}>Sair</button>
    </div>
  );
}
```

### 4.3.2 ProtectedRoute (`src/components/auth/ProtectedRoute.tsx`)

**O que faz:** Protege rotas baseado em permissões.

**Props disponíveis:**

```typescript
<ProtectedRoute>
  // Requer qualquer usuário autenticado
</ProtectedRoute>

<ProtectedRoute requireAdminAgir>
  // Requer admin-agir-corporativo OU admin-agir-planta
</ProtectedRoute>

<ProtectedRoute requireAdminAgirCorporativo>
  // Requer especificamente admin-agir-corporativo
</ProtectedRoute>

<ProtectedRoute requireAdminAgirAny>
  // Requer qualquer tipo de admin Agir
</ProtectedRoute>

<ProtectedRoute allowContratosAccess>
  // Permite admin Agir OU admin Terceiro
</ProtectedRoute>

<ProtectedRoute allowEscalasAccess>
  // Permite admin Agir OU admin Terceiro
</ProtectedRoute>
```

**Implementação simplificada:**

```typescript
interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdminAgir?: boolean;
  requireAdminAgirCorporativo?: boolean;
  // ... outras props
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAdminAgir,
  requireAdminAgirCorporativo,
  // ...
}) => {
  const { user, userProfile, loading } = useAuth();
  
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" />;
  
  if (requireAdminAgirCorporativo && !isAdminAgirCorporativo) {
    return <Navigate to="/dashboard" />;
  }
  
  if (requireAdminAgir && !isAdminAgir) {
    return <Navigate to="/dashboard" />;
  }
  
  return <>{children}</>;
};
```

### 4.3.3 Layout (`src/components/layout/Layout.tsx`)

**O que faz:** Layout padrão com sidebar e header.

**Estrutura:**
- Sidebar fixa à esquerda (colapsível em mobile)
- Header no topo com:
  - Toggle de tema (claro/escuro)
  - Informações do usuário
  - Botão de logout
- Área de conteúdo principal

**Sidebar:**
- Logo da Agir
- Menu de navegação (ícones + texto)
- Itens do menu condicionais às permissões

### 4.3.4 Dashboard (`src/pages/Dashboard.tsx`)

**O que faz:** Tela principal de visualização de acessos.

**Estrutura:**
```typescript
function Dashboard() {
  // Hooks customizados
  const { filters, setFilters } = useDashboardFilters();
  const { data, loading, refresh } = useDashboardData(filters);
  const { modals, openModal, closeModal } = useDashboardModals();
  
  // Cálculo de horas
  const hoursByCPF = calculateHoursByCPF(data.acessos);
  
  // Estatísticas
  const stats = {
    totalPessoas: new Set(hoursByCPF.keys()).size,
    totalHoras: sumHours(hoursByCPF),
    mediaHoras: averageHours(hoursByCPF),
  };
  
  return (
    <div>
      <MetricCards stats={stats} />
      <FilterSection filters={filters} onChange={setFilters} />
      <AcessosDataGrid data={data} />
    </div>
  );
}
```

### 4.3.5 ChatBot (`src/components/ChatBot.tsx`)

**O que faz:** Interface do ChatBot de IA.

**Funcionalidades:**
- Input de texto para perguntas
- Histórico de mensagens (usuário + assistente)
- Streaming da resposta (efeito de digitação)
- Renderização de Markdown
- Botão de limpar histórico

**Fluxo:**
1. Usuário digita pergunta
2. Frontend chama Edge Function `chat-gateway`
3. Edge Function processa e chama OpenAI
4. Resposta volta em streaming
5. Frontend renderiza com `react-markdown`

## 4.4 Hooks Customizados

### usePersistentState

**O que faz:** Persiste estado no `sessionStorage`.

**Por que existe:** Manter filtros do dashboard após refresh da página.

**Uso:**

```typescript
const [filters, setFilters] = usePersistentState(
  "dashboard-filters",
  defaultFilters
);
```

**Implementação simplificada:**

```typescript
function usePersistentState<T>(
  key: string,
  defaultValue: T
): [T, (value: T) => void] {
  const [state, setState] = useState<T>(() => {
    const stored = sessionStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  });
  
  const setValue = (value: T) => {
    setState(value);
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      // Quota exceeded, ignorar
    }
  };
  
  return [state, setValue];
}
```

### useDashboardData

**O que faz:** Centraliza toda lógica de busca de dados do dashboard.

**Retorna:**
```typescript
{
  data: { acessos: [], contratos: [] };
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}
```

**Implementação:**

```typescript
function useDashboardData(filters: Filters) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      
      // Buscar acessos com filtros
      const { data: acessos } = await supabase
        .from('acessos')
        .select('*')
        .eq('cpf', filters.cpf)
        .gte('data_acesso', filters.dataInicio)
        .lte('data_acesso', filters.dataFim);
      
      setData({ acessos });
      setLoading(false);
    }
    
    fetchData();
  }, [filters]);
  
  return { data, loading, refresh: () => {/* ... */} };
}
```

### useContractCPFs

**O que faz:** Busca CPFs de um contrato específico.

**Uso:** Filtrar acessos apenas de colaboradores de um contrato.

```typescript
const cpfs = useContractCPFs(contratoId);
```

## 4.5 Serviços

### dashboardService (`src/features/dashboard/services/dashboardService.ts`)

**O que faz:** Centraliza chamadas de API relacionadas ao dashboard.

```typescript
export const dashboardService = {
  async loadContratos() {
    const { data, error } = await supabase
      .from('contratos')
      .select('*, unidade:unidades_hospitalares(*)')
      .eq('ativo', true);
    
    if (error) throw error;
    return data;
  },
  
  async loadAcessos(filters: FilterParams) {
    let query = supabase.from('acessos').select('*');
    
    if (filters.cpf) query = query.eq('cpf', filters.cpf);
    if (filters.tipo) query = query.eq('tipo', filters.tipo);
    if (filters.dataInicio) query = query.gte('data_acesso', filters.dataInicio);
    if (filters.dataFim) query = query.lte('data_acesso', filters.dataFim);
    
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
  
  async loadProdutividade(dateRange: DateRange) {
    // ... similar
  },
};
```

### chatService (`src/services/chatService.ts`)

**O que faz:** Chama Edge Function do ChatBot.

```typescript
export async function sendMessageToChat(
  message: string,
  conversationId?: string
) {
  const { data, error } = await supabase.functions.invoke('chat-gateway', {
    body: {
      message,
      conversation_id: conversationId,
    },
  });
  
  if (error) throw error;
  return data;
}
```

## 4.6 Utilitários

### hoursCalculation (`src/utils/hoursCalculation.ts`)

**O que faz:** Calcula horas trabalhadas a partir de acessos.

**Algoritmo:**

```typescript
export function calculateHoursByCPF(acessos: Acesso[]) {
  // Agrupar por CPF
  const byCPF = groupBy(acessos, 'cpf');
  
  const hoursMap = new Map<string, number>();
  
  for (const [cpf, acessosDoCPF] of byCPF.entries()) {
    // Ordenar por data
    const sorted = sort(acessosDoCPF, 'data_acesso');
    
    let totalMinutes = 0;
    let entrada: Acesso | null = null;
    
    for (const acesso of sorted) {
      if (acesso.sentido === 'E') {
        // Guardar entrada
        entrada = acesso;
      } else if (acesso.sentido === 'S' && entrada) {
        // Calcular diferença
        const minutes = differenceInMinutes(
          new Date(acesso.data_acesso),
          new Date(entrada.data_acesso)
        );
        totalMinutes += minutes;
        entrada = null;
      }
    }
    
    hoursMap.set(cpf, minutesToHours(totalMinutes));
  }
  
  return hoursMap;
}
```

### csvExport (`src/utils/csvExport.ts`)

**O que faz:** Exporta dados para CSV.

```typescript
export function exportToCSV(data: any[], filename: string) {
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  
  URL.revokeObjectURL(url);
}
```

## 4.7 Build e Deploy

### Build Local

```bash
# Type check
npm run build:check

# Build de produção
npm run build
# Gera pasta dist/ com arquivos otimizados

# Preview
npm run preview
```

### Deploy na Vercel

**Configuração:**
- Conectar repositório GitHub na Vercel
- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`

**Variáveis de ambiente na Vercel:**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

**Deploy automático:**
- Push na branch `main` → Deploy em produção
- Pull requests → Deploy de preview

---

# 5. BACKEND - SUPABASE DETALHADO

## 5.1 O Que é Supabase?

**Supabase** é uma "Backend as a Service" (BaaS) open-source, frequentemente chamado de "alternativa open-source ao Firebase".

**O que fornece:**
1. **PostgreSQL gerenciado** - Banco de dados relacional completo
2. **Autenticação** - Sistema JWT integrado (igual Firebase Auth)
3. **APIs automáticas** - REST e Real-time geradas automaticamente
4. **Row Level Security** - Autorização no nível do banco de dados
5. **Storage** - Armazenamento de arquivos (tipo S3)
6. **Edge Functions** - Functions serverless (Deno/TypeScript)

**Por que foi escolhido:**
- PostgreSQL é robusto e familiar para devs
- RLS permite segurança sem criar backend próprio
- APIs automáticas aceleram desenvolvimento
- Open-source (menos vendor lock-in que Firebase)
- Hospedagem gerenciada (sem gerenciar servidores)

## 5.2 Cliente Supabase no Frontend

**Arquivo:** `src/lib/supabase.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Variáveis de ambiente do Supabase não configuradas');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,    // Renova token automaticamente
    persistSession: true,      // Mantém sessão no localStorage
    detectSessionInUrl: true,  // Detecta token na URL (reset password)
  },
});
```

**Tipos TypeScript:**
- `Database`: Tipos gerados automaticamente pelo Supabase CLI
- Inclui todas as tabelas, colunas e relações

## 5.3 Autenticação no Supabase

### 5.3.1 Como Funciona

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Usuário digita email/senha no formulário de login            │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Frontend chama:                                              │
│    supabase.auth.signInWithPassword({ email, password })        │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼ HTTPS
┌─────────────────────────────────────────────────────────────────┐
│ 3. Supabase valida em auth.users (tabela interna)               │
│    - Senha hasheada com bcrypt                                  │
│    - Verifica email confirmado (se configurado)                 │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Supabase gera tokens JWT:                                    │
│    - Access token (válido por 1 hora)                           │
│    - Refresh token (válido por 30 dias)                         │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Frontend armazena tokens no localStorage automaticamente     │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. AuthContext busca perfil do usuário:                         │
│    supabase.from('usuarios').select('*').eq('id', user.id)      │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. Redirect para /escalas (página inicial após login)           │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3.2 Métodos de Autenticação

```typescript
// Login
const { user, error } = await supabase.auth.signInWithPassword({
  email: 'usuario@exemplo.com',
  password: 'senha123',
});

// Logout
await supabase.auth.signOut();

// Recuperação de senha
await supabase.auth.resetPasswordForEmail('usuario@exemplo.com', {
  redirectTo: 'https://parceria.com/reset-password',
});

// Atualizar senha (após reset)
await supabase.auth.updateUser({
  password: 'novaSenha123',
});

// Escutar mudanças de autenticação
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    // Usuário logou
  }
  if (event === 'SIGNED_OUT') {
    // Usuário deslogou
  }
});
```

### 5.3.3 JWT Token

**Estrutura do token:**
```json
{
  "aud": "authenticated",
  "exp": 1709395200,
  "sub": "uuid-do-usuario",
  "email": "usuario@exemplo.com",
  "role": "authenticated"
}
```

**Cabeçalho de requisição:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Auto-refresh:**
- Token expira em 1 hora
- `autoRefreshToken: true` renova 10 minutos antes de expirar
- Transparente para o usuário

## 5.4 Row Level Security (RLS)

### 5.4.1 O Que é RLS?

**Row Level Security** é uma funcionalidade nativa do PostgreSQL que permite definir políticas de acesso **no nível das linhas do banco de dados**.

**Diferença para abordagem tradicional:**

| Tradicional (Node/PHP) | Com RLS (Supabase) |
|------------------------|---------------------|
| Valida permissão no backend | Valida no próprio banco |
| Se vazar credencial, acessa tudo | Mesmo com credencial, só vê o que pode |
| Lógica duplicada em vários lugares | Lógica centralizada no banco |

### 5.4.2 Como Ativar RLS

```sql
-- Ativar RLS em uma tabela
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- Após ativar, NENHUMA linha é retornada até criar políticas
```

### 5.4.3 Políticas de Exemplo

**Política 1: Usuário vê o próprio perfil**

```sql
CREATE POLICY "Usuarios podem ver proprio perfil"
ON usuarios FOR SELECT
USING (auth.uid() = id);
```

**Explicação:**
- `auth.uid()`: Função do Supabase que retorna UUID do usuário logado
- `id`: Campo da tabela `usuarios`
- Se forem iguais, a linha é retornada

**Política 2: Admin Agir vê todos os usuários**

```sql
CREATE POLICY "Admin Agir ve todos usuarios"
ON usuarios FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid()
    AND tipo IN ('administrador-agir-corporativo', 'administrador-agir-planta')
  )
);
```

**Política 3: Terceiro vê apenas seus próprios acessos**

```sql
CREATE POLICY "Terceiro ve proprios acessos"
ON acessos FOR SELECT
USING (
  cpf IN (
    SELECT cpf FROM usuarios WHERE id = auth.uid()
  )
);
```

**Política 4: Admin Terceiro vê acessos do seu contrato**

```sql
CREATE POLICY "Admin Terceiro ve acessos do contrato"
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
```

### 5.4.4 Tipos de Operação

Cada política pode ser para:

- `SELECT`: Leitura de dados
- `INSERT`: Inserção de dados
- `UPDATE`: Atualização de dados
- `DELETE`: Exclusão de dados

**Exemplo: Admin pode inserir usuários**

```sql
CREATE POLICY "Admin pode inserir usuarios"
ON usuarios FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid()
    AND tipo IN ('administrador-agir-corporativo', 'administrador-agir-planta')
  )
);
```

### 5.4.5 Vantagens do RLS

1. **Segurança nativa**: Impossível burlar (está no banco)
2. **DRY**: Não repete lógica de permissão no código
3. **Performance**: Filtros aplicados no SQL (muito rápido)
4. **Auditável**: Políticas visíveis no banco
5. **Proteção SQL Injection**: PostgreSQL gerencia

### 5.4.6 Debug de RLS

**Testar se RLS está funcionando:**

```sql
-- No SQL Editor do Supabase

-- 1. Desabilitar RLS temporariamente
ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;

-- 2. Buscar como usuário específico
SET LOCAL request.jwt.claims.sub = 'uuid-do-usuario';
SELECT * FROM usuarios;

-- 3. Reabilitar RLS
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
```

## 5.5 APIs Automáticas do Supabase

O Supabase gera APIs REST automaticamente para cada tabela.

### 5.5.1 SELECT (Buscar Dados)

```typescript
// Buscar todos (respeitando RLS)
const { data, error } = await supabase.from('contratos').select('*');

// Buscar com filtros
const { data, error } = await supabase
  .from('acessos')
  .select('*')
  .eq('cpf', '12345678900')           // WHERE cpf = '...'
  .gte('data_acesso', '2025-01-01')   // WHERE data_acesso >= '...'
  .lte('data_acesso', '2025-01-31')   // WHERE data_acesso <= '...'
  .order('data_acesso', { ascending: false });

// Buscar com colunas específicas
const { data, error } = await supabase
  .from('usuarios')
  .select('id, nome, email, tipo');

// Buscar com JOIN
const { data, error } = await supabase
  .from('usuarios')
  .select(`
    *,
    contrato:contratos(*)
  `);

// Count
const { count, error } = await supabase
  .from('acessos')
  .select('*', { count: 'exact', head: true });
```

### 5.5.2 INSERT (Inserir Dados)

```typescript
// Inserir um registro
const { data, error } = await supabase
  .from('contratos')
  .insert({
    nome: 'Contrato Teste',
    empresa: 'Empresa XYZ',
    data_inicio: '2025-01-01',
    ativo: true,
  })
  .select()  // Retorna o registro inserido

// Inserir múltiplos
const { data, error } = await supabase
  .from('escalas_medicas')
  .insert([
    { data_inicio: '2025-03-01', horario_entrada: '07:00', ... },
    { data_inicio: '2025-03-02', horario_entrada: '07:00', ... },
  ]);
```

### 5.5.3 UPDATE (Atualizar Dados)

```typescript
// Atualizar por ID
const { data, error } = await supabase
  .from('contratos')
  .update({ ativo: false })
  .eq('id', contratoId)
  .select();

// Atualizar múltiplos
const { data, error } = await supabase
  .from('escalas_medicas')
  .update({ status: 'cancelado' })
  .in('id', [id1, id2, id3]);
```

### 5.5.4 DELETE (Deletar Dados)

```typescript
// Deletar por ID
const { data, error } = await supabase
  .from('contratos')
  .delete()
  .eq('id', contratoId);

// Deletar múltiplos
const { data, error } = await supabase
  .from('escalas_medicas')
  .delete()
  .in('id', [id1, id2, id3]);
```

### 5.5.5 Operadores Disponíveis

| Operador | Método | Exemplo |
|----------|--------|---------|
| = | `.eq()` | `.eq('cpf', '123')` |
| ≠ | `.neq()` | `.neq('status', 'cancelado')` |
| > | `.gt()` | `.gt('idade', 18)` |
| ≥ | `.gte()` | `.gte('data', '2025-01-01')` |
| < | `.lt()` | `.lt('valor', 100)` |
| ≤ | `.lte()` | `.lte('valor', 1000)` |
| IN | `.in()` | `.in('id', [1, 2, 3])` |
| LIKE | `.like()` | `.like('nome', '%João%')` |
| IS NULL | `.is()` | `.is('data_fim', null)` |

## 5.6 Edge Functions

### 5.6.1 O Que São?

**Edge Functions** são funções serverless que rodam na edge da rede (perto do usuário).

**Características:**
- Rodam em Deno (runtime TypeScript moderno)
- Deploy global (baixa latência)
- Escalam automaticamente
- Pagamento por uso (primeiros 500k invocações/mês grátis)

### 5.6.2 Estrutura das Functions

```
supabase/functions/
├── chat-gateway/
│   ├── index.ts              # Handler principal
│   ├── classificador.ts      # Classifica tipo de pergunta
│   ├── gerador-sql.ts        # Gera SQL a partir de linguagem natural
│   ├── recuperador-rag.ts    # Busca em documentos (RAG)
│   ├── hibrido.ts            # Combina SQL + RAG
│   └── contexto-usuario.ts   # Busca dados do usuário
│
├── gerar-insights/
│   └── index.ts              # Gera insights automáticos diários
│
└── processar-documento/
    └── index.ts              # Processa e vetoriza PDFs
```

### 5.6.3 Exemplo: chat-gateway

**Arquivo:** `supabase/functions/chat-gateway/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req: Request) => {
  try {
    // Criar cliente Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    
    // Parse do body
    const { message, conversation_id } = await req.json();
    
    // Obter contexto do usuário
    const authHeader = req.headers.get('Authorization')!;
    const { data: { user } } = await supabase.auth.getUser(authHeader);
    
    // Classificar pergunta
    const classificacao = await classificarPergunta(message);
    
    // Processar baseado na classificação
    let resposta: string;
    
    if (classificacao.tipo === 'sql') {
      // Gerar e executar SQL
      resposta = await processarSQL(message, user);
    } else if (classificacao.tipo === 'rag') {
      // Buscar em documentos
      resposta = await processarRAG(message, user);
    } else {
      // Híbrido
      resposta = await processarHibrido(message, user);
    }
    
    // Salvar no histórico
    await supabase.from('historico_chat').insert({
      conversation_id,
      pergunta: message,
      resposta,
      usuario_id: user.id,
    });
    
    return new Response(JSON.stringify({ resposta }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
```

### 5.6.4 Invocar do Frontend

```typescript
// Chamar Edge Function
const { data, error } = await supabase.functions.invoke('chat-gateway', {
  body: {
    message: 'Quantas horas os médicos trabalharam em março?',
    conversation_id: 'uuid-da-conversa',
  },
});

if (error) throw error;
console.log(data.resposta);
```

### 5.6.5 Deploy de Functions

```bash
# Instalar Supabase CLI
npm install -g supabase

# Login
supabase login

# Deploy de uma function
supabase functions deploy chat-gateway

# Deploy de todas
supabase functions deploy
```

## 5.7 Supabase Storage

### 5.7.1 O Que é?

**Supabase Storage** é um serviço de armazenamento de arquivos similar ao S3.

**Usos no ParcerIA:**
- Upload de PDFs de contratos
- Upload de documentos de gestão
- Vetorização para busca semântica (IA)

### 5.7.2 Estrutura

```
Buckets:
└── documentos-gestao/
    ├── contratos/
    │   ├── contrato-001.pdf
    │   └── contrato-002.pdf
    └── documentos/
        ├── doc-001.pdf
        └── doc-002.pdf
```

### 5.7.3 Upload de Arquivo

```typescript
// Upload de PDF
const file = fileInput.files[0];
const { data, error } = await supabase.storage
  .from('documentos-gestao')
  .upload(`contratos/${file.name}`, file);

if (error) throw error;
console.log('URL:', data.path);
```

### 5.7.4 Download de Arquivo

```typescript
// Obter URL pública
const { data } = supabase.storage
  .from('documentos-gestao')
  .getPublicUrl('contratos/contrato-001.pdf');

console.log('URL:', data.publicUrl);

// Ou URL assinada (temporária, para arquivos privados)
const { data } = await supabase.storage
  .from('documentos-gestao')
  .createSignedUrl('contratos/contrato-001.pdf', 60); // 60 segundos
```

### 5.7.5 Políticas de Storage

```sql
-- Permitir upload apenas para admins
CREATE POLICY "Admin pode upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documentos-gestao'
  AND EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid()
    AND tipo = 'administrador-agir-corporativo'
  )
);

-- Permitir download para todos autenticados
CREATE POLICY "Usuario autenticado pode download"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'documentos-gestao');
```

## 5.8 pgvector (Busca Semântica)

### 5.8.1 O Que é?

**pgvector** é uma extensão do PostgreSQL que permite armazenar e buscar vetores (embeddings).

**Uso no ParcerIA:**
- Vetorizar documentos PDF
- Busca semântica ("encontre documentos sobre horas extras")
- RAG (Retrieval Augmented Generation) para o ChatBot

### 5.8.2 Habilitar Extensão

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 5.8.3 Tabela de Embeddings

```sql
CREATE TABLE documentos_embedings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  documento_id UUID REFERENCES documentos(id),
  conteudo TEXT,
  embedding vector(1536),  -- OpenAI ada-002 gera 1536 dimensões
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índice para busca rápida
CREATE INDEX ON documentos_embedings USING ivfflat (embedding vector_cosine_ops);
```

### 5.8.4 Busca Semântica

```sql
-- Buscar documentos similares
SELECT 
  d.nome,
  d.url,
  1 - (e.embedding <=> '[0.1, 0.2, ...]'::vector) AS similaridade
FROM documentos_embedings e
JOIN documentos d ON e.documento_id = d.id
ORDER BY e.embedding <=> '[0.1, 0.2, ...]'::vector
LIMIT 5;
```

### 5.8.5 Gerar Embedding (Edge Function)

```typescript
// Chamar OpenAI para gerar embedding
const response = await fetch('https://api.openai.com/v1/embeddings', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'text-embedding-ada-002',
    input: texto,
  }),
});

const { data } = await response.json();
const embedding = data[0].embedding;

// Salvar no PostgreSQL
await supabase.from('documentos_embedings').insert({
  documento_id,
  conteudo: texto,
  embedding,
});
```

---

# 6. SCRIPTS PYTHON DE AUTOMAÇÃO

## 6.1 Visão Geral

O ParcerIA usa **3 scripts Python principais** que rodam automaticamente via **cron** em um droplet DigitalOcean.

| Script | Horário | Finalidade |
|--------|---------|------------|
| `importar-ultimos-10000-acessos.py` | Diário 06:00 | Importa acessos das catracas |
| `coletar-produtividade-mv.py` | Diário 02:00 | Coleta produtividade do MV |
| `recalcular-status-diario.py` | Diário 14:00 | Recalcula status das escalas |

## 6.2 Ambiente de Execução

### Droplet DigitalOcean

**Configuração:**
- Ubuntu 22.04 LTS
- 1 vCPU / 1GB RAM
- Python 3.10

### Cron Jobs

```bash
# Editar crontab
crontab -e

# Adicionar jobs
0 6 * * * cd /root/parceria && python3 importar-ultimos-10000-acessos.py >> /var/log/parceria/import.log 2>&1
0 2 * * * cd /root/parceria && python3 coletar-produtividade-mv.py >> /var/log/parceria/produtividade.log 2>&1
0 14 * * * cd /root/parceria && python3 recalcular-status-diario.py >> /var/log/parceria/status.log 2>&1
```

### Variáveis de Ambiente

```bash
# Arquivo .env no droplet
SUPABASE_URL=https://qszqzdnlhxpglllyqtht.supabase.co
SUPABASE_SERVICE_ROLE_KEY=chave-service-role
RDS_HOST=db-rds-postgres.cx4bovrfmkbp.sa-east-1.rds.amazonaws.com
RDS_USER=admin
RDS_PASSWORD=senha
OPENAI_API_KEY=sk-...
```

## 6.3 Script 1: Importar Acessos

**Arquivo:** `importar-ultimos-10000-acessos.py`

**O que faz:**
1. Conecta no Data Warehouse (AWS RDS)
2. Busca CPFs da tabela `usuarios` no Supabase
3. Para cada CPF, busca os últimos 50 acessos no RDS
4. Insere na tabela `acessos` do Supabase

**Código simplificado:**

```python
from supabase import create_client
import psycopg2
import os
from datetime import datetime

# Conectar ao Supabase
supabase = create_client(
    os.getenv('SUPABASE_URL'),
    os.getenv('SUPABASE_SERVICE_ROLE_KEY')
)

# Conectar ao RDS
rds_conn = psycopg2.connect(
    host=os.getenv('RDS_HOST'),
    database='parceria',
    user=os.getenv('RDS_USER'),
    password=os.getenv('RDS_PASSWORD')
)

# Buscar CPFs dos usuários
usuarios = supabase.table('usuarios').select('cpf').execute()

for usuario in usuarios.data:
    cpf = usuario['cpf']
    
    # Buscar últimos 50 acessos no RDS
    with rds_conn.cursor() as cursor:
        cursor.execute("""
            SELECT tipo, matricula, nome, cpf, data_acesso, sentido, cod_planta
            FROM acessos_brutos
            WHERE cpf = %s
            ORDER BY data_acesso DESC
            LIMIT 50
        """, (cpf,))
        
        acessos = cursor.fetchall()
    
    # Inserir no Supabase
    for acesso in acessos:
        supabase.table('acessos').insert({
            'tipo': acesso[0],
            'matricula': acesso[1],
            'nome': acesso[2],
            'cpf': cpf,
            'data_acesso': acesso[3].isoformat(),
            'sentido': acesso[4],
            'cod_planta': acesso[5],
        }).execute()
```

## 6.4 Script 2: Coletar Produtividade

**Arquivo:** `coletar-produtividade-mv.py`

**O que faz:**
1. Usa Selenium para acessar portal web do sistema MV
2. Faz login com credenciais
3. Navega até relatório de produtividade
4. Extrai métricas (cirurgias, consultas, etc.)
5. Salva na tabela `produtividade` do Supabase

**Métricas coletadas:**
- Cirurgias realizadas
- Consultas médicas
- Exames realizados
- Horas trabalhadas
- Entre outras (13 métricas no total)

**Código simplificado:**

```python
from selenium import webdriver
from selenium.webdriver.common.by import By
from supabase import create_client
import os

# Configurar Selenium
options = webdriver.ChromeOptions()
options.add_argument('--headless')
driver = webdriver.Chrome(options=options)

# Acessar portal
driver.get('https://portal.mv.com.br')

# Login
driver.find_element(By.ID, 'username').send_keys(os.getenv('MV_USER'))
driver.find_element(By.ID, 'password').send_keys(os.getenv('MV_PASS'))
driver.find_element(By.ID, 'login-btn').click()

# Navegar até produtividade
driver.get('https://portal.mv.com.br/produtividade')

# Extrair dados
# ... lógica de scraping ...

# Salvar no Supabase
supabase = create_client(
    os.getenv('SUPABASE_URL'),
    os.getenv('SUPABASE_SERVICE_ROLE_KEY')
)

supabase.table('produtividade').insert(dados).execute()

driver.quit()
```

## 6.5 Script 3: Recalcular Status

**Arquivo:** `recalcular-status-diario.py`

**O que faz:**
1. Busca todas as escalas com status `confirmado` ou `aprovado_pela_agir`
2. Para cada escala, busca horas trabalhadas na tabela `acessos`
3. Compara horas agendadas vs. trabalhadas
4. Atualiza status baseado em regras:
   - Se trabalhou ≥ 80% → `aprovado_pela_agir`
   - Se faltou sem justificativa → `recusado`
   - Se está acontecendo agora → `em_andamento`
   - Se já passou e completou → `concluido`

**Código simplificado:**

```python
from supabase import create_client
from datetime import datetime, time
import os

supabase = create_client(
    os.getenv('SUPABASE_URL'),
    os.getenv('SUPABASE_SERVICE_ROLE_KEY')
)

# Buscar escalas ativas
escalas = supabase.table('escalas_medicas').select('''
    *,
    acessos:acessos(*)
''').in_('status', ['confirmado', 'aprovado_pela_agir']).execute()

for escala in escalas.data:
    # Calcular horas agendadas
    entrada = datetime.strptime(escala['horario_entrada'], '%H:%M')
    saida = datetime.strptime(escala['horario_saida'], '%H:%M')
    horas_agendadas = (saida - entrada).seconds / 3600
    
    # Calcular horas trabalhadas (dos acessos)
    horas_trabalhadas = calcular_horas(escala['acessos'])
    
    # Determinar novo status
    if horas_trabalhadas >= horas_agendadas * 0.8:
        novo_status = 'aprovado_pela_agir'
    elif horas_trabalhadas == 0:
        novo_status = 'recusado'
    else:
        novo_status = 'em_andamento'
    
    # Atualizar
    supabase.table('escalas_medicas').update({
        'status': novo_status,
        'horas_trabalhadas': horas_trabalhadas,
    }).eq('id', escala['id']).execute()
```

## 6.6 Dependências Python

**Arquivo:** `requirements.txt`

```
psycopg2-binary==2.9.9    # Conexão PostgreSQL
supabase>=2.22.0          # Cliente Supabase
python-dotenv==1.0.0      # Variáveis de ambiente
selenium>=4.0.0           # Web scraping
tqdm>=4.0.0               # Barras de progresso
pandas>=2.0.0             # Manipulação de dados
```

**Instalar:**

```bash
pip install -r requirements.txt
```

## 6.7 Logs e Monitoramento

### Logs dos Scripts

```bash
# Ver logs
tail -f /var/log/parceria/import.log
tail -f /var/log/parceria/produtividade.log
tail -f /var/log/parceria/status.log
```

### Debug de Erros

```bash
# Rodar script manualmente para debug
cd /root/parceria
python3 importar-ultimos-10000-acessos.py
```

### Reiniciar Scripts

```bash
# Se um script travar, matar processo
ps aux | grep python
kill <PID>

# Rodar manualmente
python3 importar-ultimos-10000-acessos.py
```

---

# 7. GUIA DE MIGRAÇÃO PARA AWS

## 7.1 Por Que Migrar?

**Vantagens da migração:**

1. **Conformidade**: Alinhamento com políticas de segurança da Agir
2. **Integração**: Conectividade com outros sistemas Agir (todos na AWS)
3. **Suporte**: Equipe interna já conhece AWS
4. **Escala**: Recursos de auto-scaling da AWS
5. **Compliance**: Dados em território nacional (sa-east-1)
6. **Custos**: Possivelmente menor em escala

**Riscos:**

1. **Complexidade**: AWS tem mais "peças móveis" que Supabase
2. **Tempo**: Migração leva semanas/meses
3. **Bugs**: Risco de introduzir bugs na migração
4. **Downtime**: Possível indisponibilidade durante migração

## 7.2 Mapeamento de Serviços

| Supabase | AWS | Notas |
|----------|-----|-------|
| PostgreSQL | **RDS PostgreSQL** | Versão 13+ recomendada |
| Auth (JWT) | **Cognito User Pools** | Configurar triggers Lambda |
| Storage | **S3** | Com CloudFront para CDN |
| Edge Functions | **Lambda + API Gateway** | Migrar de Deno para Node.js |
| Realtime | **AppSync** ou **WebSocket API** | Se necessário |
| RLS | **IAM + Middleware** | Reimplementar no código |
| pgvector | **RDS + extensão** | Ou Amazon OpenSearch |

## 7.3 Arquitetura AWS Proposta

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
        │ (chat)    │   │ (insights)│   │ (middleware)│
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

## 7.4 Passo a Passo da Migração

### FASE 1: Preparação (Semana 1-2)

#### 1.1 Criar Infraestrutura Base

**VPC e Rede:**

```bash
# Criar VPC
aws ec2 create-vpc \
  --cidr-block 10.0.0.0/16 \
  --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=ParcerIA-VPC}]'

# Criar subnets (mínimo 2 AZs para RDS)
aws ec2 create-subnet \
  --vpc-id vpc-xxx \
  --cidr-block 10.0.1.0/24 \
  --availability-zone sa-east-1a

aws ec2 create-subnet \
  --vpc-id vpc-xxx \
  --cidr-block 10.0.2.0/24 \
  --availability-zone sa-east-1b

# Criar Internet Gateway
aws ec2 create-internet-gateway

# Criar NAT Gateway (para Lambda acessar internet)
aws ec2 create-nat-gateway \
  --subnet-id subnet-xxx \
  --allocation-id eipalloc-xxx
```

**Security Groups:**

```bash
# Security Group para RDS
aws ec2 create-security-group \
  --group-name parceria-db \
  --description "RDS PostgreSQL" \
  --vpc-id vpc-xxx

# Adicionar regra de entrada (apenas Lambda)
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxx \
  --protocol tcp \
  --port 5432 \
  --source-group sg-lambda
```

#### 1.2 Criar RDS PostgreSQL

```bash
aws rds create-db-instance \
  --db-instance-identifier parceria-db \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --engine-version 13.14 \
  --master-username admin \
  --master-user-password <senha-forte> \
  --allocated-storage 100 \
  --vpc-security-group-ids sg-xxx \
  --db-subnet-group-name parceria-subnet-group \
  --backup-retention-period 7 \
  --multi-az \
  --storage-type gp3 \
  --tags Key=Name,Value=ParcerIA-DB
```

**Habilitar pgvector:**

```sql
-- Conectar ao RDS e executar:
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS uuid-ossp;
```

#### 1.3 Criar Cognito User Pool

```bash
aws cognito-idp create-user-pool \
  --pool-name ParcerIA-Pool \
  --username-attributes email \
  --auto-verified-attributes email \
  --password-policy MinLength=6,TemporaryPasswordValidityDays=7 \
  --schema Name=email,Required=true,AttributeDataType=String \
  --mfa-configuration OFF
```

**Configurar App Client:**

```bash
aws cognito-idp create-user-pool-client \
  --user-pool-id sa-east-1_xxx \
  --client-name ParcerIA-Web \
  --explicit-auth-flows ADMIN_NO_SRP_AUTH \
  --allowed-o-auth-flows code \
  --allowed-o-auth-scopes openid email \
  --allowed-o-auth-flows-user-pool-client \
  --callback-url https://parceria.agir.com.br
```

#### 1.4 Criar S3 Buckets

```bash
# Bucket para frontend
aws s3api create-bucket \
  --bucket parceria-frontend \
  --region sa-east-1 \
  --create-bucket-configuration LocationConstraint=sa-east-1

# Bucket para documentos
aws s3api create-bucket \
  --bucket parceria-documentos \
  --region sa-east-1 \
  --create-bucket-configuration LocationConstraint=sa-east-1

# Habilitar versionamento
aws s3api put-bucket-versioning \
  --bucket parceria-documentos \
  --versioning-configuration Status=Enabled
```

### FASE 2: Migração do Banco (Semana 3-4)

#### 2.1 Exportar Dados do Supabase

```bash
# Exportar schema completo
pg_dump -h db.qszqzdnlhxpglllyqtht.supabase.co \
  -U postgres \
  -d postgres \
  --schema-only \
  -f schema_parceria.sql

# Exportar dados (apenas tabelas públicas, não auth)
pg_dump -h db.qszqzdnlhxpglllyqtht.supabase.co \
  -U postgres \
  -d postgres \
  --data-only \
  --exclude-table=auth.* \
  --exclude-table=storage.* \
  -f dados_parceria.sql
```

**Atenção:** A tabela `auth.users` não pode ser exportada diretamente. Será necessário:
1. Exportar dados da tabela `usuarios` (perfil)
2. Recriar usuários no Cognito via script

#### 2.2 Importar no RDS

```bash
# Conectar ao RDS
psql -h parceria-db.xxx.sa-east-1.rds.amazonaws.com \
  -U admin \
  -d parceria

# Executar schema
\i schema_parceria.sql

# Executar dados
\i dados_parceria.sql
```

#### 2.3 Migrar Usuários para Cognito

**Script Python:**

```python
import boto3
import psycopg2

# Conectar ao Supabase para pegar usuários
supabase_conn = psycopg2.connect(
    host='db.qszqzdnlhxpglllyqtht.supabase.co',
    database='postgres',
    user='postgres',
    password='senha'
)

# Criar clientes AWS
cognito = boto3.client('cognito-idp')
user_pool_id = 'sa-east-1_xxx'

# Buscar usuários
with supabase_conn.cursor() as cursor:
    cursor.execute("SELECT id, email, nome, cpf FROM usuarios")
    usuarios = cursor.fetchall()

# Criar no Cognito
for usuario in usuarios:
    user_id, email, nome, cpf = usuario
    
    # Criar usuário com senha temporária
    cognito.admin_create_user(
        UserPoolId=user_pool_id,
        Username=email,
        UserAttributes=[
            {'Name': 'email', 'Value': email},
            {'Name': 'name', 'Value': nome},
            {'Name': 'custom:cpf', 'Value': cpf},
            {'Name': 'custom:user_id', 'Value': user_id},
        ],
        TemporaryPassword='SenhaTemp123!',
        MessageAction='SUPPRESS',  # Não enviar email
    )
    
    # Definir senha permanente (mesma senha temporária)
    cognito.admin_set_user_password(
        UserPoolId=user_pool_id,
        Username=email,
        Password='SenhaTemp123!',
        Permanent=True,
    )
```

### FASE 3: Migração do Frontend (Semana 5)

#### 3.1 Atualizar Autenticação

**Arquivo:** `src/lib/cognito.ts` (novo)

```typescript
import { CognitoUserPool, CognitoUser, AuthenticationDetails } from 'amazon-cognito-identity-js';

const poolData = {
  UserPoolId: 'sa-east-1_xxx',
  ClientId: 'xxx',
};

export const userPool = new CognitoUserPool(poolData);

export function signIn(email: string, password: string) {
  return new Promise((resolve, reject) => {
    const userData = {
      Username: email,
      Password: password,
    };
    
    const authDetails = new AuthenticationDetails(userData);
    
    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: userPool,
    });
    
    cognitoUser.authenticateUser(authDetails, {
      onSuccess: (session) => resolve(session),
      onFailure: (err) => reject(err),
    });
  });
}

export function signOut() {
  const cognitoUser = userPool.getCurrentUser();
  if (cognitoUser) {
    cognitoUser.signOut();
  }
}
```

**Atualizar AuthContext:**

```typescript
// Substituir chamadas do Supabase Auth por Cognito
import { signIn, signOut } from './lib/cognito';

// No lugar de:
// supabase.auth.signInWithPassword({ email, password })
// Usar:
await signIn(email, password);
```

#### 3.2 Atualizar Chamadas de API

**Arquivo:** `src/lib/api.ts` (novo)

```typescript
const API_BASE_URL = 'https://api.parceria.agir.com.br';

async function request(endpoint: string, options: RequestInit = {}) {
  // Obter token do Cognito
  const cognitoUser = userPool.getCurrentUser();
  const session = await new Promise((resolve) => cognitoUser.getSession(resolve));
  const token = session.getAccessToken().getJwtToken();
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error(response.statusText);
  }
  
  return response.json();
}

export const api = {
  async getContratos() {
    return request('/contratos');
  },
  
  async getAcessos(filters: Filters) {
    return request('/acessos', {
      method: 'POST',
      body: JSON.stringify(filters),
    });
  },
  
  // ... outros endpoints
};
```

#### 3.3 Deploy no S3 + CloudFront

```bash
# Build do frontend
npm run build

# Upload para S3
aws s3 sync dist/ s3://parceria-frontend/

# Invalidar cache do CloudFront
aws cloudfront create-invalidation \
  --distribution-id EXXX \
  --paths "/*"
```

### FASE 4: Migração das Functions (Semana 6-8)

#### 4.1 Reescrever Edge Functions para Lambda

**Exemplo: chat-gateway**

**Arquivo:** `lambdas/chat-gateway/index.ts`

```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const body = JSON.parse(event.body!);
    const { message, conversation_id } = body;
    
    // Obter token JWT do header
    const token = event.headers.Authorization?.replace('Bearer ', '');
    
    // Validar token com Cognito
    // ... validação ...
    
    // Classificar pergunta
    const classificacao = await classificarPergunta(message);
    
    // Processar
    let resposta: string;
    if (classificacao.tipo === 'sql') {
      resposta = await processarSQL(message);
    } else {
      resposta = await processarRAG(message);
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({ resposta }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
}
```

#### 4.2 Deploy com SAM ou Terraform

**Exemplo SAM:**

```yaml
# template.yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Resources:
  ChatGatewayFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: parceria-chat-gateway
      CodeUri: lambdas/chat-gateway/
      Handler: index.handler
      Runtime: nodejs18.x
      Timeout: 30
      MemorySize: 256
      Environment:
        Variables:
          RDS_HOST: !Ref RDSHost
          OPENAI_API_KEY: !Ref OpenAIKey
      Events:
        ApiEvent:
          Type: Api
          Properties:
            Path: /chat
            Method: post
```

**Deploy:**

```bash
sam build
sam deploy --guided
```

### FASE 5: Migração do Storage (Semana 9)

#### 5.1 Migrar Arquivos do Supabase Storage para S3

```bash
# Listar arquivos no Supabase Storage
# (via API ou script Python)

# Download local
# ...

# Upload para S3
aws s3 sync ./documentos s3://parceria-documentos/
```

#### 5.2 Atualizar Frontend para Usar S3

```typescript
// Gerar URL assinada via Lambda
export async function getDocumentoUrl(documentoId: string) {
  const response = await api.post('/documentos/url', { documentoId });
  return response.url;  // URL assinada do S3
}

// Usar no componente
<img src={await getDocumentoUrl(docId)} />
```

### FASE 6: Implementar Middleware de Autorização (Semana 10-12)

#### 6.1 Lambda Authorizer

**Arquivo:** `lambdas/authorizer/index.ts`

```typescript
import { APIGatewayAuthorizerResult } from 'aws-lambda';

export async function handler(event: any): Promise<APIGatewayAuthorizerResult> {
  const token = event.authorizationToken?.replace('Bearer ', '');
  
  // Validar token com Cognito
  const user = await validarToken(token);
  
  // Buscar perfil do usuário no RDS
  const perfil = await buscarPerfil(user.id);
  
  // Gerar policy
  const policy = {
    principalId: user.id,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [{
        Action: 'execute-api:Invoke',
        Effect: perfil ? 'Allow' : 'Deny',
        Resource: event.methodArn,
      }],
    },
    context: {
      userType: perfil.tipo,
      contratoId: perfil.contrato_id,
      unidadeId: perfil.unidade_id,
    },
  };
  
  return policy;
}
```

#### 6.2 Middleware de RLS

**Arquivo:** `lambdas/middleware/rls.ts`

```typescript
import { RDSDataClient, ExecuteStatementCommand } from '@aws-sdk/client-rds-data';

const rds = new RDSDataClient({});

export async function applyRLS(query: string, userContext: any) {
  // Adicionar filtros baseado no tipo de usuário
  if (userContext.userType === 'terceiro') {
    query += ` AND cpf = '${userContext.cpf}'`;
  } else if (userContext.userType === 'administrador-terceiro') {
    query += ` AND cpf IN (SELECT cpf FROM usuario_contrato WHERE usuario_id = '${userContext.userId}')`;
  } else if (userContext.userType === 'administrador-agir-planta') {
    query += ` AND unidade_id = '${userContext.unidadeId}'`;
  }
  // administrador-agir-corporativo vê tudo
  
  return query;
}
```

## 7.5 Checklist de Migração

### Infraestrutura

- [ ] VPC criada com subnets públicas e privadas
- [ ] Security Groups configurados
- [ ] RDS PostgreSQL criado com pgvector
- [ ] Cognito User Pool configurado
- [ ] S3 buckets criados
- [ ] CloudFront distribution configurado
- [ ] API Gateway configurado
- [ ] Lambda functions criadas
- [ ] IAM roles e policies configuradas

### Banco de Dados

- [ ] Schema exportado do Supabase
- [ ] Dados exportados (exceto auth)
- [ ] Schema importado no RDS
- [ ] Dados importados no RDS
- [ ] Usuários migrados para Cognito
- [ ] RLS reimplementado como middleware
- [ ] Testes de integridade realizados

### Frontend

- [ ] Autenticação migrada para Cognito
- [ ] Chamadas de API atualizadas
- [ ] Storage atualizado para S3
- [ ] Build e deploy no S3 + CloudFront
- [ ] Testes de funcionalidade realizados

### Backend

- [ ] Edge Functions reescritas como Lambda
- [ ] API Gateway configurado com rotas
- [ ] Authorizer Lambda implementado
- [ ] Middleware de RLS implementado
- [ ] Testes de integração realizados

### Migração de Dados

- [ ] Script de migração de usuários testado
- [ ] Script de migração de arquivos testado
- [ ] Validação de dados após migração
- [ ] Rollback plan documentado

### Go-Live

- [ ] DNS atualizado para nova infraestrutura
- [ ] Monitoramento configurado (CloudWatch)
- [ ] Alertas configurados
- [ ] Documentação atualizada
- [ ] Equipe treinada
- [ ] Período de shadow mode (ambos rodando)
- [ ] Cut-over realizado
- [ ] Supabase desativado

## 7.6 Estimativa de Custos AWS

| Serviço | Configuração | Custo Mensal Estimado |
|---------|--------------|----------------------|
| RDS PostgreSQL | db.t3.medium, 100GB | ~$100 |
| Cognito | 10.000 MAUs | ~$25 |
| Lambda | 1M requests/mês | ~$20 |
| API Gateway | 1M requests/mês | ~$35 |
| S3 | 10GB storage | ~$1 |
| CloudFront | 100GB transfer | ~$10 |
| **Total** | | **~$191/mês** |

**Comparação com Supabase:**
- Supabase Pro: $25/mês + usage
- Supabase usage real: ~$50-100/mês
- **Total Supabase: ~$75-125/mês**

A AWS pode ser mais cara, mas traz benefícios de integração e conformidade.

---

# 8. FAQ - PERGUNTAS FREQUENTES

## 8.1 Perguntas sobre Supabase

### P: É seguro expor a ANON_KEY no frontend?

**R:** Sim! A ANON_KEY é pública por design. A segurança vem do Row Level Security (RLS), não da chave. Mesmo com a ANON_KEY, um atacante só pode acessar dados que as políticas RLS permitem.

**O que NÃO expor:** SERVICE_ROLE_KEY (essa é administrativa).

### P: O que acontece se o RLS estiver mal configurado?

**R:** Dependendo do erro:
- Se esquecer de criar políticas: NENHUM dado é retornado (RLS nega tudo por padrão)
- Se criar política muito permissiva: Dados vazam (teste bem as políticas!)

**Debug:** Sempre teste RLS no SQL Editor antes de ir para produção.

### P: Posso usar Supabase localmente?

**R:** Sim! O Supabase CLI permite rodar localmente:

```bash
supabase start
# Sobe PostgreSQL + Auth + Storage localmente
```

### P: Como faço backup dos dados?

**R:** Supabase faz backup automático diário (retenção de 7 dias no plano Pro). Para backup manual:

```bash
pg_dump -h db.xxx.supabase.co -U postgres -d postgres > backup.sql
```

### P: Posso migrar de volta para Supabase depois de ir para AWS?

**R:** Sim, é o mesmo processo de exportação/importação, mas no sentido inverso.

## 8.2 Perguntas sobre a Migração

### P: Quanto tempo leva a migração completa?

**R:** Estimativa realista: **8-12 semanas** (2-3 meses) com uma equipe de 2-3 desenvolvedores.

**Cronograma:**
- Semanas 1-2: Infraestrutura AWS
- Semanas 3-4: Migração do banco
- Semanas 5-6: Frontend (Cognito + API)
- Semanas 7-9: Lambda functions
- Semanas 10-12: Testes e go-live

### P: Vai ter downtime durante a migração?

**R:** Se feito corretamente, **downtime mínimo** (minutos) durante o cut-over.

**Estratégia:**
1. Manter Supabase rodando em paralelo
2. Replicar dados continuamente (CDC ou scripts)
3. Fazer cut-over em horário de baixo uso (madrugada)
4. Se algo der errado, rollback para Supabase

### P: Qual o maior risco da migração?

**R:** **RLS mal reimplementado** é o maior risco. No Supabase, o RLS é nativo. Na AWS, precisa ser recriado como middleware.

**Mitigação:**
- Testar exaustivamente cada política
- Shadow mode (ambos sistemas rodando em paralelo)
- Auditoria de acesso pós-migração

### P: Preciso reescrever todo o frontend?

**R:** **Não!** A maior parte do código React permanece igual. Mudanças principais:
- AuthContext (de Supabase Auth para Cognito)
- Chamadas de API (de Supabase client para fetch/API Gateway)
- Storage (de Supabase Storage para S3)

**Estimativa:** 20-30% do código frontend muda.

### P: E as Edge Functions?

**R:** Precisam ser reescritas de Deno para Node.js (Lambda).

**Diferenças:**
- Deno usa `serve()` do std/http
- Lambda usa handler com event/context
- Deno tem imports de URL, Node usa npm packages

**Estimativa:** 50-70% do código das functions pode ser reaproveitado.

### P: Como fica o custo?

**R:** AWS provavelmente será **mais cara** (~$191/mês vs ~$100/mês do Supabase).

**Mas:**
- Mais controle
- Mais integração com outros sistemas Agir
- Sem vendor lock-in
- Suporte interno disponível

### P: Posso migrar em fases?

**R:** **Sim!** Recomendo:

1. **Fase 1:** Banco de dados (RDS) primeiro
2. **Fase 2:** Autenticação (Cognito)
3. **Fase 3:** Frontend (S3 + CloudFront)
4. **Fase 4:** Functions (Lambda)
5. **Fase 5:** Storage (S3)

Cada fase pode ser testada independentemente.

### P: O que fazer se algo der errado?

**R:** Ter um **rollback plan**:

1. Manter Supabase rodando em paralelo por 2-4 semanas
2. Se bug crítico na AWS, apontar DNS de volta para Supabase
3. Dados inseridos na AWS podem ser exportados e importados no Supabase

## 8.3 Perguntas sobre Operação

### P: Como monitorar o sistema na AWS?

**R:** Usar **CloudWatch**:

```bash
# Logs das Lambda functions
aws logs tail /aws/lambda/parceria-chat-gateway --follow

# Métricas do RDS
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name CPUUtilization \
  --dimensions Name=DBInstanceIdentifier,Value=parceria-db
```

**Configurar alertas:**
- CPU do RDS > 80%
- Erros das Lambda > 10/min
- Latência do API Gateway > 1s

### P: Como escalar o sistema?

**R:** AWS tem auto-scaling nativo:

- **RDS:** Read replicas para leitura, upgrade de instância para escrita
- **Lambda:** Escala automaticamente (até 1000 concurrent executions)
- **CloudFront:** CDN global, escala infinita

### P: Como fazer deploy de atualizações?

**R:** 

**Frontend:**
```bash
npm run build
aws s3 sync dist/ s3://parceria-frontend/
aws cloudfront create-invalidation --distribution-id EXXX --paths "/*"
```

**Lambda:**
```bash
sam build
sam deploy
```

### P: Onde ficam as variáveis de ambiente?

**R:** 

- **Lambda:** AWS Systems Manager Parameter Store ou Secrets Manager
- **Frontend:** Variáveis de build (hardcoded no build) ou Amazon AppConfig

## 8.4 Perguntas sobre Segurança

### P: Como proteger dados sensíveis?

**R:** 

1. **Criptografia em repouso:** RDS e S3 já criptografam por padrão
2. **Criptografia em trânsito:** HTTPS obrigatório (CloudFront)
3. **Acesso mínimo:** IAM policies restritivas
4. **Secrets:** AWS Secrets Manager para senhas e chaves de API

### P: Como auditar acesso aos dados?

**R:** 

- **RDS:** Habilitar Database Activity Streams
- **S3:** Habilitar server access logging
- **Lambda:** CloudWatch Logs de todas as invocações
- **Cognito:** CloudTrail logs de autenticação

### P: Como lidar com LGPD?

**R:** 

1. **Dados em território nacional:** Usar região sa-east-1 (São Paulo)
2. **Direito ao esquecimento:** Script para deletar dados de usuário
3. **Consentimento:** Termos de uso no login
4. **Portabilidade:** Exportar dados em CSV/JSON

---

# 9. CHECKLIST DE HANDOVER

## 9.1 Acesso a Sistemas

- [ ] Repositório GitHub transferido
- [ ] Vercel (projeto frontend)
- [ ] Supabase (projeto backend)
- [ ] DigitalOcean (droplet dos scripts Python)
- [ ] AWS RDS (data warehouse das catracas)
- [ ] OpenAI API (chave de IA)
- [ ] Domínio e DNS (se aplicável)

## 9.2 Documentação

- [ ] Esta documentação completa
- [ ] README.md atualizado
- [ ] Diagramas de arquitetura
- [ ] Credenciais (em cofre seguro, não no repositório)
- [ ] Contatos de suporte (Supabase, DigitalOcean, etc.)

## 9.3 Conhecimento

- [ ] Reunião de handover agendada
- [ ] Walkthrough do código-fonte
- [ ] Explicação das regras de negócio críticas
- [ ] Demonstração dos scripts Python
- [ ] Explicação do ChatBot e IA
- [ ] Sessão de Q&A

## 9.4 Ambiente de Desenvolvimento

- [ ] .env.example atualizado
- [ ] Instruções de setup local
- [ ] Scripts de seed (dados de teste)
- [ ] Comandos de build/deploy documentados

## 9.5 Operações

- [ ] Cron jobs documentados
- [ ] Procedimento de debug de scripts
- [ ] Contingência (se scripts falharem)
- [ ] Monitoramento atual (logs, alertas)

## 9.6 Pendências e Melhorias Futuras

- [ ] Lista de bugs conhecidos
- [ ] Melhorias planejadas (roadmap)
- [ ] Dívida técnica identificada
- [ ] Sugestões de otimização

---

# APÊNDICE A: COMANDOS ÚTEIS

## Supabase CLI

```bash
# Login
supabase login

# Linkar projeto
supabase link --project-ref qszqzdnlhxpglllyqtht

# Baixar migrations
supabase db pull

# Gerar tipos TypeScript
supabase gen types typescript --project-id qszqzdnlhxpglllyqtht > src/types/database.types.ts

# Deploy de function
supabase functions deploy chat-gateway

# Logs de function
supabase functions logs chat-gateway
```

## AWS CLI

```bash
# Listar Lambda functions
aws lambda list-functions

# Ver logs de Lambda
aws logs tail /aws/lambda/parceria-chat-gateway --follow

# Invocar Lambda
aws lambda invoke \
  --function-name parceria-chat-gateway \
  --payload '{"message": "teste"}' \
  response.json

# RDS: Conectar
psql -h parceria-db.xxx.sa-east-1.rds.amazonaws.com -U admin -d parceria
```

## DigitalOcean (Droplet)

```bash
# SSH no droplet
ssh root@<ip-do-droplet>

# Ver cron jobs
crontab -l

# Ver logs de script
tail -f /var/log/parceria/import.log

# Rodar script manualmente
cd /root/parceria && python3 importar-ultimos-10000-acessos.py
```

## npm Scripts

```bash
npm run dev          # Desenvolvimento
npm run build        # Build produção
npm run build:check  # Type check + build
npm run lint         # ESLint
npm run preview      # Preview da build
```

---

# APÊNDICE B: TROUBLESHOOTING

## Problemas Comuns

### 1. "Error: JWT expired"

**Causa:** Token expirou e não foi renovado.

**Solução:**
```typescript
// Verificar se autoRefreshToken está ativado
const supabase = createClient(url, key, {
  auth: { autoRefreshToken: true }
});

// Forçar refresh
const { data } = await supabase.auth.refreshSession();
```

### 2. "Row Level Security policy violation"

**Causa:** Política RLS bloqueou operação.

**Solução:**
- Verificar políticas no SQL Editor do Supabase
- Testar como usuário afetado
- Ajustar política se necessário

### 3. Scripts Python falhando

**Causa:** Dependências desatualizadas ou conexão falhando.

**Solução:**
```bash
# No droplet
cd /root/parceria
pip install -r requirements.txt --upgrade

# Testar conexão
python3 -c "from supabase import create_client; print('OK')"
```

### 4. Frontend não carrega dados

**Causa:** RLS bloqueando ou credenciais erradas.

**Solução:**
- Verificar console do navegador (Network tab)
- Testar query diretamente no Supabase SQL Editor
- Verificar se usuário tem permissão

### 5. ChatBot não responde

**Causa:** Edge Function falhando ou OpenAI API key inválida.

**Solução:**
```bash
# Ver logs da function
supabase functions logs chat-gateway

# Verificar chave OpenAI
# No Dashboard do Supabase: Settings > Edge Functions > Secrets
```

---

# APÊNDICE C: GLOSSÁRIO

| Termo | Definição |
|-------|-----------|
| **BaaS** | Backend as a Service (Supabase, Firebase) |
| **RLS** | Row Level Security (segurança no nível da linha) |
| **JWT** | JSON Web Token (padrão de autenticação) |
| **Edge Function** | Função serverless que roda na edge da rede |
| **RAG** | Retrieval Augmented Generation (IA com busca em documentos) |
| **pgvector** | Extensão PostgreSQL para vetores (embeddings) |
| **Cognito** | Serviço de autenticação da AWS |
| **Lambda** | Funções serverless da AWS |
| **CloudFront** | CDN da AWS |
| **Cut-over** | Momento de migrar de um sistema para outro |

---

# CONCLUSÃO

O ParcerIA é um sistema robusto e bem estruturado. A arquitetura baseada em React + Supabase permitiu desenvolvimento rápido com segurança enterprise.

A migração para AWS é um projeto de médio prazo (2-3 meses) que trará benefícios de integração e conformidade, mas requer cuidado para não introduzir bugs.

**Pontos críticos de atenção:**
1. RLS é o coração da segurança - testar exaustivamente
2. Scripts Python são críticos para operação - manter monitoramento
3. ChatBot é diferencial - preservar funcionalidade na migração

Estou à disposição para apoiar na transição.

**Contato:**
- Email: [SEU EMAIL]
- Telefone: [SEU TELEFONE]
- Slack: [SEU USUÁRIO]

---

**ParcerIA - Gestão Inteligente de Acessos e Contratos**  
© 2026 Agir Saúde - Todos os direitos reservados
