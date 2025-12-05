# 📅 Como Agendar Script de Produtividade para Rodar Automaticamente

Este guia explica como configurar o script `coletar-produtividade-wrapper.sh` para rodar automaticamente todos os dias às **2:15 AM** (horário de Brasília).

---

## 🕐 Método 1: Usando Cron (Linux/Mac) - RECOMENDADO

### Passo 1: Verificar o Timezone do Servidor

Primeiro, confirme que o servidor está configurado para o horário de Brasília:

```bash
# Verificar timezone atual
timedatectl

# OU
date +%Z
```

**Resultado esperado:** `BRT` ou `-03` (Brasília)

Se não estiver configurado corretamente:

```bash
# Configurar timezone para Brasília
sudo timedatectl set-timezone America/Sao_Paulo

# Verificar novamente
timedatectl
```

---

### Passo 2: Editar o Crontab

O `cron` é o agendador de tarefas do Linux. Vamos editá-lo:

```bash
# Editar crontab do usuário atual
crontab -e

# OU se precisar rodar como root:
sudo crontab -e
```

**Nota:** Na primeira vez, pode pedir para escolher um editor. Recomendo `nano` (opção 1).

---

### Passo 3: Adicionar a Entrada do Cron

Adicione esta linha no final do arquivo:

```bash
# Coletar produtividade todos os dias às 2:15 AM
15 2 * * * /usr/local/bin/coletar-produtividade-wrapper.sh >> /var/log/produtividade-cron.log 2>&1
```

**Explicação da sintaxe:**
```
15 2 * * *  comando
│  │ │ │ │
│  │ │ │ └─── Dia da semana (0-7, onde 0 e 7 = Domingo)
│  │ │ └───── Mês (1-12)
│  │ └─────── Dia do mês (1-31)
│  └───────── Hora (0-23)
└─────────── Minuto (0-59)

* = qualquer valor
```

**Tradução:** Minuto 15, Hora 2, Todo dia do mês, Todo mês, Todo dia da semana = **2:15 AM todos os dias**

---

### Passo 4: Salvar e Sair

- **Nano:** Pressione `Ctrl+O` (salvar), depois `Ctrl+X` (sair)
- **Vim:** Pressione `ESC`, digite `:wq`, pressione `Enter`
- **Vi:** Mesmo que Vim

Você verá uma mensagem como:
```
crontab: installing new crontab
```

---

### Passo 5: Verificar se Foi Instalado Corretamente

```bash
# Listar todas as tarefas agendadas
crontab -l

# OU para root:
sudo crontab -l
```

Deve aparecer a linha que você adicionou.

---

### Passo 6: Testar Manualmente (Antes de Esperar às 2:15 AM)

```bash
# Executar o script manualmente para testar
sudo /usr/local/bin/coletar-produtividade-wrapper.sh

# Verificar se funcionou
cat /var/log/produtividade-cron.log
```

---

### Passo 7: Verificar Logs Após Execução Automática

No dia seguinte (após às 2:15 AM), verifique se rodou:

```bash
# Ver log do script
cat /var/log/produtividade-cron.log

# Ver últimas 50 linhas do log
tail -n 50 /var/log/produtividade-cron.log

# Ver log do cron do sistema
sudo grep CRON /var/log/syslog

# OU (em sistemas com journalctl)
sudo journalctl -u cron | grep produtividade
```

---

## 🪟 Método 2: Usando Task Scheduler (Windows Server)

Se o servidor for Windows, use o Agendador de Tarefas:

### Passo 1: Abrir Agendador de Tarefas

1. Pressione `Win + R`
2. Digite: `taskschd.msc`
3. Pressione `Enter`

### Passo 2: Criar Nova Tarefa

1. Clique em **"Criar Tarefa Básica"** no painel direito
2. Nome: `Coletar Produtividade Diária`
3. Descrição: `Executa script de coleta às 2:15 AM`
4. Clique em **"Avançar"**

### Passo 3: Configurar Gatilho

1. Escolha: **"Diariamente"**
2. Clique em **"Avançar"**
3. Hora de início: **02:15:00**
4. Recorrer a cada: **1 dias**
5. Clique em **"Avançar"**

### Passo 4: Configurar Ação

1. Escolha: **"Iniciar um programa"**
2. Programa/script: `bash` (ou caminho completo do bash)
3. Argumentos: `/usr/local/bin/coletar-produtividade-wrapper.sh`
4. Clique em **"Avançar"**

### Passo 5: Finalizar

1. Marque: **"Abrir a caixa de diálogo Propriedades ao clicar em Concluir"**
2. Clique em **"Concluir"**

### Passo 6: Configurações Avançadas

Na caixa de Propriedades:
- Aba **"Geral"**: Marque **"Executar estando o usuário conectado ou não"**
- Aba **"Geral"**: Marque **"Executar com privilégios mais altos"**
- Aba **"Configurações"**: Marque **"Executar tarefa assim que possível após uma inicialização agendada ser perdida"**
- Clique em **"OK"**

---

## 🔧 Configurações Adicionais do Cron (Recomendado)

### 1. Criar Arquivo de Log com Rotação

Para evitar que o log fique muito grande:

```bash
# Criar arquivo de configuração do logrotate
sudo nano /etc/logrotate.d/produtividade
```

Adicione:
```
/var/log/produtividade-cron.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0644 root root
}
```

Isso mantém os últimos 30 dias de logs.

---

### 2. Adicionar Notificação em Caso de Erro

Edite o crontab novamente e adicione um email:

```bash
crontab -e
```

Adicione no topo:
```bash
MAILTO=seu-email@exemplo.com

# Coletar produtividade todos os dias às 2:15 AM
15 2 * * * /usr/local/bin/coletar-produtividade-wrapper.sh >> /var/log/produtividade-cron.log 2>&1 || echo "Erro ao coletar produtividade" | mail -s "ERRO: Coleta Produtividade" seu-email@exemplo.com
```

---

### 3. Adicionar Timeout para Evitar Travamento

```bash
# Executar com timeout de 1 hora (3600 segundos)
15 2 * * * timeout 3600 /usr/local/bin/coletar-produtividade-wrapper.sh >> /var/log/produtividade-cron.log 2>&1
```

---

## 📊 Exemplos de Cron para Diferentes Horários

```bash
# Todos os dias às 2:15 AM
15 2 * * * comando

# Todos os dias às 0:00 (meia-noite)
0 0 * * * comando

# De segunda a sexta às 8:00 AM
0 8 * * 1-5 comando

# A cada 6 horas
0 */6 * * * comando

# Primeiro dia do mês às 3:00 AM
0 3 1 * * comando

# Toda segunda-feira às 9:00 AM
0 9 * * 1 comando
```

---

## ✅ Checklist de Verificação

Depois de configurar, verifique:

- [ ] Timezone do servidor está correto (America/Sao_Paulo)
- [ ] Crontab foi salvo corretamente (`crontab -l`)
- [ ] Caminho do script está correto (`/usr/local/bin/coletar-produtividade-wrapper.sh`)
- [ ] Script tem permissão de execução (`chmod +x`)
- [ ] Script roda manualmente sem erros
- [ ] Log está sendo gerado (`/var/log/produtividade-cron.log`)
- [ ] Serviço cron está rodando (`systemctl status cron`)

---

## 🔍 Troubleshooting

### Problema: Cron não está rodando

**Verificar se o serviço cron está ativo:**
```bash
# Ubuntu/Debian
sudo systemctl status cron

# CentOS/RHEL
sudo systemctl status crond

# Se não estiver ativo:
sudo systemctl start cron
sudo systemctl enable cron
```

### Problema: Script não executa

**Verificar permissões:**
```bash
# Ver permissões
ls -la /usr/local/bin/coletar-produtividade-wrapper.sh

# Adicionar permissão de execução
sudo chmod +x /usr/local/bin/coletar-produtividade-wrapper.sh

# Se necessário, dar permissão de leitura/escrita
sudo chmod 755 /usr/local/bin/coletar-produtividade-wrapper.sh
```

### Problema: Erro de "command not found" no cron

O cron tem um PATH limitado. Use caminhos absolutos:

```bash
# Verificar caminhos dos comandos
which python3
which node
which bash

# Exemplo de cron com PATH completo:
15 2 * * * /usr/bin/bash /usr/local/bin/coletar-produtividade-wrapper.sh >> /var/log/produtividade-cron.log 2>&1
```

### Problema: Script roda mas não coleta dados

**Verificar variáveis de ambiente:**

Edite o wrapper para incluir variáveis:

```bash
#!/bin/bash

# Definir variáveis de ambiente
export PATH=/usr/local/bin:/usr/bin:/bin
export NODE_ENV=production

# Seu script aqui
# ...
```

---

## 📝 Exemplo Completo de Entrada Cron (Recomendado)

```bash
# ==========================================
# Coleta de Produtividade - 2:15 AM Diário
# ==========================================
SHELL=/bin/bash
PATH=/usr/local/bin:/usr/bin:/bin
MAILTO=seu-email@exemplo.com

# Executar às 2:15 AM com timeout de 1h e log
15 2 * * * timeout 3600 /usr/local/bin/coletar-produtividade-wrapper.sh >> /var/log/produtividade-cron.log 2>&1
```

---

## 🎯 Resumo Rápido

**Para agendar às 2:15 AM todos os dias:**

1. Abra o crontab: `crontab -e`
2. Adicione a linha:
   ```
   15 2 * * * /usr/local/bin/coletar-produtividade-wrapper.sh >> /var/log/produtividade-cron.log 2>&1
   ```
3. Salve e saia
4. Verifique: `crontab -l`
5. Teste manualmente: `sudo /usr/local/bin/coletar-produtividade-wrapper.sh`
6. Aguarde até 2:15 AM do dia seguinte
7. Verifique log: `cat /var/log/produtividade-cron.log`

✅ Pronto! Seu script rodará automaticamente todos os dias às 2:15 AM!

---

## 📞 Comandos Úteis

```bash
# Listar tarefas agendadas
crontab -l

# Editar tarefas
crontab -e

# Remover todas as tarefas
crontab -r

# Ver logs do sistema
sudo tail -f /var/log/syslog | grep CRON

# Verificar execuções recentes do cron
sudo journalctl -u cron --since today

# Ver status do serviço cron
sudo systemctl status cron

# Reiniciar serviço cron
sudo systemctl restart cron
```
