#!/bin/bash
# Script para configurar cron job para coletar produtividade diariamente às 2h

echo "======================================================================"
echo "CONFIGURAÇÃO DO CRON JOB - COLETA DE PRODUTIVIDADE MV"
echo "======================================================================"

# Diretório do projeto
PROJECT_DIR="/root/gestaodeacesso"
SCRIPT_PATH="$PROJECT_DIR/coletar-produtividade-mv.py"
LOG_FILE="/var/log/produtividade-mv.log"
CRON_LOG="/var/log/produtividade-mv-cron.log"

# Verificar se o script existe
if [ ! -f "$SCRIPT_PATH" ]; then
    echo "❌ Erro: Script não encontrado em $SCRIPT_PATH"
    exit 1
fi

# Criar diretório de logs se não existir
sudo mkdir -p /var/log
sudo touch $LOG_FILE
sudo touch $CRON_LOG
sudo chmod 666 $LOG_FILE
sudo chmod 666 $CRON_LOG

echo "✓ Diretório de logs configurado"

# Tornar o script executável
chmod +x $SCRIPT_PATH

echo "✓ Script marcado como executável"

# Criar wrapper script para o cron
WRAPPER_SCRIPT="/usr/local/bin/coletar-produtividade-wrapper.sh"

cat > $WRAPPER_SCRIPT << 'EOF'
#!/bin/bash

# Wrapper script para executar coleta de produtividade
# Este script é chamado pelo cron

# Carregar variáveis de ambiente
export PATH="/usr/local/bin:/usr/bin:/bin"
export DISPLAY=:99

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

# Tornar wrapper executável
sudo chmod +x $WRAPPER_SCRIPT

echo "✓ Wrapper script criado em $WRAPPER_SCRIPT"

# Adicionar ao crontab
# Executar todos os dias às 2h da manhã
CRON_COMMAND="0 2 * * * $WRAPPER_SCRIPT"

# Verificar se já existe no crontab
(crontab -l 2>/dev/null | grep -F "$WRAPPER_SCRIPT") && {
    echo "⚠️  Cron job já existe. Removendo..."
    crontab -l 2>/dev/null | grep -v "$WRAPPER_SCRIPT" | crontab -
}

# Adicionar novo cron job
(crontab -l 2>/dev/null; echo "$CRON_COMMAND") | crontab -

echo "✓ Cron job adicionado: Execução diária às 2h da manhã"

# Mostrar crontab atual
echo ""
echo "======================================================================"
echo "CRONTAB ATUAL:"
echo "======================================================================"
crontab -l

echo ""
echo "======================================================================"
echo "CONFIGURAÇÃO CONCLUÍDA COM SUCESSO!"
echo "======================================================================"
echo ""
echo "O script será executado automaticamente todos os dias às 2h da manhã."
echo ""
echo "Para testar manualmente, execute:"
echo "  sudo $WRAPPER_SCRIPT"
echo ""
echo "Para ver os logs:"
echo "  tail -f $LOG_FILE"
echo "  tail -f $CRON_LOG"
echo ""
echo "Para remover o cron job:"
echo "  crontab -e"
echo "  (remova a linha que contém 'coletar-produtividade-wrapper.sh')"
echo ""
echo "======================================================================"
