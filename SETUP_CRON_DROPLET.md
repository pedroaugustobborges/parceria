# 📅 Setup: Recalcular Status Automático no Droplet

## 🎯 Objetivo

Configurar um script Python para executar **automaticamente todos os dias às 14h** no Droplet, recalculando o status das escalas médicas do **dia anterior**.

---

## 📋 Pré-requisitos

- ✅ Droplet ativo (DigitalOcean)
- ✅ Acesso SSH ao Droplet
- ✅ Credenciais do Supabase (URL e Service Role Key)

---

## 🚀 Passo a Passo Completo

### **Passo 1: Conectar ao Droplet via SSH**

No seu computador local, abra o terminal e conecte-se ao Droplet:

```bash
ssh root@SEU_IP_DO_DROPLET
```

Exemplo:
```bash
ssh root@192.168.1.100
```

**Dica**: Se precisar da senha, use a senha que você configurou ao criar o Droplet.

---

### **Passo 2: Atualizar o Sistema**

Após conectar, atualize os pacotes do sistema:

```bash
apt update && apt upgrade -y
```

Aguarde a conclusão (pode demorar alguns minutos).

---

### **Passo 3: Instalar Python 3 e Pip**

Verifique se o Python 3 está instalado:

```bash
python3 --version
```

Se não estiver instalado, instale:

```bash
apt install python3 python3-pip -y
```

Verifique a instalação:

```bash
python3 --version
pip3 --version
```

---

### **Passo 4: Criar Diretório para o Script**

Crie um diretório dedicado para os scripts:

```bash
mkdir -p /opt/gestaodeacesso
cd /opt/gestaodeacesso
```

---

### **Passo 5: Criar Arquivo .env com Credenciais**

Crie o arquivo `.env` com as credenciais do Supabase:

```bash
nano .env
```

Cole o seguinte conteúdo (substitua pelos seus valores reais):

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key-aqui
```

**Como obter essas credenciais:**
1. Vá para o Supabase Dashboard
2. Clique em **Settings** > **API**
3. Copie:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **service_role secret** → `VITE_SUPABASE_SERVICE_ROLE_KEY`

**Salvar e sair do nano:**
- Pressione `Ctrl + O` (salvar)
- Pressione `Enter` (confirmar)
- Pressione `Ctrl + X` (sair)

---

### **Passo 6: Criar o Script Python**

Crie o arquivo do script:

```bash
nano recalcular-status-diario.py
```

Cole o conteúdo completo do arquivo `recalcular-status-diario.py` que foi criado anteriormente.

**Salvar e sair:**
- `Ctrl + O` → `Enter` → `Ctrl + X`

---

### **Passo 7: Tornar o Script Executável**

```bash
chmod +x recalcular-status-diario.py
```

---

### **Passo 8: Instalar Dependências Python**

Instale as bibliotecas necessárias:

```bash
pip3 install supabase python-dotenv
```

Aguarde a instalação.

---

### **Passo 9: Criar Diretório de Logs**

Crie o diretório onde os logs serão salvos:

```bash
mkdir -p /var/log
touch /var/log/recalcular-status.log
chmod 666 /var/log/recalcular-status.log
```

---

### **Passo 10: Testar o Script Manualmente**

Antes de configurar o cron, teste se o script funciona:

```bash
cd /opt/gestaodeacesso
python3 recalcular-status-diario.py
```

**Resultado esperado:**
```
================================================================================
🤖 INICIANDO RECÁLCULO AUTOMÁTICO DE STATUS
📅 Data alvo: 14/12/2025 (ontem)
🕐 Executado em: 15/12/2025 às 14:00:00
================================================================================

📊 X escala(s) encontrada(s) para recalcular
...
✅ Script executado com sucesso!
```

**Se houver erros:**
- Verifique o arquivo `.env`
- Verifique as credenciais do Supabase
- Verifique a conexão com a internet

---

### **Passo 11: Configurar o Cron Job**

Agora vamos configurar para o script executar automaticamente todos os dias às 14h.

Abra o crontab:

```bash
crontab -e
```

**Na primeira vez**, o sistema perguntará qual editor usar. Escolha `nano` (opção 1).

Adicione a seguinte linha **no final do arquivo**:

```bash
0 14 * * * cd /opt/gestaodeacesso && /usr/bin/python3 recalcular-status-diario.py >> /var/log/recalcular-status.log 2>&1
```

**Explicação da linha:**
- `0 14 * * *` - Executar às 14:00 todos os dias
- `cd /opt/gestaodeacesso` - Ir para o diretório do script
- `&&` - E então...
- `/usr/bin/python3 recalcular-status-diario.py` - Executar o script
- `>> /var/log/recalcular-status.log` - Adicionar logs ao arquivo
- `2>&1` - Redirecionar erros para o mesmo arquivo de log

**Salvar e sair:**
- `Ctrl + O` → `Enter` → `Ctrl + X`

Verifique se o cron foi adicionado:

```bash
crontab -l
```

Você deve ver a linha que acabou de adicionar.

---

### **Passo 12: Verificar o Serviço Cron**

Certifique-se de que o cron está rodando:

```bash
systemctl status cron
```

Se não estiver rodando:

```bash
systemctl start cron
systemctl enable cron
```

---

### **Passo 13: Testar o Cron (Opcional)**

Para testar se o cron está funcionando, você pode criar uma execução de teste para 1 minuto à frente.

Veja a hora atual:

```bash
date
```

Edite o crontab temporariamente:

```bash
crontab -e
```

Adicione uma linha para executar no próximo minuto. Por exemplo, se agora são 10:30, adicione:

```bash
31 10 * * * cd /opt/gestaodeacesso && /usr/bin/python3 recalcular-status-diario.py >> /var/log/recalcular-status-test.log 2>&1
```

Aguarde 1 minuto e verifique o log:

```bash
cat /var/log/recalcular-status-test.log
```

Se funcionou, remova a linha de teste:

```bash
crontab -e
# Delete a linha de teste
# Mantenha apenas a linha das 14h
```

---

## 📊 Monitoramento e Logs

### Ver Logs em Tempo Real

Para ver os logs enquanto o script executa:

```bash
tail -f /var/log/recalcular-status.log
```

**Pressione `Ctrl + C` para sair.**

### Ver Últimas 50 Linhas do Log

```bash
tail -n 50 /var/log/recalcular-status.log
```

### Ver Todo o Log

```bash
cat /var/log/recalcular-status.log
```

### Limpar Logs Antigos (Opcional)

Se o arquivo de log ficar muito grande:

```bash
echo "" > /var/log/recalcular-status.log
```

---

## 🔧 Horários do Cron (Referência Rápida)

Se você quiser mudar o horário de execução:

```bash
# Minuto Hora Dia Mês DiaDaSemana
0 14 * * *        # Todos os dias às 14:00
0 9 * * *         # Todos os dias às 09:00
30 14 * * *       # Todos os dias às 14:30
0 14 * * 1        # Toda segunda-feira às 14:00
0 14 1 * *        # Todo dia 1 do mês às 14:00
0 */6 * * *       # A cada 6 horas (00:00, 06:00, 12:00, 18:00)
*/30 * * * *      # A cada 30 minutos
```

Para editar:

```bash
crontab -e
```

---

## ✅ Checklist de Verificação

Após completar todos os passos, verifique:

- [ ] Python 3 instalado (`python3 --version`)
- [ ] Pip instalado (`pip3 --version`)
- [ ] Diretório `/opt/gestaodeacesso` criado
- [ ] Arquivo `.env` com credenciais corretas
- [ ] Script `recalcular-status-diario.py` criado
- [ ] Script é executável (`chmod +x`)
- [ ] Dependências instaladas (`supabase`, `python-dotenv`)
- [ ] Diretório de logs criado (`/var/log/recalcular-status.log`)
- [ ] Script testado manualmente (executou sem erros)
- [ ] Cron job configurado (`crontab -l`)
- [ ] Serviço cron rodando (`systemctl status cron`)

---

## 🔍 Solução de Problemas

### Script Não Executa

**Verifique o log do cron:**

```bash
grep CRON /var/log/syslog | tail -20
```

**Verifique permissões:**

```bash
ls -la /opt/gestaodeacesso/recalcular-status-diario.py
```

Deve mostrar `-rwxr-xr-x` (executável).

### Erro "ModuleNotFoundError"

Reinstale as dependências:

```bash
pip3 install --upgrade supabase python-dotenv
```

### Erro de Conexão com Supabase

Verifique:
1. As credenciais no `.env` estão corretas
2. O Droplet tem acesso à internet: `ping google.com`
3. O Supabase está acessível: `curl https://seu-projeto.supabase.co`

### Script Executa Mas Não Atualiza

Verifique os logs:

```bash
tail -n 100 /var/log/recalcular-status.log
```

Procure por mensagens de erro.

---

## 📧 Notificações por Email (Opcional)

Para receber email quando o script executar, instale o `mailutils`:

```bash
apt install mailutils -y
```

Edite o cron:

```bash
crontab -e
```

Adicione antes da linha do cron:

```bash
MAILTO=seu-email@exemplo.com

0 14 * * * cd /opt/gestaodeacesso && /usr/bin/python3 recalcular-status-diario.py >> /var/log/recalcular-status.log 2>&1
```

**Nota**: O servidor de email do Droplet precisa estar configurado.

---

## 🎯 Estrutura Final no Droplet

```
/opt/gestaodeacesso/
├── .env                          # Credenciais Supabase
└── recalcular-status-diario.py   # Script principal

/var/log/
└── recalcular-status.log         # Arquivo de logs

/etc/crontab ou crontab -l
└── 0 14 * * * ...                # Agendamento
```

---

## 📅 O Que Acontece Diariamente

**Às 14:00 todos os dias:**

1. ✅ Cron inicia o script Python
2. ✅ Script conecta ao Supabase
3. ✅ Busca escalas de **ontem** com status "Programado"
4. ✅ Para cada escala:
   - Busca acessos dos médicos no dia
   - Calcula horas trabalhadas
   - Determina novo status:
     - **"Atenção"** se não compareceu (0 horas)
     - **"Aprovação Parcial"** se trabalhou parcialmente
     - **"Pré-Aprovado"** se trabalhou horas completas
5. ✅ Atualiza o banco de dados
6. ✅ Registra resultado nos logs
7. ✅ Envia email (se configurado)

---

## 🔒 Segurança

**Proteja o arquivo `.env`:**

```bash
chmod 600 /opt/gestaodeacesso/.env
```

Isso garante que só o root pode ler o arquivo.

**Verifique:**

```bash
ls -la /opt/gestaodeacesso/.env
```

Deve mostrar `-rw-------` (somente leitura/escrita pelo dono).

---

## 🚀 Comandos Úteis

### Ver Status do Cron
```bash
systemctl status cron
```

### Reiniciar Cron
```bash
systemctl restart cron
```

### Listar Cron Jobs
```bash
crontab -l
```

### Editar Cron Jobs
```bash
crontab -e
```

### Remover Todos os Cron Jobs
```bash
crontab -r
```

### Executar Script Manualmente
```bash
cd /opt/gestaodeacesso && python3 recalcular-status-diario.py
```

### Ver Logs em Tempo Real
```bash
tail -f /var/log/recalcular-status.log
```

---

## ✅ Pronto!

O script agora executará automaticamente **todos os dias às 14h**, recalculando o status das escalas do dia anterior.

**Próximo passo**: Aguarde até às 14h do dia seguinte e verifique os logs para confirmar que funcionou!

---

**Data de criação**: 15/12/2025
**Autor**: Sistema Automatizado
**Status**: ✅ Documentação completa
