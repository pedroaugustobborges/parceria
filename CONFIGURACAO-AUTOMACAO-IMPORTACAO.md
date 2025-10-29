# Configuração de Automação - Importação de Acessos

Este guia documenta como configurar a execução automática do script `importar-ultimos-10000-acessos.py` duas vezes ao dia na instância EC2.

## Informações da Instância EC2

- **IP Interno:** 10.12.1.70
- **Usuário:** admin
- **Sistema:** Debian 6.1.2 (64-bit)
- **Chave de Acesso:** AgirChave02 2.ppk (formato PuTTY)
- **Horários de Execução:** 01:00 e 13:00 (Horário de Brasília - America/Sao_Paulo)

---

## Passo 1: Conectar na Instância EC2

### Via PuTTY (Windows)

1. Abra o PuTTY
2. Em "Host Name": `admin@10.12.1.170`
3. Em Connection > SSH > Auth > Credentials: Selecione o arquivo `AgirChave02 2.ppk`
4. Clique em "Open"

### Via SSH (Linux/Mac ou WSL)

```bash
# Primeiro, converta a chave .ppk para formato OpenSSH (se necessário)
puttygen "AgirChave02 2.ppk" -O private-openssh -o agir-key.pem
chmod 400 agir-key.pem

# Conecte via SSH
ssh -i agir-key.pem admin@10.12.1.170
```

---

## Passo 2: Verificar/Configurar Timezone

Após conectar na instância, verifique se o timezone está correto:

```bash
# Verificar timezone atual
timedatectl

# Se necessário, configurar para horário de Brasília
sudo timedatectl set-timezone America/Sao_Paulo

# Verificar novamente
date
```

**Saída esperada:** Deve mostrar `America/Sao_Paulo` e horário de Brasília.

---

## Passo 3: Preparar o Diretório do Projeto

Assumindo que o projeto já está na máquina (se não, faça upload via SCP/SFTP):

```bash
# Navegue até o diretório do projeto
cd /home/admin/gestaodeacesso

# Ou se estiver em outro local, ajuste o caminho
# cd /path/to/gestaodeacesso

# Verifique se o script existe
ls -l importar-ultimos-10000-acessos.py

# Verifique se o ambiente virtual existe
ls -l venv/

# Se não existir ambiente virtual, crie
python3 -m venv venv

# Ative o ambiente virtual
source venv/bin/activate

# Instale as dependências
pip install -r requirements.txt
```

---

## Passo 4: Verificar Variáveis de Ambiente

```bash
# Verifique se o arquivo .env existe
cat .env

# Deve conter:
# VITE_SUPABASE_URL=https://...
# VITE_SUPABASE_SERVICE_ROLE_KEY=...
```

---

## Passo 5: Criar Script Wrapper

Crie um script wrapper que será executado pelo cron:

```bash
# Crie o script
sudo nano /usr/local/bin/importar-acessos-wrapper.sh
```

Cole o seguinte conteúdo:

```bash
#!/bin/bash

# Script wrapper para importar acessos do Data Warehouse
# Executado pelo cron às 01:00 e 13:00 diariamente

# Diretório do projeto
PROJECT_DIR="/home/admin/gestaodeacesso"

# Arquivo de log
LOG_FILE="/var/log/importacao-acessos.log"

# Início da execução
echo "========================================" >> "$LOG_FILE"
echo "Iniciando importação em $(date '+%Y-%m-%d %H:%M:%S %Z')" >> "$LOG_FILE"

# Navega para o diretório do projeto
cd "$PROJECT_DIR" || {
    echo "ERRO: Não foi possível acessar o diretório $PROJECT_DIR" >> "$LOG_FILE"
    exit 1
}

# Ativa o ambiente virtual
source venv/bin/activate || {
    echo "ERRO: Não foi possível ativar o ambiente virtual" >> "$LOG_FILE"
    exit 1
}

# Executa o script Python
python3 importar-ultimos-10000-acessos.py 500 >> "$LOG_FILE" 2>&1

# Status de saída
EXIT_CODE=$?
if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Importação concluída com sucesso em $(date '+%Y-%m-%d %H:%M:%S %Z')" >> "$LOG_FILE"
else
    echo "❌ Importação falhou com código de erro: $EXIT_CODE em $(date '+%Y-%m-%d %H:%M:%S %Z')" >> "$LOG_FILE"
fi

echo "========================================" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

exit $EXIT_CODE
```

**Salve e saia:** `Ctrl + O`, `Enter`, `Ctrl + X`

```bash
# Dê permissão de execução
sudo chmod +x /usr/local/bin/importar-acessos-wrapper.sh

# Crie o arquivo de log
sudo touch /var/log/importacao-acessos.log
sudo chown admin:admin /var/log/importacao-acessos.log
```

---

## Passo 6: Testar o Script Wrapper

Antes de configurar o cron, teste manualmente:

```bash
# Execute o wrapper
/usr/local/bin/importar-acessos-wrapper.sh

# Verifique o log
tail -n 50 /var/log/importacao-acessos.log
```

**Resultado esperado:** Deve executar sem erros e mostrar os registros importados.

---

## Passo 7: Configurar Cron Jobs

```bash
# Edite o crontab do usuário admin
crontab -e

# Se for a primeira vez, escolha o editor (recomendo nano - opção 1)
```

Adicione as seguintes linhas ao final do arquivo:

```cron
# Importação de Acessos - 01:00 e 13:00 (Horário de Brasília)
0 1 * * * /usr/local/bin/importar-acessos-wrapper.sh
0 13 * * * /usr/local/bin/importar-acessos-wrapper.sh
```

**Salve e saia:** `Ctrl + O`, `Enter`, `Ctrl + X`

```bash
# Verifique se o cron foi configurado
crontab -l

# Verifique se o serviço cron está rodando
sudo systemctl status cron
```

**Saída esperada:** Deve mostrar as duas linhas de cron configuradas e o serviço cron ativo.

---

## Passo 8: Verificar Logs do Cron

```bash
# Verificar logs do sistema (opcional - para debug)
sudo tail -f /var/log/syslog | grep CRON

# Verificar log da aplicação
tail -f /var/log/importacao-acessos.log
```

---

## Comandos Úteis para Monitoramento

### Ver últimas 50 linhas do log

```bash
tail -n 50 /var/log/importacao-acessos.log
```

### Ver log em tempo real

```bash
tail -f /var/log/importacao-acessos.log
```

### Ver apenas execuções com erro

```bash
grep "❌" /var/log/importacao-acessos.log
```

### Ver apenas execuções bem-sucedidas

```bash
grep "✅" /var/log/importacao-acessos.log
```

### Contar quantas execuções foram feitas hoje

```bash
grep "$(date '+%Y-%m-%d')" /var/log/importacao-acessos.log | grep "Iniciando" | wc -l
```

### Verificar cron jobs ativos

```bash
crontab -l
```

### Ver quando o cron vai executar próximo

```bash
# Este comando mostra os próximos agendamentos
sudo systemctl list-timers
```

---

## Rotação de Logs (Opcional mas Recomendado)

Para evitar que o arquivo de log cresça indefinidamente:

```bash
# Crie arquivo de configuração do logrotate
sudo nano /etc/logrotate.d/importacao-acessos
```

Cole o seguinte conteúdo:

```
/var/log/importacao-acessos.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0644 admin admin
}
```

**Salve e saia:** `Ctrl + O`, `Enter`, `Ctrl + X`

Isso manterá os últimos 30 dias de logs, comprimindo os antigos.

---

## Teste de Execução Manual

Você pode forçar uma execução manual a qualquer momento:

```bash
# Execução manual
/usr/local/bin/importar-acessos-wrapper.sh

# Ou diretamente via Python (com venv ativado)
cd /home/admin/gestaodeacesso
source venv/bin/activate
python3 importar-ultimos-10000-acessos.py 500
```

---

## Troubleshooting

### Problema: Cron não está executando

```bash
# Verifique se o serviço cron está rodando
sudo systemctl status cron

# Se não estiver, inicie
sudo systemctl start cron
sudo systemctl enable cron
```

### Problema: Script falha com erro de módulo não encontrado

```bash
# Verifique o ambiente virtual
cd /home/admin/gestaodeacesso
source venv/bin/activate
pip list

# Reinstale dependências se necessário
pip install -r requirements.txt
```

### Problema: Permissões negadas

```bash
# Verifique permissões do script
ls -l /usr/local/bin/importar-acessos-wrapper.sh

# Deve mostrar rwxr-xr-x
# Se não, ajuste:
sudo chmod 755 /usr/local/bin/importar-acessos-wrapper.sh
```

### Problema: Arquivo .env não encontrado

```bash
# Verifique se o .env está no diretório correto
ls -la /home/admin/gestaodeacesso/.env

# Se não existir, crie com as variáveis corretas
nano /home/admin/gestaodeacesso/.env
```

---

## Resumo de Horários

| Horário (Brasília) | Descrição                              |
| ------------------ | -------------------------------------- |
| 01:00              | Primeira importação diária (madrugada) |
| 13:00              | Segunda importação diária (tarde)      |

**Nota:** Como configuramos o timezone para `America/Sao_Paulo`, os horários no cron (1 e 13) correspondem exatamente aos horários de Brasília.

---

## Checklist de Verificação Final

- [ ] Conectado na instância EC2 (10.12.1.70)
- [ ] Timezone configurado para America/Sao_Paulo
- [ ] Diretório do projeto existe e está acessível
- [ ] Ambiente virtual (venv) criado e com dependências instaladas
- [ ] Arquivo .env existe com as variáveis SUPABASE
- [ ] Script wrapper criado em `/usr/local/bin/importar-acessos-wrapper.sh`
- [ ] Script wrapper tem permissão de execução (chmod +x)
- [ ] Arquivo de log criado em `/var/log/importacao-acessos.log`
- [ ] Script wrapper testado manualmente com sucesso
- [ ] Cron jobs configurados (crontab -l mostra as duas entradas)
- [ ] Serviço cron está ativo (systemctl status cron)
- [ ] Logrotate configurado (opcional)

---

## Contato e Suporte

Se encontrar problemas, verifique os logs primeiro:

```bash
tail -n 100 /var/log/importacao-acessos.log
```

Para mais detalhes sobre o script Python, consulte o arquivo `importar-ultimos-10000-acessos.py`.

---

**Data de criação:** 2025-10-28
**Última atualização:** 2025-10-28
