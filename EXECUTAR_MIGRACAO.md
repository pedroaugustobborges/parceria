# 🚀 Como Executar a Migração Multi-Tenancy

## ⚠️ IMPORTANTE - Leia Antes de Executar!

### Pré-requisitos:
1. ✅ Fazer BACKUP do banco de dados
2. ✅ Estar em ambiente de desenvolvimento (não produção, inicialmente)
3. ✅ Ter acesso ao Supabase Dashboard ou psql

---

## 📋 Opção 1: Supabase Dashboard (Recomendado)

### Passo a Passo:

1. **Acesse o Supabase Dashboard**
   - Vá para: https://supabase.com/dashboard
   - Selecione seu projeto

2. **Abra o SQL Editor**
   - Menu lateral → **SQL Editor**
   - Clique em **New Query**

3. **Cole o Script de Migração**
   - Abra o arquivo: `migrations/001_multi_tenancy_setup.sql`
   - Copie TODO o conteúdo
   - Cole no SQL Editor

4. **Execute o Script**
   - Clique em **Run** (ou Ctrl+Enter)
   - Aguarde a execução (pode demorar 10-30 segundos)

5. **Verifique o Resultado**
   - Se aparecer "Success! No rows returned", está correto
   - Se houver erro, copie a mensagem e me envie

6. **Validação**
   - Execute as queries de validação abaixo

---

## 📋 Opção 2: Via psql (Terminal)

```bash
# Conectar ao banco
psql "postgresql://[USER]:[PASSWORD]@[HOST]:[PORT]/[DATABASE]"

# Executar a migração
\i migrations/001_multi_tenancy_setup.sql

# Verificar
SELECT * FROM unidades_hospitalares;
```

---

## ✅ Queries de Validação

Após executar a migração, rode estas queries no SQL Editor:

### 1. Verificar Unidades Criadas
```sql
SELECT * FROM unidades_hospitalares ORDER BY codigo;
```
**Resultado esperado:** 3 linhas (HUGOL, HECAD, CRER)

### 2. Verificar Contratos Vinculados ao HUGOL
```sql
SELECT
  c.nome,
  c.empresa,
  uh.nome as unidade
FROM contratos c
LEFT JOIN unidades_hospitalares uh ON uh.id = c.unidade_hospitalar_id
ORDER BY c.nome;
```
**Resultado esperado:** Todos os contratos devem ter `unidade = "Hospital de Urgências de Goiânia - HUGOL"`

### 3. Verificar Produtividade Vinculada ao HUGOL
```sql
SELECT
  COUNT(*) as total_registros,
  uh.nome as unidade
FROM produtividade p
LEFT JOIN unidades_hospitalares uh ON uh.id = p.unidade_hospitalar_id
GROUP BY uh.nome;
```
**Resultado esperado:** Todos os registros vinculados ao HUGOL

### 4. Verificar Tipos de Usuário
```sql
SELECT tipo, COUNT(*) as quantidade
FROM usuarios
GROUP BY tipo
ORDER BY tipo;
```
**Resultado esperado:**
- `administrador-agir` deve ter 0 registros
- `administrador-agir-corporativo` deve ter os antigos admins-agir

### 5. Verificar RLS Ativado
```sql
SELECT
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('unidades_hospitalares', 'contratos', 'acessos', 'produtividade', 'usuarios')
ORDER BY tablename;
```
**Resultado esperado:** Todas as tabelas com `rls_enabled = true`

### 6. Listar Policies Criadas
```sql
SELECT
  schemaname,
  tablename,
  policyname
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```
**Resultado esperado:** Múltiplas policies para cada tabela

---

## 🔄 Se Algo Der Errado (Rollback)

Se precisar reverter a migração:

1. Abra o SQL Editor
2. Role até o final do arquivo `001_multi_tenancy_setup.sql`
3. Copie o bloco comentado "ROLLBACK SCRIPT"
4. Descomente (remova os `/*` e `*/`)
5. Execute

**OU** execute este comando rápido:

```sql
-- Quick rollback
DROP TABLE IF EXISTS unidades_hospitalares CASCADE;
ALTER TABLE contratos DROP COLUMN IF EXISTS unidade_hospitalar_id;
ALTER TABLE usuarios DROP COLUMN IF EXISTS unidade_hospitalar_id;
ALTER TABLE produtividade DROP COLUMN IF EXISTS unidade_hospitalar_id;
UPDATE usuarios SET tipo = 'administrador-agir' WHERE tipo = 'administrador-agir-corporativo';
```

---

## 📊 Próximos Passos Após Migração Bem-Sucedida

1. ✅ Me avise que a migração foi executada
2. ✅ Envie o resultado das queries de validação
3. ✅ Continuarei com a atualização do frontend (Types, Context, UI)

---

## 🆘 Suporte

Se encontrar qualquer erro:
1. **NÃO ENTRE EM PÂNICO** 😊
2. Copie a mensagem de erro completa
3. Me envie junto com qual query estava executando
4. Temos o rollback preparado para reverter tudo

**Pronto para executar?** 🚀
