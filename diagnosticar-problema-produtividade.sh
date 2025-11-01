#!/bin/bash

echo "======================================"
echo "DIAGNÓSTICO DO SCRIPT DE PRODUTIVIDADE"
echo "Data: $(date)"
echo "Hostname: $(hostname)"
echo "Sistema: $(lsb_release -d 2>/dev/null | cut -f2)"
echo "======================================"
echo ""

# VERIFICAÇÃO IMPORTANTE: Sistema precisa reiniciar?
if [ -f /var/run/reboot-required ]; then
    echo "⚠️  ATENÇÃO: SISTEMA PRECISA SER REINICIADO!"
    echo "   Arquivos que requerem reinício:"
    if [ -f /var/run/reboot-required.pkgs ]; then
        cat /var/run/reboot-required.pkgs
    fi
    echo ""
fi

# 1. Verificar últimas execuções do cron
echo "1. ÚLTIMAS EXECUÇÕES DO CRON:"
echo "--------------------------------------"
# Ubuntu 25.04 usa journalctl para logs do cron
echo "Logs do cron nas últimas 48 horas:"
journalctl -u cron.service --since "48 hours ago" --no-pager | grep -i "produtividade\|coletar" | tail -n 30
if [ $? -ne 0 ]; then
    echo "Tentando logs do syslog..."
    grep -i "cron.*produtividade\|cron.*coletar" /var/log/syslog 2>/dev/null | tail -n 30
fi
echo ""

# 2. Verificar log do script de produtividade
echo "2. ÚLTIMAS 100 LINHAS DO LOG DO SCRIPT:"
echo "--------------------------------------"
if [ -f /var/log/produtividade-mv.log ]; then
    tail -n 100 /var/log/produtividade-mv.log
else
    echo "❌ Arquivo /var/log/produtividade-mv.log não encontrado"
fi
echo ""

# 3. Verificar crontab configurado
echo "3. CRONTAB CONFIGURADO:"
echo "--------------------------------------"
crontab -l 2>/dev/null | grep -v "^#" | grep -i "produtividade\|coletar"
if [ $? -ne 0 ]; then
    echo "❌ Nenhuma entrada de cron encontrada para produtividade"
fi
echo ""

# 4. Verificar se o script existe e tem permissões
echo "4. VERIFICAÇÃO DO SCRIPT:"
echo "--------------------------------------"
SCRIPT_PATH="/root/coletar-produtividade-mv.py"
if [ -f "$SCRIPT_PATH" ]; then
    echo "✅ Script encontrado em: $SCRIPT_PATH"
    ls -lh "$SCRIPT_PATH"
    echo ""
    echo "Primeiras 10 linhas do script:"
    head -n 10 "$SCRIPT_PATH"
else
    echo "❌ Script não encontrado em: $SCRIPT_PATH"
    echo "Procurando script em outros locais..."
    find /root -name "coletar-produtividade-mv.py" 2>/dev/null
    find /home -name "coletar-produtividade-mv.py" 2>/dev/null
fi
echo ""

# 5. Verificar status do Xvfb
echo "5. STATUS DO XVFB:"
echo "--------------------------------------"
if systemctl list-units --full -all | grep -q xvfb.service; then
    if systemctl is-active --quiet xvfb; then
        echo "✅ Xvfb está rodando"
        systemctl status xvfb --no-pager | head -n 15
    else
        echo "❌ Xvfb não está rodando"
        echo "Status do serviço:"
        systemctl status xvfb --no-pager | head -n 15
        echo ""
        echo "Tentando verificar se há algum Xvfb rodando:"
        ps aux | grep -i xvfb | grep -v grep
    fi
else
    echo "⚠️  Serviço xvfb.service não está configurado"
    echo "Verificando se Xvfb está rodando manualmente:"
    ps aux | grep -i xvfb | grep -v grep
fi
echo ""

# 6. Verificar Python e dependências
echo "6. PYTHON E DEPENDÊNCIAS:"
echo "--------------------------------------"
echo "Python version: $(python3 --version 2>&1)"
echo ""
echo "Pacotes instalados relevantes:"
pip3 list 2>/dev/null | grep -i "selenium\|supabase\|dotenv"
echo ""

# 7. Verificar geckodriver
echo "7. GECKODRIVER:"
echo "--------------------------------------"
if command -v geckodriver &> /dev/null; then
    echo "✅ Geckodriver encontrado: $(which geckodriver)"
    geckodriver --version 2>&1 | head -n 1
else
    echo "❌ Geckodriver não encontrado no PATH"
fi
echo ""

# 8. Verificar arquivo .env
echo "8. ARQUIVO .ENV:"
echo "--------------------------------------"
if [ -f /root/.env ]; then
    echo "✅ Arquivo .env encontrado em /root/.env"
    echo "Variáveis configuradas (sem valores):"
    grep -v "^#" /root/.env 2>/dev/null | grep "=" | cut -d'=' -f1
elif [ -f "$(dirname $SCRIPT_PATH)/.env" ]; then
    echo "✅ Arquivo .env encontrado no diretório do script"
    echo "Variáveis configuradas (sem valores):"
    grep -v "^#" "$(dirname $SCRIPT_PATH)/.env" 2>/dev/null | grep "=" | cut -d'=' -f1
else
    echo "❌ Arquivo .env não encontrado"
fi
echo ""

# 9. Verificar conectividade com MV
echo "9. CONECTIVIDADE COM MV:"
echo "--------------------------------------"
if curl -s -o /dev/null -w "%{http_code}" "http://mvpepprd.saude.go.gov.br" --max-time 10; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://mvpepprd.saude.go.gov.br" --max-time 10)
    echo "✅ Servidor MV respondendo (HTTP $HTTP_CODE)"
else
    echo "❌ Não foi possível conectar ao servidor MV"
fi
echo ""

# 10. Verificar últimos dados coletados no Supabase
echo "10. ÚLTIMOS REGISTROS DE PRODUTIVIDADE:"
echo "--------------------------------------"
echo "Você precisará verificar isso manualmente no Supabase"
echo "Query sugerida:"
echo "SELECT data, COUNT(*) as registros"
echo "FROM produtividade"
echo "WHERE created_at >= '2025-10-25'"
echo "GROUP BY data"
echo "ORDER BY data DESC;"
echo ""

# 11. Verificar espaço em disco
echo "11. ESPAÇO EM DISCO:"
echo "--------------------------------------"
df -h / | tail -n 1
echo ""

# 12. Verificar memória
echo "12. MEMÓRIA:"
echo "--------------------------------------"
free -h
echo ""

echo "======================================"
echo "DIAGNÓSTICO CONCLUÍDO"
echo "======================================"
echo ""
echo "📋 PRÓXIMOS PASSOS:"
echo "1. Analise os logs acima"
echo "2. Se o cron não está executando, verifique o crontab"
echo "3. Se há erro no script, veja o log em /var/log/produtividade-mv.log"
echo "4. Teste manualmente: python3 /root/coletar-produtividade-mv.py"
echo ""
