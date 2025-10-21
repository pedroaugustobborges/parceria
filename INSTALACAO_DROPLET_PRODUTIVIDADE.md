# Instalação e Configuração - Coleta de Produtividade MV no Droplet

## Informações do Droplet

- **Provedor**: Digital Ocean
- **IPv4 (eth0)**: 138.68.27.70
- **Sistema**: Ubuntu 20.04+ (presumido)
- **URL MV**: http://mvpepprd.saude.go.gov.br/report-executor/report-viewer?id=7076

## Pré-requisitos

Este guia assume que você tem acesso SSH ao droplet:

```bash
ssh root@138.68.27.70
```

## Passo 1: Atualizar Sistema

```bash
# Atualizar pacotes
sudo apt update && sudo apt upgrade -y

# Instalar pacotes essenciais
sudo apt install -y python3 python3-pip python3-venv git curl wget
```

## Passo 2: Instalar Firefox e Geckodriver

### Instalar Firefox

```bash
# Instalar Firefox
sudo apt install -y firefox

# Verificar instalação
firefox --version
```

### Instalar Geckodriver

```bash
# Baixar geckodriver (ajustar versão se necessário)
GECKODRIVER_VERSION="v0.33.0"
wget https://github.com/mozilla/geckodriver/releases/download/$GECKODRIVER_VERSION/geckodriver-$GECKODRIVER_VERSION-linux64.tar.gz

# Extrair
tar -xvzf geckodriver-$GECKODRIVER_VERSION-linux64.tar.gz

# Mover para /usr/local/bin
sudo mv geckodriver /usr/local/bin/
sudo chmod +x /usr/local/bin/geckodriver

# Verificar instalação
geckodriver --version

# Limpar arquivo baixado
rm geckodriver-$GECKODRIVER_VERSION-linux64.tar.gz
```

### Instalar Xvfb (para modo headless)

```bash
# Xvfb permite rodar Firefox sem interface gráfica
sudo apt install -y xvfb

# Criar serviço do Xvfb
sudo tee /etc/systemd/system/xvfb.service > /dev/null <<EOF
[Unit]
Description=X Virtual Frame Buffer Service
After=network.target

[Service]
ExecStart=/usr/bin/Xvfb :99 -screen 0 1920x1080x24
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

# Habilitar e iniciar Xvfb
sudo systemctl enable xvfb
sudo systemctl start xvfb

# Verificar status
sudo systemctl status xvfb
```

## Passo 3: Clonar/Transferir Projeto

### Opção A: Transferir via SCP (do seu computador local)

```bash
# No seu computador local (Windows)
# Navegue até o diretório do projeto e execute:

scp -r C:\Users\16144-pedro\Documents\python_projects\gestaodeacesso root@138.68.27.70:/root/
```

### Opção B: Criar diretório e transferir arquivos individuais

```bash
# No droplet
mkdir -p /root/gestaodeacesso
cd /root/gestaodeacesso

# Transferir os seguintes arquivos do seu computador:
# - coletar-produtividade-mv.py
# - requirements-produtividade.txt
# - setup-cron-produtividade.sh
# - .env (com as credenciais)
```

## Passo 4: Configurar Ambiente Python

```bash
cd /root/gestaodeacesso

# Criar ambiente virtual
python3 -m venv venv

# Ativar ambiente virtual
source venv/bin/activate

# Atualizar pip
pip install --upgrade pip

# Instalar dependências
pip install -r requirements-produtividade.txt

# Verificar instalações
pip list
```

## Passo 5: Configurar Variáveis de Ambiente

```bash
cd /root/gestaodeacesso

# Criar arquivo .env
nano .env
```

Adicione o seguinte conteúdo (ajuste com suas credenciais reais):

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key-aqui
```

Salve e saia (Ctrl+X, depois Y, depois Enter).

```bash
# Proteger o arquivo .env
chmod 600 .env
```

## Passo 6: Criar Diretório de Logs

```bash
# Criar diretório de logs
sudo mkdir -p /var/log

# Criar arquivos de log
sudo touch /var/log/produtividade-mv.log
sudo touch /var/log/produtividade-mv-cron.log

# Dar permissões
sudo chmod 666 /var/log/produtividade-mv.log
sudo chmod 666 /var/log/produtividade-mv-cron.log
```

## Passo 7: Testar Script Manualmente

```bash
cd /root/gestaodeacesso

# Ativar ambiente virtual
source venv/bin/activate

# Definir DISPLAY para Xvfb
export DISPLAY=:99

# Executar script
python3 coletar-produtividade-mv.py
```

**Observações durante o teste:**
- O script deve conectar ao Supabase
- Buscar usuários terceiros
- Para cada usuário:
  - Acessar o relatório MV
  - Preencher o formulário
  - Extrair dados
  - Inserir no banco
- Aguardar 10s entre cada usuário

**Verificar logs:**
```bash
tail -f /var/log/produtividade-mv.log
```

## Passo 8: Configurar Cron Job

```bash
cd /root/gestaodeacesso

# Tornar script de setup executável
chmod +x setup-cron-produtividade.sh

# Executar script de configuração
./setup-cron-produtividade.sh
```

Isso irá:
1. Criar wrapper script em `/usr/local/bin/coletar-produtividade-wrapper.sh`
2. Adicionar entrada no crontab para executar às 2h da manhã
3. Configurar logs

**Verificar crontab:**
```bash
crontab -l
```

Deve mostrar algo como:
```
0 2 * * * /usr/local/bin/coletar-produtividade-wrapper.sh
```

## Passo 9: Testar Wrapper do Cron

```bash
# Executar wrapper manualmente para testar
sudo /usr/local/bin/coletar-produtividade-wrapper.sh

# Verificar logs do cron
tail -f /var/log/produtividade-mv-cron.log
```

## Passo 10: Monitoramento

### Ver logs em tempo real:

```bash
# Log principal
tail -f /var/log/produtividade-mv.log

# Log do cron
tail -f /var/log/produtividade-mv-cron.log
```

### Ver últimas execuções:

```bash
# Últimas 50 linhas
tail -n 50 /var/log/produtividade-mv.log

# Filtrar por data
grep "2025-10-20" /var/log/produtividade-mv.log
```

### Ver estatísticas de execução:

```bash
# Contar sucessos
grep "Processados com sucesso" /var/log/produtividade-mv.log

# Contar erros
grep "Erro" /var/log/produtividade-mv.log | wc -l
```

## Estrutura de Diretórios no Droplet

```
/root/gestaodeacesso/
├── coletar-produtividade-mv.py          # Script principal
├── requirements-produtividade.txt       # Dependências Python
├── setup-cron-produtividade.sh          # Script de configuração do cron
├── .env                                  # Variáveis de ambiente (SEGREDO!)
├── venv/                                 # Ambiente virtual Python
│   ├── bin/
│   ├── lib/
│   └── ...
└── productivity-report.jpg               # Imagem de referência do relatório

/usr/local/bin/
└── coletar-produtividade-wrapper.sh     # Wrapper para o cron

/var/log/
├── produtividade-mv.log                 # Log principal da aplicação
└── produtividade-mv-cron.log            # Log do cron job
```

## Ajuste de Caminho do Geckodriver

Se o geckodriver estiver em local diferente, edite o script:

```bash
nano /root/gestaodeacesso/coletar-produtividade-mv.py
```

Procure pela linha (aproximadamente linha 29):
```python
GECKODRIVER_PATH = '/usr/local/bin/geckodriver'
```

E ajuste conforme necessário.

## Solução de Problemas

### Problema: "geckodriver not found"

```bash
# Verificar se geckodriver está no PATH
which geckodriver

# Se não estiver, reinstalar:
sudo cp /caminho/para/geckodriver /usr/local/bin/
sudo chmod +x /usr/local/bin/geckodriver
```

### Problema: "Firefox not found"

```bash
# Verificar instalação do Firefox
which firefox

# Reinstalar se necessário
sudo apt install -y firefox
```

### Problema: "Display :99 not available"

```bash
# Verificar status do Xvfb
sudo systemctl status xvfb

# Reiniciar se necessário
sudo systemctl restart xvfb
```

### Problema: "Connection refused" ao acessar Supabase

```bash
# Verificar variáveis de ambiente
cd /root/gestaodeacesso
cat .env

# Testar conexão manualmente
python3 << EOF
from dotenv import load_dotenv
import os
load_dotenv()
print("URL:", os.getenv('VITE_SUPABASE_URL'))
print("KEY:", os.getenv('VITE_SUPABASE_SERVICE_ROLE_KEY')[:20] + "...")
EOF
```

### Problema: "Timeout ao preencher formulário"

Possíveis causas:
1. **Rede lenta**: Aumentar timeout no código
2. **XPath incorreto**: Verificar se elementos mudaram
3. **Página MV fora do ar**: Verificar manualmente

```bash
# Testar acesso ao MV
curl -I http://mvpepprd.saude.go.gov.br/report-executor/report-viewer?id=7076
```

### Problema: Cron não executa

```bash
# Verificar se cron está rodando
sudo systemctl status cron

# Iniciar se necessário
sudo systemctl start cron

# Ver logs do sistema
sudo tail -f /var/log/syslog | grep CRON
```

## Manutenção

### Atualizar Script

```bash
cd /root/gestaodeacesso

# Fazer backup
cp coletar-produtividade-mv.py coletar-produtividade-mv.py.backup

# Editar
nano coletar-produtividade-mv.py

# Salvar e testar
python3 coletar-produtividade-mv.py
```

### Limpar Logs Antigos

```bash
# Manter apenas últimos 7 dias
find /var/log/produtividade-mv*.log -mtime +7 -delete

# Ou criar rotação de logs
sudo tee /etc/logrotate.d/produtividade-mv > /dev/null <<EOF
/var/log/produtividade-mv*.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    missingok
}
EOF
```

### Atualizar Dependências

```bash
cd /root/gestaodeacesso
source venv/bin/activate

# Atualizar todas
pip install --upgrade -r requirements-produtividade.txt

# Ou atualizar individualmente
pip install --upgrade selenium supabase
```

## Segurança

### Proteger arquivo .env

```bash
# Apenas root pode ler
chmod 600 /root/gestaodeacesso/.env
chown root:root /root/gestaodeacesso/.env
```

### Firewall (se aplicável)

```bash
# Permitir apenas SSH
sudo ufw allow 22/tcp
sudo ufw enable
sudo ufw status
```

### Backup do .env

```bash
# Fazer backup em local seguro (NÃO versionar no Git!)
cp /root/gestaodeacesso/.env ~/backup/.env.backup
chmod 600 ~/backup/.env.backup
```

## Comandos Úteis

```bash
# Ver próximas execuções do cron
crontab -l

# Desabilitar temporariamente
# (comentar a linha com #)
crontab -e

# Executar manualmente fora do horário
sudo /usr/local/bin/coletar-produtividade-wrapper.sh

# Ver processos do Python rodando
ps aux | grep python

# Matar processo se necessário
pkill -f coletar-produtividade-mv.py

# Ver uso de recursos
htop
```

## Checklist de Instalação

- [ ] Sistema atualizado
- [ ] Python 3 instalado
- [ ] Firefox instalado
- [ ] Geckodriver instalado e no PATH
- [ ] Xvfb instalado e rodando
- [ ] Projeto transferido para `/root/gestaodeacesso`
- [ ] Ambiente virtual criado
- [ ] Dependências instaladas
- [ ] Arquivo `.env` configurado
- [ ] Logs criados e com permissões corretas
- [ ] Script testado manualmente com sucesso
- [ ] Cron job configurado
- [ ] Wrapper testado manualmente
- [ ] Logs sendo gerados corretamente
- [ ] Verificação no Supabase: dados sendo inseridos

## Contato e Suporte

Se encontrar problemas, verifique:
1. Logs em `/var/log/produtividade-mv.log`
2. Logs do cron em `/var/log/produtividade-mv-cron.log`
3. Syslog: `sudo tail -f /var/log/syslog`

## Próximos Passos

Após instalação bem-sucedida:
1. Monitorar execuções nas primeiras semanas
2. Ajustar timeouts se necessário
3. Implementar alertas por email em caso de falhas
4. Criar dashboard para visualizar dados de produtividade
5. Considerar backup automático dos dados
