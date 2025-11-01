#!/bin/bash

echo "======================================"
echo "TESTE MANUAL DO SCRIPT DE PRODUTIVIDADE"
echo "======================================"
echo ""

# Localizar o script
SCRIPT_PATH="/root/coletar-produtividade-mv.py"

if [ ! -f "$SCRIPT_PATH" ]; then
    echo "❌ Script não encontrado em $SCRIPT_PATH"
    echo "Procurando em outros locais..."
    SCRIPT_PATH=$(find /root -name "coletar-produtividade-mv.py" 2>/dev/null | head -n 1)
    if [ -z "$SCRIPT_PATH" ]; then
        echo "❌ Script não encontrado. Abortando."
        exit 1
    fi
    echo "✅ Script encontrado em: $SCRIPT_PATH"
fi

echo "Script: $SCRIPT_PATH"
echo "Data/Hora: $(date)"
echo ""
echo "Iniciando execução em 3 segundos..."
sleep 3
echo ""

# Executar o script
cd "$(dirname $SCRIPT_PATH)"
python3 "$SCRIPT_PATH"

RESULT=$?

echo ""
echo "======================================"
if [ $RESULT -eq 0 ]; then
    echo "✅ Script executado com sucesso (exit code 0)"
else
    echo "❌ Script falhou (exit code $RESULT)"
fi
echo "======================================"
echo ""
echo "Para ver os logs completos:"
echo "  tail -f /var/log/produtividade-mv.log"
echo ""
