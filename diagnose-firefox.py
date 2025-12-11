#!/usr/bin/env python3
"""
Script de diagnóstico para identificar problemas com Firefox/Geckodriver.
Execute este script no servidor antes de rodar o coletor principal.
"""

import os
import sys
import subprocess
import shutil

print("=" * 70)
print("DIAGNÓSTICO: Firefox + Geckodriver + Selenium")
print("=" * 70)
print()

def run_command(cmd, description):
    """Executa um comando e mostra o resultado."""
    print(f"[Teste] {description}")
    print(f"Comando: {cmd}")
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0:
            print(f"✅ SUCESSO")
            print(f"Output: {result.stdout.strip()[:200]}")
        else:
            print(f"❌ FALHOU (código: {result.returncode})")
            print(f"Error: {result.stderr.strip()[:200]}")
    except subprocess.TimeoutExpired:
        print(f"⚠️  TIMEOUT (comando travou)")
    except Exception as e:
        print(f"❌ ERRO: {e}")
    print()

# Teste 1: Firefox instalado?
run_command("firefox --version", "Firefox está instalado?")

# Teste 2: Geckodriver instalado?
run_command("geckodriver --version", "Geckodriver está instalado?")

# Teste 3: Geckodriver no PATH correto?
geckodriver_path = shutil.which('geckodriver')
print(f"[Teste] Geckodriver no PATH")
if geckodriver_path:
    print(f"✅ Encontrado em: {geckodriver_path}")
else:
    print(f"❌ NÃO encontrado no PATH")
print()

# Teste 4: Firefox pode rodar em modo headless?
run_command("firefox --headless --screenshot /tmp/test-screenshot.png about:blank",
            "Firefox funciona em modo headless?")

# Teste 5: Dependências do Firefox
print("[Teste] Verificando dependências do Firefox")
dependencies = [
    "libgtk-3-0",
    "libdbus-glib-1-2",
    "libxt6",
    "libx11-xcb1"
]
for dep in dependencies:
    cmd = f"dpkg -l | grep {dep}"
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if result.returncode == 0:
        print(f"  ✅ {dep}: instalado")
    else:
        print(f"  ❌ {dep}: NÃO instalado")
print()

# Teste 6: Processos Firefox/Geckodriver travados?
print("[Teste] Verificando processos travados")
result = subprocess.run("ps aux | grep -E '(firefox|geckodriver)' | grep -v grep",
                       shell=True, capture_output=True, text=True)
if result.stdout.strip():
    print("⚠️  Processos encontrados (podem estar travados):")
    print(result.stdout.strip())
    print("\nPara matar processos travados, execute:")
    print("  pkill -9 firefox")
    print("  pkill -9 geckodriver")
else:
    print("✅ Nenhum processo travado")
print()

# Teste 7: Permissões
print("[Teste] Verificando permissões")
paths = [
    "/usr/bin/firefox",
    "/usr/local/bin/geckodriver",
    "/tmp"
]
for path in paths:
    if os.path.exists(path):
        perms = oct(os.stat(path).st_mode)[-3:]
        print(f"  ✅ {path}: {perms}")
    else:
        print(f"  ❌ {path}: NÃO EXISTE")
print()

# Teste 8: Teste básico do Selenium
print("[Teste] Tentando inicializar Selenium (timeout: 30s)")
print("Este teste pode travar - aguarde...")

test_code = """
import sys
import signal
from selenium import webdriver
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service

def timeout_handler(signum, frame):
    print("❌ TIMEOUT: Firefox não iniciou em 30 segundos")
    sys.exit(1)

signal.signal(signal.SIGALRM, timeout_handler)
signal.alarm(30)

try:
    options = Options()
    options.add_argument('--headless')
    options.binary_location = '/usr/bin/firefox'

    service = Service(executable_path='/usr/local/bin/geckodriver')
    driver = webdriver.Firefox(service=service, options=options)

    print("✅ SUCESSO: Firefox iniciou corretamente")
    driver.quit()
    signal.alarm(0)
    sys.exit(0)

except Exception as e:
    print(f"❌ ERRO: {e}")
    signal.alarm(0)
    sys.exit(1)
"""

try:
    with open('/tmp/test_selenium.py', 'w') as f:
        f.write(test_code)

    result = subprocess.run(
        "python3 /tmp/test_selenium.py",
        shell=True,
        capture_output=True,
        text=True,
        timeout=35
    )
    print(result.stdout)
    if result.stderr:
        print("Stderr:", result.stderr[:500])

except subprocess.TimeoutExpired:
    print("❌ TIMEOUT: Teste do Selenium travou")
    print("⚠️  PROBLEMA IDENTIFICADO: Firefox não consegue inicializar")
except Exception as e:
    print(f"❌ Erro ao executar teste: {e}")

print()
print("=" * 70)
print("DIAGNÓSTICO COMPLETO")
print("=" * 70)
print()
print("SOLUÇÕES COMUNS:")
print()
print("1. Se Firefox não está instalado:")
print("   sudo apt-get update")
print("   sudo apt-get install -y firefox")
print()
print("2. Se Geckodriver não está instalado:")
print("   wget https://github.com/mozilla/geckodriver/releases/download/v0.33.0/geckodriver-v0.33.0-linux64.tar.gz")
print("   tar -xzf geckodriver-v0.33.0-linux64.tar.gz")
print("   sudo mv geckodriver /usr/local/bin/")
print("   sudo chmod +x /usr/local/bin/geckodriver")
print()
print("3. Se dependências estão faltando:")
print("   sudo apt-get install -y libgtk-3-0 libdbus-glib-1-2 libxt6 libx11-xcb1")
print()
print("4. Se processos estão travados:")
print("   pkill -9 firefox")
print("   pkill -9 geckodriver")
print()
print("5. Se Firefox trava ao inicializar (comum em VPS):")
print("   Adicione a variável de ambiente: MOZ_HEADLESS=1")
print("   Ou use o modo --headless com --disable-gpu")
print()
