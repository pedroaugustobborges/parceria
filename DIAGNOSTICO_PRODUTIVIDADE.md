# 🔍 Diagnóstico: Script de Produtividade MV Parou de Funcionar

## 📅 Situação
- **Último dia com sucesso**: 28/10/2025
- **Primeiro dia com falha**: 29/10/2025
- **Status atual**: Script não está coletando dados

## 🚀 Passos para Diagnóstico

### 1️⃣ Executar Script de Diagnóstico

No droplet, execute:

```bash
# Fazer upload dos scripts
cd ~
# (Faça upload de diagnosticar-problema-produtividade.sh para o droplet)

# Dar permissão de execução
chmod +x diagnosticar-problema-produtividade.sh

# Executar diagnóstico
./diagnosticar-problema-produtividade.sh > diagnostico-$(date +%Y%m%d-%H%M%S).txt 2>&1

# Ver resultado
cat diagnostico-*.txt | tail -n 200
```

### 2️⃣ Verificar Possíveis Causas

#### ❌ **Causa 1: Cron não está executando**
**Sintomas**:
- Nenhuma entrada no log do cron após 28/10
- `crontab -l` não mostra a entrada

**Solução**:
```bash
# Verificar crontab
crontab -l

# Se vazio, reconfigurar
crontab -e

# Adicionar (ajuste o caminho se necessário):
0 2 * * * cd /root && /usr/bin/python3 /root/coletar-produtividade-mv.py >> /var/log/produtividade-mv-cron.log 2>&1
```

#### ❌ **Causa 2: Xvfb parou de funcionar**
**Sintomas**:
- Erro no log: "Can't open display"
- `systemctl status xvfb` mostra como inactive/failed

**Solução**:
```bash
# Verificar status
systemctl status xvfb

# Se não estiver rodando, reiniciar
sudo systemctl restart xvfb

# Verificar se iniciou
systemctl status xvfb

# Habilitar para iniciar com o sistema
sudo systemctl enable xvfb
```

#### ❌ **Causa 3: Geckodriver/Firefox desatualizado**
**Sintomas**:
- Erro no log: "session not created"
- Erro: "WebDriver version mismatch"

**Solução**:
```bash
# Verificar versão do Firefox
firefox --version

# Verificar versão do geckodriver
geckodriver --version

# Atualizar Firefox
sudo apt update
sudo apt install firefox-esr --only-upgrade

# Baixar nova versão do geckodriver
wget https://github.com/mozilla/geckodriver/releases/download/v0.34.0/geckodriver-v0.34.0-linux64.tar.gz
tar -xzf geckodriver-v0.34.0-linux64.tar.gz
sudo mv geckodriver /usr/local/bin/
sudo chmod +x /usr/local/bin/geckodriver
```

#### ❌ **Causa 4: Mudança no site do MV**
**Sintomas**:
- Script executa mas não encontra elementos
- Erro: "TimeoutException" ou "NoSuchElementException"
- Log mostra "Elemento não encontrado"

**Solução**:
```bash
# Testar acesso ao site
curl -I http://mvpepprd.saude.go.gov.br/report-executor/report-viewer?id=7076

# Se retornar HTTP 200, o site está acessível
# Se retornar outro código, pode ter mudado

# Fazer screenshot para debug (adicione ao script):
# driver.save_screenshot('/tmp/mv-debug.png')
```

#### ❌ **Causa 5: Credenciais/Variáveis de ambiente**
**Sintomas**:
- Erro: "KeyError" ou "NoneType"
- Erro de autenticação no Supabase

**Solução**:
```bash
# Verificar arquivo .env
cat /root/.env | grep -v "PASS\|KEY" | cut -d'=' -f1

# Verificar se as variáveis estão definidas
echo $VITE_SUPABASE_URL
echo $VITE_SUPABASE_SERVICE_ROLE_KEY

# Se vazias, carregar manualmente
export $(cat /root/.env | xargs)
```

#### ❌ **Causa 6: Falta de espaço em disco**
**Sintomas**:
- Erro: "No space left on device"
- Log não é criado

**Solução**:
```bash
# Verificar espaço
df -h

# Limpar logs antigos se necessário
sudo journalctl --vacuum-time=7d

# Limpar cache do apt
sudo apt clean
```

#### ❌ **Causa 7: Problemas de memória**
**Sintomas**:
- Script trava sem mensagem de erro
- OOM (Out of Memory) no dmesg

**Solução**:
```bash
# Verificar memória
free -h

# Ver se houve OOM kill
dmesg | grep -i "out of memory\|killed process"

# Se sim, aumentar swap ou reduzir uso de memória
```

### 3️⃣ Teste Manual do Script

```bash
# Fazer upload do script de teste
chmod +x testar-script-produtividade.sh

# Executar teste
./testar-script-produtividade.sh

# Acompanhar logs em tempo real
tail -f /var/log/produtividade-mv.log
```

### 4️⃣ Análise dos Logs

Procure por estas mensagens específicas:

**✅ Sucesso**:
```
Configurando Firefox driver...
Acessando relatório MV...
Processando usuário: [NOME] (código: [CODIGO])
[X] registros inseridos com sucesso
Script executado com sucesso
```

**❌ Erros Comuns**:

1. **Display não encontrado**:
```
selenium.common.exceptions.WebDriverException: Message: invalid argument: can't open display: :99
```
→ Problema: Xvfb não está rodando

2. **Elemento não encontrado**:
```
selenium.common.exceptions.TimeoutException: Message:
```
→ Problema: Site MV mudou estrutura

3. **Erro de conexão**:
```
requests.exceptions.ConnectionError
```
→ Problema: Site MV fora do ar

4. **Erro Supabase**:
```
postgrest.exceptions.APIError
```
→ Problema: Credenciais ou conectividade

## 🛠️ Correções Rápidas

### Fix 1: Reiniciar Tudo
```bash
# Reiniciar serviços
sudo systemctl restart xvfb
sudo systemctl restart cron

# Testar script
python3 /root/coletar-produtividade-mv.py
```

### Fix 2: Reconfigurar Cron
```bash
# Editar crontab
crontab -e

# Adicionar linha (certifique-se que está correta):
0 2 * * * cd /root && /usr/bin/python3 /root/coletar-produtividade-mv.py >> /var/log/produtividade-mv-cron.log 2>&1

# Salvar e sair (Ctrl+X, Y, Enter)

# Verificar se foi salvo
crontab -l
```

### Fix 3: Forçar Execução Manual
```bash
# Executar manualmente para coletar dados dos dias perdidos
python3 /root/coletar-produtividade-mv.py

# Verificar se funcionou
tail -n 50 /var/log/produtividade-mv.log
```

## 📊 Verificar Dados no Supabase

Após resolver, verifique se os dados estão sendo inseridos:

```sql
-- Ver últimos registros
SELECT
  data,
  COUNT(*) as total_registros,
  MAX(created_at) as ultima_atualizacao
FROM produtividade
WHERE data >= '2025-10-25'
GROUP BY data
ORDER BY data DESC;

-- Ver se há dados de 29/10 em diante
SELECT COUNT(*) as registros_29_outubro
FROM produtividade
WHERE data = '2025-10-29';
```

## 📝 Checklist de Resolução

- [ ] Diagnóstico executado
- [ ] Causa identificada
- [ ] Correção aplicada
- [ ] Teste manual bem-sucedido
- [ ] Cron verificado e funcionando
- [ ] Dados aparecendo no Supabase
- [ ] Log mostrando execuções diárias

## 🆘 Se Nada Funcionar

1. **Coletar todas as informações**:
```bash
# Executar diagnóstico completo
./diagnosticar-problema-produtividade.sh > diagnostico-completo.txt 2>&1

# Coletar últimas 200 linhas do log
tail -n 200 /var/log/produtividade-mv.log > log-produtividade.txt

# Testar e capturar saída
python3 /root/coletar-produtividade-mv.py > teste-manual.txt 2>&1
```

2. **Enviar os arquivos**:
   - `diagnostico-completo.txt`
   - `log-produtividade.txt`
   - `teste-manual.txt`

3. **Informações adicionais úteis**:
   - Houve alguma atualização do sistema?
   - Houve reinicialização do droplet?
   - Alguma mudança foi feita manualmente?

## 💡 Prevenção Futura

Para evitar que isso aconteça novamente:

1. **Monitoramento**:
```bash
# Criar script de verificação diária
# que envia alerta se não houver dados novos
```

2. **Log rotation**:
```bash
# Configurar logrotate para evitar logs gigantes
sudo nano /etc/logrotate.d/produtividade-mv

# Adicionar:
/var/log/produtividade-mv.log {
    daily
    rotate 7
    compress
    missingok
    notifempty
}
```

3. **Health check**:
```bash
# Adicionar ao cron um health check
30 8 * * * curl -X POST [URL_WEBHOOK] -d "status=ok" || echo "Health check failed"
```

---

**Data do documento**: 30/10/2025
**Autor**: Claude Code
**Versão**: 1.0
