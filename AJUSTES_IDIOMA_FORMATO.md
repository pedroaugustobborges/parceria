# Ajustes para Firefox em Inglês e Formato de Data Americano

## Data: 2025-10-21

## Alterações Aplicadas

### 1. Botão Submit em Inglês

**Problema:** O Firefox no droplet está configurado em inglês, portanto o botão que estava procurando por "Enviar" não era encontrado.

**Antes:**
```python
XPATH_SUBMIT_BUTTON = f"{BASE_CONTAINER}//tr[4]/td[4]//td[contains(., 'Enviar')]"
```

**Depois:**
```python
XPATH_SUBMIT_BUTTON = f"{BASE_CONTAINER}//tr[4]/td[4]//td[contains(., 'Submit')]"
```

**Localização no código:** Linha 54

---

### 2. Formato de Data Americano (mm.dd.yyyy)

**Problema:** O sistema MV no droplet (Firefox em inglês) espera datas no formato americano `mm.dd.yyyy` e não no formato brasileiro `dd.mm.yyyy`.

#### a) Função de Formatação de Data

**Antes:**
```python
def formatar_data_ontem(self) -> str:
    """Retorna a data de ontem no formato dd.mm.yyyy (com pontos)."""
    ontem = datetime.now() - timedelta(days=1)
    return ontem.strftime('%d.%m.%Y')  # Formato com pontos, não barras
```

**Depois:**
```python
def formatar_data_ontem(self) -> str:
    """Retorna a data de ontem no formato mm.dd.yyyy (com pontos) - formato americano."""
    ontem = datetime.now() - timedelta(days=1)
    return ontem.strftime('%m.%d.%Y')  # Formato americano: mm.dd.yyyy
```

**Localização no código:** Linha 176-179

**Exemplo:**
- Dia 20 de Outubro de 2025
- **Antes (brasileiro):** 20.10.2025
- **Agora (americano):** 10.20.2025

---

#### b) Logs de Preenchimento

**Antes:**
```python
logger.info(f"Preenchendo data inicial: {data} (formato dd.mm.yyyy)")
```

**Depois:**
```python
logger.info(f"Preenchendo data inicial: {data} (formato mm.dd.yyyy)")
```

**Localização no código:** Linhas 196 e 208

---

#### c) Conversão para ISO (Inserção no Banco)

**Antes:**
```python
# Converter data de dd.mm.yyyy para yyyy-MM-dd
data_obj = datetime.strptime(data, '%d.%m.%Y')
data_iso = data_obj.strftime('%Y-%m-%d')
```

**Depois:**
```python
# Converter data de mm.dd.yyyy para yyyy-MM-dd
data_obj = datetime.strptime(data, '%m.%d.%Y')
data_iso = data_obj.strftime('%Y-%m-%d')
```

**Localização no código:** Linhas 392-394

**Exemplo de conversão:**
- Input (no formulário): 10.20.2025
- Parsing: `datetime.strptime('10.20.2025', '%m.%d.%Y')`
- Output (no banco): 2025-10-20

---

## Impacto das Mudanças

### ✅ Vantagens:
1. **Botão Submit será encontrado** - Não haverá mais erro de "elemento não encontrado" para o botão
2. **Data será aceita pelo sistema MV** - Formato americano é o esperado pelo Firefox em inglês
3. **Conversão para banco continua correta** - A data no Supabase sempre será armazenada no formato ISO (yyyy-MM-dd)

### ⚠️ Atenção:
- Estas mudanças são **específicas para o droplet** (Firefox em inglês)
- Se você rodar o script localmente com Firefox em português, precisaria ajustar:
  - `'Submit'` → `'Enviar'`
  - `'%m.%d.%Y'` → `'%d.%m.%Y'`

---

## Comparação: Local vs Droplet

| Aspecto | scraplocal.py (Windows PT-BR) | coletar-produtividade-mv.py (Droplet EN) |
|---------|-------------------------------|------------------------------------------|
| Botão Submit | `'Enviar'` | `'Submit'` ✅ |
| Formato Data Input | `dd.mm.yyyy` (20.10.2025) | `mm.dd.yyyy` (10.20.2025) ✅ |
| Formato Data Banco | `yyyy-MM-dd` (2025-10-20) | `yyyy-MM-dd` (2025-10-20) ✅ |
| Idioma Firefox | Português | Inglês |

---

## Teste Rápido

Para verificar que as mudanças estão corretas:

```bash
# 1. Verificar XPath do botão Submit
grep "XPATH_SUBMIT_BUTTON" coletar-produtividade-mv.py
# Esperado: ... contains(., 'Submit')

# 2. Verificar formato de data na função formatar_data_ontem
grep "strftime('%m.%d.%Y')" coletar-produtividade-mv.py
# Esperado: return ontem.strftime('%m.%d.%Y')

# 3. Verificar parsing de data na inserção
grep "strptime(data, '%m.%d.%Y')" coletar-produtividade-mv.py
# Esperado: data_obj = datetime.strptime(data, '%m.%d.%Y')

# 4. Verificar sintaxe Python
python -m py_compile coletar-produtividade-mv.py
echo $?
# Esperado: 0 (sem erros)
```

---

## Exemplo de Execução Esperada

Quando o script rodar no droplet, os logs devem mostrar:

```
2025-10-21 10:30:15 - INFO - Data a ser consultada: 10.20.2025
2025-10-21 10:30:16 - INFO - Preenchendo data inicial: 10.20.2025 (formato mm.dd.yyyy)
2025-10-21 10:30:17 - INFO - Limpando campo data inicial (Ctrl+A + Backspace)...
2025-10-21 10:30:19 - INFO - Preenchendo data final: 10.20.2025 (formato mm.dd.yyyy)
2025-10-21 10:30:20 - INFO - Limpando campo data final (Ctrl+A + Backspace)...
2025-10-21 10:30:22 - INFO - Clicando no botão Submit
```

**Observe que:**
- A data está no formato americano: **10.20.2025** (outubro, dia 20)
- O botão é identificado como **Submit** (não "Enviar")

---

## Próximos Passos

1. **Transferir o arquivo atualizado para o droplet:**
   ```bash
   scp coletar-produtividade-mv.py root@138.68.27.70:/root/gestaodeacesso/
   ```

2. **Fazer backup do arquivo antigo no droplet:**
   ```bash
   ssh root@138.68.27.70
   cd /root/gestaodeacesso
   cp coletar-produtividade-mv.py coletar-produtividade-mv.py.backup-antes-formato-americano
   ```

3. **Testar com um único usuário primeiro** (opcional, para validar):
   - Você pode modificar temporariamente o código para processar apenas 1 usuário
   - Ou adicionar um `break` logo após o primeiro usuário

4. **Executar o script completo:**
   ```bash
   cd /root/gestaodeacesso
   source venv/bin/activate
   export DISPLAY=:99
   python3 coletar-produtividade-mv.py
   ```

5. **Monitorar logs:**
   ```bash
   tail -f /var/log/produtividade-mv.log
   ```

6. **Verificar se a data foi inserida corretamente no banco:**
   - Acesse o Supabase Table Editor
   - Verifique a tabela `produtividade`
   - A coluna `data` deve mostrar: `2025-10-20` (formato ISO)

---

## Troubleshooting

### Problema: "Submit button not found"
**Solução:** Verifique se o texto do botão está realmente em inglês:
```bash
# Capturar screenshot para debug
# No código, já está configurado para salvar em /tmp/screenshot_erro_{codigo}.png
```

### Problema: "Invalid date format"
**Solução:** Certifique-se que o sistema MV está aceitando `mm.dd.yyyy`:
- Se o erro persistir, pode ser necessário tentar outros formatos:
  - `mm/dd/yyyy` (com barras)
  - `MM/DD/YYYY` (maiúsculas)
  - `M/D/YYYY` (sem zeros à esquerda)

### Problema: Data errada no banco de dados
**Exemplo:** Esperava 20/10/2025 mas salvou 10/20/2025

**Causa:** Isso indicaria que a conversão está invertida.

**Solução:** Verifique a data que foi enviada vs a data salva:
- Log mostrará: `10.20.2025` (formato americano para o formulário)
- Banco deve salvar: `2025-10-20` (20 de outubro)
- Se salvar `2025-10-20` está **CORRETO** ✅

---

## Resumo das Linhas Alteradas

| Linha | O que foi mudado |
|-------|------------------|
| 54 | XPath botão Submit: `'Enviar'` → `'Submit'` |
| 179 | Formato data: `'%d.%m.%Y'` → `'%m.%d.%Y'` |
| 196 | Log: `dd.mm.yyyy` → `mm.dd.yyyy` |
| 208 | Log: `dd.mm.yyyy` → `mm.dd.yyyy` |
| 393 | Parse data: `'%d.%m.%Y'` → `'%m.%d.%Y'` |

**Total: 5 linhas alteradas**

---

✅ **Arquivo validado e pronto para uso no droplet!**
