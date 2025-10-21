#!/bin/bash
# Script de diagnóstico completo para identificar problemas com Firefox/Selenium

echo "======================================================================"
echo "DIAGNÓSTICO COMPLETO - FIREFOX/SELENIUM/XVFB"
echo "======================================================================"
echo ""
echo "Data: $(date)"
echo ""

# 1. Verificar versões instaladas
echo "1. VERSÕES INSTALADAS"
echo "----------------------------------------------------------------------"
echo "Python:"
python3 --version 2>&1 || echo "  ❌ Python não encontrado"
echo ""

echo "Firefox:"
if command -v firefox &> /dev/null; then
    firefox --version 2>&1
    echo "  Localização: $(which firefox)"
else
    echo "  ❌ Firefox NÃO instalado"
fi
echo ""

echo "Geckodriver:"
if command -v geckodriver &> /dev/null; then
    geckodriver --version 2>&1 | head -n 2
    echo "  Localização: $(which geckodriver)"
else
    echo "  ❌ Geckodriver NÃO encontrado"
fi
echo ""

echo "Xvfb:"
if command -v Xvfb &> /dev/null; then
    Xvfb -help 2>&1 | head -n 1 || echo "  Xvfb instalado"
    echo "  Localização: $(which Xvfb)"
else
    echo "  ❌ Xvfb NÃO instalado"
fi
echo ""

# 2. Verificar processos em execução
echo "2. PROCESSOS EM EXECUÇÃO"
echo "----------------------------------------------------------------------"
echo "Xvfb:"
if ps aux | grep -v grep | grep "Xvfb :99"; then
    echo "  ✅ Processo Xvfb :99 encontrado"
else
    echo "  ❌ Xvfb :99 NÃO está rodando"
fi
echo ""

echo "Firefox/Geckodriver órfãos:"
if ps aux | grep -v grep | grep -E "firefox|geckodriver"; then
    echo "  ⚠️  Processos encontrados:"
    ps aux | grep -v grep | grep -E "firefox|geckodriver" | sed 's/^/     /'
else
    echo "  ✅ Nenhum processo órfão"
fi
echo ""

# 3. Status do serviço Xvfb
echo "3. STATUS DO SERVIÇO XVFB"
echo "----------------------------------------------------------------------"
if systemctl list-unit-files | grep -q xvfb.service; then
    echo "Status:"
    systemctl status xvfb --no-pager 2>&1 | head -n 15 | sed 's/^/  /'
    echo ""
    echo "Enabled: $(systemctl is-enabled xvfb 2>&1)"
    echo "Active: $(systemctl is-active xvfb 2>&1)"
else
    echo "  ❌ Serviço xvfb.service NÃO existe"
    echo "  Execute: bash CORRECAO_RAPIDA_DROPLET.sh"
fi
echo ""

# 4. Verificar DISPLAY
echo "4. VARIÁVEIS DE AMBIENTE"
echo "----------------------------------------------------------------------"
echo "DISPLAY atual: ${DISPLAY:-não definido}"
echo "MOZ_HEADLESS: ${MOZ_HEADLESS:-não definido}"
echo ""

echo "Testando display :99:"
export DISPLAY=:99
if command -v xdpyinfo &> /dev/null; then
    if xdpyinfo -display :99 &> /dev/null 2>&1; then
        echo "  ✅ Display :99 está ACESSÍVEL"
        echo "  Informações:"
        xdpyinfo -display :99 2>&1 | head -n 5 | sed 's/^/     /'
    else
        echo "  ❌ Display :99 NÃO está acessível"
    fi
else
    echo "  ⚠️  xdpyinfo não instalado (instale: sudo apt install x11-utils)"
fi
echo ""

# 5. Testar Firefox manualmente
echo "5. TESTE MANUAL DO FIREFOX"
echo "----------------------------------------------------------------------"
export DISPLAY=:99
export MOZ_HEADLESS=1

echo "Teste 1: Firefox --version no modo headless"
timeout 5 firefox --headless --version 2>&1
RESULT=$?
if [ $RESULT -eq 0 ]; then
    echo "  ✅ Firefox --version funcionou"
else
    echo "  ❌ Firefox --version falhou (exit code: $RESULT)"
fi
echo ""

echo "Teste 2: Firefox screenshot simples"
rm -f /tmp/test-firefox-debug.png
timeout 10 firefox --headless --screenshot /tmp/test-firefox-debug.png https://example.com 2>&1
RESULT=$?
if [ $RESULT -eq 0 ] && [ -f /tmp/test-firefox-debug.png ]; then
    echo "  ✅ Firefox screenshot funcionou"
    ls -lh /tmp/test-firefox-debug.png | sed 's/^/     /'
    rm -f /tmp/test-firefox-debug.png
else
    echo "  ❌ Firefox screenshot falhou (exit code: $RESULT)"
fi
echo ""

# 6. Verificar dependências do Firefox
echo "6. DEPENDÊNCIAS DO FIREFOX"
echo "----------------------------------------------------------------------"
if [ -f /usr/bin/firefox ]; then
    echo "Verificando bibliotecas faltantes:"
    MISSING=$(ldd /usr/bin/firefox 2>&1 | grep "not found")
    if [ -n "$MISSING" ]; then
        echo "  ❌ BIBLIOTECAS FALTANDO:"
        echo "$MISSING" | sed 's/^/     /'
    else
        echo "  ✅ Todas as bibliotecas estão presentes"
    fi
else
    echo "  ❌ /usr/bin/firefox não existe"
fi
echo ""

# 7. Verificar logs do Geckodriver
echo "7. LOGS DO GECKODRIVER"
echo "----------------------------------------------------------------------"
if [ -f /tmp/geckodriver.log ]; then
    echo "Últimas 20 linhas de /tmp/geckodriver.log:"
    tail -n 20 /tmp/geckodriver.log | sed 's/^/  /'
else
    echo "  ⚠️  /tmp/geckodriver.log ainda não existe"
    echo "  (será criado após executar o script Python)"
fi
echo ""

# 8. Verificar logs do systemd
echo "8. LOGS DO SYSTEMD (Xvfb)"
echo "----------------------------------------------------------------------"
if systemctl list-unit-files | grep -q xvfb.service; then
    echo "Últimas 15 linhas do journal:"
    sudo journalctl -u xvfb -n 15 --no-pager 2>&1 | sed 's/^/  /'
else
    echo "  ⚠️  Serviço xvfb não configurado"
fi
echo ""

# 9. Verificar logs do script Python
echo "9. LOGS DO SCRIPT PYTHON"
echo "----------------------------------------------------------------------"
if [ -f /var/log/produtividade-mv.log ]; then
    echo "Últimas 30 linhas de /var/log/produtividade-mv.log:"
    tail -n 30 /var/log/produtividade-mv.log | sed 's/^/  /'
else
    echo "  ⚠️  /var/log/produtividade-mv.log ainda não existe"
fi
echo ""

# 10. Verificar arquivos de lock
echo "10. ARQUIVOS DE LOCK"
echo "----------------------------------------------------------------------"
if [ -f /tmp/.X99-lock ]; then
    echo "  ⚠️  /tmp/.X99-lock existe:"
    ls -lh /tmp/.X99-lock | sed 's/^/     /'
    cat /tmp/.X99-lock | sed 's/^/     PID: /'
else
    echo "  ✅ Nenhum arquivo de lock encontrado"
fi
echo ""

# 11. Testar Selenium com Python
echo "11. TESTE PYTHON/SELENIUM"
echo "----------------------------------------------------------------------"
cd /root/gestaodeacesso 2>/dev/null || cd ~

if [ -d venv ]; then
    echo "Ativando venv..."
    source venv/bin/activate

    echo "Testando imports:"
    python3 << 'PYEOF'
try:
    import selenium
    print("  ✅ Selenium importado:", selenium.__version__)
except ImportError as e:
    print("  ❌ Erro ao importar Selenium:", e)

try:
    from selenium import webdriver
    print("  ✅ webdriver importado")
except ImportError as e:
    print("  ❌ Erro ao importar webdriver:", e)

try:
    import supabase
    print("  ✅ Supabase importado")
except ImportError as e:
    print("  ❌ Erro ao importar Supabase:", e)
PYEOF
else
    echo "  ⚠️  venv não encontrado em $(pwd)"
fi
echo ""

# 12. Resumo e Recomendações
echo "======================================================================"
echo "RESUMO E RECOMENDAÇÕES"
echo "======================================================================"
echo ""

ISSUES=0

# Verificar problemas críticos
if ! command -v firefox &> /dev/null; then
    echo "❌ CRÍTICO: Firefox não instalado"
    echo "   Solução: sudo apt update && sudo apt install -y firefox"
    ((ISSUES++))
fi

if ! command -v geckodriver &> /dev/null; then
    echo "❌ CRÍTICO: Geckodriver não instalado"
    echo "   Solução: Ver INSTALACAO_DROPLET_PRODUTIVIDADE.md"
    ((ISSUES++))
fi

if ! systemctl is-active --quiet xvfb 2>/dev/null; then
    echo "❌ CRÍTICO: Xvfb não está rodando"
    echo "   Solução: bash CORRECAO_RAPIDA_DROPLET.sh"
    ((ISSUES++))
fi

export DISPLAY=:99
if ! xdpyinfo -display :99 &> /dev/null 2>&1; then
    echo "❌ CRÍTICO: Display :99 não está acessível"
    echo "   Solução: sudo systemctl restart xvfb"
    ((ISSUES++))
fi

if [ -f /usr/bin/firefox ]; then
    MISSING=$(ldd /usr/bin/firefox 2>&1 | grep "not found")
    if [ -n "$MISSING" ]; then
        echo "❌ CRÍTICO: Firefox está faltando bibliotecas"
        echo "   Solução: sudo apt install --fix-broken -y"
        ((ISSUES++))
    fi
fi

# Verificar problemas menores
if [ ! -d /root/gestaodeacesso/venv ]; then
    echo "⚠️  Aviso: venv não encontrado"
    echo "   Solução: cd /root/gestaodeacesso && python3 -m venv venv"
fi

echo ""
if [ $ISSUES -eq 0 ]; then
    echo "======================================================================"
    echo "✅ AMBIENTE PARECE ESTAR OK!"
    echo "======================================================================"
    echo ""
    echo "Se o script Python ainda falha, execute:"
    echo "  cd /root/gestaodeacesso"
    echo "  source venv/bin/activate"
    echo "  export DISPLAY=:99"
    echo "  python3 coletar-produtividade-mv.py"
    echo ""
    echo "E envie a saída completa incluindo /tmp/geckodriver.log"
else
    echo "======================================================================"
    echo "⚠️  FORAM ENCONTRADOS $ISSUES PROBLEMA(S) CRÍTICO(S)"
    echo "======================================================================"
    echo ""
    echo "Corrija os problemas acima antes de executar o script Python."
fi
echo ""

# 13. Salvar saída completa
OUTPUT_FILE="/tmp/diagnostico-completo-$(date +%Y%m%d-%H%M%S).log"
echo "Salvando saída completa em: $OUTPUT_FILE"
echo ""

echo "======================================================================"
