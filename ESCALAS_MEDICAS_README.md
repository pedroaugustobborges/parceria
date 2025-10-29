# Escalas Médicas - Nova Funcionalidade

## 📋 Visão Geral

Nova página para gerenciar escalas médicas por contrato, permitindo o registro de horários, datas e médicos escalados de forma visual e intuitiva.

## ✨ Funcionalidades Implementadas

### 1. **Wizard de 3 Etapas**
- **Etapa 1 - Dados Básicos**: Preenchimento do formulário
- **Etapa 2 - Visualizar Escala**: Preview dos dados antes de salvar
- **Etapa 3 - Confirmar**: Confirmação final

### 2. **Formulário Inteligente**
- **Contrato**: Seleção única de contrato ativo
- **Data de Início**: Date picker moderno
- **Horário de Entrada/Saída**: Time pickers de 00:00 a 23:59
- **Médicos**: Seleção múltipla de médicos vinculados ao contrato
- **CPF**: Preenchido automaticamente com os médicos selecionados
- **Observações**: Campo de texto livre

### 3. **Visualização em Cards**
- Cards modernos com informações da escala
- Chips para data, horário e médicos
- Ações rápidas de editar e excluir
- Design responsivo

### 4. **Regras de Negócio**
- Apenas médicos vinculados ao contrato selecionado são listados
- Validação de campos obrigatórios
- Preview antes de salvar
- Confirmação antes de excluir

## 🗄️ Estrutura do Banco de Dados

### Tabela: `escalas_medicas`

```sql
CREATE TABLE escalas_medicas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id UUID NOT NULL REFERENCES contratos(id),
  data_inicio DATE NOT NULL,
  horario_entrada TIME NOT NULL,
  horario_saida TIME NOT NULL,
  medicos JSONB NOT NULL,
  observacoes TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES usuarios(id)
);
```

### Campo `medicos` (JSONB):
```json
[
  {
    "nome": "Dr. João Silva",
    "cpf": "123.456.789-00"
  },
  {
    "nome": "Dra. Maria Santos",
    "cpf": "987.654.321-00"
  }
]
```

## 📁 Arquivos Criados/Modificados

### Novos Arquivos:
1. **migrations/007_create_escalas_medicas.sql** - Script de criação da tabela
2. **src/pages/EscalasMedicas.tsx** - Componente principal da página
3. **ESCALAS_MEDICAS_README.md** - Este arquivo de documentação

### Arquivos Modificados:
1. **src/types/database.types.ts** - Adicionados tipos `EscalaMedica` e `MedicoEscala`
2. **src/App.tsx** - Adicionada rota `/escalas`
3. **src/components/layout/Layout.tsx** - Adicionado item "Escalas Médicas" no menu

## 🚀 Como Usar

### 1. Execute a Migration
No Supabase SQL Editor, execute:
```sql
-- Conteúdo do arquivo migrations/007_create_escalas_medicas.sql
```

### 2. Acesse a Página
- No menu lateral, clique em "Escalas Médicas"
- Ou acesse diretamente: `/escalas`

### 3. Criar Nova Escala
1. Clique no botão "Nova Escala"
2. **Etapa 1**: Preencha os dados
   - Selecione o contrato
   - Escolha a data de início
   - Defina os horários de entrada e saída
   - Selecione os médicos (múltipla seleção)
   - Adicione observações (opcional)
3. **Etapa 2**: Revise os dados em formato de tabela
4. **Etapa 3**: Confirme e salve

### 4. Editar/Excluir
- Clique no ícone de edição no card da escala
- Ou clique no ícone de lixeira para excluir (com confirmação)

## 🎨 Design

- **Padrão Visual**: Consistente com as outras páginas do sistema
- **Cores**: Gradiente azul-roxo nos botões principais
- **Cards**: Modernos com hover effects
- **Wizard**: Stepper com 3 etapas visuais
- **Responsivo**: Funciona em desktop, tablet e mobile

## 🔒 Permissões

- Acesso apenas para administradores Agir (corporativo e planta)
- Rota protegida com `requireAdminAgir`

## 🔄 Fluxo de Dados

1. Usuário seleciona contrato
2. Sistema busca médicos vinculados (tabela `usuario_contrato`)
3. Usuário preenche dados e seleciona médicos
4. Preview mostra dados formatados
5. Ao salvar, dados são inseridos como JSONB
6. Escalas são exibidas em cards na listagem

## 📊 Benefícios

✅ Interface intuitiva e moderna
✅ Validação em tempo real
✅ Preview antes de salvar
✅ Gestão visual de escalas
✅ Seleção múltipla de médicos
✅ Vínculo automático com contratos
✅ Histórico completo de escalas

## 🔧 Manutenção

Para adicionar novos campos:
1. Altere a migration SQL
2. Atualize a interface `EscalaMedica` em `database.types.ts`
3. Adicione campos no formulário em `EscalasMedicas.tsx`
4. Atualize o preview e os cards
