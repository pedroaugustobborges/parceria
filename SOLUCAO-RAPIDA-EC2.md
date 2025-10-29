# Solução Rápida - Criar Script na EC2

## Passo 1: Verificar onde está o script

```bash
# Veja se o script existe
cat /usr/local/bin/importar-acessos-wrapper.sh

# Se não existir, vamos criá-lo agora
```

## Passo 2: Verificar estrutura do projeto

```bash
# Onde você está?
pwd

# Verificar se o projeto está neste diretório
ls -la

# Verificar se o script Python existe
ls -la importar-ultimos-10000-acessos.py

# Verificar se tem ambiente virtual
ls -la venv/
```

## Passo 3: Criar o script wrapper diretamente no servidor

Execute este comando completo (copie tudo de uma vez):

```bash
sudo tee /usr/local/bin/importar-acessos-wrapper.sh > /dev/null << 'EOFSCRIPT'
#!/bin/bash

# Script wrapper para importar acessos do Data Warehouse
# Executado pelo cron às 01:00 e 13:00 diariamente

# Diretório do projeto (AJUSTE SE NECESSÁRIO)
PROJECT_DIR="/home/admin/gestaodeacesso"

# Arquivo de log
LOG_FILE="/var/log/importacao-acessos.log"

# Início da execução
echo "========================================" >> "$LOG_FILE"
echo "Iniciando importação em $(date '+%Y-%m-%d %H:%M:%S %Z')" >> "$LOG_FILE"
echo "Diretório do projeto: $PROJECT_DIR" >> "$LOG_FILE"

# Navega para o diretório do projeto
if [ ! -d "$PROJECT_DIR" ]; then
    echo "ERRO: Diretório $PROJECT_DIR não existe!" >> "$LOG_FILE"
    exit 1
fi

cd "$PROJECT_DIR" || {
    echo "ERRO: Não foi possível acessar o diretório $PROJECT_DIR" >> "$LOG_FILE"
    exit 1
}

echo "Diretório atual: $(pwd)" >> "$LOG_FILE"

# Verifica se o ambiente virtual existe
if [ ! -d "venv" ]; then
    echo "ERRO: Ambiente virtual 'venv' não encontrado em $(pwd)" >> "$LOG_FILE"
    exit 1
fi

# Ativa o ambiente virtual
source venv/bin/activate || {
    echo "ERRO: Não foi possível ativar o ambiente virtual" >> "$LOG_FILE"
    exit 1
}

echo "Ambiente virtual ativado" >> "$LOG_FILE"

# Verifica se o script Python existe
if [ ! -f "importar-ultimos-10000-acessos.py" ]; then
    echo "ERRO: Script importar-ultimos-10000-acessos.py não encontrado em $(pwd)" >> "$LOG_FILE"
    exit 1
fi

# Executa o script Python (500 registros por CPF)
echo "Executando script Python..." >> "$LOG_FILE"
python3 importar-ultimos-10000-acessos.py 500 >> "$LOG_FILE" 2>&1

# Status de saída
EXIT_CODE=$?
if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Importação concluída com sucesso em $(date '+%Y-%m-%d %H:%M:%S %Z')" >> "$LOG_FILE"
else
    echo "❌ Importação falhou com código de erro: $EXIT_CODE em $(date '+%Y-%m-%d %H:%M:%S %Z')" >> "$LOG_FILE"
fi

echo "========================================" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

exit $EXIT_CODE
EOFSCRIPT
```

## Passo 4: Dar permissão de execução

```bash
sudo chmod +x /usr/local/bin/importar-acessos-wrapper.sh
```

## Passo 5: Verificar se o script foi criado

```bash
# Ver o conteúdo do script
cat /usr/local/bin/importar-acessos-wrapper.sh

# Ver permissões
ls -l /usr/local/bin/importar-acessos-wrapper.sh
```

## Passo 6: Testar a execução

```bash
# Executar o script
/usr/local/bin/importar-acessos-wrapper.sh

# Ver o log
cat /var/log/importacao-acessos.log
```

## Se ainda não funcionar - Debug Manual

### A. Verificar diretório do projeto

```bash
# Mostrar diretório atual
pwd

# Se não estiver em /home/admin/gestaodeacesso, descubra onde está
find /home -name "importar-ultimos-10000-acessos.py" 2>/dev/null
```

### B. Ajustar caminho no script se necessário

Se o projeto estiver em outro lugar (por exemplo `/root/gestaodeacesso`), edite o script:

```bash
sudo nano /usr/local/bin/importar-acessos-wrapper.sh

# Altere a linha:
# PROJECT_DIR="/home/admin/gestaodeacesso"
# Para o caminho correto

# Salve: Ctrl+O, Enter, Ctrl+X
```

### C. Criar ambiente virtual se não existir

```bash
cd ~/gestaodeacesso  # ou o caminho correto
python3 -m venv venv
source venv/bin/activate
pip install psycopg2-binary python-dotenv supabase
```

### D. Verificar se o .env existe

```bash
cat .env

# Deve mostrar:
# VITE_SUPABASE_URL=...
# VITE_SUPABASE_SERVICE_ROLE_KEY=...
```

### E. Testar script Python diretamente

```bash
cd ~/gestaodeacesso
source venv/bin/activate
python3 importar-ultimos-10000-acessos.py 10
```

## Comandos de Diagnóstico

Execute estes para identificar o problema:

```bash
echo "=== Verificação de Ambiente ==="
echo "Usuário atual: $(whoami)"
echo "Diretório atual: $(pwd)"
echo ""
echo "Existe script wrapper?"
ls -l /usr/local/bin/importar-acessos-wrapper.sh
echo ""
echo "Existe projeto?"
ls -l ~/gestaodeacesso/importar-ultimos-10000-acessos.py
echo ""
echo "Existe venv?"
ls -l ~/gestaodeacesso/venv/bin/activate
echo ""
echo "Existe .env?"
ls -l ~/gestaodeacesso/.env
echo ""
echo "Timezone:"
timedatectl | grep "Time zone"
```

## Resultado Esperado

Após executar `/usr/local/bin/importar-acessos-wrapper.sh`, você deve ver no log:

```bash
tail -f /var/log/importacao-acessos.log

# Saída esperada:
# ========================================
# Iniciando importação em 2025-10-29 14:30:00 -03
# Diretório do projeto: /home/admin/gestaodeacesso
# Diretório atual: /home/admin/gestaodeacesso
# Ambiente virtual ativado
# Executando script Python...
# ======================================================================
# IMPORTAÇÃO DE ACESSOS DO DATA WAREHOUSE PARA SUPABASE
# ...
# ✅ Importação concluída com sucesso em ...
```

## Se tudo funcionar

Configure o cron:

```bash
(crontab -l 2>/dev/null; cat << 'EOF'
# Importação de Acessos - 01:00 e 13:00 (Horário de Brasília)
0 1 * * * /usr/local/bin/importar-acessos-wrapper.sh
0 13 * * * /usr/local/bin/importar-acessos-wrapper.sh
EOF
) | crontab -

# Verificar
crontab -l
```
