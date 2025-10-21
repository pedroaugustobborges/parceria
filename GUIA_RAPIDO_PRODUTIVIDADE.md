# Guia Rápido - Coleta de Produtividade MV

## Visão Geral

Sistema automatizado que coleta dados de produtividade do sistema MV (hospital) e insere na tabela `produtividade` do Supabase.

**Execução**: Diariamente às 2h da manhã
**Servidor**: Digital Ocean Droplet (138.68.27.70)
**Navegador**: Firefox (modo headless)

## Como Funciona

```
2h da manhã
    ↓
Cron Job dispara
    ↓
Script Python inicia
    ↓
Busca usuários "terceiro" no Supabase
    ↓
Para cada usuário:
    │
    ├─ Abre Firefox (headless)
    ├─ Acessa relatório MV
    ├─ Preenche: Código MV + Data de ontem
    ├─ Clica "Submit"
    ├─ Aguarda 12s (carregamento)
    ├─ Extrai dados da tabela
    ├─ Insere/Atualiza no Supabase
    └─ Aguarda 10s antes do próximo
    ↓
Gera log completo
    ↓
Finaliza
```

## Estrutura dos Dados Coletados

| Campo | Descrição | Fonte |
|-------|-----------|-------|
| `codigo_mv` | Código do prestador no MV | Campo 1 da tabela |
| `nome` | Nome do profissional | Campo 2 da tabela |
| `especialidade` | Especialidade médica | Campo 3 da tabela |
| `vinculo` | Tipo de vínculo | Campo 4 da tabela |
| `procedimento` | Quantidade de procedimentos | Campo 5 da tabela |
| `parecer_solicitado` | Pareceres solicitados | Campo 6 da tabela |
| `parecer_realizado` | Pareceres realizados | Campo 7 da tabela |
| `cirurgia_realizada` | Cirurgias realizadas | Campo 8 da tabela |
| `prescricao` | Prescrições | Campo 9 da tabela |
| `evolucao` | Evoluções | Campo 10 da tabela |
| `urgencia` | Atendimentos de urgência | Campo 11 da tabela |
| `ambulatorio` | Atendimentos ambulatoriais | Campo 12 da tabela |
| `auxiliar` | Participações como auxiliar | Campo 13 da tabela |
| `encaminhamento` | Encaminhamentos | Campo 14 da tabela |
| `folha_objetivo_diario` | Folhas de objetivo diário | Campo 15 da tabela |
| `evolucao_diurna_cti` | Evoluções diurnas CTI | Campo 16 da tabela |
| `evolucao_noturna_cti` | Evoluções noturnas CTI | Campo 17 da tabela |
| `data` | Data da coleta (ontem) | Calculado pelo script |

## Comandos Essenciais

### No Droplet (SSH: `ssh root@138.68.27.70`)

```bash
# Ver logs em tempo real
tail -f /var/log/produtividade-mv.log

# Ver últimas 100 linhas do log
tail -n 100 /var/log/produtividade-mv.log

# Executar manualmente
sudo /usr/local/bin/coletar-produtividade-wrapper.sh

# Ver crontab
crontab -l

# Editar crontab
crontab -e

# Ver status do Xvfb
sudo systemctl status xvfb

# Reiniciar Xvfb se necessário
sudo systemctl restart xvfb
```

### Verificar Dados no Supabase

```sql
-- Ver registros mais recentes
SELECT * FROM produtividade
ORDER BY created_at DESC
LIMIT 10;

-- Ver produtividade de ontem
SELECT * FROM produtividade
WHERE data = CURRENT_DATE - INTERVAL '1 day'
ORDER BY nome;

-- Contar registros por data
SELECT data, COUNT(*) as total
FROM produtividade
GROUP BY data
ORDER BY data DESC;

-- Ver totais por profissional
SELECT
    nome,
    SUM(procedimento) as total_procedimentos,
    SUM(prescricao) as total_prescricoes,
    COUNT(*) as dias_trabalhados
FROM produtividade
GROUP BY nome
ORDER BY total_procedimentos DESC;
```

## Troubleshooting Rápido

### Script não executou às 2h

```bash
# 1. Verificar se cron está rodando
sudo systemctl status cron

# 2. Ver logs do sistema
sudo grep CRON /var/log/syslog | tail -n 20

# 3. Testar wrapper manualmente
sudo /usr/local/bin/coletar-produtividade-wrapper.sh
```

### Erro de conexão com Supabase

```bash
# Verificar .env
cat /root/gestaodeacesso/.env

# Testar conexão
cd /root/gestaodeacesso
source venv/bin/activate
python3 -c "from supabase import create_client; import os; from dotenv import load_dotenv; load_dotenv(); print('OK' if create_client(os.getenv('VITE_SUPABASE_URL'), os.getenv('VITE_SUPABASE_SERVICE_ROLE_KEY')) else 'ERRO')"
```

### Erro "Display :99 not available"

```bash
# Verificar Xvfb
sudo systemctl status xvfb

# Reiniciar
sudo systemctl restart xvfb

# Verificar se está escutando
ps aux | grep Xvfb
```

### Timeout ao acessar MV

```bash
# Testar acesso à URL
curl -I http://mvpepprd.saude.go.gov.br/report-executor/report-viewer?id=7076

# Se retornar 200 OK, o site está acessível
# Se não, pode estar fora do ar
```

### Nenhum dado extraído

Possíveis causas:
1. **Estrutura da página mudou**: Verificar XPaths
2. **Usuário sem produtividade**: Normal, continua para o próximo
3. **Timeout insuficiente**: Aumentar tempo de espera

## Logs - O que Procurar

### Execução Normal

```
2025-10-20 02:00:01 - INFO - INÍCIO DA COLETA DE PRODUTIVIDADE
2025-10-20 02:00:02 - INFO - Conectado ao Supabase com sucesso
2025-10-20 02:00:03 - INFO - Firefox driver configurado com sucesso
2025-10-20 02:00:04 - INFO - Encontrados 45 usuários terceiros com codigomv
2025-10-20 02:00:05 - INFO - Data a ser consultada: 19/10/2025
2025-10-20 02:00:06 - INFO - Processando [1/45]: JOÃO DA SILVA (Código MV: 12345)
2025-10-20 02:00:08 - INFO - Preenchendo código MV: 12345
2025-10-20 02:00:20 - INFO - Dados extraídos: JOÃO DA SILVA - Total procedimentos: 15
2025-10-20 02:00:21 - INFO - ✓ Produtividade salva com sucesso para JOÃO DA SILVA
...
2025-10-20 02:45:30 - INFO - COLETA DE PRODUTIVIDADE CONCLUÍDA
2025-10-20 02:45:30 - INFO - Processados com sucesso: 45
2025-10-20 02:45:30 - INFO - Erros: 0
```

### Erros Comuns

```
# Timeout
TimeoutException: Message: Timeout waiting for element

# Sem dados
WARNING - Nenhum dado encontrado para MARIA SANTOS

# Erro de conexão
ERROR - Erro ao conectar no Supabase: Connection refused

# Elemento não encontrado
NoSuchElementException: Unable to locate element
```

## Manutenção

### Semanal

```bash
# Ver resumo da semana
grep "COLETA DE PRODUTIVIDADE CONCLUÍDA" /var/log/produtividade-mv.log | tail -n 7
```

### Mensal

```bash
# Limpar logs muito antigos (manter 30 dias)
find /var/log/produtividade-mv*.log -mtime +30 -delete

# Atualizar dependências
cd /root/gestaodeacesso
source venv/bin/activate
pip install --upgrade selenium supabase
```

## Fluxo de Dados Detalhado

```
┌─────────────────────────────────────────────────────────────┐
│                    INÍCIO (2h da manhã)                      │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Conectar Supabase                                        │
│     → Buscar usuários WHERE tipo='terceiro' AND codigomv!=NULL│
│     → Resultado: Lista de 45 usuários (exemplo)             │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Iniciar Firefox (headless via Xvfb)                     │
│     → Display :99                                            │
│     → Modo headless (sem interface gráfica)                 │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  3. LOOP: Para cada usuário (1 a 45)                        │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ├─► 3.1. Abrir URL do relatório
                  │        http://mvpepprd.saude.go.gov.br/...
                  │        Aguardar 3s
                  │
                  ├─► 3.2. Preencher campo "Código Prestador"
                  │        Valor: codigomv do usuário
                  │        Aguardar 2s
                  │
                  ├─► 3.3. Preencher campo "Data Inicial"
                  │        Valor: ontem (dd/MM/yyyy)
                  │        Aguardar 2s
                  │
                  ├─► 3.4. Preencher campo "Data Final"
                  │        Valor: ontem (dd/MM/yyyy)
                  │        Aguardar 2s
                  │
                  ├─► 3.5. Clicar botão "Submit"
                  │        Aguardar 12s (carregamento)
                  │
                  ├─► 3.6. Localizar tabela de resultados
                  │        XPath: tr[15]
                  │        Extrair 17 células (td)
                  │
                  ├─► 3.7. Mapear dados
                  │        td[0]  → codigo_mv
                  │        td[1]  → nome
                  │        td[2]  → especialidade
                  │        ...
                  │        td[16] → evolucao_noturna_cti
                  │
                  ├─► 3.8. Verificar se já existe no Supabase
                  │        Buscar por: codigo_mv + data
                  │        Se existe: UPDATE
                  │        Se não: INSERT
                  │
                  ├─► 3.9. Salvar no Supabase
                  │        Tabela: produtividade
                  │
                  └─► 3.10. Aguardar 10s antes do próximo

                  ↓ (volta ao início do loop)

┌─────────────────────────────────────────────────────────────┐
│  4. Finalizar                                                │
│     → Fechar Firefox                                         │
│     → Gerar resumo nos logs                                  │
│     → Encerrar script                                        │
└─────────────────────────────────────────────────────────────┘
```

## Segurança

### O que NUNCA fazer:

❌ Compartilhar arquivo `.env`
❌ Versionar `.env` no Git
❌ Logar senhas ou keys nos logs
❌ Expor porta 80/443 desnecessariamente
❌ Executar como root sem necessidade

### O que SEMPRE fazer:

✅ Manter `.env` com permissões 600
✅ Usar HTTPS para Supabase
✅ Monitorar logs regularmente
✅ Fazer backup do `.env` em local seguro
✅ Atualizar dependências mensalmente

## Contatos Importantes

- **Servidor MV**: http://mvpepprd.saude.go.gov.br
- **Supabase**: https://supabase.com
- **Droplet IP**: 138.68.27.70

## FAQ

**P: O script roda em qual horário?**
R: Todos os dias às 2h da manhã (horário do servidor).

**P: Qual data é coletada?**
R: Sempre o dia anterior (ontem).

**P: E se o MV estiver fora do ar?**
R: O script tenta por 20s e depois pula para o próximo usuário.

**P: Os dados são atualizados ou duplicados?**
R: Se já existe registro para aquele código MV + data, é feito UPDATE. Caso contrário, INSERT.

**P: Quanto tempo leva para processar todos os usuários?**
R: Aproximadamente 10-15 segundos por usuário. Para 45 usuários: ~7-11 minutos.

**P: Como adicionar um novo usuário?**
R: Basta cadastrar na tabela `usuarios` com `tipo='terceiro'` e preencher o `codigomv`. O script vai pegar automaticamente na próxima execução.

**P: Como testar sem esperar até às 2h?**
R: Execute manualmente: `sudo /usr/local/bin/coletar-produtividade-wrapper.sh`

**P: Os logs crescem infinitamente?**
R: Recomendado configurar rotação de logs (logrotate) para manter apenas 30 dias.
