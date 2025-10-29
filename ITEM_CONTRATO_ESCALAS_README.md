# Item de Contrato em Escalas Médicas - Atualização

## 📋 Resumo da Funcionalidade

Foi adicionada a capacidade de vincular um **Item de Contrato** a cada escala médica, permitindo maior rastreabilidade e organização das escalas por tipo de serviço contratado.

## ✨ Funcionalidades Implementadas

### 1. **Seleção de Item de Contrato**
- Campo de seleção adicionado no formulário de criação/edição de escalas
- Lista dinâmica que exibe apenas os itens vinculados ao contrato selecionado
- **Campo obrigatório** - toda escala deve ter um item de contrato vinculado
- Desabilitado até que um contrato seja selecionado

### 2. **Exibição no Preview**
- Item de contrato exibido no Step 2 (Visualizar Escala)
- Chip com cor secundária para diferenciação visual
- Sempre exibido (campo obrigatório)

### 3. **Exibição nos Cards da Listagem**
- Seção dedicada "Item de Contrato" nos cards
- Chip visual com o nome do item
- Sempre exibido (campo obrigatório)

## 🗄️ Alterações no Banco de Dados

### Migration: `008_add_item_contrato_to_escalas.sql`

```sql
-- Adiciona coluna item_contrato_id (NOT NULL)
ALTER TABLE escalas_medicas
ADD COLUMN IF NOT EXISTS item_contrato_id UUID NOT NULL;

-- Adiciona constraint de foreign key
ALTER TABLE escalas_medicas
ADD CONSTRAINT fk_escalas_item_contrato
FOREIGN KEY (item_contrato_id)
REFERENCES itens_contrato(id)
ON DELETE RESTRICT;

-- Adiciona índice para performance
CREATE INDEX IF NOT EXISTS idx_escalas_item_contrato
ON escalas_medicas(item_contrato_id);
```

**Características**:
- Campo obrigatório (NOT NULL)
- Foreign key para `itens_contrato`
- ON DELETE RESTRICT (impede deletar item de contrato que está sendo usado)
- Índice para otimizar queries

## 📁 Arquivos Modificados

### 1. **src/types/database.types.ts**
- Adicionado campo `item_contrato_id: string` na interface `EscalaMedica` (obrigatório)
- Imports adicionados: `ItemContrato`, `ContratoItem`

### 2. **src/pages/EscalasMedicas.tsx**
- **Estados adicionados**:
  - `itensContrato`: Lista de itens do contrato selecionado
  - `todosItensContrato`: Lista completa de itens para exibição nos cards

- **Funções adicionadas/modificadas**:
  - `loadItensContrato()`: Carrega itens vinculados a um contrato específico
  - `loadData()`: Atualizado para carregar todos os itens de contrato
  - `handleContratoChange()`: Limpa seleção de item ao mudar contrato
  - `handleNext()`: Validação adicionada para garantir que item foi selecionado
  - `handleSave()`: Inclui `item_contrato_id` ao salvar
  - `handleOpenDialog()`: Inicializa campo `item_contrato_id`

- **UI adicionada**:
  - Campo Autocomplete obrigatório no Step 0 (após seleção de contrato)
  - Chip no Step 1 (preview) - sempre exibido
  - Seção com chip nos cards da listagem - sempre exibida

### 3. **migrations/008_add_item_contrato_to_escalas.sql**
- Nova migration criada para adicionar o campo

## 🔄 Fluxo de Uso

1. **Criar Nova Escala**:
   - Usuário seleciona o contrato
   - Sistema carrega automaticamente os itens vinculados ao contrato
   - Campo "Item de Contrato" é habilitado
   - Usuário pode selecionar um item (opcional)
   - Item aparece no preview e é salvo com a escala

2. **Visualizar Escala**:
   - Cards na listagem mostram o item de contrato (se houver)
   - Chip colorido facilita identificação visual
   - Label "Item de Contrato:" diferencia de outros dados

## 🎨 Design

- **Campo de Seleção**:
  - Desabilitado por padrão
  - Habilitado após seleção de contrato
  - Marcado como obrigatório (required)
  - Helper text explicativo
  - Formato: "Nome do Item (unidade de medida)"

- **Preview**:
  - Chip com `color="secondary"` e `variant="outlined"`
  - Integrado aos demais chips de informação
  - Sempre exibido

- **Cards**:
  - Seção dedicada com label descritiva
  - Chip pequeno (`size="small"`)
  - Cor secundária para diferenciação
  - Sempre exibido

## 🔒 Validações

- **Campo obrigatório** - bloqueia salvamento se não preenchido
- Validação no Step 0 antes de avançar para preview
- Apenas itens do contrato selecionado são listados
- Foreign key garante integridade referencial
- ON DELETE RESTRICT impede deletar item em uso

## 📊 Benefícios

✅ Maior rastreabilidade das escalas por tipo de serviço
✅ Facilita análise de produtividade por item de contrato
✅ Melhora organização e categorização das escalas
✅ Preparação para relatórios e dashboards futuros
✅ Vínculo direto entre escala e especificação contratual

## 🚀 Como Usar

### 1. Execute a Migration
No Supabase SQL Editor:
```sql
-- Execute o conteúdo de migrations/008_add_item_contrato_to_escalas.sql
```

### 2. Criar Escala com Item
1. Clique em "+ Nova Escala"
2. Selecione um contrato
3. Campo "Item de Contrato" será habilitado
4. Selecione um item da lista (opcional)
5. Continue preenchendo os demais campos
6. No preview, o item será exibido
7. Confirme e salve

### 3. Visualizar Item nas Escalas
- Item aparece nos cards da listagem principal
- Seção "Item de Contrato:" com chip colorido
- Visível apenas quando há item vinculado

## 🔧 Manutenção

Para modificar no futuro:

1. **Adicionar filtro por item**:
   - Criar estado `filtroItem`
   - Adicionar lógica em `aplicarFiltros()`
   - Adicionar campo Autocomplete em "Filtros Avançados"

2. **Tornar campo opcional novamente** (não recomendado):
   - Alterar migration: remover `NOT NULL`
   - Remover validação do `handleNext()`
   - Adicionar "(Opcional)" ao label
   - Alterar `ON DELETE RESTRICT` para `ON DELETE SET NULL`

3. **Relatórios por item**:
   - Usar `item_contrato_id` para agrupar escalas
   - Combinar com dados de produtividade
   - Gerar métricas por tipo de serviço

## ⚠️ Notas Importantes

- A coluna é **obrigatória** (NOT NULL)
- Toda escala nova deve ter um item de contrato vinculado
- Se tentar deletar um item de contrato em uso, operação será bloqueada (RESTRICT)
- Índice otimiza queries de busca por item
- Compatível com sistema de multi-tenancy existente
- **IMPORTANTE**: Se já existem escalas no banco, será necessário preencher o item_contrato_id antes de aplicar a migration
