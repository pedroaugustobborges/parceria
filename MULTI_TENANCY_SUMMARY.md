# 🏥 Sistema Multi-Tenancy por Unidade Hospitalar - Resumo Executivo

## 📊 Análise Realizada

Como um engenheiro de software sênior, realizei uma análise arquitetural completa do sistema e identifiquei os seguintes pontos críticos e soluções:

---

## 🎯 Problema Identificado

**Situação Atual:**
- Acessos já possuem campo `planta` identificando diferentes hospitais
- Contratos não estão vinculados a unidades específicas
- Apenas um tipo de administrador Agir (sem diferenciação de escopo)
- Sem isolamento de dados por unidade hospitalar

**Necessidade:**
- Sistema de multi-tenancy baseado em unidades hospitalares
- Hierarquia administrativa com escopo corporativo e por unidade
- Isolamento automático de dados via Row Level Security (RLS)

---

## ✅ Solução Proposta

### 1. **Nova Hierarquia de Usuários**

```
┌─────────────────────────────────────────────────────────┐
│  ADMINISTRADOR-AGIR-CORPORATIVO (Master)                │
│  ✓ Acesso a TODAS as unidades hospitalares             │
│  ✓ Gerencia unidades, contratos e usuários globalmente │
│  ✓ Sem restrições de dados                             │
└─────────────────────────────────────────────────────────┘
                         │
        ┌────────────────┴────────────────┐
        │                                 │
┌───────▼──────────┐           ┌─────────▼────────┐
│ ADMIN-PLANTA H1  │           │ ADMIN-PLANTA H2  │
│ ✓ Ver só dados   │           │ ✓ Ver só dados   │
│   da Unidade H1  │           │   da Unidade H2  │
│ ✓ Gerencia       │           │ ✓ Gerencia       │
│   contratos H1   │           │   contratos H2   │
│ ✓ Gerencia       │           │ ✓ Gerencia       │
│   usuários H1    │           │   usuários H2    │
└──────────────────┘           └──────────────────┘
        │                                 │
        └────────────────┬────────────────┘
                         │
        ┌────────────────┴────────────────┐
        │                                 │
┌───────▼──────────┐           ┌─────────▼────────┐
│ ADMIN-TERCEIRO   │           │ TERCEIRO         │
│ (sem mudanças)   │           │ (sem mudanças)   │
└──────────────────┘           └──────────────────┘
```

### 2. **Arquitetura de Banco de Dados**

#### Nova Tabela: `unidades_hospitalares`
```sql
┌──────────────────────────────────────┐
│ unidades_hospitalares                │
├──────────────────────────────────────┤
│ id UUID (PK)                         │
│ codigo VARCHAR(50) UNIQUE            │ ← "H1", "H2", etc
│ nome VARCHAR(255)                    │ ← "Hospital Santa Casa"
│ endereco TEXT                        │
│ ativo BOOLEAN                        │
│ created_at, updated_at               │
└──────────────────────────────────────┘
```

#### Alterações em Tabelas Existentes:
```sql
contratos
  └─ + unidade_hospitalar_id (FK) → unidades_hospitalares

usuarios
  └─ + unidade_hospitalar_id (FK) → unidades_hospitalares
     (apenas para administrador-agir-planta)

produtividade
  └─ + unidade_hospitalar_id (FK) → unidades_hospitalares
```

### 3. **Segurança via Row Level Security (RLS)**

**Princípio Zero-Trust:**
- Frontend **não** filtra dados manualmente
- Supabase RLS garante isolamento automático
- Cada query retorna apenas dados autorizados

**Exemplo Prático:**
```typescript
// Admin Corporativo executa:
const { data } = await supabase.from('contratos').select('*');
// ✓ Retorna TODOS os contratos de TODAS as unidades

// Admin Planta H1 executa a MESMA query:
const { data } = await supabase.from('contratos').select('*');
// ✓ RLS filtra automaticamente: retorna APENAS contratos da unidade H1
```

---

## 🔐 Segurança e Compliance

### Garantias Implementadas:

1. **Isolamento Automático**: RLS garante que admin de planta NUNCA vê dados de outra unidade
2. **Validação no DB**: Constraint impede criar admin-planta sem unidade
3. **Auditoria**: Triggers mantêm timestamps de criação/atualização
4. **Integridade Referencial**: Foreign keys garantem consistência
5. **Rollback Seguro**: Script de rollback incluído no migration

### Matriz de Permissões:

| Entidade         | Corporativo | Admin Planta | Admin Terceiro | Terceiro |
|------------------|-------------|--------------|----------------|----------|
| Ver todas units  | ✅          | ❌           | ❌             | ❌       |
| Gerenciar units  | ✅          | ❌           | ❌             | ❌       |
| Ver contratos    | Todos       | Só da unit   | Só do contrato | Só do contrato |
| Criar contratos  | ✅          | ✅ (só unit) | ❌             | ❌       |
| Ver acessos      | Todos       | Só da unit   | Só do contrato | Só próprios |
| Ver produtividade| Todos       | Só da unit   | Só do contrato | Só próprios |
| Gerenciar users  | Todos       | Só da unit   | Só do contrato | ❌       |

---

## 📋 Migração de Dados

### Estratégia de Migração:

1. **Automática**:
   - Extrai valores únicos de `acessos.planta`
   - Cria registros em `unidades_hospitalares`
   - Migra `administrador-agir` → `administrador-agir-corporativo`

2. **Manual (pós-migração)**:
   - Editar nomes das unidades (substituir "Unidade H1" por nomes reais)
   - Vincular contratos às unidades corretas
   - Vincular registros de produtividade às unidades
   - Criar admins de planta conforme necessário

3. **Validação**:
   - Script inclui queries de verificação
   - Testes de RLS com diferentes usuários

---

## 💻 Mudanças no Frontend

### Arquivos a Modificar:

1. **Types** (`database.types.ts`)
   - Novo type: `'administrador-agir-corporativo' | 'administrador-agir-planta'`
   - Nova interface: `UnidadeHospitalar`
   - Campos adicionados: `unidade_hospitalar_id`

2. **Context** (`AuthContext.tsx`)
   - `isAdminAgirCorporativo: boolean`
   - `isAdminAgirPlanta: boolean`
   - `unidadeHospitalarId: string | null`

3. **Nova Página**: `UnidadesHospitalares.tsx`
   - CRUD completo (apenas corporativo)
   - Listagem, criação, edição, desativação

4. **Formulário de Contratos**
   - Dropdown para selecionar unidade
   - Obrigatório ao criar
   - Auto-preenchido para admin planta

5. **Formulário de Usuários**
   - Dropdown de tipo atualizado
   - Campo de unidade (condicional)
   - Validação: planta requer unidade

6. **Dashboard**
   - Sem alterações nas queries (RLS filtra automaticamente!)
   - Indicador visual de unidade ativa

7. **Layout**
   - Badge mostrando unidade (para admin planta)
   - Menu "Unidades" (apenas corporativo)

---

## ⚡ Vantagens da Solução

### Técnicas:
- ✅ **Escalável**: Fácil adicionar novas unidades
- ✅ **Seguro**: RLS garante isolamento mesmo se houver bug no frontend
- ✅ **Performático**: Índices otimizados para queries filtradas
- ✅ **Manutenível**: Lógica de negócio centralizada no DB
- ✅ **Testável**: Cada tipo de usuário pode ser testado isoladamente

### Operacionais:
- ✅ **Delegação de Responsabilidade**: Admin planta gerencia sua unidade
- ✅ **Redução de Carga**: Corporativo não precisa gerenciar tudo
- ✅ **Compliance**: Dados sensíveis isolados por unidade
- ✅ **Auditoria**: Rastreabilidade de quem criou/alterou cada registro

---

## 📊 Estimativa de Esforço

### Fases da Implementação:

| Fase | Descrição | Tempo | Prioridade |
|------|-----------|-------|------------|
| 1 | Migration Database | 2-3h | **CRÍTICA** |
| 2 | Types & Context | 1h | **CRÍTICA** |
| 3 | Página Unidades | 2h | Alta |
| 4 | Form Contratos | 1h | Alta |
| 5 | Form Usuários | 1h | Alta |
| 6 | Dashboard Updates | 2h | Média |
| 7 | Layout & UI Polish | 1h | Baixa |
| 8 | Testes E2E | 2-3h | **CRÍTICA** |

**Total Estimado: 12-14 horas**

### Riscos Mitigados:
- ✅ Script de rollback preparado
- ✅ RLS testado antes de produção
- ✅ Migração de dados validada
- ✅ Backup recomendado antes de executar

---

## 🚀 Próximos Passos Recomendados

### Opção A: Implementação Imediata
1. ✅ Fazer backup do banco de dados
2. ✅ Executar migration `001_multi_tenancy_setup.sql`
3. ✅ Validar criação de unidades
4. ✅ Atualizar frontend (types, context, forms)
5. ✅ Testar com diferentes tipos de usuário
6. ✅ Deploy em produção

### Opção B: Implementação Incremental
1. Executar migration em ambiente de dev
2. Testar RLS policies isoladamente
3. Implementar UI para unidades
4. Implementar UI para contratos
5. Implementar UI para usuários
6. Testes completos
7. Deploy staged

---

## ❓ Perguntas para Decisão

Antes de prosseguir, preciso confirmar:

1. **Nomes das Unidades**: Você tem uma lista dos nomes reais das unidades? (Ou deixo genérico "Unidade H1" por enquanto?)

2. **Produtividade**: Como mapear registros de produtividade para unidades? Existe relação entre `codigo_mv` e `planta`?

3. **Contratos Existentes**: Como vincular contratos já existentes às unidades? Fazer manual ou tem alguma regra?

4. **Timeline**: Prefere implementação imediata (todas as fases) ou incremental (fase por fase)?

5. **Testes**: Tem usuários de teste para cada tipo? Precisamos criar?

---

## 📁 Arquivos Criados

- `MULTI_TENANCY_IMPLEMENTATION_PLAN.md` - Plano técnico detalhado
- `migrations/001_multi_tenancy_setup.sql` - Script SQL completo
- `MULTI_TENANCY_SUMMARY.md` - Este documento

**Está pronto para prosseguir?** Aguardo suas respostas para começar a implementação! 🚀
