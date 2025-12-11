#!/usr/bin/env python3
"""
Teste rápido para verificar se Selenium está funcionando.
Execute dentro do venv: source venv/bin/activate && python3 test-selenium-quick.py
"""

import sys
import signal
import time

print("=" * 70)
print("TESTE RÁPIDO: Selenium + Firefox + Geckodriver")
print("=" * 70)
print()

def timeout_handler(signum, frame):
    print('❌ TIMEOUT: Firefox não iniciou em 60 segundos')
    sys.exit(1)

# Configurar timeout
signal.signal(signal.SIGALRM, timeout_handler)
signal.alarm(60)

try:
    print("[1/6] Importando Selenium...")
    from selenium import webdriver
    from selenium.webdriver.firefox.options import Options
    from selenium.webdriver.firefox.service import Service
    print("    ✅ Selenium importado")
    print()

    print("[2/6] Configurando opções do Firefox...")
    options = Options()
    options.add_argument('--headless')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--disable-gpu')

    # FIX: Marionette protocol
    options.set_preference('marionette.port', 2828)
    options.set_preference('marionette.log.level', 'Info')
    options.set_preference('remote.log.level', 'Info')
    options.set_preference('browser.tabs.remote.autostart', False)
    options.set_preference('browser.tabs.remote.autostart.2', False)

    options.binary_location = '/usr/bin/firefox'
    print("    ✅ Opções configuradas")
    print()

    print("[3/6] Configurando Geckodriver...")
    service = Service(
        executable_path='/usr/local/bin/geckodriver',
        log_output='/tmp/geckodriver-quick-test.log'
    )
    print("    ✅ Service configurado")
    print()

    print("[4/6] Iniciando Firefox (pode demorar 10-30s)...")
    print("    Aguarde...")
    driver = webdriver.Firefox(service=service, options=options)
    print("    ✅ Firefox iniciado com sucesso!")
    print()

    print("[5/6] Navegando para página de teste...")
    driver.get('http://example.com')
    title = driver.title
    print(f"    ✅ Página carregada: '{title}'")
    print()

    print("[6/6] Fechando navegador...")
    driver.quit()
    print("    ✅ Navegador fechado")
    print()

    signal.alarm(0)  # Cancelar timeout

    print("=" * 70)
    print("✅ SUCESSO TOTAL!")
    print("=" * 70)
    print()
    print("Selenium está funcionando perfeitamente!")
    print()
    print("Próximo passo:")
    print("  python3 coletar-produtividade-mv.py")
    print()
    sys.exit(0)

except ImportError as e:
    signal.alarm(0)
    print(f"❌ ERRO: Módulo não encontrado: {e}")
    print()
    print("Solução:")
    print("  pip install selenium")
    print()
    sys.exit(1)

except Exception as e:
    signal.alarm(0)
    print(f"❌ ERRO: {e}")
    print()
    print("Logs do Geckodriver:")
    try:
        with open('/tmp/geckodriver-quick-test.log', 'r') as f:
            logs = f.read()
            if logs:
                print(logs[-1000:])  # Últimos 1000 caracteres
    except:
        print("  (nenhum log disponível)")
    print()
    print("Tipo do erro:", type(e).__name__)
    print()

    if "marionette" in str(e).lower():
        print("⚠️  Erro relacionado ao protocolo Marionette.")
        print()
        print("Soluções:")
        print("  1. Geckodriver foi atualizado para v0.35.0? Execute:")
        print("     geckodriver --version")
        print()
        print("  2. Se ainda v0.34, atualize:")
        print("     wget https://github.com/mozilla/geckodriver/releases/download/v0.35.0/geckodriver-v0.35.0-linux64.tar.gz")
        print("     tar -xzf geckodriver-v0.35.0-linux64.tar.gz")
        print("     sudo mv geckodriver /usr/local/bin/")
        print("     sudo chmod +x /usr/local/bin/geckodriver")
        print()
        print("  3. Se problema persistir, downgrade Firefox:")
        print("     sudo apt-get remove --purge firefox")
        print("     sudo apt-get install firefox-esr")

    sys.exit(1)
