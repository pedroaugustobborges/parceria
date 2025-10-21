# Solução: Erro de Timeout do Firefox/Geckodriver

## Erro Encontrado

```
ReadTimeoutError: HTTPConnectionPool(host='localhost', port=39151): Read timed out. (read timeout=120)
```

## Causa

O Firefox/Geckodriver não conseguiu iniciar porque:
1. Xvfb não está rodando corretamente
2. Variável DISPLAY não está configurada
3. Firefox não consegue se conectar ao display virtual

## Solução Rápida (Passo a Passo)

### No droplet (138.68.27.70), execute:

```bash
# 1. Transferir os novos scripts
cd /root/gestaodeacesso

# 2. Tornar scripts executáveis
chmod +x diagnostico-ambiente.sh
chmod +x corrigir-xvfb.sh

# 3. Executar correção
bash corrigir-xvfb.sh

# 4. Executar diagnóstico
bash diagnostico-ambiente.sh

# 5. Se tudo OK, testar o script
source venv/bin/activate
export DISPLAY=:99
python3 coletar-produtividade-mv.py
```

## Solução Detalhada

### Passo 1: Verificar e Corrigir Xvfb

```bash
# Parar Xvfb
sudo systemctl stop xvfb

# Matar processos órfãos
sudo killall Xvfb
sudo killall firefox
sudo killall geckodriver

# Recriar serviço Xvfb com configurações corretas
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

# Recarregar systemd
sudo systemctl daemon-reload

# Habilitar e iniciar
sudo systemctl enable xvfb
sudo systemctl start xvfb

# Verificar status
sudo systemctl status xvfb
```

### Passo 2: Verificar se Xvfb está Rodando

```bash
# Deve mostrar "active (running)"
sudo systemctl status xvfb

# Deve mostrar processo Xvfb :99
ps aux | grep Xvfb

# Deve mostrar informações do display
export DISPLAY=:99
xdpyinfo -display :99
```

### Passo 3: Testar Firefox Manualmente

```bash
# Definir variáveis
export DISPLAY=:99
export MOZ_HEADLESS=1

# Testar Firefox
firefox --headless --version

# Testar screenshot
firefox --headless --screenshot /tmp/test.png https://example.com
ls -lh /tmp/test.png
```

### Passo 4: Atualizar Script Python

O script já foi atualizado para:
- Definir `DISPLAY=:99` automaticamente
- Definir `MOZ_HEADLESS=1`
- Gerar logs do geckodriver em `/tmp/geckodriver.log`
- Mensagens de erro mais claras

### Passo 5: Testar Script Python

```bash
cd /root/gestaodeacesso
source venv/bin/activate
export DISPLAY=:99
python3 coletar-produtividade-mv.py
```

## Verificações Adicionais

### 1. Verificar Geckodriver

```bash
# Deve mostrar versão
geckodriver --version

# Deve estar em /usr/local/bin
which geckodriver

# Se não estiver, criar link
sudo ln -s /usr/bin/geckodriver /usr/local/bin/geckodriver
```

### 2. Verificar Firefox

```bash
# Deve mostrar versão
firefox --version

# Se não instalado
sudo apt update
sudo apt install -y firefox
```

### 3. Verificar Logs

```bash
# Log principal
tail -f /var/log/produtividade-mv.log

# Log do geckodriver (após executar script)
tail -f /tmp/geckodriver.log

# Log do systemd (Xvfb)
sudo journalctl -u xvfb -f
```

## Testes de Diagnóstico

### Teste 1: Xvfb está rodando?

```bash
sudo systemctl is-active xvfb
# Deve retornar: active
```

### Teste 2: Display :99 está disponível?

```bash
export DISPLAY=:99
xdpyinfo -display :99 > /dev/null && echo "OK" || echo "ERRO"
# Deve retornar: OK
```

### Teste 3: Firefox funciona em headless?

```bash
export DISPLAY=:99
timeout 10 firefox --headless --screenshot /tmp/t.png https://google.com
echo $?
# Deve retornar: 0 (sucesso)
```

### Teste 4: Geckodriver está acessível?

```bash
geckodriver --version
# Deve mostrar versão
```

### Teste 5: Python consegue importar Selenium?

```bash
cd /root/gestaodeacesso
source venv/bin/activate
python3 -c "import selenium; print('OK')"
# Deve imprimir: OK
```

## Problemas Comuns e Soluções

### Problema 1: "Xvfb failed to start"

```bash
# Ver logs detalhados
sudo journalctl -u xvfb -n 50

# Possível solução: remover lock files
sudo rm -f /tmp/.X99-lock
sudo systemctl restart xvfb
```

### Problema 2: "Display :99 cannot be opened"

```bash
# Verificar se outro processo está usando :99
sudo lsof -i :99

# Tentar outro display
# Editar /etc/systemd/system/xvfb.service
# Mudar :99 para :100
# Atualizar script Python também
```

### Problema 3: "Firefox not found"

```bash
# Reinstalar Firefox
sudo apt remove -y firefox
sudo apt update
sudo apt install -y firefox
```

### Problema 4: "Permission denied"

```bash
# Dar permissões corretas
sudo chown -R root:root /root/gestaodeacesso
chmod +x /root/gestaodeacesso/*.py
```

### Problema 5: "Module not found"

```bash
# Reinstalar dependências
cd /root/gestaodeacesso
source venv/bin/activate
pip install --upgrade --force-reinstall -r requirements-produtividade.txt
```

## Checklist de Verificação

Execute cada comando e marque se passou:

- [ ] `sudo systemctl status xvfb` → active (running)
- [ ] `ps aux | grep Xvfb` → mostra processo
- [ ] `geckodriver --version` → mostra versão
- [ ] `firefox --version` → mostra versão
- [ ] `export DISPLAY=:99 && xdpyinfo` → mostra informações
- [ ] `export DISPLAY=:99 && firefox --headless --version` → funciona
- [ ] `python3 -c "import selenium"` → sem erro
- [ ] `python3 -c "import supabase"` → sem erro

Se **TODOS** os itens passarem, o ambiente está OK!

## Configuração Permanente

Para garantir que o ambiente funcione sempre:

### 1. Criar script de inicialização

```bash
sudo tee /etc/profile.d/produtividade-env.sh > /dev/null <<'EOF'
# Variáveis de ambiente para coleta de produtividade
export DISPLAY=:99
export MOZ_HEADLESS=1
EOF
```

### 2. Atualizar wrapper do cron

```bash
sudo nano /usr/local/bin/coletar-produtividade-wrapper.sh
```

Adicionar no início:
```bash
export DISPLAY=:99
export MOZ_HEADLESS=1
```

### 3. Garantir que Xvfb inicia no boot

```bash
sudo systemctl enable xvfb
sudo systemctl is-enabled xvfb  # Deve retornar: enabled
```

## Logs para Debug

Se ainda houver problemas, colete todos os logs:

```bash
# Criar arquivo de debug
cat > /tmp/debug-info.txt <<EOF
=== SYSTEM INFO ===
$(uname -a)

=== XVFB STATUS ===
$(sudo systemctl status xvfb --no-pager)

=== XVFB LOGS ===
$(sudo journalctl -u xvfb -n 50 --no-pager)

=== FIREFOX VERSION ===
$(firefox --version 2>&1)

=== GECKODRIVER VERSION ===
$(geckodriver --version 2>&1)

=== PROCESSES ===
$(ps aux | grep -E "Xvfb|firefox|gecko")

=== GECKODRIVER LOG ===
$(cat /tmp/geckodriver.log 2>&1)

=== PYTHON SCRIPT LOG ===
$(tail -n 100 /var/log/produtividade-mv.log 2>&1)
EOF

echo "Debug info salvo em: /tmp/debug-info.txt"
cat /tmp/debug-info.txt
```

## Contato

Se após todas as tentativas o problema persistir, verifique:
1. `/tmp/debug-info.txt`
2. `/var/log/produtividade-mv.log`
3. `/tmp/geckodriver.log`
4. `sudo journalctl -u xvfb -n 100`

---

**Última atualização**: 2025-10-21
**Versão**: 1.1
