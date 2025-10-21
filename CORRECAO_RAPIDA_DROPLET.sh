#!/bin/bash
# Script de correção rápida - copie e cole este arquivo inteiro no droplet

echo "======================================================================"
echo "CORREÇÃO RÁPIDA - FIREFOX/XVFB"
echo "======================================================================"

# 1. Parar tudo
echo "1. Parando serviços..."
sudo systemctl stop xvfb 2>/dev/null
sudo killall Xvfb 2>/dev/null
sudo killall firefox 2>/dev/null
sudo killall geckodriver 2>/dev/null
sleep 2
echo "   ✓ Serviços parados"

# 2. Instalar pacotes necessários se não existirem
echo "2. Verificando pacotes..."
if ! command -v firefox &> /dev/null; then
    echo "   Instalando Firefox..."
    sudo apt update && sudo apt install -y firefox
fi

if ! command -v xdpyinfo &> /dev/null; then
    echo "   Instalando x11-utils..."
    sudo apt install -y x11-utils
fi
echo "   ✓ Pacotes OK"

# 3. Recriar serviço Xvfb
echo "3. Configurando Xvfb..."
sudo tee /etc/systemd/system/xvfb.service > /dev/null <<'EOF'
[Unit]
Description=X Virtual Frame Buffer Service
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX +render -noreset
Restart=always
RestartSec=3
Environment=DISPLAY=:99

[Install]
WantedBy=multi-user.target
EOF
echo "   ✓ Serviço configurado"

# 4. Iniciar Xvfb
echo "4. Iniciando Xvfb..."
sudo systemctl daemon-reload
sudo systemctl enable xvfb
sudo systemctl start xvfb
sleep 3

if systemctl is-active --quiet xvfb; then
    echo "   ✅ Xvfb RODANDO!"
else
    echo "   ❌ Xvfb FALHOU!"
    sudo journalctl -u xvfb -n 20
    exit 1
fi

# 5. Verificar display
echo "5. Verificando display..."
export DISPLAY=:99
if xdpyinfo -display :99 &> /dev/null; then
    echo "   ✅ Display :99 OK!"
else
    echo "   ❌ Display :99 FALHOU!"
    exit 1
fi

# 6. Testar Firefox
echo "6. Testando Firefox..."
export DISPLAY=:99
export MOZ_HEADLESS=1
timeout 10 firefox --headless --screenshot /tmp/test.png https://example.com &> /tmp/firefox-test.log
if [ $? -eq 0 ] && [ -f /tmp/test.png ]; then
    echo "   ✅ Firefox FUNCIONANDO!"
    rm /tmp/test.png
else
    echo "   ⚠️  Firefox teve problemas, mas pode funcionar com o script"
fi

# 7. Atualizar script Python inline
echo "7. Atualizando script Python..."
cd /root/gestaodeacesso

# Fazer backup
cp coletar-produtividade-mv.py coletar-produtividade-mv.py.backup-$(date +%Y%m%d-%H%M%S)

# Atualizar a função setup_driver
cat > /tmp/fix_setup_driver.py << 'PYEOF'
import sys

# Ler arquivo
with open('/root/gestaodeacesso/coletar-produtividade-mv.py', 'r') as f:
    content = f.read()

# Localizar e substituir função setup_driver
old_setup = '''    def setup_driver(self):
        """Configura o driver do Selenium com Firefox headless."""
        logger.info("Configurando Firefox driver...")

        options = Options()
        options.add_argument('--headless')  # Modo headless (sem interface gráfica)
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--disable-gpu')
        options.add_argument('--window-size=1920,1080')

        service = Service(GECKODRIVER_PATH)

        try:
            self.driver = webdriver.Firefox(service=service, options=options)
            self.driver.set_page_load_timeout(30)
            logger.info("Firefox driver configurado com sucesso")
        except Exception as e:
            logger.error(f"Erro ao configurar Firefox driver: {e}")
            raise'''

new_setup = '''    def setup_driver(self):
        """Configura o driver do Selenium com Firefox headless."""
        logger.info("Configurando Firefox driver...")

        options = Options()
        options.add_argument('--headless')  # Modo headless (sem interface gráfica)
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--disable-gpu')
        options.add_argument('--window-size=1920,1080')

        # Adicionar variável de ambiente DISPLAY
        import os
        os.environ['DISPLAY'] = ':99'
        os.environ['MOZ_HEADLESS'] = '1'

        service = Service(GECKODRIVER_PATH)
        service.log_output = '/tmp/geckodriver.log'

        try:
            logger.info("Iniciando Firefox com display :99...")
            self.driver = webdriver.Firefox(service=service, options=options)
            self.driver.set_page_load_timeout(30)
            logger.info("Firefox driver configurado com sucesso")
        except Exception as e:
            logger.error(f"Erro ao configurar Firefox driver: {e}")
            logger.error("Verifique se Xvfb está rodando: sudo systemctl status xvfb")
            logger.error("Verifique logs do geckodriver em: /tmp/geckodriver.log")
            raise'''

if old_setup in content:
    content = content.replace(old_setup, new_setup)
    with open('/root/gestaodeacesso/coletar-produtividade-mv.py', 'w') as f:
        f.write(content)
    print("✓ Script Python atualizado")
else:
    print("⚠ Função já estava atualizada ou tem formato diferente")
PYEOF

python3 /tmp/fix_setup_driver.py
echo "   ✓ Script Python atualizado"

# 8. Atualizar wrapper do cron
echo "8. Atualizando wrapper do cron..."
if [ -f /usr/local/bin/coletar-produtividade-wrapper.sh ]; then
    sudo tee /usr/local/bin/coletar-produtividade-wrapper.sh > /dev/null <<'EOF'
#!/bin/bash

# Wrapper script para executar coleta de produtividade

# Carregar variáveis de ambiente
export PATH="/usr/local/bin:/usr/bin:/bin"
export DISPLAY=:99
export MOZ_HEADLESS=1

# Diretório do projeto
cd /root/gestaodeacesso

# Ativar ambiente virtual se existir
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Executar script Python
/usr/bin/python3 /root/gestaodeacesso/coletar-produtividade-mv.py >> /var/log/produtividade-mv-cron.log 2>&1

# Log de execução
echo "Execução concluída em $(date)" >> /var/log/produtividade-mv-cron.log
EOF
    sudo chmod +x /usr/local/bin/coletar-produtividade-wrapper.sh
    echo "   ✓ Wrapper atualizado"
else
    echo "   ⚠ Wrapper não existe ainda (será criado pelo setup-cron)"
fi

# 9. Resumo
echo ""
echo "======================================================================"
echo "✅ CORREÇÃO CONCLUÍDA!"
echo "======================================================================"
echo ""
echo "Status dos serviços:"
echo "  - Xvfb: $(systemctl is-active xvfb)"
echo "  - Display :99: OK"
echo ""
echo "Agora teste o script:"
echo ""
echo "  cd /root/gestaodeacesso"
echo "  source venv/bin/activate"
echo "  export DISPLAY=:99"
echo "  python3 coletar-produtividade-mv.py"
echo ""
echo "======================================================================"
