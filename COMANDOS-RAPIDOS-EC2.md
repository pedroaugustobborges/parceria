# Comandos Rápidos - Configuração EC2

## Conectar via SSH
```bash
ssh -i agir-key.pem admin@10.12.1.70
```

## Configuração Inicial (Execute na ordem)

### 1. Configurar Timezone
```bash
sudo timedatectl set-timezone America/Sao_Paulo
date
```

### 2. Navegar e verificar projeto
```bash
cd /home/admin/gestaodeacesso
ls -la
```

### 3. Criar/Verificar ambiente virtual
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 4. Criar script wrapper (copiar todo o bloco)
```bash
sudo tee /usr/local/bin/importar-acessos-wrapper.sh > /dev/null << 'EOF'
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

# Executa o script Python (500 registros por CPF)
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
EOF
```

### 5. Dar permissões ao script
```bash
sudo chmod +x /usr/local/bin/importar-acessos-wrapper.sh
sudo touch /var/log/importacao-acessos.log
sudo chown admin:admin /var/log/importacao-acessos.log
```

### 6. Testar script manualmente
```bash
/usr/local/bin/importar-acessos-wrapper.sh
tail -n 50 /var/log/importacao-acessos.log
```

### 7. Configurar cron (copiar todo o bloco)
```bash
(crontab -l 2>/dev/null; cat << 'EOF'
# Importação de Acessos - 01:00 e 13:00 (Horário de Brasília)
0 1 * * * /usr/local/bin/importar-acessos-wrapper.sh
0 13 * * * /usr/local/bin/importar-acessos-wrapper.sh
EOF
) | crontab -
```

### 8. Verificar cron configurado
```bash
crontab -l
sudo systemctl status cron
```

### 9. Configurar logrotate (opcional)
```bash
sudo tee /etc/logrotate.d/importacao-acessos > /dev/null << 'EOF'
/var/log/importacao-acessos.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0644 admin admin
}
EOF
```

## Comandos de Monitoramento

### Ver log em tempo real
```bash
tail -f /var/log/importacao-acessos.log
```

### Ver últimas 50 linhas
```bash
tail -n 50 /var/log/importacao-acessos.log
```

### Ver apenas erros
```bash
grep "❌" /var/log/importacao-acessos.log
```

### Ver apenas sucessos
```bash
grep "✅" /var/log/importacao-acessos.log
```

### Contar execuções de hoje
```bash
grep "$(date '+%Y-%m-%d')" /var/log/importacao-acessos.log | grep "Iniciando" | wc -l
```

### Executar manualmente
```bash
/usr/local/bin/importar-acessos-wrapper.sh
```

## Troubleshooting

### Reiniciar serviço cron
```bash
sudo systemctl restart cron
sudo systemctl status cron
```

### Ver logs do sistema
```bash
sudo tail -f /var/log/syslog | grep CRON
```

### Verificar permissões
```bash
ls -l /usr/local/bin/importar-acessos-wrapper.sh
ls -l /var/log/importacao-acessos.log
```

### Reinstalar dependências Python
```bash
cd /home/admin/gestaodeacesso
source venv/bin/activate
pip install --upgrade -r requirements.txt
```
