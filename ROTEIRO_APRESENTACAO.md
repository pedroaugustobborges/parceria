# Roteiro de Apresentação - ParcerIA

## Para Equipe de Desenvolvimento Agir

**Duração:** 45-60 minutos (30 min apresentação + 15-30 min Q&A)  
**Público:** Equipe Backend + Frontend  
**Data:** [DATA DA APRESENTAÇÃO]

---

# ESTRUTURA DA APRESENTAÇÃO

## Parte 1: Introdução (5 minutos)

### Slide 1: Capa
```
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║                    ParcerIA                               ║
║         Sistema Inteligente de Gestão de Acessos          ║
║                                                           ║
║         Apresentação para Equipe de Desenvolvimento       ║
║                       Agir Saúde                          ║
║                                                           ║
║                    [DATA]                                 ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

**O que falar:**
> "Bom dia a todos. Hoje vou apresentar o ParcerIA, sistema que desenvolvi para gestão de acessos e contratos de equipes terceirizadas. Vocês serão os responsáveis pela manutenção e evolução deste sistema, e também pela migração para AWS."

---

### Slide 2: Agenda
```
┌─────────────────────────────────────────────────────────┐
│  AGENDA                                                 │
├─────────────────────────────────────────────────────────┤
│  1. O que é o ParcerIA (5 min)                          │
│  2. Arquitetura do Sistema (5 min)                      │
│  3. Demonstração das Funcionalidades (10 min)           │
│  4. Stack Tecnológico (5 min)                           │
│  5. Migração para AWS (10 min)                          │
│  6. Perguntas e Respostas (15-30 min)                   │
└─────────────────────────────────────────────────────────┘
```

---

## Parte 2: O Que é o ParcerIA (5 minutos)

### Slide 3: O Problema
```
┌─────────────────────────────────────────────────────────┐
│  PROBLEMA                                               │
├─────────────────────────────────────────────────────────┤
│  ❌ Dados fragmentados em sistemas separados            │
│  ❌ Falta de visibilidade de horas trabalhadas          │
│  ❌ Processos manuais de importação de escalas          │
│  ❌ Nenhuma análise inteligente dos dados               │
│  ❌ Dificuldade no fechamento com terceirizadas         │
└─────────────────────────────────────────────────────────┘
```

**O que falar:**
> "Antes do ParcerIA, a gestão financeira não tinha visibilidade consolidada de quantas horas estavam sendo realmente trabalhadas vs. contratadas. Tudo era manual, em planilhas."

---

### Slide 4: A Solução
```
┌─────────────────────────────────────────────────────────┐
│  SOLUÇÃO - ParcerIA                                     │
├─────────────────────────────────────────────────────────┤
│  ✅ Dashboard de horas trabalhadas em tempo real        │
│  ✅ Integração com catracas de reconhecimento facial    │
│  ✅ Gestão completa de escalas médicas                  │
│  ✅ Contratos e itens contratuais                       │
│  ✅ Insights automáticos com IA                         │
│  ✅ ChatBot que responde em linguagem natural           │
└─────────────────────────────────────────────────────────┘
```

---

### Slide 5: Números do Sistema
```
┌─────────────────────────────────────────────────────────┐
│  PARCERIA EM NÚMEROS                                    │
├─────────────────────────────────────────────────────────┤
│  📊  ~50.000 registros de acessos/mês                  │
│  👥  ~200 usuários ativos                               │
│  🏥  ~10 unidades hospitalares                          │
│  📝  ~50 contratos gerenciados                          │
│  🤖  3 scripts Python rodando diariamente               │
│  💡  Insights gerados automaticamente todo dia          │
└─────────────────────────────────────────────────────────┘
```

---

## Parte 3: Arquitetura (5 minutos)

### Slide 6: Arquitetura Atual
```
                    ┌─────────────────┐
                    │   FRONTEND      │
                    │   (Vercel)      │
                    │  React + TS     │
                    └────────┬────────┘
                             │ HTTPS + JWT
                             ▼
                    ┌─────────────────┐
                    │   SUPABASE      │
                    │   (BaaS)        │
                    │  Postgres +     │
                    │  Auth + RLS     │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
     ┌────────────┐ ┌────────────┐ ┌────────────┐
     │  Scripts   │ │   AWS RDS  │ │   OpenAI   │
     │   Python   │ │  (Dados)   │ │   GPT-4o   │
     │  (Cron)    │ │  Catracas  │ │  (Insights)│
     └────────────┘ └────────────┘ └────────────┘
```

**O que falar:**
> "O frontend React está na Vercel. O backend é todo o Supabase, que é um 'Backend as a Service'. Scripts Python rodam em um droplet DigitalOcean via cron."

---

### Slide 7: O Que é Supabase?
```
┌─────────────────────────────────────────────────────────┐
│  SUPABASE = Firebase Open-Source                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  PostgreSQL  │  │     Auth     │  │   Storage    │ │
│  │  (Database)  │  │    (JWT)     │  │   (S3-like)  │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐                    │
│  │  Real-time   │  │    Edge      │                    │
│  │  (Subscribe) │  │  Functions   │                    │
│  └──────────────┘  └──────────────┘                    │
│                                                         │
│  + Row Level Security (RLS) para autorização           │
└─────────────────────────────────────────────────────────┘
```

**Ponto importante:**
> "RLS é o coração da segurança. Permissões são definidas no banco de dados, não no código. Isso é crucial para entender na migração."

---

## Parte 4: Demonstração (10 minutos)

### Demo 1: Dashboard de Acessos

**Roteiro:**
1. Fazer login como admin
2. Mostrar dashboard com filtros aplicados
3. Explicar cálculo de horas (entrada/saída pareadas)
4. Mostrar exportação para CSV

**O que falar:**
> "Esta é a tela principal. Cada linha mostra um colaborador e suas horas trabalhadas. O sistema pareia entradas e saídas automaticamente."

---

### Demo 2: Escalas Médicas

**Roteiro:**
1. Navegar para /escalas
2. Mostrar escalas existentes
3. Explicar workflow de aprovação (7 status)
4. Mostrar importação em lote via CSV

**O que falar:**
> "As escalas têm um workflow complexo. Começam como 'programadas', passam por 'confirmadas', 'aprovadas pela Agir', etc. O status é recalculado automaticamente todo dia."

---

### Demo 3: Insights com IA

**Roteiro:**
1. Navegar para /insights-ia
2. Fazer uma pergunta: "Quantas horas foram trabalhadas em março?"
3. Mostrar resposta do ChatBot
4. Explicar que usa GPT-4o + RAG

**O que falar:**
> "Este é o diferencial do sistema. O ChatBot entende perguntas em português e responde com base nos dados. Usa GPT-4o da OpenAI."

---

## Parte 5: Stack Tecnológico (5 minutos)

### Slide 8: Frontend
```
┌─────────────────────────────────────────────────────────┐
│  FRONTEND STACK                                         │
├─────────────────────────────────────────────────────────┤
│  React 18.2        │ TypeScript 5.2    │ Vite 5.1      │
│  MUI v5            │ Tailwind CSS 3.4  │ Recharts 3    │
│  React Router v6   │ MUI DataGrid 6    │ jsPDF         │
├─────────────────────────────────────────────────────────┤
│  Estrutura:                                             │
│  src/                                                   │
│  ├── components/     (componentes reutilizáveis)        │
│  ├── contexts/       (estado global: Auth, Theme)       │
│  ├── features/       (módulos por funcionalidade)       │
│  ├── pages/          (rotas da aplicação)               │
│  ├── services/       (chamadas de API)                  │
│  └── utils/          (funções utilitárias)              │
└─────────────────────────────────────────────────────────┘
```

---

### Slide 9: Backend (Supabase)
```
┌─────────────────────────────────────────────────────────┐
│  BACKEND - SUPABASE                                     │
├─────────────────────────────────────────────────────────┤
│  Tabelas Principais:                                    │
│  • usuarios (perfis de usuário)                         │
│  • acessos (dados das catracas)                         │
│  • contratos (contratos com terceiros)                  │
│  • contrato_itens (itens de cada contrato)              │
│  • escalas_medicas (plantões programados)               │
│  • produtividade (métricas do sistema MV)               │
│  • unidades_hospitalares (hospitais/unidades)           │
│  • insights_ia (histórico de insights)                  │
│  • documentos (PDFs e embeddings para IA)               │
├─────────────────────────────────────────────────────────┤
│  4 Tipos de Usuário:                                    │
│  1. administrador-agir-corporativo (acesso total)       │
│  2. administrador-agir-planta (uma unidade)             │
│  3. administrador-terceiro (seu contrato)               │
│  4. terceiro (apenas próprios dados)                    │
└─────────────────────────────────────────────────────────┘
```

---

### Slide 10: Scripts Python
```
┌─────────────────────────────────────────────────────────┐
│  AUTOMAÇÃO PYTHON (DigitalOcean)                        │
├─────────────────────────────────────────────────────────┤
│  Script                        │ Horário │ Finalidade   │
│  ──────────────────────────────┼─────────┼──────────────│
│  importar-ultimos-10000-acessos│ 06:00   │ Catracas     │
│  coletar-produtividade-mv      │ 02:00   │ Scraping MV  │
│  recalcular-status-diario      │ 14:00   │ Status       │
├─────────────────────────────────────────────────────────┤
│  Dependências:                                          │
│  psycopg2-binary, supabase, selenium, python-dotenv     │
└─────────────────────────────────────────────────────────┘
```

---

## Parte 6: Migração para AWS (10 minutos)

### Slide 11: Por Que Migrar?
```
┌─────────────────────────────────────────────────────────┐
│  POR QUE MIGRAR PARA AWS?                               │
├─────────────────────────────────────────────────────────┤
│  ✅ Conformidade com políticas Agir                     │
│  ✅ Integração com outros sistemas (todos na AWS)       │
│  ✅ Suporte interno disponível                          │
│  ✅ Auto-scaling nativo                                 │
│  ✅ Compliance (dados no Brasil - sa-east-1)            │
│                                                         │
│  ⚠️  AWS será mais cara (~$191 vs ~$100/mês)           │
│  ⚠️  Migração leva 8-12 semanas                         │
│  ⚠️  Risco de bugs na transição                         │
└─────────────────────────────────────────────────────────┘
```

---

### Slide 12: Mapeamento de Serviços
```
┌─────────────────────────────────────────────────────────┐
│  MAPEAMENTO SUPABASE → AWS                              │
├───────────────────────────┬─────────────────────────────┤
│  SUPABASE                 │  AWS                        │
├───────────────────────────┼─────────────────────────────┤
│  PostgreSQL               │  RDS PostgreSQL             │
│  Auth (JWT)               │  Cognito User Pools         │
│  Storage                  │  S3                         │
│  Edge Functions           │  Lambda + API Gateway       │
│  Realtime                 │  AppSync / WebSocket API    │
│  RLS                      │  IAM + Middleware           │
│  pgvector                 │  RDS + extensão             │
└───────────────────────────┴─────────────────────────────┘
```

**Ponto crítico:**
> "RLS é o maior desafio. No Supabase é nativo. Na AWS, precisamos recriar como middleware nas Lambda functions ou no código da API."

---

### Slide 13: Arquitetura AWS Proposta
```
                    ┌─────────────────┐
                    │   CloudFront    │
                    │    (CDN)        │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
     ┌────────────┐ ┌────────────┐ ┌────────────┐
     │     S3     │ │    API     │ │   Cognito  │
     │ (Frontend) │ │  Gateway   │ │   (Auth)   │
     └────────────┘ └─────┬──────┘ └────────────┘
                          │
              ┌───────────┼───────────┐
              ▼           ▼           ▼
     ┌────────────┐ ┌────────────┐ ┌────────────┐
     │  Lambda    │ │  Lambda    │ │  Lambda    │
     │  (chat)    │ │ (insights) │ │ (middleware)│
     └─────┬──────┘ └─────┬──────┘ └─────┬───────┘
                           │
                           ▼
                   ┌───────────────┐
                   │  RDS Postgres │
                   │  + pgvector   │
                   └───────┬───────┘
                           │
                           ▼
                   ┌───────────────┐
                   │     S3        │
                   │ (Documentos)  │
                   └───────────────┘
```

---

### Slide 14: Cronograma de Migração
```
┌─────────────────────────────────────────────────────────┐
│  CRONOGRAMA (8-12 semanas)                              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Semanas 1-2    ████████░░░░░░░░░░░░  Infra AWS base   │
│  Semanas 3-4    ░░░░████████░░░░░░░░  Migração DB      │
│  Semanas 5-6    ░░░░░░░░████████░░░░  Frontend         │
│  Semanas 7-9    ░░░░░░░░░░░░████████  Lambda functions │
│  Semanas 10-12  ░░░░░░░░░░░░░░░░████  Testes + Go-live │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

### Slide 15: Fases da Migração

```
FASE 1: Infraestrutura (Semana 1-2)
├─ Criar VPC, subnets, security groups
├─ Criar RDS PostgreSQL com pgvector
├─ Criar Cognito User Pool
└─ Criar S3 buckets

FASE 2: Banco de Dados (Semana 3-4)
├─ Exportar schema do Supabase
├─ Exportar dados (exceto auth)
├─ Importar no RDS
└─ Migrar usuários para Cognito

FASE 3: Frontend (Semana 5-6)
├─ Substituir Supabase Auth por Cognito
├─ Atualizar chamadas de API
├─ Deploy no S3 + CloudFront
└─ Testes de funcionalidade

FASE 4: Backend (Semana 7-9)
├─ Reescrever Edge Functions como Lambda
├─ Configurar API Gateway
├─ Implementar middleware de RLS
└─ Testes de integração

FASE 5: Go-Live (Semana 10-12)
├─ Shadow mode (ambos rodando)
├─ Cut-over em horário de baixo uso
├─ Monitoramento intensivo
└─ Desativar Supabase
```

---

### Slide 16: Riscos e Mitigação

```
┌─────────────────────────────────────────────────────────┐
│  RISCOS E MITIGAÇÃO                                     │
├──────────────────────┬──────────────────────────────────┤
│  RISCO               │  MITIGAÇÃO                       │
├──────────────────────┼──────────────────────────────────┤
│  RLS mal implement.  │  Testes exaustivos, shadow mode  │
│  Downtime na migração│  Cut-over madrugada, rollback    │
│  Bugs pós-migração   │  QA rigoroso, monitoramento      │
│  Custo maior         │  Otimização após go-live         │
│  Perda de dados      │  Backups, validação pós-migração │
└──────────────────────┴──────────────────────────────────┘
```

---

## Parte 7: Perguntas e Respostas (15-30 minutos)

### Perguntas que Provavelmente Farão

**1. "Quanto tempo até a equipe conseguir manter o sistema?"**
> "Com a documentação e essa apresentação, em 1-2 semanas vocês já conseguem fazer manutenções básicas. Em 1 mês, já estarão confortáveis com o código."

**2. "Vale a pena migrar para AWS?"**
> "Depende das prioridades. Se conformidade e integração são críticas, sim. Se custo é prioridade, Supabase é mais barato. Minha recomendação: migrem, mas com calma."

**3. "Qual a parte mais crítica do sistema?"**
> "Os scripts Python de importação de acessos. Se falharem, o dashboard fica sem dados. Tenham monitoramento neles."

**4. "O ChatBot é caro de manter?"**
> "OpenAI GPT-4o custa ~$0.03 por 1K tokens. Uso mensal: ~$20-50. Na AWS, podemos usar Bedrock com modelos similares."

**5. "Tem dívida técnica?"**
> "Sim. Algumas políticas RLS podem ser otimizadas. O cálculo de horas poderia ser feito no banco, não no frontend. Mas nada crítico."

**6. "Como escalar o sistema?"**
> "Supabase escala bem. Na AWS, RDS com read replicas e Lambda com auto-scaling. Frontend no CloudFront já é global."

**7. "O que fazer se algo der errado na migração?"**
> "Ter rollback plan. Manter Supabase rodando em paralelo por 2-4 semanas. Se bug crítico, apontar DNS de volta."

---

# DICAS PARA A APRESENTAÇÃO

## Antes

1. **Testar o sistema** - Garantir que está funcionando
2. **Preparar dados de demo** - Criar usuários de teste se necessário
3. **Testar compartilhamento de tela** - Verificar áudio/vídeo
4. **Imprimir cópias da documentação** - Para quem preferir papel
5. **Chegar 10 minutos antes** - Testar equipamentos

## Durante

1. **Falar devagar** - Nervosismo acelera a fala
2. **Fazer pausas** - Dar tempo de absorver
3. **Olhar para a plateia** - Não só para os slides
4. **Usar o mouse para destacar** - Mostrar onde clicar na demo
5. **Anotar perguntas** - Para não esquecer durante a apresentação

## Depois

1. **Enviar gravação** - Para quem não pôde comparecer
2. **Disponibilizar slides** - No repositório ou SharePoint
3. **Agendar sessões de Q&A** - Para dúvidas que surgirem depois
4. **Coletar feedback** - Para melhorar próximas apresentações

---

# CHECKLIST PRÉ-APRESENTAÇÃO

## Sistema

- [ ] Frontend rodando (npm run dev)
- [ ] Login funcionando
- [ ] Dashboard com dados
- [ ] Escalas com exemplos
- [ ] ChatBot respondendo
- [ ] Dados de exemplo carregados

## Ambiente

- [ ] Sala reservada
- [ ] Projetor/TV funcionando
- [ ] Internet estável
- [ ] Extensão de tomada disponível
- [ ] Água/café disponíveis

## Materiais

- [ ] Slides preparados
- [ ] Documentação impressa (opcional)
- [ ] Link da gravação testado
- [ ] Lista de presença (se necessário)

## Pessoal

- [ ] Equipe convidada
- [ ] Gestor avisado
- [ ] Horário bloqueado na agenda
- [ ] Backup presenter identificado (se necessário)

---

# SCRIPT DA APRESENTAÇÃO

## Abertura (0:00 - 0:05)

> "Bom dia a todos. Obrigado por virem. Meu nome é [SEU NOME] e sou o desenvolvedor do ParcerIA. Hoje vou apresentar o sistema para vocês, que serão os responsáveis pela manutenção e evolução a partir de agora."

> "A apresentação terá cerca de 30 minutos, seguidos de 15-30 minutos para perguntas. Vou mostrar o que é o sistema, como funciona, e principalmente como migrar para AWS."

> "Ao final, vou entregar uma documentação completa de mais de 100 páginas com tudo que precisam saber."

## Transições

> "Agora que entendemos o problema, vamos ver a arquitetura..."

> "Com a arquitetura entendida, vou fazer uma demonstração prática..."

> "Agora a parte importante: como migrar para AWS..."

## Fechamento (29:00 - 30:00)

> "Para encerrar, recapitulando: ParcerIA é um sistema de gestão de acessos e contratos. Stack é React + Supabase. Migração para AWS leva 8-12 semanas. Documentação completa está no repositório."

> "Estou à disposição nas próximas semanas para tirar dúvidas. Meu contato está na documentação."

> "Agora vou abrir para perguntas."

---

# PÓS-APRESENTAÇÃO

## Ações Imediatas

1. **Enviar email de agradecimento**
   ```
   Assunto: Apresentação ParcerIA - Materiais
   
   Bom dia a todos,
   
   Obrigado pela presença e pelas perguntas.
   
   Seguem materiais:
   - Gravação: [LINK]
   - Slides: [ANEXO]
   - Documentação: [LINK REPOSITÓRIO]
   
   Estou à disposição para dúvidas.
   
   Abraço,
   [SEU NOME]
   ```

2. **Atualizar repositório**
   - Adicionar link da gravação no README
   - Garantir que documentação está acessível
   - Criar issue com ações identificadas

3. **Agendar follow-ups**
   - Sessão de dúvidas em 1 semana
   - Check-in em 2 semanas
   - Suporte durante migração

## Acompanhamento

| Semana | Ação |
|--------|------|
| 1 | Sessão de Q&A (dúvidas que surgiram) |
| 2 | Revisão do plano de migração |
| 3 | Suporte na configuração do ambiente |
| 4 | Code review das primeiras mudanças |

---

# MATERIAL DE APOIO

## Links Úteis

- **Repositório:** [URL DO GITHUB]
- **Documentação:** `DOCUMENTACAO_HANDOVER_COMPLETA.md`
- **Supabase Dashboard:** https://qszqzdnlhxpglllyqtht.supabase.co
- **Vercel Dashboard:** https://vercel.com/dashboard
- **AWS Console:** https://console.aws.amazon.com

## Contatos

| Pessoa | Papel | Contato |
|--------|-------|---------|
| [SEU NOME] | Dev Original | [EMAIL/TELEFONE] |
| [GESTOR] | Stakeholder | [EMAIL] |
| [SUPORTE TI] | Infra | [EMAIL] |

---

**Boa apresentação! 🚀**
