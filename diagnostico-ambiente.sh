#!/bin/bash
# Script para diagnosticar problemas com Firefox/Selenium no droplet

echo "======================================================================"
echo "DIAGNÓSTICO DO AMBIENTE - FIREFOX/SELENIUM"
echo "======================================================================"
echo ""

# 1. Verificar Firefox
echo "1. Verificando Firefox..."
if command -v firefox &> /dev/null; then
    echo "   ✓ Firefox instalado: $(firefox --version)"
else
    echo "   ✗ Firefox NÃO encontrado"
    echo "   Instale com: sudo apt install -y firefox"
fi
echo ""

# 2. Verificar Geckodriver
echo "2. Verificando Geckodriver..."
if command -v geckodriver &> /dev/null; then
    echo "   ✓ Geckodriver instalado: $(geckodriver --version | head -n 1)"
else
    echo "   ✗ Geckodriver NÃO encontrado"
    echo "   Verifique o caminho em GECKODRIVER_PATH no script Python"
fi
echo ""

# 3. Verificar Xvfb
echo "3. Verificando Xvfb..."
if command -v Xvfb &> /dev/null; then
    echo "   ✓ Xvfb instalado"

    # Verificar se está rodando
    if systemctl is-active --quiet xvfb; then
        echo "   ✓ Xvfb está RODANDO"
    else
        echo "   ✗ Xvfb NÃO está rodando"
        echo "   Inicie com: sudo systemctl start xvfb"
    fi

    # Verificar processo
    if ps aux | grep -v grep | grep "Xvfb :99" > /dev/null; then
        echo "   ✓ Processo Xvfb :99 encontrado"
    else
        echo "   ✗ Processo Xvfb :99 NÃO encontrado"
    fi
else
    echo "   ✗ Xvfb NÃO instalado"
    echo "   Instale com: sudo apt install -y xvfb"
fi
echo ""

# 4. Verificar DISPLAY
echo "4. Verificando variável DISPLAY..."
if [ -z "$DISPLAY" ]; then
    echo "   ⚠  DISPLAY não está definido"
    echo "   Execute: export DISPLAY=:99"
else
    echo "   ✓ DISPLAY=$DISPLAY"
fi
echo ""

# 5. Verificar Python e pacotes
echo "5. Verificando Python e pacotes..."
if command -v python3 &> /dev/null; then
    echo "   ✓ Python: $(python3 --version)"

    # Verificar se está no venv
    if [ -n "$VIRTUAL_ENV" ]; then
        echo "   ✓ Ambiente virtual ativado: $VIRTUAL_ENV"
    else
        echo "   ⚠  Ambiente virtual NÃO ativado"
        echo "   Ative com: source venv/bin/activate"
    fi

    # Verificar pacotes
    if python3 -c "import selenium" 2>/dev/null; then
        echo "   ✓ Selenium instalado"
    else
        echo "   ✗ Selenium NÃO instalado"
    fi

    if python3 -c "import supabase" 2>/dev/null; then
        echo "   ✓ Supabase instalado"
    else
        echo "   ✗ Supabase NÃO instalado"
    fi
else
    echo "   ✗ Python3 NÃO encontrado"
fi
echo ""

# 6. Testar Xvfb
echo "6. Testando Xvfb..."
export DISPLAY=:99
if xdpyinfo -display :99 &> /dev/null; then
    echo "   ✓ Display :99 está ACESSÍVEL"
else
    echo "   ✗ Display :99 NÃO está acessível"
    echo "   Verifique se Xvfb está rodando corretamente"
fi
echo ""

# 7. Testar Firefox no modo headless
echo "7. Testando Firefox headless..."
export DISPLAY=:99
export MOZ_HEADLESS=1
timeout 5 firefox --headless --screenshot /tmp/test-screenshot.png https://example.com &> /dev/null
if [ $? -eq 0 ]; then
    echo "   ✓ Firefox funciona em modo headless"
    if [ -f /tmp/test-screenshot.png ]; then
        echo "   ✓ Screenshot criado com sucesso"
        rm /tmp/test-screenshot.png
    fi
else
    echo "   ✗ Firefox FALHOU em modo headless"
    echo "   Execute manualmente: DISPLAY=:99 firefox --headless --version"
fi
echo ""

# 8. Verificar logs
echo "8. Verificando logs..."
if [ -f /var/log/produtividade-mv.log ]; then
    echo "   ✓ Log principal existe"
    echo "   Últimas 3 linhas:"
    tail -n 3 /var/log/produtividade-mv.log | sed 's/^/     /'
else
    echo "   ✗ Log principal NÃO existe"
fi
echo ""

if [ -f /tmp/geckodriver.log ]; then
    echo "   ✓ Log do geckodriver existe"
    echo "   Últimas 5 linhas:"
    tail -n 5 /tmp/geckodriver.log | sed 's/^/     /'
else
    echo "   ⚠  Log do geckodriver ainda não foi criado"
fi
echo ""

# 9. Resumo e Recomendações
echo "======================================================================"
echo "RESUMO E RECOMENDAÇÕES"
echo "======================================================================"
echo ""

PROBLEMAS=0

# Verificar problemas
if ! command -v firefox &> /dev/null; then
    echo "❌ INSTALAR FIREFOX: sudo apt install -y firefox"
    ((PROBLEMAS++))
fi

if ! command -v geckodriver &> /dev/null; then
    echo "❌ INSTALAR GECKODRIVER (ver INSTALACAO_DROPLET_PRODUTIVIDADE.md)"
    ((PROBLEMAS++))
fi

if ! systemctl is-active --quiet xvfb; then
    echo "❌ INICIAR XVFB: sudo systemctl start xvfb && sudo systemctl enable xvfb"
    ((PROBLEMAS++))
fi

if [ -z "$VIRTUAL_ENV" ]; then
    echo "⚠️  ATIVAR VENV: cd /root/gestaodeacesso && source venv/bin/activate"
fi

if [ -z "$DISPLAY" ]; then
    echo "⚠️  DEFINIR DISPLAY: export DISPLAY=:99"
fi

echo ""
if [ $PROBLEMAS -eq 0 ]; then
    echo "✅ Ambiente parece estar OK!"
    echo ""
    echo "Para testar o script:"
    echo "   cd /root/gestaodeacesso"
    echo "   source venv/bin/activate"
    echo "   export DISPLAY=:99"
    echo "   python3 coletar-produtividade-mv.py"
else
    echo "⚠️  Foram encontrados $PROBLEMAS problema(s) que precisam ser corrigidos."
fi
echo ""
echo "======================================================================"
