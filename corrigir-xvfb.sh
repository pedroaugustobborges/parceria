#!/bin/bash
# Script para corrigir problemas com Xvfb e Firefox

echo "======================================================================"
echo "CORRIGINDO AMBIENTE XVFB E FIREFOX"
echo "======================================================================"
echo ""

# 1. Parar Xvfb se estiver rodando
echo "1. Parando Xvfb existente..."
sudo systemctl stop xvfb 2>/dev/null
sudo killall Xvfb 2>/dev/null
sleep 2
echo "   ✓ Xvfb parado"
echo ""

# 2. Limpar processos órfãos
echo "2. Limpando processos Firefox órfãos..."
sudo killall firefox 2>/dev/null
sudo killall geckodriver 2>/dev/null
sleep 2
echo "   ✓ Processos limpos"
echo ""

# 3. Recriar serviço Xvfb
echo "3. Recriando serviço Xvfb..."
sudo tee /etc/systemd/system/xvfb.service > /dev/null <<EOF
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
echo "   ✓ Serviço criado"
echo ""

# 4. Recarregar systemd
echo "4. Recarregando systemd..."
sudo systemctl daemon-reload
echo "   ✓ Systemd recarregado"
echo ""

# 5. Habilitar e iniciar Xvfb
echo "5. Habilitando e iniciando Xvfb..."
sudo systemctl enable xvfb
sudo systemctl start xvfb
sleep 3
echo "   ✓ Xvfb iniciado"
echo ""

# 6. Verificar status
echo "6. Verificando status do Xvfb..."
if systemctl is-active --quiet xvfb; then
    echo "   ✅ Xvfb está RODANDO!"
    systemctl status xvfb --no-pager | head -n 10
else
    echo "   ❌ Xvfb NÃO está rodando"
    echo "   Ver logs: sudo journalctl -u xvfb -n 50"
    exit 1
fi
echo ""

# 7. Verificar processo
echo "7. Verificando processo Xvfb..."
if ps aux | grep -v grep | grep "Xvfb :99"; then
    echo "   ✅ Processo encontrado!"
else
    echo "   ❌ Processo NÃO encontrado"
    exit 1
fi
echo ""

# 8. Testar display
echo "8. Testando display :99..."
export DISPLAY=:99
if command -v xdpyinfo &> /dev/null; then
    if xdpyinfo -display :99 &> /dev/null; then
        echo "   ✅ Display :99 está ACESSÍVEL!"
    else
        echo "   ❌ Display :99 NÃO está acessível"
        exit 1
    fi
else
    echo "   ⚠️  xdpyinfo não instalado (instale com: sudo apt install -y x11-utils)"
    echo "   Mas Xvfb parece estar rodando..."
fi
echo ""

# 9. Testar Firefox
echo "9. Testando Firefox headless..."
export DISPLAY=:99
export MOZ_HEADLESS=1

# Criar teste simples
timeout 10 firefox --headless --screenshot /tmp/test-firefox.png https://example.com &> /tmp/firefox-test.log

if [ $? -eq 0 ]; then
    echo "   ✅ Firefox funciona!"
    if [ -f /tmp/test-firefox.png ]; then
        echo "   ✅ Screenshot criado: /tmp/test-firefox.png"
    fi
else
    echo "   ⚠️  Firefox teve problemas. Ver logs em /tmp/firefox-test.log"
fi
echo ""

# 10. Resumo
echo "======================================================================"
echo "CORREÇÃO CONCLUÍDA!"
echo "======================================================================"
echo ""
echo "Próximos passos:"
echo ""
echo "1. Execute o diagnóstico:"
echo "   bash diagnostico-ambiente.sh"
echo ""
echo "2. Se tudo OK, teste o script Python:"
echo "   cd /root/gestaodeacesso"
echo "   source venv/bin/activate"
echo "   export DISPLAY=:99"
echo "   python3 coletar-produtividade-mv.py"
echo ""
echo "======================================================================"
