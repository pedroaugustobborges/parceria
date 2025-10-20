# Importação de Acessos - Versão Atualizada

## Mudanças Implementadas

O script `importar-ultimos-10000-acessos.py` foi completamente reestruturado para atender aos seguintes requisitos:

### ✅ Requisito 1: Filtrar por CPFs da Tabela Usuarios
- **ANTES**: Importava os últimos 10.000 registros de qualquer CPF
- **AGORA**: Importa APENAS registros de CPFs que existem na tabela `usuarios`

### ✅ Requisito 2: Limitar a 50 Registros por CPF
- **ANTES**: Limite global de 10.000 registros total
- **AGORA**: Até 50 registros mais recentes para cada CPF individual

### ✅ Requisito 3: Evitar Duplicatas
- **MANTIDO**: Continua verificando se o registro já existe antes de inserir
- Verifica a combinação única: `cpf + data_acesso + sentido`

## Como Funciona Agora

### Fluxo de Execução:

1. **Conecta ao Supabase**
   - Busca todos os CPFs da tabela `usuarios`
   - Exibe quantos CPFs foram encontrados

2. **Conecta ao Data Warehouse**
   - Para CADA CPF encontrado na tabela usuarios:
     - Busca os últimos 50 acessos daquele CPF
     - Ordena do mais antigo para o mais recente
   - Exibe progresso a cada 10 CPFs processados

3. **Insere no Supabase**
   - Para cada registro coletado:
     - Verifica se já existe (CPF + data_acesso + sentido)
     - Se NÃO existe: insere
     - Se JÁ existe: pula (duplicado)
   - Exibe progresso a cada 100 registros processados

4. **Resumo Final**
   - Total processado
   - Inseridos com sucesso
   - Duplicados (ignorados)
   - Erros

## Uso do Script

### Uso Básico (50 registros por CPF):
```bash
python importar-ultimos-10000-acessos.py
```

### Uso com Limite Personalizado:
```bash
# Exemplo: 100 registros por CPF
python importar-ultimos-10000-acessos.py 100

# Exemplo: 20 registros por CPF
python importar-ultimos-10000-acessos.py 20
```

## Exemplos de Saída

### Exemplo 1: Execução Normal
```
======================================================================
IMPORTAÇÃO DE ACESSOS DO DATA WAREHOUSE PARA SUPABASE
(Apenas para CPFs cadastrados na tabela usuarios)
Horário: 2025-10-19 20:30:00
======================================================================

📋 Buscando CPFs da tabela usuarios...
  ✅ 45 CPFs encontrados na tabela usuarios

✅ Conectado ao Data Warehouse: db-rds-postgres.cx4bovrfmkbp.sa-east-1.rds.amazonaws.com
✅ Conectado ao Supabase: https://your-project.supabase.co

📥 Extraindo os últimos 50 registros para cada CPF do Data Warehouse...

📊 Executando query para buscar os últimos 50 registros para cada um dos 45 CPFs...
  Progresso: 10/45 CPFs processados - 485 registros coletados
  Progresso: 20/45 CPFs processados - 967 registros coletados
  Progresso: 30/45 CPFs processados - 1450 registros coletados
  Progresso: 40/45 CPFs processados - 1925 registros coletados
  Progresso: 45/45 CPFs processados - 2180 registros coletados
  ✅ Total de registros encontrados: 2180

📤 Iniciando inserção de 2180 registros no Supabase...
  Progresso: 100/2180 - Inseridos: 87 | Duplicados: 13 | Erros: 0
  Progresso: 200/2180 - Inseridos: 178 | Duplicados: 22 | Erros: 0
  ...
  Progresso: 2180/2180 - Inseridos: 1950 | Duplicados: 230 | Erros: 0

✅ Importação concluída!
  📊 Resumo:
     - Total processado: 2180
     - Inseridos com sucesso: 1950
     - Duplicados (ignorados): 230
     - Erros: 0

🔌 Conexão com o Data Warehouse encerrada.
```

### Exemplo 2: Nenhum CPF na Tabela Usuarios
```
📋 Buscando CPFs da tabela usuarios...
  ✅ 0 CPFs encontrados na tabela usuarios

⚠️ Nenhum CPF encontrado na tabela usuarios. Nada para importar.
```

## Funções Adicionadas

### `buscar_cpfs_usuarios(supabase: Client)`
```python
"""Busca todos os CPFs da tabela usuarios."""
```
- Retorna: Lista de strings com os CPFs
- Exemplo: ['75271168115', '4787922122', '3391151145', ...]

### `extrair_acessos(conn, cpfs_usuarios, limite_por_cpf=50)`
```python
"""
Extrai os últimos N acessos do banco de dados para cada CPF presente na tabela usuarios.

Args:
    conn: Conexão com o Data Warehouse
    cpfs_usuarios: Lista de CPFs da tabela usuarios
    limite_por_cpf: Número máximo de registros por CPF (padrão: 50)
"""
```
- Itera sobre cada CPF
- Busca até `limite_por_cpf` registros mais recentes
- Retorna todos os registros em ordem cronológica

## Verificação de Duplicatas

A função `registro_existe()` continua verificando duplicatas usando:
```python
cpf + data_acesso + sentido
```

Esta combinação é considerada única porque:
- Um CPF não pode ter duas entradas/saídas no mesmo instante
- A combinação dos três campos identifica unicamente um acesso

## Cálculo de Registros Esperados

### Cenário Ideal:
- **N** CPFs na tabela usuarios
- **50** registros por CPF
- **Total máximo**: N × 50 registros

### Exemplo Real:
- 6 CPFs (do arquivo new_users.csv)
- 50 registros por CPF
- Total máximo: 300 registros

### Fatores que Reduzem o Total:
1. CPF pode ter menos de 50 acessos no Data Warehouse
2. Registros duplicados são ignorados
3. Erros de conexão ou dados inválidos

## Requisitos do Ambiente

### Variáveis de Ambiente (.env):
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Dependências Python:
```
psycopg2
supabase
python-dotenv
```

## Tratamento de Erros

### Erros Individuais de CPF:
- Se um CPF falhar, continua processando os demais
- Exibe mensagem de aviso no console
- Não interrompe a execução

### Erros Críticos:
- Falha na conexão com Data Warehouse
- Falha na conexão com Supabase
- Erro ao buscar CPFs da tabela usuarios
- Nesses casos, o script é interrompido

## Logs e Monitoramento

### Progresso de CPFs:
- Atualização a cada 10 CPFs processados
- Mostra total de registros coletados até o momento

### Progresso de Inserção:
- Atualização a cada 100 registros processados
- Mostra: inseridos, duplicados, erros

### Resumo Final:
- Total processado
- Total inserido
- Total de duplicados ignorados
- Total de erros

## Comparação: Antes vs Depois

| Aspecto | ANTES | DEPOIS |
|---------|-------|--------|
| Filtro de CPF | Nenhum (todos os CPFs) | Apenas CPFs da tabela usuarios |
| Limite | 10.000 registros total | 50 registros por CPF |
| Lógica de busca | Query única global | Query individual por CPF |
| Duplicatas | Verificação mantida | Verificação mantida |
| Progressão | Por registros | Por CPFs + registros |
| Uso de argumento | Limite total | Limite por CPF |

## Otimizações Futuras Possíveis

1. **Batch Processing**: Agrupar inserções em lotes (ex: 100 registros por vez)
2. **Parallel Processing**: Processar múltiplos CPFs simultaneamente
3. **Cache de Duplicatas**: Manter cache em memória dos registros existentes
4. **Incremental Import**: Importar apenas registros mais novos que o último importado

## Segurança

- ✅ Usa variáveis de ambiente para credenciais
- ✅ Service Role Key do Supabase (bypass RLS)
- ✅ Credenciais do Data Warehouse em código (considere mover para .env)
- ⚠️ Recomendação: Mover credenciais DW para variáveis de ambiente

## Conclusão

O script agora está totalmente adaptado para importar APENAS os acessos relevantes:
- ✅ Somente CPFs cadastrados na tabela usuarios
- ✅ Máximo de 50 registros por CPF
- ✅ Sem duplicatas
- ✅ Progresso claro e detalhado
- ✅ Tratamento robusto de erros
