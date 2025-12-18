# 🚀 Quick Reference: Cron Job do Droplet

## 📝 Comandos Essenciais

### Conectar ao Droplet
```bash
ssh root@SEU_IP_DO_DROPLET
```

### Ver Logs
```bash
# Ver últimas linhas
tail -n 50 /var/log/recalcular-status.log

# Ver em tempo real
tail -f /var/log/recalcular-status.log

# Ver tudo
cat /var/log/recalcular-status.log
```

### Executar Script Manualmente
```bash
cd /opt/gestaodeacesso
python3 recalcular-status-diario.py
```

### Gerenciar Cron

```bash
# Ver jobs agendados
crontab -l

# Editar jobs
crontab -e

# Status do serviço cron
systemctl status cron

# Reiniciar cron
systemctl restart cron
```

---

## 🔧 Configuração do Cron Job

**Linha no crontab:**
```bash
0 14 * * * cd /opt/gestaodeacesso && /usr/bin/python3 recalcular-status-diario.py >> /var/log/recalcular-status.log 2>&1
```

**Significado:**
- `0 14 * * *` = Todos os dias às 14:00
- Executa o script Python
- Salva logs em `/var/log/recalcular-status.log`

---

## 📁 Arquivos Importantes

| Arquivo | Localização | Propósito |
|---------|-------------|-----------|
| Script Python | `/opt/gestaodeacesso/recalcular-status-diario.py` | Script principal |
| Credenciais | `/opt/gestaodeacesso/.env` | URL e chave do Supabase |
| Logs | `/var/log/recalcular-status.log` | Histórico de execuções |

---

## ⚙️ Horários Alternativos do Cron

```bash
0 9 * * *         # Diário às 09:00
0 14 * * *        # Diário às 14:00 (atual)
30 14 * * *       # Diário às 14:30
0 14 * * 1        # Segunda-feira às 14:00
0 */6 * * *       # A cada 6 horas
```

---

## 🔍 Troubleshooting Rápido

### Script não executou?
```bash
# 1. Verificar se cron está rodando
systemctl status cron

# 2. Ver logs do sistema
grep CRON /var/log/syslog | tail -20

# 3. Testar manualmente
cd /opt/gestaodeacesso && python3 recalcular-status-diario.py
```

### Erro de permissão?
```bash
chmod +x /opt/gestaodeacesso/recalcular-status-diario.py
chmod 600 /opt/gestaodeacesso/.env
```

### Dependências faltando?
```bash
pip3 install --upgrade supabase python-dotenv
```

---

## 📊 O Que o Script Faz

1. ✅ Conecta ao Supabase
2. ✅ Busca escalas de **ontem** com status "Programado"
3. ✅ Calcula horas trabalhadas de cada médico
4. ✅ Atualiza status:
   - "Atenção" → 0 horas (não compareceu)
   - "Aprovação Parcial" → Trabalho parcial
   - "Pré-Aprovado" → Trabalho completo
5. ✅ Registra tudo nos logs

---

## 🛡️ Segurança

**Proteger credenciais:**
```bash
chmod 600 /opt/gestaodeacesso/.env
ls -la /opt/gestaodeacesso/.env  # Verificar: -rw-------
```

---

## 📞 Suporte Rápido

**Tudo funcionando?**
```bash
# Ver última execução
tail -n 30 /var/log/recalcular-status.log
```

**Deve mostrar:**
```
================================================================================
🤖 INICIANDO RECÁLCULO AUTOMÁTICO DE STATUS
📅 Data alvo: DD/MM/YYYY (ontem)
...
✅ Script executado com sucesso!
================================================================================
```

---

**Última atualização:** 15/12/2025
