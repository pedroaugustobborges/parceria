# Diagnóstico Rápido - Firefox Failing

## Execute estes comandos no droplet (copie e cole tudo de uma vez):

```bash
echo "=== TESTE RÁPIDO ==="
echo ""
echo "1. Firefox instalado?"
firefox --version 2>&1 || echo "ERRO: Firefox não encontrado"
echo ""

echo "2. Geckodriver instalado?"
geckodriver --version 2>&1 | head -n 1 || echo "ERRO: Geckodriver não encontrado"
echo ""

echo "3. Xvfb rodando?"
systemctl is-active xvfb 2>&1
ps aux | grep -v grep | grep "Xvfb :99" || echo "ERRO: Xvfb não está rodando"
echo ""

echo "4. Display :99 acessível?"
export DISPLAY=:99
xdpyinfo -display :99 &> /dev/null && echo "OK" || echo "ERRO: Display não acessível"
echo ""

echo "5. Bibliotecas do Firefox OK?"
ldd /usr/bin/firefox 2>&1 | grep "not found" && echo "ERRO: Faltam bibliotecas" || echo "OK"
echo ""

echo "6. Teste Firefox headless:"
export DISPLAY=:99
export MOZ_HEADLESS=1
timeout 5 firefox --headless --version 2>&1
echo "Exit code: $?"
echo ""

echo "7. Geckodriver log (se existir):"
[ -f /tmp/geckodriver.log ] && tail -n 20 /tmp/geckodriver.log || echo "Log ainda não existe"
echo ""

echo "8. Log do Python (se existir):"
[ -f /var/log/produtividade-mv.log ] && tail -n 20 /var/log/produtividade-mv.log || echo "Log ainda não existe"
echo ""

echo "=== FIM DO TESTE ==="
```

## Interpretação dos Resultados:

### Se Firefox --version falhar:
```bash
sudo apt update
sudo apt install -y firefox
```

### Se Geckodriver não encontrado:
```bash
# Baixar geckodriver (versão compatível com Firefox)
wget https://github.com/mozilla/geckodriver/releases/download/v0.33.0/geckodriver-v0.33.0-linux64.tar.gz
tar -xzf geckodriver-v0.33.0-linux64.tar.gz
sudo mv geckodriver /usr/local/bin/
sudo chmod +x /usr/local/bin/geckodriver
```

### Se Xvfb não está rodando:
```bash
bash CORRECAO_RAPIDA_DROPLET.sh
```

### Se faltam bibliotecas do Firefox:
```bash
sudo apt update
sudo apt install --fix-broken -y
sudo apt install -y libgtk-3-0 libdbus-glib-1-2 libxt6 libx11-xcb1
```

### Se Display não acessível:
```bash
sudo systemctl restart xvfb
sleep 3
export DISPLAY=:99
xdpyinfo -display :99
```

## Após corrigir, teste novamente:

```bash
cd /root/gestaodeacesso
source venv/bin/activate
export DISPLAY=:99
export MOZ_HEADLESS=1
python3 coletar-produtividade-mv.py
```

## Se ainda falhar, cole a saída completa de:

```bash
cat /tmp/geckodriver.log
tail -n 50 /var/log/produtividade-mv.log
sudo journalctl -u xvfb -n 30
```
