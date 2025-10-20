# Guia Completo: Inserir Usuários do CSV sem Autenticação

## Problema Identificado

A tabela `usuarios` possui uma constraint de foreign key que vincula `usuarios.id` à tabela `auth.users` do Supabase. Isso impede a inserção direta de usuários sem criar registros de autenticação.

## Solução em 3 Passos

### Passo 1: Remover a Constraint de Foreign Key

Execute o script `remove-fk-constraint-usuarios.sql` no Supabase SQL Editor:

```sql
-- Verificar o nome da constraint
SELECT
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
WHERE conrelid = 'usuarios'::regclass
AND contype = 'f';

-- Remover a constraint
ALTER TABLE usuarios
DROP CONSTRAINT IF EXISTS usuarios_id_fkey;
```

### Passo 2: Inserir os Usuários

Execute o script `insert-users-from-csv.sql` no Supabase SQL Editor.

Este script irá:
- Inserir 6 usuários na tabela `usuarios`
- Criar os vínculos na tabela `usuario_contrato`
- Todos dentro de uma transação (BEGIN/COMMIT)

### Passo 3 (Opcional): Recriar a Constraint com Validação Parcial

Se você quiser manter a integridade referencial para NOVOS usuários (criados via autenticação), você pode recriar a constraint de forma que ela se aplique apenas a novos registros:

```sql
-- NÃO recomendado se você pretende adicionar mais usuários sem autenticação
ALTER TABLE usuarios
ADD CONSTRAINT usuarios_id_fkey
FOREIGN KEY (id)
REFERENCES auth.users(id)
ON DELETE CASCADE
NOT VALID;  -- Não valida registros existentes

-- Posteriormente, você pode validar apenas novos registros
-- ALTER TABLE usuarios VALIDATE CONSTRAINT usuarios_id_fkey;
```

## Alternativa: Modificar a Tabela Permanentemente

Se você frequentemente precisará adicionar usuários sem autenticação, considere:

### Opção A: Remover a constraint permanentemente

```sql
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_id_fkey;
```

### Opção B: Tornar o ID independente

Criar uma nova coluna `auth_user_id` (nullable) que referencia auth.users, e manter `id` como chave primária independente:

```sql
-- Adicionar nova coluna
ALTER TABLE usuarios ADD COLUMN auth_user_id UUID;

-- Criar foreign key para a nova coluna
ALTER TABLE usuarios
ADD CONSTRAINT usuarios_auth_user_id_fkey
FOREIGN KEY (auth_user_id)
REFERENCES auth.users(id)
ON DELETE CASCADE;

-- Criar índice
CREATE INDEX idx_usuarios_auth_user_id ON usuarios(auth_user_id);
```

## Notas Importantes

1. **Usuários sem autenticação não poderão fazer login** - Eles existem apenas como registros no banco de dados
2. **Emails placeholder** - Os emails gerados seguem o padrão `{cpf}@terceiro.agir.com.br`
3. **Políticas RLS** - Verifique se as políticas de Row Level Security permitem acesso a esses registros
4. **Integridade dos dados** - Sem a constraint, você é responsável por garantir que os IDs são únicos e válidos

## Verificação Pós-Inserção

Após executar os scripts, verifique os usuários inseridos:

```sql
SELECT id, email, nome, cpf, tipo, codigomv, especialidade
FROM usuarios
WHERE email LIKE '%@terceiro.agir.com.br'
ORDER BY created_at DESC;
```

## Resumo dos Arquivos

- `remove-fk-constraint-usuarios.sql` - Remove a constraint de foreign key
- `insert-users-from-csv.sql` - Insere os 6 usuários do CSV
- `insert-users-from-csv.py` - Script Python que gera o SQL (já executado)
