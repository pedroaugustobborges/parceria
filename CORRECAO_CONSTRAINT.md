# 🔧 Correção do Erro de Constraint

## Problema Identificado
O banco de dados tinha uma constraint antiga que só aceitava os valores antigos de `tipo`:
- `'administrador-agir'`
- `'administrador-terceiro'`
- `'terceiro'`

E precisamos adicionar:
- `'administrador-agir-corporativo'`
- `'administrador-agir-planta'`

## ✅ Solução Aplicada

Atualizei o script `migrations/001_multi_tenancy_setup.sql` para incluir no início (PART 0) a correção da constraint.

## 🚀 Como Executar Agora

### Opção 1: Script Completo Atualizado (RECOMENDADO)

1. **Abra o Supabase Dashboard** → SQL Editor
2. **Cole TODO o conteúdo** do arquivo `migrations/001_multi_tenancy_setup.sql` (atualizado)
3. **Execute** (Run)

O script agora faz:
1. Remove a constraint antiga
2. Cria a nova constraint com todos os valores
3. Continua com a migração normalmente

---

### Opção 2: Executar em Duas Etapas

**Etapa 1: Corrigir Constraint**
```sql
-- Execute isto primeiro
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_tipo_check;

ALTER TABLE usuarios
ADD CONSTRAINT usuarios_tipo_check CHECK (
  tipo IN (
    'administrador-agir',
    'administrador-agir-corporativo',
    'administrador-agir-planta',
    'administrador-terceiro',
    'terceiro'
  )
);
```

**Etapa 2: Executar Migração Completa**
- Cole o conteúdo de `migrations/001_multi_tenancy_setup.sql`
- Execute

---

## ✅ Validação

Após executar, valide com:

```sql
-- 1. Ver seu usuário atualizado
SELECT id, email, nome, tipo FROM usuarios WHERE email = 'pedro.borges@agirsaude.org.br';
```

**Resultado esperado:**
- `tipo` = `'administrador-agir-corporativo'`

```sql
-- 2. Ver as unidades criadas
SELECT * FROM unidades_hospitalares ORDER BY codigo;
```

**Resultado esperado:** 3 linhas (HUGOL, HECAD, CRER)

```sql
-- 3. Verificar constraint atualizada
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'usuarios_tipo_check';
```

**Resultado esperado:**
- Constraint com os 5 valores permitidos

---

## 🎯 Pode Executar Agora!

O script está corrigido e pronto. Execute a **Opção 1** (recomendado) para resolver tudo de uma vez.

Me avise quando terminar! 🚀
