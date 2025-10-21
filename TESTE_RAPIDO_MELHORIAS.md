# Teste Rápido das Melhorias

## Como Testar as Mudanças

### 1. Verificar que o arquivo foi atualizado corretamente

```bash
# No Windows (local):
grep -n "BASE_CONTAINER" coletar-produtividade-mv.py
# Deve mostrar: BASE_CONTAINER = "//div[contains(@id, '_ParametersPanelContainer')]"

grep -n "strftime('%d.%m.%Y')" coletar-produtividade-mv.py
# Deve mostrar a linha com formato de data usando pontos

grep -n "def extrair_dados_tabela(self, codigo_mv: str)" coletar-produtividade-mv.py
# Deve mostrar que a função agora recebe codigo_mv como parâmetro
```

### 2. Principais Diferenças para Verificar

Execute estes comandos para confirmar as mudanças:

#### a) Import de Keys (linha ~23)
```bash
grep "from selenium.webdriver.common.keys import Keys" coletar-produtividade-mv.py
```
**Esperado:** Deve retornar a linha do import

#### b) XPaths Flexíveis (linhas ~49-54)
```bash
grep "BASE_CONTAINER" coletar-produtividade-mv.py
```
**Esperado:** Deve mostrar as definições de XPaths usando BASE_CONTAINER

#### c) Formato de Data com Pontos (linha ~178)
```bash
grep "strftime('%d.%m.%Y')" coletar-produtividade-mv.py
```
**Esperado:** Deve retornar a linha formatando data com pontos

#### d) Limpeza de Campos com Ctrl+A (linhas ~199-202)
```bash
grep -A2 "Limpando campo data inicial" coletar-produtividade-mv.py
```
**Esperado:** Deve mostrar o uso de Keys.CONTROL + "a"

#### e) Função extrair_dados_tabela recebe codigo_mv (linha ~242)
```bash
grep "def extrair_dados_tabela(self, codigo_mv:" coletar-produtividade-mv.py
```
**Esperado:** Deve retornar a definição da função com parâmetro

#### f) Busca em Todas as Tabelas (linha ~258)
```bash
grep "all_tables = self.driver.find_elements(By.TAG_NAME" coletar-produtividade-mv.py
```
**Esperado:** Deve retornar a linha que busca todas as tabelas

#### g) Procura pelo Código MV (linha ~282)
```bash
grep "if first_cell == str(codigo_mv):" coletar-produtividade-mv.py
```
**Esperado:** Deve retornar a linha que compara o código

#### h) Timeout de 60s (linha ~119)
```bash
grep "set_page_load_timeout(60)" coletar-produtividade-mv.py
```
**Esperado:** Deve retornar a linha com timeout de 60 segundos

---

## 3. Comparação Visual Entre os Dois Arquivos

### Pontos-Chave que Devem Estar Idênticos:

| Funcionalidade | scraplocal.py | coletar-produtividade-mv.py |
|----------------|---------------|------------------------------|
| XPaths Base | `BASE_CONTAINER = "//div[contains(@id, '_ParametersPanelContainer')]"` | ✅ Idêntico |
| Formato Data | `'%d.%m.%Y'` | ✅ Idêntico |
| Limpeza Campos | `Keys.CONTROL + "a"` + `Keys.BACKSPACE` | ✅ Idêntico |
| Busca Tabelas | `find_elements(By.TAG_NAME, "table")` | ✅ Idêntico |
| Busca por Código | `if first_cell == str(codigo_mv):` | ✅ Idêntico |
| Iframe Fallback | `switch_to.frame(iframe)` | ✅ Idêntico |
| Screenshots | `/tmp/screenshot_erro_{codigo_mv}.png` | ✅ Idêntico (ajustado path para Linux) |
| Timeout | `60` segundos | ✅ Idêntico |

---

## 4. Teste Rápido de Sintaxe

Antes de transferir para o droplet, verifique se não há erros de sintaxe:

```bash
# No Windows com Python instalado:
python -m py_compile coletar-produtividade-mv.py

# Se retornar sem erros, a sintaxe está OK
```

---

## 5. Diferenças Intencionais (Específicas para Droplet)

Estes pontos são propositalmente diferentes entre os arquivos:

| Item | scraplocal.py (Windows) | coletar-produtividade-mv.py (Droplet) |
|------|-------------------------|---------------------------------------|
| Geckodriver path | `C:\Users\...\geckodriver.exe` | `/usr/local/bin/geckodriver` |
| Firefox binary | `C:\Program Files\Mozilla Firefox\firefox.exe` | `/usr/bin/firefox` |
| Log file | `produtividade-mv-local.log` | `/var/log/produtividade-mv.log` |
| Screenshot path | `screenshot_erro_{codigo}.png` (local) | `/tmp/screenshot_erro_{codigo}.png` |
| Modo headless | Não especificado (Firefox normal) | `--headless`, `--no-sandbox`, etc. |
| DISPLAY | Não definido | `:99` (comentado, depende de Xvfb) |

---

## 6. Checklist Final Antes de Testar no Droplet

Antes de executar no droplet, confirme:

- [ ] Xvfb está rodando: `sudo systemctl status xvfb`
- [ ] Firefox instalado: `firefox --version`
- [ ] Geckodriver instalado: `geckodriver --version`
- [ ] Arquivo transferido: `scp coletar-produtividade-mv.py root@138.68.27.70:/root/gestaodeacesso/`
- [ ] Permissões OK: `chmod +x coletar-produtividade-mv.py`
- [ ] Variáveis de ambiente no .env estão configuradas
- [ ] venv ativado: `source venv/bin/activate`

---

## 7. Teste no Droplet - Passo a Passo

```bash
# 1. Conectar ao droplet
ssh root@138.68.27.70

# 2. Ir para o diretório
cd /root/gestaodeacesso

# 3. Fazer backup do arquivo antigo (se houver)
cp coletar-produtividade-mv.py coletar-produtividade-mv.py.backup-antigo-$(date +%Y%m%d)

# 4. Verificar que o arquivo novo foi transferido
ls -lh coletar-produtividade-mv.py
head -n 55 coletar-produtividade-mv.py | tail -n 5
# Deve mostrar as linhas com BASE_CONTAINER

# 5. Ativar venv
source venv/bin/activate

# 6. Testar importação
python3 -c "from selenium.webdriver.common.keys import Keys; print('Keys import OK')"

# 7. Verificar sintaxe Python
python3 -m py_compile coletar-produtividade-mv.py
echo $?  # Deve retornar 0

# 8. Executar teste
export DISPLAY=:99
python3 coletar-produtividade-mv.py

# 9. Monitorar logs em outra janela (abrir outra conexão SSH)
tail -f /var/log/produtividade-mv.log

# 10. Se houver erro, verificar screenshots
ls -lh /tmp/screenshot_*.png
```

---

## 8. O Que Observar nos Logs

Durante a execução, você deve ver logs como:

```
2025-10-21 10:30:15 - INFO - Procurando TODAS as tabelas na página...
2025-10-21 10:30:16 - INFO - Total de tabelas encontradas na página: 5
2025-10-21 10:30:16 - INFO - Tabela 1: 2 linhas encontradas
2025-10-21 10:30:16 - INFO -   -> Tabela 1, Linha 1: '' (4 células)
2025-10-21 10:30:16 - INFO - Tabela 2: 15 linhas encontradas
2025-10-21 10:30:17 - INFO -   -> Tabela 2, Linha 1: '12345' (17 células)
2025-10-21 10:30:17 - INFO - [OK] CÓDIGO 12345 ENCONTRADO na Tabela 2, Linha 1!
2025-10-21 10:30:17 - INFO - [OK] Dados extraídos: Dr. Fulano - Procedimentos: 42
```

**Isso indica que a nova estratégia de busca está funcionando!**

---

## 9. Sinais de Sucesso

✅ **Tudo OK se você ver:**
- "Procurando TODAS as tabelas na página..."
- "Total de tabelas encontradas: X"
- "[OK] CÓDIGO XXXXX ENCONTRADO na Tabela Y, Linha Z!"
- "[OK] Dados extraídos: Nome - Procedimentos: N"
- "[OK] Produtividade salva com sucesso para Nome"

❌ **Problema se você ver:**
- "Código XXXXX não encontrado em nenhuma das X tabelas"
- "ESTRATÉGIA 2: Tentando extrair dados de dentro de iframe..."
- "Não foi possível extrair dados para o código XXXXX"

Se a ESTRATÉGIA 2 (iframe) for usada, não é necessariamente um erro - apenas significa que a tabela estava dentro de um iframe, e o script conseguiu lidar com isso!

---

## 10. Troubleshooting

### Problema: "all_tables está vazio"
**Solução:** Aumentar tempo de espera após submit (já está em 12s, pode aumentar para 15s)

### Problema: "Código não encontrado em nenhuma tabela"
**Solução:**
1. Verificar screenshot em `/tmp/screenshot_linha_nao_encontrada_XXXXX.png`
2. Pode ser que o usuário realmente não tenha dados no dia consultado

### Problema: "Keys not defined"
**Solução:** Verificar que o import foi adicionado corretamente

### Problema: "Timeout ao preencher formulário"
**Solução:** Verificar screenshot em `/tmp/screenshot_erro_XXXXX.png`

---

## Conclusão

Todas as melhorias do `scraplocal.py` foram aplicadas ao `coletar-produtividade-mv.py`. A lógica de extração agora é robusta e idêntica entre os dois arquivos, com as únicas diferenças sendo os paths específicos do sistema operacional (Windows vs Linux).

**O arquivo está pronto para ser testado no droplet!** 🚀
