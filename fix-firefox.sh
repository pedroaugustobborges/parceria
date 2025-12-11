#!/bin/bash

################################################################################
# Script de correção automática para Firefox + Geckodriver
# Execute este script no seu DigitalOcean Droplet para corrigir problemas comuns
################################################################################

set -e  # Parar em caso de erro

echo "========================================================================"
echo "CORREÇÃO AUTOMÁTICA: Firefox + Geckodriver"
echo "========================================================================"
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para mensagens
info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[AVISO]${NC} $1"
}

error() {
    echo -e "${RED}[ERRO]${NC} $1"
}

# 1. Matar processos travados
info "Passo 1/8: Matando processos Firefox/Geckodriver travados..."
pkill -9 firefox 2>/dev/null || true
pkill -9 geckodriver 2>/dev/null || true
sleep 2
info "Processos limpos"
echo ""

# 2. Limpar arquivos temporários
info "Passo 2/8: Limpando arquivos temporários..."
rm -rf /tmp/.org.chromium.* /tmp/rust_mozprofile* /tmp/tmp* 2>/dev/null || true
info "Arquivos temporários limpos"
echo ""

# 3. Atualizar repositórios
info "Passo 3/8: Atualizando repositórios apt..."
sudo apt-get update -qq
info "Repositórios atualizados"
echo ""

# 4. Instalar dependências
info "Passo 4/8: Instalando dependências do Firefox..."
sudo apt-get install -y -qq \
    libgtk-3-0 \
    libdbus-glib-1-2 \
    libxt6 \
    libx11-xcb1 \
    libasound2 \
    libxtst6 \
    libpci3 \
    libdrm2 \
    libgbm1 \
    wget \
    unzip 2>&1 | grep -v "is already the newest version" || true
info "Dependências instaladas"
echo ""

# 5. Verificar/Instalar Firefox
info "Passo 5/8: Verificando instalação do Firefox..."
if ! command -v firefox &> /dev/null; then
    warn "Firefox não encontrado. Instalando..."
    sudo apt-get install -y firefox
    info "Firefox instalado"
else
    FIREFOX_VERSION=$(firefox --version 2>/dev/null | head -1)
    info "Firefox já instalado: $FIREFOX_VERSION"
fi
echo ""

# 6. Instalar/Atualizar Geckodriver
info "Passo 6/8: Instalando Geckodriver compatível..."

# Detectar versão do Firefox para escolher Geckodriver compatível
FIREFOX_MAJOR=$(firefox --version 2>/dev/null | grep -oP '\d+' | head -1)

if [ "$FIREFOX_MAJOR" -ge 115 ]; then
    GECKODRIVER_VERSION="0.34.0"
elif [ "$FIREFOX_MAJOR" -ge 102 ]; then
    GECKODRIVER_VERSION="0.33.0"
else
    GECKODRIVER_VERSION="0.31.0"
fi

info "Instalando Geckodriver v${GECKODRIVER_VERSION} (compatível com Firefox ${FIREFOX_MAJOR})"

cd /tmp
wget -q https://github.com/mozilla/geckodriver/releases/download/v${GECKODRIVER_VERSION}/geckodriver-v${GECKODRIVER_VERSION}-linux64.tar.gz
tar -xzf geckodriver-v${GECKODRIVER_VERSION}-linux64.tar.gz
sudo mv geckodriver /usr/local/bin/
sudo chmod +x /usr/local/bin/geckodriver
rm -f geckodriver-v${GECKODRIVER_VERSION}-linux64.tar.gz

GECKODRIVER_VERSION_INSTALLED=$(geckodriver --version 2>/dev/null | head -1)
info "Geckodriver instalado: $GECKODRIVER_VERSION_INSTALLED"
echo ""

# 7. Teste do Firefox headless
info "Passo 7/8: Testando Firefox em modo headless..."
timeout 30 firefox --headless --screenshot /tmp/test-screenshot.png about:blank 2>/dev/null || {
    error "Firefox falhou no teste headless"
    warn "Tentando reinstalar Firefox..."
    sudo apt-get remove --purge -y firefox
    sudo apt-get autoremove -y
    sudo apt-get install -y firefox
}

if [ -f /tmp/test-screenshot.png ]; then
    info "✅ Firefox headless funcionando corretamente"
    rm -f /tmp/test-screenshot.png
else
    error "❌ Firefox headless ainda não está funcionando"
fi
echo ""

# 8. Teste do Selenium
info "Passo 8/8: Testando Selenium + Firefox..."

python3 -c "
import sys
import signal

def timeout_handler(signum, frame):
    print('❌ TIMEOUT: Selenium não iniciou em 30 segundos')
    sys.exit(1)

signal.signal(signal.SIGALRM, timeout_handler)
signal.alarm(30)

try:
    from selenium import webdriver
    from selenium.webdriver.firefox.options import Options
    from selenium.webdriver.firefox.service import Service

    options = Options()
    options.add_argument('--headless')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')

    service = Service('/usr/local/bin/geckodriver')
    driver = webdriver.Firefox(service=service, options=options)

    driver.get('http://example.com')
    print('✅ Selenium + Firefox funcionando perfeitamente!')

    driver.quit()
    signal.alarm(0)
    sys.exit(0)

except Exception as e:
    print(f'❌ Erro no teste Selenium: {e}')
    signal.alarm(0)
    sys.exit(1)
" && SELENIUM_OK=1 || SELENIUM_OK=0

echo ""
echo "========================================================================"
echo "RESULTADO DA CORREÇÃO"
echo "========================================================================"
echo ""

if [ $SELENIUM_OK -eq 1 ]; then
    info "✅ SUCESSO! Todas as correções foram aplicadas com sucesso."
    info ""
    info "Você pode agora executar o script principal:"
    info "  cd ~/gestaodeacesso"
    info "  python3 coletar-produtividade-mv.py"
    echo ""
else
    error "❌ Selenium ainda apresenta problemas."
    warn ""
    warn "Próximos passos:"
    warn "  1. Execute o diagnóstico completo: python3 diagnose-firefox.py"
    warn "  2. Verifique os logs: cat /tmp/geckodriver.log"
    warn "  3. Verifique recursos do sistema: free -h && df -h"
    warn "  4. Considere usar Chrome ao invés de Firefox"
    echo ""
fi

echo "Versões instaladas:"
echo "  - Firefox: $(firefox --version 2>/dev/null)"
echo "  - Geckodriver: $(geckodriver --version 2>/dev/null | head -1)"
echo ""
echo "========================================================================"
