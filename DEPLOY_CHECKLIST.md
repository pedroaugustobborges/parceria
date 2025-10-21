# 📋 Checklist de Deploy - Sistema de Produtividade MV

## Pré-Deploy (No seu computador local)

- [ ] Todos os arquivos criados e testados localmente
- [ ] Arquivo `.env` preparado (mas NÃO versionado no Git)
- [ ] Credenciais do Supabase disponíveis
- [ ] Acesso SSH ao droplet confirmado (`ssh root@138.68.27.70`)

---

## Deploy no Droplet (138.68.27.70)

### Fase 1: Preparação do Sistema (20 min)

- [ ] **1.1** Conectar ao droplet via SSH
  ```bash
  ssh root@138.68.27.70
  ```

- [ ] **1.2** Atualizar sistema
  ```bash
  sudo apt update && sudo apt upgrade -y
  ```

- [ ] **1.3** Instalar Python e ferramentas
  ```bash
  sudo apt install -y python3 python3-pip python3-venv git curl wget
  ```

- [ ] **1.4** Verificar instalações
  ```bash
  python3 --version  # Deve ser 3.8+
  pip3 --version
  ```

---

### Fase 2: Instalar Firefox e Geckodriver (15 min)

- [ ] **2.1** Instalar Firefox
  ```bash
  sudo apt install -y firefox
  firefox --version
  ```

- [ ] **2.2** Baixar Geckodriver
  ```bash
  cd /tmp
  wget https://github.com/mozilla/geckodriver/releases/download/v0.33.0/geckodriver-v0.33.0-linux64.tar.gz
  ```

- [ ] **2.3** Instalar Geckodriver
  ```bash
  tar -xvzf geckodriver-v0.33.0-linux64.tar.gz
  sudo mv geckodriver /usr/local/bin/
  sudo chmod +x /usr/local/bin/geckodriver
  geckodriver --version
  rm geckodriver-v0.33.0-linux64.tar.gz
  ```

- [ ] **2.4** Instalar Xvfb
  ```bash
  sudo apt install -y xvfb
  ```

- [ ] **2.5** Criar serviço Xvfb
  ```bash
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
  ```

- [ ] **2.6** Habilitar e iniciar Xvfb
  ```bash
  sudo systemctl enable xvfb
  sudo systemctl start xvfb
  sudo systemctl status xvfb  # Verificar se está "active (running)"
  ```

---

### Fase 3: Transferir Projeto (10 min)

**Opção A: Via SCP (do seu computador)**

- [ ] **3.1** No seu computador local (Windows), abrir PowerShell:
  ```powershell
  scp -r C:\Users\16144-pedro\Documents\python_projects\gestaodeacesso root@138.68.27.70:/root/
  ```

**Opção B: Criar manualmente**

- [ ] **3.1** No droplet, criar diretório:
  ```bash
  mkdir -p /root/gestaodeacesso
  cd /root/gestaodeacesso
  ```

- [ ] **3.2** Criar cada arquivo manualmente:
  ```bash
  # Usar nano ou vim para criar:
  # - coletar-produtividade-mv.py
  # - requirements-produtividade.txt
  # - setup-cron-produtividade.sh
  # - .env (com credenciais)
  ```

---

### Fase 4: Configurar Ambiente Python (10 min)

- [ ] **4.1** Navegar para o projeto
  ```bash
  cd /root/gestaodeacesso
  ```

- [ ] **4.2** Criar ambiente virtual
  ```bash
  python3 -m venv venv
  ```

- [ ] **4.3** Ativar ambiente virtual
  ```bash
  source venv/bin/activate
  ```

- [ ] **4.4** Atualizar pip
  ```bash
  pip install --upgrade pip
  ```

- [ ] **4.5** Instalar dependências
  ```bash
  pip install -r requirements-produtividade.txt
  ```

- [ ] **4.6** Verificar instalações
  ```bash
  pip list | grep -E "(selenium|supabase)"
  ```

---

### Fase 5: Configurar Variáveis de Ambiente (5 min)

- [ ] **5.1** Criar arquivo .env
  ```bash
  cd /root/gestaodeacesso
  nano .env
  ```

- [ ] **5.2** Adicionar credenciais (SUBSTITUIR COM VALORES REAIS):
  ```env
  VITE_SUPABASE_URL=https://seu-projeto.supabase.co
  VITE_SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key-aqui
  ```

- [ ] **5.3** Salvar e sair (Ctrl+X, Y, Enter)

- [ ] **5.4** Proteger arquivo
  ```bash
  chmod 600 .env
  chown root:root .env
  ```

- [ ] **5.5** Verificar conteúdo (SEM expor no terminal público!)
  ```bash
  cat .env
  ```

---

### Fase 6: Configurar Logs (5 min)

- [ ] **6.1** Criar arquivos de log
  ```bash
  sudo touch /var/log/produtividade-mv.log
  sudo touch /var/log/produtividade-mv-cron.log
  ```

- [ ] **6.2** Dar permissões
  ```bash
  sudo chmod 666 /var/log/produtividade-mv.log
  sudo chmod 666 /var/log/produtividade-mv-cron.log
  ```

- [ ] **6.3** Verificar
  ```bash
  ls -l /var/log/produtividade-mv*.log
  ```

---

### Fase 7: Teste Manual (15 min)

- [ ] **7.1** Ativar ambiente
  ```bash
  cd /root/gestaodeacesso
  source venv/bin/activate
  ```

- [ ] **7.2** Definir DISPLAY
  ```bash
  export DISPLAY=:99
  ```

- [ ] **7.3** Executar script
  ```bash
  python3 coletar-produtividade-mv.py
  ```

- [ ] **7.4** Acompanhar em outro terminal
  ```bash
  # Em outra sessão SSH:
  tail -f /var/log/produtividade-mv.log
  ```

- [ ] **7.5** Aguardar conclusão

- [ ] **7.6** Verificar resultado:
  - [ ] Script executou sem erros críticos
  - [ ] Conectou ao Supabase
  - [ ] Buscou usuários terceiros
  - [ ] Acessou MV
  - [ ] Extraiu dados
  - [ ] Inseriu no banco

- [ ] **7.7** Verificar no Supabase:
  ```sql
  SELECT * FROM produtividade ORDER BY created_at DESC LIMIT 5;
  ```

---

### Fase 8: Configurar Cron Job (10 min)

- [ ] **8.1** Tornar script de setup executável
  ```bash
  cd /root/gestaodeacesso
  chmod +x setup-cron-produtividade.sh
  ```

- [ ] **8.2** Executar setup
  ```bash
  ./setup-cron-produtividade.sh
  ```

- [ ] **8.3** Verificar mensagens de sucesso

- [ ] **8.4** Confirmar crontab
  ```bash
  crontab -l
  ```

  Deve mostrar:
  ```
  0 2 * * * /usr/local/bin/coletar-produtividade-wrapper.sh
  ```

- [ ] **8.5** Verificar wrapper criado
  ```bash
  ls -l /usr/local/bin/coletar-produtividade-wrapper.sh
  cat /usr/local/bin/coletar-produtividade-wrapper.sh
  ```

---

### Fase 9: Teste do Wrapper (5 min)

- [ ] **9.1** Executar wrapper manualmente
  ```bash
  sudo /usr/local/bin/coletar-produtividade-wrapper.sh
  ```

- [ ] **9.2** Ver log do cron
  ```bash
  tail -f /var/log/produtividade-mv-cron.log
  ```

- [ ] **9.3** Verificar execução completa

- [ ] **9.4** Confirmar dados no Supabase

---

### Fase 10: Validação Final (10 min)

- [ ] **10.1** Verificar serviços rodando:
  ```bash
  sudo systemctl status xvfb    # Deve estar "active"
  sudo systemctl status cron    # Deve estar "active"
  ```

- [ ] **10.2** Verificar estrutura de arquivos:
  ```bash
  tree /root/gestaodeacesso
  ```

- [ ] **10.3** Verificar logs:
  ```bash
  ls -lh /var/log/produtividade-mv*.log
  ```

- [ ] **10.4** Testar conexão com MV:
  ```bash
  curl -I http://mvpepprd.saude.go.gov.br/report-executor/report-viewer?id=7076
  ```
  (Deve retornar 200 OK)

- [ ] **10.5** Testar conexão com Supabase:
  ```bash
  cd /root/gestaodeacesso
  source venv/bin/activate
  python3 << EOF
  from dotenv import load_dotenv
  from supabase import create_client
  import os
  load_dotenv()
  client = create_client(os.getenv('VITE_SUPABASE_URL'), os.getenv('VITE_SUPABASE_SERVICE_ROLE_KEY'))
  response = client.table('usuarios').select('count', count='exact').limit(1).execute()
  print("✓ Conexão com Supabase OK")
  EOF
  ```

- [ ] **10.6** Verificar que arquivo .env está protegido:
  ```bash
  ls -l /root/gestaodeacesso/.env
  ```
  (Deve mostrar: `-rw------- 1 root root`)

---

## Pós-Deploy

### Monitoramento (Primeiras 24h)

- [ ] **Aguardar primeira execução automática** (próximas 2h da manhã)

- [ ] **No dia seguinte, verificar**:
  ```bash
  # Ver log da execução automática
  grep "COLETA DE PRODUTIVIDADE" /var/log/produtividade-mv.log | tail -n 1

  # Ver dados inseridos
  # (No Supabase, consultar tabela produtividade)
  ```

- [ ] **Confirmar que dados foram inseridos** para a data de ontem

---

### Primeira Semana

- [ ] **Dia 1**: Verificar execução e dados
- [ ] **Dia 3**: Verificar logs, confirmar sem erros
- [ ] **Dia 7**: Analisar padrão de execução, ajustar se necessário

---

### Primeira Mês

- [ ] **Semana 1-2**: Monitoramento ativo
- [ ] **Semana 3**: Análise de performance
- [ ] **Semana 4**: Otimizações se necessário

---

## Troubleshooting Durante Deploy

### Se algo der errado:

**Problema**: Erro ao instalar dependências Python
```bash
# Solução:
pip install --upgrade pip setuptools wheel
pip install -r requirements-produtividade.txt --no-cache-dir
```

**Problema**: Geckodriver não encontrado
```bash
# Solução:
which geckodriver  # Ver onde está
sudo ln -s /caminho/real/geckodriver /usr/local/bin/geckodriver
```

**Problema**: Xvfb não inicia
```bash
# Solução:
sudo journalctl -u xvfb -f  # Ver logs
sudo systemctl restart xvfb
```

**Problema**: Cron não executa
```bash
# Solução:
sudo systemctl status cron
sudo systemctl restart cron
# Verificar /var/log/syslog para erros
```

---

## Rollback (Se necessário)

### Desinstalar tudo:

```bash
# 1. Remover cron job
crontab -e  # Deletar linha

# 2. Remover wrapper
sudo rm /usr/local/bin/coletar-produtividade-wrapper.sh

# 3. Remover projeto
rm -rf /root/gestaodeacesso

# 4. Parar Xvfb
sudo systemctl stop xvfb
sudo systemctl disable xvfb

# 5. Remover logs
sudo rm /var/log/produtividade-mv*.log
```

---

## Backup Recomendado

### Antes de qualquer mudança:

```bash
# Backup do projeto
tar -czf ~/gestaodeacesso-backup-$(date +%Y%m%d).tar.gz /root/gestaodeacesso/

# Backup do .env
cp /root/gestaodeacesso/.env ~/env-backup-$(date +%Y%m%d).txt

# Backup do crontab
crontab -l > ~/crontab-backup-$(date +%Y%m%d).txt
```

---

## ✅ Deploy Completo!

Quando todos os checkboxes estiverem marcados, o sistema está **100% operacional**.

**Próximo passo**: Aguardar execução automática às 2h da manhã.

**Duração total estimada do deploy**: ~90 minutos

---

## 📞 Contatos de Emergência

- **Droplet**: 138.68.27.70
- **Logs**: `/var/log/produtividade-mv.log`
- **Supabase**: [Seu projeto Supabase]

---

**Data de Deploy**: _________________
**Executado por**: _________________
**Status Final**: [ ] Sucesso  [ ] Falha  [ ] Parcial
**Observações**:
_______________________________________________________
_______________________________________________________
_______________________________________________________
