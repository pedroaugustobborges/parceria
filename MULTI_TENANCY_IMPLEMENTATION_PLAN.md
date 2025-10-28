# Plano de Implementação: Sistema Multi-Tenancy por Unidade Hospitalar

## 📋 Análise do Requisito

### Necessidades Identificadas:
1. **Diferenciação de Unidades Hospitalares**: Acessos já possuem campo `planta` identificando a unidade
2. **Contratos vinculados a Unidades**: Cada contrato deve pertencer a uma única unidade hospitalar
3. **Nova hierarquia de administradores**:
   - `administrador-agir-corporativo`: Acesso total a todas as unidades (master)
   - `administrador-agir-planta`: Acesso completo, mas apenas à sua unidade específica
   - Manter compatibilidade com `administrador-terceiro` e `terceiro`

---

## 🏗️ Arquitetura Proposta

### 1. Modelo de Dados

#### 1.1. Nova Tabela: `unidades_hospitalares`
```sql
CREATE TABLE unidades_hospitalares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(50) UNIQUE NOT NULL,  -- Código da planta (ex: "H1", "H2")
  nome VARCHAR(255) NOT NULL,           -- Nome da unidade (ex: "Hospital Santa Casa")
  endereco TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_unidades_codigo ON unidades_hospitalares(codigo);
CREATE INDEX idx_unidades_ativo ON unidades_hospitalares(ativo);

-- Trigger para updated_at
CREATE TRIGGER update_unidades_hospitalares_updated_at
  BEFORE UPDATE ON unidades_hospitalares
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

#### 1.2. Alteração na Tabela `contratos`
```sql
-- Adicionar coluna unidade_hospitalar_id
ALTER TABLE contratos
ADD COLUMN unidade_hospitalar_id UUID REFERENCES unidades_hospitalares(id);

-- Criar índice
CREATE INDEX idx_contratos_unidade ON contratos(unidade_hospitalar_id);

-- Migração de dados: criar unidades a partir de plantas existentes e vincular
-- Isso será feito após popular a tabela unidades_hospitalares
```

#### 1.3. Alteração na Tabela `usuarios`
```sql
-- Adicionar coluna unidade_hospitalar_id (apenas para admins de planta)
ALTER TABLE usuarios
ADD COLUMN unidade_hospitalar_id UUID REFERENCES unidades_hospitalares(id);

-- Criar índice
CREATE INDEX idx_usuarios_unidade ON usuarios(unidade_hospitalar_id);
```

#### 1.4. Alteração na Tabela `produtividade`
```sql
-- Adicionar coluna para identificar a unidade (se não houver já)
ALTER TABLE produtividade
ADD COLUMN unidade_hospitalar_id UUID REFERENCES unidades_hospitalares(id);

-- Criar índice
CREATE INDEX idx_produtividade_unidade ON produtividade(unidade_hospitalar_id);
```

### 2. Tipos de Usuário Atualizados

```typescript
export type UserRole =
  | 'administrador-agir-corporativo'  // Master - acesso a todas unidades
  | 'administrador-agir-planta'       // Admin de uma unidade específica
  | 'administrador-terceiro'          // Admin de terceiro (sem mudanças)
  | 'terceiro';                       // Terceiro (sem mudanças)
```

### 3. Row Level Security (RLS) Policies

#### 3.1. Política para `contratos`
```sql
-- Enable RLS
ALTER TABLE contratos ENABLE ROW LEVEL SECURITY;

-- Policy: Corporativo vê tudo
CREATE POLICY "corporativo_all_contratos" ON contratos
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo = 'administrador-agir-corporativo'
    )
  );

-- Policy: Admin de planta vê apenas sua unidade
CREATE POLICY "planta_own_unit_contratos" ON contratos
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo = 'administrador-agir-planta'
      AND usuarios.unidade_hospitalar_id = contratos.unidade_hospitalar_id
    )
  );

-- Policy: Admin terceiro vê apenas contratos onde tem usuários vinculados
CREATE POLICY "terceiro_admin_contratos" ON contratos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u1
      JOIN usuarios u2 ON u2.contrato_id = contratos.id
      WHERE u1.id = auth.uid()
      AND u1.tipo = 'administrador-terceiro'
      AND u2.contrato_id = u1.contrato_id
    )
  );
```

#### 3.2. Política para `acessos`
```sql
ALTER TABLE acessos ENABLE ROW LEVEL SECURITY;

-- Policy: Corporativo vê tudo
CREATE POLICY "corporativo_all_acessos" ON acessos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo = 'administrador-agir-corporativo'
    )
  );

-- Policy: Admin de planta vê apenas sua unidade
CREATE POLICY "planta_own_unit_acessos" ON acessos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      JOIN unidades_hospitalares uh ON uh.id = usuarios.unidade_hospitalar_id
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo = 'administrador-agir-planta'
      AND acessos.planta = uh.codigo
    )
  );
```

#### 3.3. Política para `produtividade`
```sql
ALTER TABLE produtividade ENABLE ROW LEVEL SECURITY;

-- Similar às políticas de acessos
CREATE POLICY "corporativo_all_produtividade" ON produtividade
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo = 'administrador-agir-corporativo'
    )
  );

CREATE POLICY "planta_own_unit_produtividade" ON produtividade
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo = 'administrador-agir-planta'
      AND usuarios.unidade_hospitalar_id = produtividade.unidade_hospitalar_id
    )
  );
```

---

## 🔄 Plano de Migração de Dados

### Etapa 1: Popular `unidades_hospitalares`
```sql
-- Extrair valores únicos de planta da tabela acessos
INSERT INTO unidades_hospitalares (codigo, nome, ativo)
SELECT DISTINCT
  planta,
  'Unidade ' || planta,  -- Nome temporário
  true
FROM acessos
WHERE planta IS NOT NULL
ORDER BY planta;
```

### Etapa 2: Vincular `produtividade` às unidades
```sql
-- Isso requer lógica de negócio para mapear codigo_mv -> planta
-- Pode ser necessário criar uma tabela auxiliar ou usar dados existentes
```

### Etapa 3: Migrar usuários `administrador-agir` existentes
```sql
-- Converter todos os administrador-agir para corporativo (inicialmente)
UPDATE usuarios
SET tipo = 'administrador-agir-corporativo'
WHERE tipo = 'administrador-agir';
```

---

## 💻 Mudanças no Frontend

### 1. Atualizar `database.types.ts`
```typescript
export type UserRole =
  | 'administrador-agir-corporativo'
  | 'administrador-agir-planta'
  | 'administrador-terceiro'
  | 'terceiro';

export interface UnidadeHospitalar {
  id: string;
  codigo: string;
  nome: string;
  endereco: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Usuario {
  id: string;
  email: string;
  nome: string;
  cpf: string;
  tipo: UserRole;
  contrato_id: string | null;
  codigomv: string | null;
  especialidade: string[] | null;
  unidade_hospitalar_id: string | null;  // NOVO
  created_at: string;
  updated_at: string;
}

export interface Contrato {
  id: string;
  nome: string;
  numero_contrato: string | null;
  empresa: string;
  data_inicio: string;
  data_fim: string | null;
  ativo: boolean;
  unidade_hospitalar_id: string | null;  // NOVO
  created_at: string;
  updated_at: string;
}

export interface Produtividade {
  // ... campos existentes
  unidade_hospitalar_id: string | null;  // NOVO
}
```

### 2. Atualizar `AuthContext.tsx`
```typescript
interface AuthContextType {
  user: User | null;
  userProfile: Usuario | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isAdminAgirCorporativo: boolean;     // NOVO
  isAdminAgirPlanta: boolean;          // NOVO
  isAdminTerceiro: boolean;
  isTerceiro: boolean;
  unidadeHospitalarId: string | null;  // NOVO
}

// No provider:
const isAdminAgirCorporativo = userProfile?.tipo === 'administrador-agir-corporativo';
const isAdminAgirPlanta = userProfile?.tipo === 'administrador-agir-planta';
const isAdminTerceiro = userProfile?.tipo === 'administrador-terceiro';
const isTerceiro = userProfile?.tipo === 'terceiro';
const isAdmin = isAdminAgirCorporativo || isAdminAgirPlanta || isAdminTerceiro;
const unidadeHospitalarId = userProfile?.unidade_hospitalar_id || null;
```

### 3. Criar Hook de Filtragem Automática
```typescript
// src/hooks/useUnidadeFilter.ts
export const useUnidadeFilter = () => {
  const { isAdminAgirPlanta, unidadeHospitalarId } = useAuth();

  const applyUnidadeFilter = <T extends { unidade_hospitalar_id?: string | null }>(
    query: any
  ) => {
    if (isAdminAgirPlanta && unidadeHospitalarId) {
      return query.eq('unidade_hospitalar_id', unidadeHospitalarId);
    }
    return query;
  };

  return { applyUnidadeFilter, unidadeHospitalarId };
};
```

### 4. Atualizar Formulários

#### 4.1. Formulário de Contratos
- Adicionar campo `Select` para escolher a unidade hospitalar
- Obrigatório para admins corporativos
- Auto-preenchido e read-only para admins de planta

#### 4.2. Formulário de Usuários
- Ao criar `administrador-agir-planta`, exigir seleção de unidade
- Campo `tipo` deve ter as novas opções
- Validação: `administrador-agir-planta` DEVE ter `unidade_hospitalar_id`

### 5. Atualizar Queries no Dashboard
```typescript
// Exemplo de aplicação do filtro
const { data: contratos } = await supabase
  .from('contratos')
  .select('*')
  .eq('ativo', true);
  // RLS automaticamente filtra por unidade!

// Para acessos (relacionamento via código de planta)
const { data: acessos } = await supabase
  .from('acessos')
  .select('*');
  // RLS filtra automaticamente
```

---

## ✅ Checklist de Implementação

### Database:
- [ ] Criar tabela `unidades_hospitalares`
- [ ] Popular com dados de plantas existentes
- [ ] Adicionar coluna `unidade_hospitalar_id` em `contratos`
- [ ] Adicionar coluna `unidade_hospitalar_id` em `usuarios`
- [ ] Adicionar coluna `unidade_hospitalar_id` em `produtividade`
- [ ] Migrar dados existentes
- [ ] Criar policies RLS para todas as tabelas
- [ ] Testar policies com diferentes tipos de usuário

### TypeScript Types:
- [ ] Atualizar `UserRole` type
- [ ] Criar interface `UnidadeHospitalar`
- [ ] Atualizar interface `Usuario`
- [ ] Atualizar interface `Contrato`
- [ ] Atualizar interface `Produtividade`

### Authentication:
- [ ] Atualizar `AuthContext` com novos roles
- [ ] Adicionar `unidadeHospitalarId` ao contexto
- [ ] Criar helpers `isAdminAgirCorporativo` e `isAdminAgirPlanta`

### UI - Unidades:
- [ ] Criar página de gerenciamento de Unidades Hospitalares
- [ ] CRUD completo (apenas para corporativo)
- [ ] Listagem com filtros

### UI - Contratos:
- [ ] Adicionar campo de seleção de unidade no formulário
- [ ] Exibir unidade na listagem
- [ ] Filtro por unidade (para corporativos)

### UI - Usuários:
- [ ] Atualizar dropdown de tipo com novos roles
- [ ] Adicionar campo de seleção de unidade (condicional)
- [ ] Validação: planta requer unidade
- [ ] Exibir unidade na listagem

### UI - Dashboard:
- [ ] Verificar que RLS está filtrando corretamente
- [ ] Adicionar indicador visual de unidade ativa (para admin planta)
- [ ] Testar todas as queries e filtros

### UI - Layout:
- [ ] Adicionar badge/chip mostrando unidade do usuário (se aplicável)
- [ ] Adicionar item de menu "Unidades" (apenas corporativo)

### Testes:
- [ ] Testar login como corporativo (deve ver tudo)
- [ ] Testar login como admin planta (deve ver só sua unidade)
- [ ] Testar criação de contratos em diferentes unidades
- [ ] Testar criação de usuários de planta
- [ ] Testar filtros e queries do dashboard
- [ ] Testar inconsistências com dados multi-unidade

---

## 🚨 Considerações de Segurança

1. **RLS é obrigatório**: Todas as queries devem confiar no RLS do Supabase
2. **Validação dupla**: Frontend valida, mas backend (RLS) é a verdade absoluta
3. **Auditoria**: Considerar adicionar campos `created_by` e `updated_by`
4. **Migração segura**: Fazer backup antes de alterar schema
5. **Testes extensivos**: Testar cada tipo de usuário em cada operação

---

## 📊 Impacto Estimado

### Arquivos a modificar:
- `database.types.ts` - Types
- `AuthContext.tsx` - Context
- `Dashboard.tsx` - Queries e filtros
- `Contratos.tsx` - Form e listagem
- `Usuarios.tsx` - Form e listagem
- `Layout.tsx` - Menu e indicadores
- Nova página: `UnidadesHospitalares.tsx`

### Tempo estimado:
- Database setup: 2-3 horas
- Types e Context: 1 hora
- UI Unidades: 2 horas
- UI Contratos: 1 hora
- UI Usuários: 1 hora
- Dashboard updates: 2 horas
- Testes: 2-3 horas
- **Total: 11-13 horas**

---

## 🎯 Próximos Passos

1. Aprovar este plano de implementação
2. Criar branch `feature/multi-tenancy`
3. Começar pelo database (migration script)
4. Seguir a ordem do checklist
5. Testar cada etapa antes de avançar
