#!/bin/bash

# Script wrapper para importar acessos do Data Warehouse
# Executado pelo cron às 01:00 e 13:00 diariamente

# Diretório do projeto
PROJECT_DIR="/home/admin/gestaodeacesso"

# Arquivo de log
LOG_FILE="/var/log/importacao-acessos.log"

# Início da execução
echo "========================================" >> "$LOG_FILE"
echo "Iniciando importação em $(date '+%Y-%m-%d %H:%M:%S %Z')" >> "$LOG_FILE"

# Navega para o diretório do projeto
cd "$PROJECT_DIR" || {
    echo "ERRO: Não foi possível acessar o diretório $PROJECT_DIR" >> "$LOG_FILE"
    exit 1
}

# Ativa o ambiente virtual
source venv/bin/activate || {
    echo "ERRO: Não foi possível ativar o ambiente virtual" >> "$LOG_FILE"
    exit 1
}

# Executa o script Python (500 registros por CPF)
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
