# 🚀 Comandos Rápidos - Correção Produtividade MV

## ⚠️ ATENÇÃO: Sistema Precisa Reiniciar

Você tem a mensagem `*** System restart required ***`
**Isso pode ser a causa do problema!**

## 📋 Opção 1: Correção Automática (RECOMENDADO)

Execute no droplet:

```bash
# 1. Fazer upload do script de correção
# (Use scp ou copie o conteúdo)

# 2. Dar permissão e executar
chmod +x corrigir-produtividade.sh
./corrigir-produtividade.sh
```

**O script vai**:
- ✅ Verificar tudo automaticamente
- ✅ Corrigir problemas encontrados
- ✅ Configurar cron se necessário
- ✅ Oferecer teste manual
- ✅ Mostrar o que precisa ser feito

---

## 📋 Opção 2: Correção Manual Rápida

### Passo 1: Verificar o Cron (CAUSA MAIS PROVÁVEL)

```bash
# Ver se o cron está configurado
crontab -l

# Se NÃO mostrar a linha do produtividade, adicionar:
crontab -e

# Adicionar esta linha (pressione 'i' para inserir, depois ESC, :wq para salvar):
0 2 * * * cd /root && /usr/bin/python3 /root/coletar-produtividade-mv.py >> /var/log/produtividade-mv-cron.log 2>&1

# Verificar se foi salvo
crontab -l | grep produtividade
```

### Passo 2: Testar Manualmente

```bash
# Executar o script manualmente
cd /root
python3 coletar-produtividade-mv.py

# Acompanhar execução
tail -f /var/log/produtividade-mv.log
```

### Passo 3: Ver os Logs

```bash
# Ver últimas 100 linhas do log
tail -n 100 /var/log/produtividade-mv.log

# Ver logs do cron
journalctl -u cron.service --since "48 hours ago" --no-pager | grep produtividade
```

### Passo 4: Verificar Xvfb (se der erro de display)

```bash
# Ver status
systemctl status xvfb

# Se não estiver rodando, iniciar
sudo systemctl start xvfb
sudo systemctl enable xvfb

# Verificar se iniciou
systemctl status xvfb
```

### Passo 5: Reiniciar o Sistema (SE NECESSÁRIO)

```bash
# O sistema está pedindo reinicialização
# Isso pode resolver problemas após atualizações
sudo reboot
```

---

## 📋 Opção 3: Diagnóstico Completo

```bash
# Executar diagnóstico completo
chmod +x diagnosticar-problema-produtividade.sh
./diagnosticar-problema-produtividade.sh > diagnostico.txt 2>&1

# Ver resultado
less diagnostico.txt

# OU enviar para análise
cat diagnostico.txt
```

---

## 🔍 Verificação Rápida do Problema

### Comando único para ver tudo:

```bash
echo "=== CRONTAB ===" && \
crontab -l | grep produtividade && \
echo "" && \
echo "=== ÚLTIMO LOG ===" && \
tail -n 30 /var/log/produtividade-mv.log && \
echo "" && \
echo "=== XVFB ===" && \
systemctl status xvfb --no-pager | head -n 5 && \
echo "" && \
echo "=== ESPAÇO ===" && \
df -h / | tail -n 1 && \
echo "" && \
echo "=== MEMÓRIA ===" && \
free -h | head -n 2
```

---

## 💊 Soluções Rápidas por Sintoma

### Sintoma: "Crontab vazio ou sem entrada"
```bash
crontab -e
# Adicionar:
0 2 * * * cd /root && /usr/bin/python3 /root/coletar-produtividade-mv.py >> /var/log/produtividade-mv-cron.log 2>&1
```

### Sintoma: "Can't open display :99"
```bash
sudo systemctl restart xvfb
sudo systemctl enable xvfb
```

### Sintoma: "No such file or directory: geckodriver"
```bash
# Baixar geckodriver
wget https://github.com/mozilla/geckodriver/releases/download/v0.34.0/geckodriver-v0.34.0-linux64.tar.gz
tar -xzf geckodriver-v0.34.0-linux64.tar.gz
sudo mv geckodriver /usr/local/bin/
sudo chmod +x /usr/local/bin/geckodriver
geckodriver --version
```

### Sintoma: "ModuleNotFoundError: selenium/supabase"
```bash
pip3 install selenium supabase python-dotenv
```

### Sintoma: "Connection refused" ou "timeout"
```bash
# Testar conectividade
curl -I http://mvpepprd.saude.go.gov.br/report-executor/report-viewer?id=7076
```

---

## 🎯 Solução Mais Provável (90%)

```bash
# Execute estes comandos em sequência:

# 1. Ver se cron está configurado
crontab -l

# 2. Se NÃO aparecer nada sobre produtividade:
crontab -e
# Adicionar: 0 2 * * * cd /root && /usr/bin/python3 /root/coletar-produtividade-mv.py >> /var/log/produtividade-mv-cron.log 2>&1

# 3. Testar manualmente
python3 /root/coletar-produtividade-mv.py

# 4. Reiniciar sistema (resolve 80% dos problemas após atualizações)
sudo reboot
```

---

## 📊 Verificar se Funcionou

### Depois de aplicar correções:

```bash
# 1. Ver últimas execuções do cron (no dia seguinte às 2h)
journalctl -u cron.service --since today --no-pager | grep produtividade

# 2. Ver logs do script
tail -n 50 /var/log/produtividade-mv.log

# 3. No Supabase, executar:
# SELECT data, COUNT(*) as registros
# FROM produtividade
# WHERE data >= '2025-10-29'
# GROUP BY data
# ORDER BY data DESC;
```

---

## 🆘 Se Nada Funcionar

```bash
# Executar e me enviar o resultado:
./diagnosticar-problema-produtividade.sh > diagnostico-completo.txt 2>&1
cat diagnostico-completo.txt

# E também:
python3 /root/coletar-produtividade-mv.py > teste-manual.txt 2>&1
cat teste-manual.txt
```

---

## ⏰ Dica: Teste Rápido Sem Esperar até 2h

```bash
# Execute manualmente para coletar dados agora:
python3 /root/coletar-produtividade-mv.py

# Isso vai coletar os dados imediatamente
# E você pode ver se funciona sem esperar o cron
```

---

## 🔄 Checklist de Resolução

- [ ] Executei `crontab -l` e confirmei que há entrada para produtividade
- [ ] Testei manualmente: `python3 /root/coletar-produtividade-mv.py`
- [ ] Verifichi que Xvfb está rodando: `systemctl status xvfb`
- [ ] Reiniciei o sistema: `sudo reboot`
- [ ] Verifiquei logs: `tail -f /var/log/produtividade-mv.log`
- [ ] Confirmei dados novos no Supabase (data >= 29/10)

---

**Data**: 01/11/2025
**Droplet**: doctors-productivity-scraper (138.68.27.70)
**Sistema**: Ubuntu 25.04
