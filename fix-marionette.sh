#!/bin/bash

################################################################################
# Fix para erro "Failed to decode response from marionette"
# Este erro ocorre por incompatibilidade Firefox 140 + Geckodriver 0.34
################################################################################

echo "========================================================================"
echo "FIX: Marionette Protocol Error"
echo "========================================================================"
echo ""

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[AVISO]${NC} $1"; }
error() { echo -e "${RED}[ERRO]${NC} $1"; }

# Matar processos
info "Matando processos Firefox/Geckodriver..."
pkill -9 firefox 2>/dev/null || true
pkill -9 geckodriver 2>/dev/null || true
sleep 3

# Limpar cache
info "Limpando cache do Firefox..."
rm -rf ~/.mozilla/firefox/*.default*/cache2 2>/dev/null || true
rm -rf ~/.cache/mozilla 2>/dev/null || true
rm -rf /tmp/.org.chromium.* /tmp/rust_mozprofile* 2>/dev/null || true

# Solução 1: Atualizar Geckodriver para versão mais recente
info "Baixando Geckodriver mais recente compatível com Firefox 140..."
cd /tmp
wget -q https://github.com/mozilla/geckodriver/releases/download/v0.35.0/geckodriver-v0.35.0-linux64.tar.gz
tar -xzf geckodriver-v0.35.0-linux64.tar.gz
sudo mv geckodriver /usr/local/bin/
sudo chmod +x /usr/local/bin/geckodriver
rm -f geckodriver-v0.35.0-linux64.tar.gz

GECKODRIVER_NEW=$(geckodriver --version | head -1)
info "✅ Geckodriver atualizado: $GECKODRIVER_NEW"
echo ""

# Solução 2: Criar profile customizado do Firefox
info "Criando profile customizado do Firefox..."
PROFILE_DIR="/tmp/firefox_selenium_profile"
rm -rf "$PROFILE_DIR"
mkdir -p "$PROFILE_DIR"

cat > "$PROFILE_DIR/user.js" << 'EOF'
// Configurações para corrigir Marionette
user_pref("marionette.port", 2828);
user_pref("marionette.log.level", "Trace");
user_pref("remote.log.level", "Trace");
user_pref("browser.tabs.remote.autostart", false);
user_pref("browser.tabs.remote.autostart.2", false);
user_pref("extensions.autoDisableScopes", 14);
user_pref("extensions.enabledScopes", 15);
EOF

info "✅ Profile customizado criado em: $PROFILE_DIR"
echo ""

# Teste
info "Testando Selenium com novo Geckodriver e configurações..."
echo ""

# Detectar e ativar venv se existir
if [ -d "venv" ]; then
    info "Ativando ambiente virtual..."
    source venv/bin/activate
elif [ -d "../venv" ]; then
    info "Ativando ambiente virtual..."
    source ../venv/bin/activate
fi

python3 << 'PYTEST'
import sys
import signal
import os
import tempfile

def timeout_handler(signum, frame):
    print('❌ TIMEOUT: Teste demorou mais de 45 segundos')
    sys.exit(1)

signal.signal(signal.SIGALRM, timeout_handler)
signal.alarm(45)

try:
    from selenium import webdriver
    from selenium.webdriver.firefox.options import Options
    from selenium.webdriver.firefox.service import Service

    print("[Teste] Inicializando Firefox com configurações otimizadas...")

    options = Options()
    options.add_argument('--headless')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')

    # Configurações específicas para resolver Marionette
    options.set_preference('marionette.port', 2828)
    options.set_preference('marionette.log.level', 'Trace')
    options.set_preference('browser.tabs.remote.autostart', False)
    options.set_preference('browser.tabs.remote.autostart.2', False)

    # Usar binary explícito
    options.binary_location = '/usr/bin/firefox'

    service = Service(
        executable_path='/usr/local/bin/geckodriver',
        log_output='/tmp/geckodriver-test.log'
    )

    print("[Teste] Criando driver...")
    driver = webdriver.Firefox(service=service, options=options)

    print("[Teste] Navegando para página de teste...")
    driver.get('http://example.com')

    title = driver.title
    print(f"[Teste] Título da página: {title}")

    driver.quit()
    signal.alarm(0)

    print("")
    print("✅ SUCESSO! Selenium está funcionando perfeitamente!")
    print("")
    sys.exit(0)

except Exception as e:
    print(f"❌ ERRO: {e}")
    print("")
    print("Logs do Geckodriver:")
    try:
        with open('/tmp/geckodriver-test.log', 'r') as f:
            print(f.read()[-500:])
    except:
        pass
    signal.alarm(0)
    sys.exit(1)
PYTEST

TEST_RESULT=$?

echo ""
echo "========================================================================"
if [ $TEST_RESULT -eq 0 ]; then
    echo -e "${GREEN}✅ CORREÇÃO BEM-SUCEDIDA!${NC}"
    echo ""
    echo "O erro 'Failed to decode response from marionette' foi corrigido."
    echo ""
    echo "Próximos passos:"
    echo "  1. Execute: python3 coletar-produtividade-mv.py"
    echo "  2. O script agora deve funcionar normalmente"
else
    echo -e "${RED}❌ CORREÇÃO FALHOU${NC}"
    echo ""
    echo "O problema persiste. Vamos tentar uma solução alternativa:"
    echo ""
    echo "OPÇÃO 1: Downgrade do Firefox para versão estável"
    echo "  sudo apt-get remove --purge firefox"
    echo "  sudo add-apt-repository ppa:mozillateam/ppa"
    echo "  sudo apt-get update"
    echo "  sudo apt-get install firefox-esr=115.*"
    echo ""
    echo "OPÇÃO 2: Usar Chrome ao invés de Firefox"
    echo "  (Posso ajudar a modificar o script para usar Chrome)"
    echo ""
    echo "OPÇÃO 3: Ver logs detalhados"
    echo "  cat /tmp/geckodriver-test.log"
fi
echo "========================================================================"
