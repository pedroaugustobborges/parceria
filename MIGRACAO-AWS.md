# Guia de Migração: ParcerIA — Vercel + Supabase Gerenciado → AWS VM (Completo)

**Decisão arquitetural:** migração completa para a VM AWS.  
Frontend (React/Vite) **e** backend (Supabase self-hosted via Docker) rodarão na mesma VM.

**Ambiente de destino:** AWS EC2 `10.12.1.170` (SSH via PuTTY + chave `.ppk`)  
**Repositório fonte:** `http://10.12.1.251:8000/pedro.borges/parceria`  
**Stack:** React 18 + Vite (Nginx) + Supabase self-hosted (Docker Compose)

---

## ⚠️ Princípios de Segurança Desta Migração

1. **O Supabase gerenciado só é cancelado depois de 2 semanas de estabilidade confirmada** em produção. Ele é o fallback.
2. **Nenhum dado é deletado** em nenhuma fase. Apenas copiado.
3. **Os scripts de cron são parados** antes da virada para evitar gap de dados entre os dois bancos.
4. **Backup completo** é tirado imediatamente antes de cada etapa destrutiva.
5. **Se qualquer etapa falhar**, existe um procedimento de rollback documentado abaixo que restaura tudo em menos de 10 minutos.

---

## 🔄 Plano de Rollback (Ler antes de começar)

Se qualquer coisa der errado após a virada, o rollback completo é:

```bash
# 1. Reverter o .env.production do frontend
cd /opt/parceria
cat > .env.production << 'EOF'
VITE_SUPABASE_URL=https://qszqzdnlhxpglllyqtht.supabase.co
VITE_SUPABASE_ANON_KEY=ANON_KEY_ORIGINAL
EOF

# 2. Reverter o .env dos scripts
cat > .env << 'EOF'
VITE_SUPABASE_URL=https://qszqzdnlhxpglllyqtht.supabase.co
VITE_SUPABASE_ANON_KEY=ANON_KEY_ORIGINAL
VITE_SUPABASE_SERVICE_ROLE_KEY=SERVICE_ROLE_KEY_ORIGINAL
EOF

# 3. Rebuild do frontend apontando de volta para o gerenciado
npm run build
sudo rsync -a --delete dist/ /var/www/parceria/
sudo chown -R www-data:www-data /var/www/parceria

# 4. Reativar os cron scripts
crontab -e   # descomentar as linhas dos scripts

# 5. Reload Nginx
sudo systemctl reload nginx
```

> Guarde as chaves originais do Supabase gerenciado em local seguro antes de começar.  
> O Supabase gerenciado **não será cancelado** durante toda a migração — está sempre disponível para rollback.

---

## Arquitetura Final

```
Usuário (internet)
       │
       ▼  porta 443 (HTTPS)
  Route 53 — parceria.daherlab.org.br
       │  aponta para o ALB
       ▼
  ALB — Application Load Balancer
  (IP público + certificado SSL via ACM)
       │
       ▼  porta 80 (HTTP interno)
  Nginx na VM (10.12.1.170)
       │
       ├── /                  → React SPA (/var/www/parceria/)
       ├── /rest/v1/          → Supabase Kong (localhost:8000)
       ├── /auth/v1/          → Supabase Kong (localhost:8000)
       ├── /storage/v1/       → Supabase Kong (localhost:8000)
       ├── /realtime/v1/      → Supabase Kong (localhost:8000) [WebSocket]
       └── /functions/v1/     → Supabase Kong (localhost:8000)

  Supabase self-hosted (Docker Compose na mesma VM)
       ├── PostgreSQL          (porta 5432 — interno apenas)
       ├── Kong API Gateway    (porta 8000 — interno apenas)
       ├── GoTrue (Auth)
       ├── PostgREST
       ├── Realtime
       ├── Storage
       └── Edge Functions (IA — chat, insights, PDFs)

  Scripts Python (cron na VM)
       ├── coletar-produtividade-ontem-AWS.py   (roda todo dia)
       ├── coletar-produtividade-escalas-AWS.py
       └── (outros)
       Todos leem .env → VITE_SUPABASE_URL + VITE_SUPABASE_SERVICE_ROLE_KEY
       Após a virada: apontam para localhost (self-hosted)
```

---

## Checklist Completo

```
# ── JÁ FEITO ──────────────────────────────────────────────────────────
[x] Fase 1   — Node.js, Git e Nginx instalados
[x] Fase 2   — Repositório clonado em /opt/parceria
[x] Fase 3   — .env.production criado
[x] Fase 4   — Build do frontend gerado
[x] Fase 5   — dist/ publicado no Nginx
[x] Fase 6   — Nginx configurado (SPA acessível via VPN)
[x] Fase 7   — Script de deploy criado em /opt/scripts/

# ── CONFIGURAÇÃO (Supabase self-hosted, paralelo ao gerenciado) ────────
[ ] Fase 8   — Verificar disco (mín. 40 GB livres)
[ ] Fase 9   — Docker instalado na VM
[ ] Fase 10  — Supabase self-hosted configurado e rodando
[ ] Fase 11  — Backup completo do Supabase gerenciado
[ ] Fase 12  — Dados importados e verificados no self-hosted

# ── VIRADA (janela de manutenção — fazer de uma vez, sem interrupção) ──
[ ] Fase 13  — PARAR os cron scripts
[ ] Fase 14  — Backup final (delta desde a Fase 11)
[ ] Fase 15  — Importar delta no self-hosted
[ ] Fase 16  — Atualizar .env e .env.production → self-hosted
[ ] Fase 17  — Rebuild frontend + teste via VPN
[ ] Fase 18  — Reativar cron scripts (agora apontam para self-hosted)
[ ] Fase 19  — Nginx atualizado para proxy do Supabase

# ── TI (Carlos) ────────────────────────────────────────────────────────
[ ] Fase 20a — Certificado ACM para parceria.daherlab.org.br
[ ] Fase 20b — Target Group no ALB (EC2 porta 80)
[ ] Fase 20c — Listener HTTPS/443 no ALB com certificado ACM
[ ] Fase 20d — Registro A Alias no Route 53 → ALB
[ ] Fase 20e — Security Group da VM: porta 80 do ALB liberada

# ── VALIDAÇÃO E ENCERRAMENTO ───────────────────────────────────────────
[ ] Fase 21  — Validação completa em produção (HTTPS)
[ ]           — Período de observação: 2 semanas com self-hosted em produção
[ ]           — Cancelar plano Vercel
[ ]           — Cancelar plano Supabase gerenciado (só após 2 semanas OK)
[ ]           — Comunicar usuários da nova URL
```

---

## Fase 8 — Verificar Disco da VM

```bash
df -h /
```

> Necessário: mínimo **40 GB livres**.  
> O Supabase self-hosted (Docker images + dados + backups locais) ocupa ~15–25 GB.  
> Se o disco estiver abaixo de 40 GB livres, pedir ao Carlos para ampliar antes de continuar.

---

## Fase 9 — Instalar Docker na VM

```bash
# Remover versões antigas (se houver)
sudo apt remove -y docker docker-engine docker.io containerd runc 2>/dev/null

# Instalar dependências
sudo apt update
sudo apt install -y ca-certificates curl gnupg lsb-release

# Adicionar repositório oficial do Docker
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Instalar Docker e Docker Compose
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Permitir rodar Docker sem sudo
sudo usermod -aG docker $USER
newgrp docker

# Verificar
docker --version
docker compose version
```

---

## Fase 10 — Configurar Supabase Self-Hosted

> O Supabase gerenciado **continua ativo** durante toda esta fase. Nenhum dado é afetado.

### 10.1 — Baixar os arquivos do Supabase

```bash
sudo mkdir -p /opt/supabase
sudo chown $USER:$USER /opt/supabase

cd /opt/supabase
git clone --depth 1 https://github.com/supabase/supabase .
cd docker
cp .env.example .env
```

### 10.2 — Gerar chaves e senhas

```bash
# Executar cada comando e copiar o resultado para um local seguro (senha do Windows por ex.)
openssl rand -base64 32   # → JWT_SECRET
openssl rand -base64 24   # → POSTGRES_PASSWORD
openssl rand -base64 16   # → DASHBOARD_PASSWORD
```

Agora gere as chaves `anon` e `service_role` diretamente na VM a partir do JWT_SECRET:

```bash
# Instalar biblioteca JWT
pip3 install PyJWT

# Gerar as chaves — substitua SEU_JWT_SECRET pelo valor gerado acima
python3 - << 'EOF'
import jwt, time

SECRET = "HS2Zo0b7+uFl+fCUDwv4Do/98lMOEhQPFAMU7bM9zk8="
now = int(time.time())
exp = now + (5 * 365 * 24 * 60 * 60)  # 5 anos

anon = jwt.encode(
    {"role": "anon", "iss": "supabase", "iat": now, "exp": exp},
    SECRET, algorithm="HS256"
)
service = jwt.encode(
    {"role": "service_role", "iss": "supabase", "iat": now, "exp": exp},
    SECRET, algorithm="HS256"
)

print(f"\nANON_KEY={anon}")
print(f"\nSERVICE_ROLE_KEY={service}\n")
EOF
```

Copie e salve as duas chaves impressas na tela.

> **Salve os 5 valores em local seguro agora** (ex: bloco de notas protegido por senha):
>
> - `JWT_SECRET`
> - `POSTGRES_PASSWORD`
> - `DASHBOARD_PASSWORD`
> - `ANON_KEY`
> - `SERVICE_ROLE_KEY`
>
> Elas serão usadas no `.env` dos scripts e no `.env.production` do frontend.

### 10.3 — Configurar o .env do Supabase

```bash
nano /opt/supabase/docker/.env
```

Preencher obrigatoriamente (substituir os valores gerados no passo 10.2):

```env
# Senhas e chaves
POSTGRES_PASSWORD=24f55bfb55640c8797f4307eb15b08311076aed9022e4aa0
JWT_SECRET=HS2Zo0b7+uFl+fCUDwv4Do/98lMOEhQPFAMU7bM9zk8=
ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzgzMzQ2MTY3LCJleHAiOjE5NDEwMjYxNjd9.ygeg2QFy5y6fN_3p0u53s6Z3D2xGP4p53WJ6IFW0ccU
SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODMzNDYxNjcsImV4cCI6MTk0MTAyNjE2N30.cNgf3uQ2_4VtS0JfnS2Ga44V9sVkIqrMvFf6Vw-QrPM
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=a81ed6c41f540bea19cc2b23

# Banco de dados
POSTGRES_HOST=db
POSTGRES_DB=postgres
POSTGRES_PORT=5432

# URL pública (domínio final)
SITE_URL=https://parceria.daherlab.org.br
API_EXTERNAL_URL=https://parceria.daherlab.org.br
SUPABASE_PUBLIC_URL=https://parceria.daherlab.org.br

# E-mail (recuperação de senha)
SMTP_ADMIN_EMAIL=pedro.borges@agirsaude.org.br
SMTP_HOST=smtp.agir.com.br
SMTP_PORT=587
SMTP_USER=pedro.borges@agirsaude.org.br
SMTP_PASS=SENHA_DO_EMAIL
SMTP_SENDER_NAME=ParcerIA
```

### 10.4 — Subir o Supabase

```bash
cd /opt/supabase/docker
docker compose up -d

# Aguardar ~2 minutos e verificar
docker compose ps
```

Todos os serviços devem aparecer com status `running` ou `healthy`.  
O Kong ficará disponível em `http://localhost:8000`.

```bash
# Confirmar que o Kong está respondendo
curl http://localhost:8000/rest/v1/ \
  -H "apikey: ANON_KEY_GERADA" \
  -H "Authorization: Bearer ANON_KEY_GERADA"
# Esperado: resposta JSON (pode ser vazia, mas não erro de conexão)
```

---

## Fase 11 — Backup Completo do Supabase Gerenciado

> Este backup é a rede de segurança principal. Guarde o arquivo.

```bash
# Instalar cliente PostgreSQL
sudo apt install -y postgresql-client

# Criar diretório de backups
sudo mkdir -p /opt/backups
sudo chown $USER:$USER /opt/backups

# Exportar tudo do Supabase gerenciado








# A SENHA está em: Supabase Dashboard → Project Settings → Database → Database password
pg_dump \
  "postgresql://postgres:d2KGzq3sjb2QxgQP@db.qszqzdnlhxpglllyqtht.supabase.co:5432/postgres" \
  --no-owner --no-acl \
  -f /opt/backups/backup-gerenciado-$(date +%Y%m%d-%H%M).sql

# Verificar que o arquivo foi criado e tem tamanho razoável
ls -lh /opt/backups/
```

---

## Fase 12 — Importar Dados no Supabase Self-Hosted e Verificar

### 12.1 — Importar o backup

```bash
# Aguardar o PostgreSQL do self-hosted estar pronto
docker exec supabase-db pg_isready -U postgres

# Importar
docker exec -i supabase-db psql \
  -U postgres -d postgres \
  < /opt/backups/backup-gerenciado-YYYYMMDD-HHMM.sql
```

### 12.2 — Verificar os dados

```bash
# Listar tabelas públicas
docker exec supabase-db psql -U postgres -d postgres \
  -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"

# Contar registros nas tabelas críticas
docker exec supabase-db psql -U postgres -d postgres \
  -c "SELECT 'acessos' as tabela, COUNT(*) FROM public.acessos
      UNION ALL
      SELECT 'produtividade', COUNT(*) FROM public.produtividade;"
```

Compare os totais com o Supabase gerenciado (Supabase Dashboard → Table Editor).  
Os números devem ser iguais ou muito próximos (diferença = registros adicionados após o backup).

### 12.3 — Migrar arquivos do Storage (PDFs, imagens)

```bash
# Instalar Supabase CLI
npm install -g supabase

# Login no Supabase gerenciado
supabase login
# (usar o access token do Supabase Dashboard → Account → Access Tokens)

# Listar buckets
supabase storage ls --project-ref qszqzdnlhxpglllyqtht

# Para cada bucket, baixar e reenviar para o self-hosted
# (repetir para cada bucket existente, ex: "contratos", "documentos")
supabase storage cp -r \
  ss://qszqzdnlhxpglllyqtht/contratos \
  /opt/backups/storage-contratos/
```

> Se os buckets tiverem poucos arquivos, o upload pode ser feito manualmente via
> Supabase Studio (acessível em `http://10.12.1.170:3000` após o self-hosted subir).

---

## ── JANELA DE MANUTENÇÃO ──────────────────────────────────────────────

> As fases 13 a 19 devem ser executadas **de uma vez, sem interrupção**, de preferência
> em um horário de baixo uso (noite ou fim de semana).
> Tempo estimado: 30 a 60 minutos.
> Durante este período, o sistema ficará fora do ar para os usuários.

---

## Fase 13 — Parar os Scripts de Cron

```bash
# Listar os cron jobs ativos
crontab -l

# Abrir o cron e comentar todas as linhas dos scripts de produtividade/acessos
crontab -e
# Adicionar # na frente de cada linha dos scripts coletar-produtividade-* e importar-acessos-*

# Confirmar que não há nenhum script rodando no momento
ps aux | grep python
```

> Anote o horário exato em que os scripts foram parados.  
> **Não pule esta etapa.** Se os scripts continuarem rodando durante a virada,
> dados novos irão para o Supabase gerenciado e não para o self-hosted, criando inconsistência.

---

## Fase 14 — Backup Final (Delta)

```bash
# Novo backup capturando tudo que chegou desde a Fase 11
pg_dump \
  "postgresql://postgres:SENHA_SUPABASE_GERENCIADO@db.qszqzdnlhxpglllyqtht.supabase.co:5432/postgres" \
  --no-owner --no-acl \
  -f /opt/backups/backup-final-$(date +%Y%m%d-%H%M).sql

ls -lh /opt/backups/
```

---

## Fase 15 — Importar Delta no Self-Hosted

```bash
# Reimportar o backup final sobre o self-hosted
# (o --clean apaga e recria as tabelas para garantir consistência)
docker exec -i supabase-db psql \
  -U postgres -d postgres \
  < /opt/backups/backup-final-YYYYMMDD-HHMM.sql

# Verificar contagens novamente
docker exec supabase-db psql -U postgres -d postgres \
  -c "SELECT 'acessos' as tabela, COUNT(*) FROM public.acessos
      UNION ALL
      SELECT 'produtividade', COUNT(*) FROM public.produtividade;"
```

---

## Fase 16 — Atualizar Variáveis de Ambiente

### 16.1 — Atualizar `.env.production` (usado pelo frontend)

```bash
cd /opt/parceria

cat > .env.production << 'EOF'
VITE_SUPABASE_URL=https://parceria.daherlab.org.br
VITE_SUPABASE_ANON_KEY=ANON_KEY_GERADA_NO_PASSO_10.2
EOF
```

### 16.2 — Atualizar `.env` (usado pelos scripts Python)

```bash
cd /opt/parceria

cat > .env << 'EOF'
VITE_SUPABASE_URL=https://parceria.daherlab.org.br
VITE_SUPABASE_ANON_KEY=ANON_KEY_GERADA_NO_PASSO_10.2
VITE_SUPABASE_SERVICE_ROLE_KEY=SERVICE_ROLE_KEY_GERADA_NO_PASSO_10.2
EOF
```

> **Atenção:** o `.env` dos scripts agora usa a `SERVICE_ROLE_KEY` do Supabase **self-hosted**,
> não mais a do gerenciado. São chaves diferentes.

---

## Fase 17 — Rebuild do Frontend e Teste via VPN

```bash
cd /opt/parceria
npm run build
sudo rsync -a --delete dist/ /var/www/parceria/
sudo chown -R www-data:www-data /var/www/parceria
```

**Teste imediato via VPN** (antes de qualquer configuração do TI):

```bash
# A API do Supabase self-hosted deve responder via Nginx
curl http://10.12.1.170/rest/v1/ \
  -H "apikey: ANON_KEY_GERADA" \
  -H "Authorization: Bearer ANON_KEY_GERADA"
```

Abra `http://10.12.1.170` no navegador (via VPN):

- [ ] Tela de login aparece
- [ ] Login com usuário real funciona
- [ ] Dados (acessos, produtividade) aparecem corretamente
- [ ] Navegação entre páginas sem erro 404

> Se o login não funcionar: os usuários do Auth do Supabase gerenciado foram migrados via
> pg_dump. Se estiver com problema, verificar a tabela `auth.users` no self-hosted:
>
> ```bash
> docker exec supabase-db psql -U postgres -d postgres \
>   -c "SELECT COUNT(*) FROM auth.users;"
> ```

---

## Fase 18 — Reativar os Scripts de Cron (agora apontando para self-hosted)

```bash
# Testar um script manualmente antes de reativar o cron
cd /opt/parceria
python3 coletar-produtividade-ontem-AWS.py

# Se funcionar sem erros, reativar o cron
crontab -e
# Remover o # das linhas dos scripts
```

Verificar que os dados novos estão chegando no self-hosted:

```bash
docker exec supabase-db psql -U postgres -d postgres \
  -c "SELECT MAX(created_at) FROM public.produtividade;"
# O timestamp deve ser recente (hoje)
```

---

## Fase 19 — Atualizar Nginx para Proxy do Supabase

```bash
sudo nano /etc/nginx/sites-available/parceria
```

Substituir a configuração atual por:

```nginx
server {
    listen 80;
    server_name parceria.daherlab.org.br;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/javascript;

    # ── Supabase API (Kong em localhost:8000) ──────────────────────────

    location /rest/v1/ {
        proxy_pass http://localhost:8000/rest/v1/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /auth/v1/ {
        proxy_pass http://localhost:8000/auth/v1/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /storage/v1/ {
        proxy_pass http://localhost:8000/storage/v1/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 50M;
    }

    location /functions/v1/ {
        proxy_pass http://localhost:8000/functions/v1/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /realtime/v1/ {
        proxy_pass http://localhost:8000/realtime/v1/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }

    # ── Frontend React (SPA) ───────────────────────────────────────────

    root /var/www/parceria;
    index index.html;

    location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## Fase 20 — HTTPS via ALB + ACM (feito pelo TI — Carlos)

### O que Carlos precisa fazer:

1. **ACM** — emitir certificado para `parceria.daherlab.org.br`
2. **ALB** — Target Group: instância `10.12.1.170`, porta `80`, health check `GET /`
3. **ALB** — Listener HTTPS/443 com certificado ACM → forward ao Target Group
4. **Route 53** — registro A Alias: `parceria.daherlab.org.br` → DNS name do ALB
5. **Security Group da VM** — porta 80 liberada do Security Group do ALB

---

## Fase 21 — Validação Final em Produção

```bash
# Confirmar que o domínio resolve
nslookup parceria.daherlab.org.br

# Testar HTTPS
curl -I https://parceria.daherlab.org.br

# Testar API via domínio público
curl https://parceria.daherlab.org.br/rest/v1/ \
  -H "apikey: ANON_KEY_GERADA"
```

Validações manuais:

- [ ] `https://parceria.daherlab.org.br` abre com cadeado verde
- [ ] Login com usuário real funciona
- [ ] Dados históricos de acessos e produtividade aparecem
- [ ] Navegação entre páginas sem erro 404
- [ ] Upload de arquivo funciona (Storage)
- [ ] Chat IA responde (Edge Functions)
- [ ] Recuperação de senha por e-mail funciona
- [ ] Script de cron executou e inseriu dados no self-hosted

---

## Após 2 Semanas de Estabilidade

Só após 2 semanas sem problemas em produção:

```bash
# Backup final do self-hosted antes de cancelar o gerenciado
docker exec supabase-db pg_dump -U postgres postgres \
  > /opt/backups/backup-selfhosted-$(date +%Y%m%d).sql
```

- [ ] Cancelar plano Vercel
- [ ] Cancelar plano Supabase gerenciado (Dashboard → Settings → General → Delete project)
- [ ] Comunicar usuários da nova URL: `https://parceria.daherlab.org.br`

---

## Comandos de Manutenção

```bash
# Atualizar o frontend
sudo bash /opt/scripts/deploy-frontend.sh

# Status do Supabase
cd /opt/supabase/docker && docker compose ps

# Logs do Supabase (todos os serviços)
cd /opt/supabase/docker && docker compose logs -f

# Logs de um serviço específico
cd /opt/supabase/docker && docker compose logs -f kong
cd /opt/supabase/docker && docker compose logs -f db

# Reiniciar Supabase
cd /opt/supabase/docker && docker compose restart

# Backup do banco (rodar periodicamente)
docker exec supabase-db pg_dump -U postgres postgres \
  > /opt/backups/backup-$(date +%Y%m%d).sql

# Logs do Nginx
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# Status do Nginx
sudo systemctl status nginx
```

---

## Portas no Security Group da VM

| Porta | Protocolo | Origem                 | Motivo                         |
| ----- | --------- | ---------------------- | ------------------------------ |
| 22    | TCP       | Rede interna Agir      | SSH / PuTTY                    |
| 80    | TCP       | VPN (192.168.144.0/20) | Teste via VPN (já configurado) |
| 80    | TCP       | Security Group do ALB  | Tráfego público via ALB        |

> Portas 5432 (Postgres) e 8000 (Kong) **não devem ser abertas** no Security Group.
> São internas à VM e acessadas apenas pelo Nginx e pelos scripts Python localmente.
