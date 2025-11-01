# 📅 Guia de Coleta Retroativa de Produtividade

## 🎯 Objetivo

Este script coleta dados de produtividade do MV de **01/09/2025 até ontem**, preenchendo os dados que faltam desde que o script diário parou de funcionar.

## ⚙️ Configurações

- **Data início**: 01/09/2025
- **Data fim**: Ontem (calculado automaticamente)
- **Intervalo entre dias**: 15 segundos
- **Execução**: ÚNICA (não é para rodar no cron)

## 📊 Estimativa de Tempo

- **Dias a processar**: ~61 dias (01/09 a 31/10)
- **Médicos**: ~15-20
- **Tempo por dia**: ~15 segundos
- **Tempo total estimado**: ~15-20 minutos

## 🚀 Como Executar

### 1. Fazer Upload do Script

```bash
# No seu computador, enviar o arquivo
scp coletar-produtividade-retroativo.py root@138.68.27.70:~/gestaodeacesso/
```

### 2. No Droplet

```bash
# Conectar via SSH
ssh root@138.68.27.70

# Ir para o diretório
cd ~/gestaodeacesso

# Ativar virtualenv
source venv/bin/activate

# Definir display
export DISPLAY=:99

# Executar o script
python3 coletar-produtividade-retroativo.py
```

### 3. Confirmar Execução

O script vai perguntar:

```
COLETA RETROATIVA DE PRODUTIVIDADE MV
======================================================================
Período: 01/09/2025 até 31/10/2025
Intervalo: 15 segundos entre cada dia
Total de dias: 61
======================================================================

⚠️  ATENÇÃO: Este processo pode levar várias horas!
⚠️  Certifique-se de que o droplet não será desligado.

Deseja continuar? (sim/não):
```

Digite: **sim**

## 📝 O Que o Script Faz

1. ✅ Conecta ao Supabase
2. ✅ Busca todos os médicos terceiros com código MV
3. ✅ Para cada dia do período:
   - Acessa o relatório MV para cada médico
   - Extrai os dados de produtividade
   - Insere no Supabase
   - Aguarda 15 segundos antes do próximo dia
4. ✅ Mostra progresso em tempo real
5. ✅ Gera log completo

## 📊 Acompanhar Progresso

O script mostra em tempo real:

```
======================================================================
DIA 1/61: 01/09/2025
======================================================================
[1/15] Processando Dr. João Silva (12345)...
  ✓ 5 registros inseridos
[2/15] Processando Dra. Maria Santos (67890)...
  ✓ 3 registros inseridos
...

Resumo do dia: 45 registros inseridos
Total acumulado: 45 registros

Aguardando 15 segundos antes do próximo dia...
```

## 📋 Logs

O script salva logs em:
```
/var/log/produtividade-mv-retroativo.log
```

Para acompanhar em outra janela:
```bash
tail -f /var/log/produtividade-mv-retroativo.log
```

## ✅ Verificar Resultado

Após a execução, verificar no Supabase:

```sql
-- Ver dados coletados por dia
SELECT
  data,
  COUNT(*) as total_registros,
  COUNT(DISTINCT codigo_mv) as total_medicos
FROM produtividade
WHERE data >= '2025-09-01'
GROUP BY data
ORDER BY data;

-- Ver total geral
SELECT
  COUNT(*) as total_registros,
  MIN(data) as primeira_data,
  MAX(data) as ultima_data
FROM produtividade
WHERE data >= '2025-09-01';
```

## ⚠️ Importante

### ✅ Antes de Executar

- [ ] Certifique-se que o script diário está funcionando
- [ ] Verifique que o Xvfb está rodando: `systemctl status xvfb`
- [ ] Confirme que tem espaço em disco: `df -h`
- [ ] O droplet não será desligado durante a execução

### ❌ Não Execute

- ❌ Enquanto o script diário estiver rodando (às 2h da manhã)
- ❌ Se já coletou os dados retroativos
- ❌ Múltiplas vezes (vai duplicar dados)

## 🛑 Interromper Execução

Se precisar parar o script:

```bash
# Pressionar Ctrl+C
# OU
pkill -f coletar-produtividade-retroativo.py

# Limpar processos do Firefox
pkill -9 firefox
```

## 🔄 Executar Novamente (Se Falhar)

Se o script falhar no meio:

1. Verificar até qual data foi coletada:
```sql
SELECT MAX(data) FROM produtividade WHERE data >= '2025-09-01';
```

2. Editar o script e ajustar `DATA_INICIO`:
```python
# Mudar de:
DATA_INICIO = datetime(2025, 9, 1)

# Para (exemplo: se parou em 15/09):
DATA_INICIO = datetime(2025, 9, 16)  # Dia seguinte ao último coletado
```

3. Executar novamente

## 📈 Estimativa de Registros

Considerando:
- 61 dias
- 15 médicos
- Média de 3 registros por médico/dia

**Total esperado**: ~2.745 registros

## 🎉 Conclusão

Após a execução bem-sucedida:

1. ✅ Dados de 01/09 a ontem estarão no Supabase
2. ✅ O script diário continua coletando novos dados (às 2h)
3. ✅ Dashboard mostrará dados completos do período

## 🆘 Problemas Comuns

### Timeout ao acessar MV
**Solução**: Aumentar intervalo entre dias (editar `INTERVALO_ENTRE_DIAS = 30`)

### Memória insuficiente
**Solução**:
```bash
# Limpar memória
sync; echo 3 > /proc/sys/vm/drop_caches
```

### Firefox travando
**Solução**:
```bash
pkill -9 firefox
sudo systemctl restart xvfb
```

## 💡 Dicas

1. **Execute em horário de baixo uso** (noite/madrugada)
2. **Use `screen` ou `tmux`** para não perder a sessão
3. **Monitore o progresso** com `tail -f` nos logs
4. **Backup antes** (opcional, mas recomendado)

## 📞 Suporte

Se tiver problemas, compartilhe:
1. Últimas 50 linhas do log: `tail -n 50 /var/log/produtividade-mv-retroativo.log`
2. Até qual data conseguiu coletar
3. Mensagem de erro específica

---

**Data**: 01/11/2025
**Versão**: 1.0
**Autor**: Claude Code
