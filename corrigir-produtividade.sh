#!/bin/bash

echo "======================================"
echo "SCRIPT DE CORREÇÃO RÁPIDA"
echo "Produtividade MV - doctors-productivity-scraper"
echo "======================================"
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SCRIPT_PATH="/root/coletar-produtividade-mv.py"
PYTHON_CMD="python3"

echo "📋 INICIANDO CORREÇÕES AUTOMÁTICAS..."
echo ""

# 1. Verificar se o script existe
echo "1️⃣  Verificando script..."
if [ ! -f "$SCRIPT_PATH" ]; then
    echo -e "${RED}❌ Script não encontrado em $SCRIPT_PATH${NC}"
    echo "   Procurando em outros locais..."
    FOUND=$(find /root -name "coletar-produtividade-mv.py" 2>/dev/null | head -n 1)
    if [ ! -z "$FOUND" ]; then
        SCRIPT_PATH="$FOUND"
        echo -e "${GREEN}✅ Script encontrado em: $SCRIPT_PATH${NC}"
    else
        echo -e "${RED}❌ Script não encontrado. Abortando.${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ Script encontrado${NC}"
fi
echo ""

# 2. Verificar e corrigir permissões
echo "2️⃣  Verificando permissões..."
chmod +x "$SCRIPT_PATH"
echo -e "${GREEN}✅ Permissões ajustadas${NC}"
echo ""

# 3. Verificar Python e dependências
echo "3️⃣  Verificando Python e dependências..."
if ! command -v $PYTHON_CMD &> /dev/null; then
    echo -e "${RED}❌ Python3 não encontrado${NC}"
    exit 1
fi
echo "   Python: $($PYTHON_CMD --version)"

# Verificar dependências críticas
MISSING_DEPS=0
for pkg in selenium supabase python-dotenv; do
    if ! $PYTHON_CMD -c "import ${pkg//-/_}" 2>/dev/null; then
        echo -e "${RED}   ❌ Faltando: $pkg${NC}"
        MISSING_DEPS=1
    fi
done

if [ $MISSING_DEPS -eq 1 ]; then
    echo ""
    echo -e "${YELLOW}⚠️  Instalando dependências faltantes...${NC}"
    pip3 install selenium supabase python-dotenv
fi
echo -e "${GREEN}✅ Dependências verificadas${NC}"
echo ""

# 4. Verificar e iniciar Xvfb
echo "4️⃣  Verificando Xvfb..."
if systemctl list-units --full -all | grep -q xvfb.service; then
    if ! systemctl is-active --quiet xvfb; then
        echo -e "${YELLOW}⚠️  Xvfb não está rodando. Iniciando...${NC}"
        systemctl start xvfb
        sleep 2
        if systemctl is-active --quiet xvfb; then
            echo -e "${GREEN}✅ Xvfb iniciado com sucesso${NC}"
            systemctl enable xvfb
        else
            echo -e "${RED}❌ Falha ao iniciar Xvfb${NC}"
        fi
    else
        echo -e "${GREEN}✅ Xvfb já está rodando${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Serviço Xvfb não configurado${NC}"
    echo "   Verificando se está rodando manualmente..."
    if ! ps aux | grep -v grep | grep -q Xvfb; then
        echo -e "${RED}❌ Xvfb não está rodando${NC}"
        echo "   Nota: O script pode usar --headless nativo do Firefox"
    else
        echo -e "${GREEN}✅ Xvfb rodando manualmente${NC}"
    fi
fi
echo ""

# 5. Verificar geckodriver
echo "5️⃣  Verificando geckodriver..."
if command -v geckodriver &> /dev/null; then
    echo -e "${GREEN}✅ Geckodriver encontrado: $(which geckodriver)${NC}"
    geckodriver --version | head -n 1
else
    echo -e "${RED}❌ Geckodriver não encontrado${NC}"
    echo "   Instale com:"
    echo "   wget https://github.com/mozilla/geckodriver/releases/download/v0.34.0/geckodriver-v0.34.0-linux64.tar.gz"
    echo "   tar -xzf geckodriver-v0.34.0-linux64.tar.gz"
    echo "   sudo mv geckodriver /usr/local/bin/"
fi
echo ""

# 6. Verificar arquivo .env
echo "6️⃣  Verificando arquivo .env..."
ENV_FOUND=0
for env_path in "/root/.env" "$(dirname $SCRIPT_PATH)/.env"; do
    if [ -f "$env_path" ]; then
        echo -e "${GREEN}✅ Arquivo .env encontrado: $env_path${NC}"
        ENV_FOUND=1
        # Verificar se tem as variáveis necessárias
        if grep -q "VITE_SUPABASE_URL" "$env_path" && grep -q "VITE_SUPABASE_SERVICE_ROLE_KEY" "$env_path"; then
            echo -e "${GREEN}✅ Variáveis Supabase configuradas${NC}"
        else
            echo -e "${RED}❌ Variáveis Supabase faltando no .env${NC}"
        fi
        break
    fi
done

if [ $ENV_FOUND -eq 0 ]; then
    echo -e "${RED}❌ Arquivo .env não encontrado${NC}"
fi
echo ""

# 7. Verificar e configurar crontab
echo "7️⃣  Verificando crontab..."
if crontab -l 2>/dev/null | grep -q "coletar-produtividade-mv.py"; then
    echo -e "${GREEN}✅ Cron já configurado${NC}"
    echo "   Entrada atual:"
    crontab -l 2>/dev/null | grep "coletar-produtividade-mv.py"
else
    echo -e "${YELLOW}⚠️  Cron NÃO configurado${NC}"
    echo ""
    read -p "Deseja configurar o cron agora? (s/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[SsYy]$ ]]; then
        # Criar backup do crontab atual
        crontab -l 2>/dev/null > /tmp/crontab.backup

        # Adicionar nova entrada
        (crontab -l 2>/dev/null; echo "0 2 * * * cd $(dirname $SCRIPT_PATH) && $PYTHON_CMD $SCRIPT_PATH >> /var/log/produtividade-mv-cron.log 2>&1") | crontab -

        if crontab -l 2>/dev/null | grep -q "coletar-produtividade-mv.py"; then
            echo -e "${GREEN}✅ Cron configurado com sucesso!${NC}"
            echo "   Nova entrada:"
            crontab -l | grep "coletar-produtividade-mv.py"
        else
            echo -e "${RED}❌ Falha ao configurar cron${NC}"
        fi
    fi
fi
echo ""

# 8. Teste de conectividade
echo "8️⃣  Testando conectividade com MV..."
if curl -s -o /dev/null -w "%{http_code}" "http://mvpepprd.saude.go.gov.br" --max-time 10 | grep -q "200\|302"; then
    echo -e "${GREEN}✅ Servidor MV acessível${NC}"
else
    echo -e "${RED}❌ Servidor MV não acessível${NC}"
fi
echo ""

# 9. Verificar se sistema precisa reiniciar
echo "9️⃣  Verificando necessidade de reinicialização..."
if [ -f /var/run/reboot-required ]; then
    echo -e "${RED}⚠️  SISTEMA PRECISA SER REINICIADO!${NC}"
    echo "   Pacotes que requerem reinício:"
    cat /var/run/reboot-required.pkgs 2>/dev/null
    echo ""
    echo "   Execute: sudo reboot"
else
    echo -e "${GREEN}✅ Sistema não precisa reiniciar${NC}"
fi
echo ""

# 10. Teste manual do script
echo "🔟  Oferecendo teste manual..."
read -p "Deseja executar o script manualmente agora? (s/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[SsYy]$ ]]; then
    echo ""
    echo "Executando script..."
    echo "======================================"
    cd "$(dirname $SCRIPT_PATH)"
    $PYTHON_CMD "$SCRIPT_PATH"
    EXIT_CODE=$?
    echo "======================================"
    echo ""
    if [ $EXIT_CODE -eq 0 ]; then
        echo -e "${GREEN}✅ Script executado com sucesso!${NC}"
    else
        echo -e "${RED}❌ Script falhou com exit code: $EXIT_CODE${NC}"
        echo "   Veja os logs em: /var/log/produtividade-mv.log"
    fi
fi

echo ""
echo "======================================"
echo "CORREÇÕES CONCLUÍDAS"
echo "======================================"
echo ""
echo "📝 PRÓXIMOS PASSOS:"
echo "1. Se o sistema precisa reiniciar: sudo reboot"
echo "2. Verificar logs: tail -f /var/log/produtividade-mv.log"
echo "3. Aguardar próxima execução do cron (2h da manhã)"
echo "4. Verificar dados no Supabase no dia seguinte"
echo ""
