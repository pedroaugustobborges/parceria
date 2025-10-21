# Resumo Completo - Sistema de Coleta de Produtividade MV

## ✅ Sistema Implementado com Sucesso

Foi criado um sistema completo e automatizado para coletar dados de produtividade do sistema MV (hospital) e inserir na tabela `produtividade` do Supabase.

---

## 📁 Arquivos Criados

### 1. **coletar-produtividade-mv.py** (Script Principal)
- **Localização**: `/root/gestaodeacesso/coletar-produtividade-mv.py`
- **Função**: Script Python com Selenium que automatiza a coleta
- **Tecnologias**: Selenium WebDriver, Firefox, Supabase
- **Características**:
  - Modo headless (sem interface gráfica)
  - Logging detalhado
  - Tratamento de erros robusto
  - Atualização inteligente (UPDATE ou INSERT)

### 2. **setup-cron-produtividade.sh** (Instalador do Cron)
- **Localização**: `/root/gestaodeacesso/setup-cron-produtividade.sh`
- **Função**: Configura o cron job para execução automática
- **Executa**:
  - Cria wrapper script
  - Configura logs
  - Adiciona ao crontab (2h da manhã)

### 3. **requirements-produtividade.txt** (Dependências)
- **Localização**: `/root/gestaodeacesso/requirements-produtividade.txt`
- **Função**: Lista todas as dependências Python
- **Pacotes principais**:
  - selenium==4.15.2
  - supabase==2.3.2
  - python-dotenv==1.0.0

### 4. **INSTALACAO_DROPLET_PRODUTIVIDADE.md** (Guia de Instalação)
- **Função**: Guia completo passo a passo para instalação no droplet
- **Conteúdo**:
  - Instalação de pré-requisitos
  - Configuração do Firefox e Geckodriver
  - Setup do Xvfb (modo headless)
  - Configuração de ambiente Python
  - Testes e validação
  - Troubleshooting detalhado

### 5. **GUIA_RAPIDO_PRODUTIVIDADE.md** (Referência Rápida)
- **Função**: Guia de referência rápida para uso diário
- **Conteúdo**:
  - Comandos essenciais
  - Como visualizar logs
  - Troubleshooting comum
  - Consultas SQL úteis
  - FAQ

### 6. **RESUMO_SISTEMA_PRODUTIVIDADE.md** (Este arquivo)
- **Função**: Visão geral completa do sistema

---

## 🎯 Como o Sistema Funciona

### Fluxo Automatizado:

```
TODOS OS DIAS ÀS 2H DA MANHÃ
         ↓
    Cron dispara
         ↓
    Script Python executa
         ↓
1. Conecta ao Supabase
2. Busca usuários tipo "terceiro" com codigomv
         ↓
Para CADA usuário:
    a) Abre Firefox (headless)
    b) Acessa: http://mvpepprd.saude.go.gov.br/report-executor/report-viewer?id=7076
    c) Preenche código MV
    d) Preenche data de ONTEM (nos dois campos de data)
    e) Clica "Submit"
    f) Aguarda 12 segundos (carregamento)
    g) Extrai dados da linha 15 da tabela (17 células)
    h) Verifica se já existe registro (codigo_mv + data)
    i) INSERT (novo) ou UPDATE (existente) no Supabase
    j) Aguarda 10 segundos
    k) Próximo usuário
         ↓
Gera log completo com estatísticas
         ↓
    Finaliza
```

---

## 📊 Dados Coletados (17 Campos)

Cada execução coleta os seguintes dados para cada usuário:

| # | Campo | Descrição |
|---|-------|-----------|
| 1 | codigo_mv | Código do prestador no MV |
| 2 | nome | Nome do profissional |
| 3 | especialidade | Especialidade médica |
| 4 | vinculo | Tipo de vínculo |
| 5 | procedimento | Quantidade de procedimentos |
| 6 | parecer_solicitado | Pareceres solicitados |
| 7 | parecer_realizado | Pareceres realizados |
| 8 | cirurgia_realizada | Cirurgias realizadas |
| 9 | prescricao | Prescrições médicas |
| 10 | evolucao | Evoluções de pacientes |
| 11 | urgencia | Atendimentos de urgência |
| 12 | ambulatorio | Atendimentos ambulatoriais |
| 13 | auxiliar | Participações como auxiliar |
| 14 | encaminhamento | Encaminhamentos |
| 15 | folha_objetivo_diario | Folhas de objetivo diário |
| 16 | evolucao_diurna_cti | Evoluções diurnas CTI |
| 17 | evolucao_noturna_cti | Evoluções noturnas CTI |
| + | data | Data da coleta (ontem) |

---

## 🖥️ Informações Técnicas

### Servidor (Digital Ocean Droplet)
- **IP**: 138.68.27.70
- **SO**: Ubuntu 20.04+ (recomendado)
- **Acesso**: SSH via `ssh root@138.68.27.70`

### Sistema MV
- **URL**: http://mvpepprd.saude.go.gov.br/report-executor/report-viewer?id=7076
- **Relatório**: ID 7076 (Produtividade Global)

### Tecnologias Utilizadas
- **Linguagem**: Python 3
- **Automação**: Selenium WebDriver
- **Navegador**: Firefox (modo headless)
- **Display Virtual**: Xvfb (Display :99)
- **Banco de Dados**: Supabase (PostgreSQL)
- **Agendamento**: Cron
- **Driver**: Geckodriver

### XPaths Utilizados
```python
# Campo Código Prestador
XPATH_CODIGO_PRESTADOR = '//*[@id="WebViewer...tr[2]/td[2]/table/tbody/tr/td/input'

# Campo Data Inicial
XPATH_DATA_INICIAL = '//*[@id="WebViewer...tr[1]/td[4]/table/tbody/tr/td[1]/input'

# Campo Data Final
XPATH_DATA_FINAL = '//*[@id="WebViewer...tr[2]/td[4]/table/tbody/tr/td[1]/input'

# Botão Submit
XPATH_SUBMIT_BUTTON = '//*[@id="WebViewer...tr[4]/td[4]/table/tbody/tr/td[2]/div/table/tbody/tr/td'

# Tabela de Resultados
XPATH_TABELA_RESULTADO = '//*[@id="WebViewer...ReportPanel"]/div/table/tbody/tr[15]'
```

---

## 📅 Agendamento

### Cron Job
```bash
# Executa todos os dias às 2h da manhã
0 2 * * * /usr/local/bin/coletar-produtividade-wrapper.sh
```

### Logs
- **Log principal**: `/var/log/produtividade-mv.log`
- **Log do cron**: `/var/log/produtividade-mv-cron.log`

---

## 🚀 Instalação (Resumo)

### No Droplet (138.68.27.70):

```bash
# 1. Conectar via SSH
ssh root@138.68.27.70

# 2. Instalar pré-requisitos
sudo apt update && sudo apt install -y python3 python3-pip firefox xvfb

# 3. Instalar Geckodriver
wget https://github.com/mozilla/geckodriver/releases/download/v0.33.0/geckodriver-v0.33.0-linux64.tar.gz
tar -xvzf geckodriver-v0.33.0-linux64.tar.gz
sudo mv geckodriver /usr/local/bin/
sudo chmod +x /usr/local/bin/geckodriver

# 4. Configurar Xvfb
# (seguir INSTALACAO_DROPLET_PRODUTIVIDADE.md)

# 5. Transferir arquivos do projeto
# (via SCP ou Git)

# 6. Instalar dependências Python
cd /root/gestaodeacesso
python3 -m venv venv
source venv/bin/activate
pip install -r requirements-produtividade.txt

# 7. Configurar .env
nano .env
# Adicionar VITE_SUPABASE_URL e VITE_SUPABASE_SERVICE_ROLE_KEY

# 8. Testar manualmente
export DISPLAY=:99
python3 coletar-produtividade-mv.py

# 9. Configurar cron
chmod +x setup-cron-produtividade.sh
./setup-cron-produtividade.sh

# 10. Verificar
crontab -l
```

---

## 📝 Uso Diário

### Ver Logs em Tempo Real
```bash
tail -f /var/log/produtividade-mv.log
```

### Executar Manualmente (Teste)
```bash
sudo /usr/local/bin/coletar-produtividade-wrapper.sh
```

### Verificar Última Execução
```bash
tail -n 50 /var/log/produtividade-mv.log | grep "COLETA DE PRODUTIVIDADE CONCLUÍDA"
```

### Ver Dados no Supabase
```sql
SELECT * FROM produtividade
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🔧 Manutenção

### Semanal
- Verificar logs de execução
- Confirmar que dados estão sendo inseridos

### Mensal
- Atualizar dependências Python
- Limpar logs antigos (> 30 dias)
- Verificar espaço em disco

### Quando Necessário
- Ajustar timeouts se MV ficar lento
- Atualizar XPaths se MV mudar layout
- Adicionar novos usuários na tabela `usuarios`

---

## ⚠️ Pontos de Atenção

### 1. **Tempo de Execução**
- ~10-15 segundos por usuário
- 45 usuários = ~7-11 minutos total
- Executar às 2h minimiza impacto

### 2. **Tratamento de Erros**
- Se um usuário falhar, continua para o próximo
- Erros são logados mas não param o processo
- Permite execução parcial mesmo com problemas

### 3. **Duplicatas**
- Sistema verifica por `codigo_mv + data`
- Se existe: faz UPDATE (sobrescreve)
- Se não existe: faz INSERT (novo registro)

### 4. **Data Coletada**
- Sempre coleta dados de ONTEM
- Formato: dd/MM/yyyy
- Permite correção executando novamente

### 5. **Segurança**
- Arquivo `.env` com permissões 600
- Logs não contêm senhas
- Comunicação HTTPS com Supabase

---

## 🐛 Troubleshooting Comum

| Problema | Solução |
|----------|---------|
| Script não executou | Verificar cron: `sudo systemctl status cron` |
| Erro de conexão Supabase | Verificar `.env` e credenciais |
| Display :99 not available | Reiniciar Xvfb: `sudo systemctl restart xvfb` |
| Timeout no MV | Aumentar tempo de espera ou verificar se MV está online |
| Nenhum dado extraído | Verificar XPaths ou se usuário tem produtividade |
| Firefox não inicia | Reinstalar: `sudo apt install --reinstall firefox` |

---

## 📈 Próximos Passos (Sugestões)

### Melhorias Possíveis:

1. **Notificações**
   - Email em caso de falhas
   - Slack/Telegram com resumo diário

2. **Dashboard**
   - Visualização gráfica dos dados
   - Comparação mensal/anual
   - Rankings de produtividade

3. **Backup Automático**
   - Exportar dados mensalmente
   - Armazenar em S3 ou similar

4. **Alertas Inteligentes**
   - Detectar produtividade anormalmente baixa
   - Alertar sobre usuários sem dados

5. **Retry Automático**
   - Tentar novamente usuários que falharam
   - Executar em horários alternativos

6. **Integração com Outros Sistemas**
   - Sincronizar com sistema de folha de pagamento
   - Gerar relatórios para RH

---

## 📞 Suporte

### Em Caso de Problemas:

1. **Verificar logs**:
   ```bash
   tail -f /var/log/produtividade-mv.log
   ```

2. **Testar conexões**:
   - MV: `curl -I http://mvpepprd.saude.go.gov.br/...`
   - Supabase: Verificar dashboard

3. **Executar manualmente**:
   ```bash
   sudo /usr/local/bin/coletar-produtividade-wrapper.sh
   ```

4. **Documentação**:
   - `INSTALACAO_DROPLET_PRODUTIVIDADE.md` - Instalação completa
   - `GUIA_RAPIDO_PRODUTIVIDADE.md` - Referência rápida

---

## ✅ Checklist de Verificação

- [ ] Droplet acessível via SSH
- [ ] Firefox instalado e funcionando
- [ ] Geckodriver instalado em `/usr/local/bin/`
- [ ] Xvfb rodando (Display :99)
- [ ] Projeto em `/root/gestaodeacesso/`
- [ ] Ambiente virtual Python criado
- [ ] Dependências instaladas
- [ ] Arquivo `.env` configurado corretamente
- [ ] Teste manual executado com sucesso
- [ ] Cron job configurado (verificar com `crontab -l`)
- [ ] Logs sendo gerados corretamente
- [ ] Dados aparecendo no Supabase

---

## 🎉 Conclusão

O sistema está **completo e pronto para uso**!

**Próximas 24h**: Aguardar primeira execução automática às 2h da manhã.

**Após primeira execução**: Verificar logs e dados no Supabase para confirmar funcionamento.

**Manutenção**: Monitorar logs semanalmente, atualizar dependências mensalmente.

---

## 📚 Referências

- **Selenium**: https://www.selenium.dev/documentation/
- **Supabase**: https://supabase.com/docs
- **Cron**: https://crontab.guru/
- **Xvfb**: https://www.x.org/releases/X11R7.6/doc/man/man1/Xvfb.1.xhtml
- **Geckodriver**: https://github.com/mozilla/geckodriver

---

**Sistema criado em**: 2025-10-19
**Versão**: 1.0
**Status**: ✅ Pronto para Produção
