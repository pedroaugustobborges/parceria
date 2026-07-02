# Guia de Migração: ParcerIA — Vercel → AWS VM

**Decisão arquitetural:** Supabase permanece gerenciado (`qszqzdnlhxpglllyqtht.supabase.co`).  
Apenas o frontend sai do Vercel e passa a rodar na VM AWS.

**Ambiente de destino:** AWS EC2 `10.12.1.170` (SSH via PuTTY + chave `.ppk`)  
**Repositório fonte:** `http://10.12.1.251:8000/pedro.borges/parceria`  
**Stack:** React 18 + Vite → build estático servido por Nginx

---

## Arquitetura Final

```
Usuário (internet)
       │
       ▼  porta 443 (HTTPS)
  Route 53 (DNS)
       │  aponta para o ALB
       ▼
  ALB — Application Load Balancer
  (IP público + certificado SSL via ACM)
       │
       ▼  porta 80 (HTTP interno)
  Nginx na VM (10.12.1.170) — sem IP público, acessível só via VPN/ALB
       │
       ├── /          → React SPA (/var/www/parceria/dist/)
       │
       └── (todo o resto)  → Supabase Gerenciado
                              https://qszqzdnlhxpglllyqtht.supabase.co
                              (banco, auth, storage, edge functions — sem mudança)
```

**Notas importantes sobre esta arquitetura:**
- A VM **não tem IP público** — acesso externo passa obrigatoriamente pelo ALB.
- A terminação SSL/HTTPS ocorre **no ALB**, com certificado gerenciado pelo ACM (AWS Certificate Manager).
- O Nginx escuta apenas na **porta 80** (HTTP interno). Não é necessário Certbot.
- O Supabase continua funcionando exatamente como hoje.
- As variáveis de ambiente do projeto **não mudam**.

---

## Fase 0 — Verificar Disco da VM

```bash
df -h /
```

> **Status atual:** 20 GB total, 14 GB livres.  
> Para esta abordagem (só frontend + Nginx) isso é **suficiente** — o build ocupa ~600 MB.

---

## Fase 1 — Instalar Node.js, Git e Nginx

```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git rsync

# Nginx
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# Verificar
node --version    # v20.x.x
nginx -v
```

---

## Fase 2 — Clonar o Repositório

```bash
sudo mkdir -p /opt/parceria
sudo chown $USER:$USER /opt/parceria

git clone http://10.12.1.251:8000/pedro.borges/parceria /opt/parceria
```

---

## Fase 3 — Configurar Variáveis de Ambiente

```bash
cd /opt/parceria

cat > .env.production << 'EOF'
# Supabase gerenciado — sem alteração
VITE_SUPABASE_URL=https://qszqzdnlhxpglllyqtht.supabase.co
VITE_SUPABASE_ANON_KEY=cole_a_anon_key_atual_aqui
EOF
```

> Copie a `ANON_KEY` do seu `.env` local atual.  
> Nunca inclua `VITE_SUPABASE_SERVICE_ROLE_KEY` neste arquivo.

---

## Fase 4 — Build do Frontend

```bash
cd /opt/parceria

npm install
npm run build

# Verificar output
ls -la dist/
```

---

## Fase 5 — Publicar no Nginx

```bash
sudo mkdir -p /var/www/parceria
sudo rsync -a --delete dist/ /var/www/parceria/
sudo chown -R www-data:www-data /var/www/parceria
```

---

## Fase 6 — Configurar o Nginx

```bash
sudo nano /etc/nginx/sites-available/parceria
```

```nginx
server {
    listen 80;
    server_name parceria.agir.com.br;  # domínio final — ajustar se necessário

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/javascript;

    root /var/www/parceria;
    index index.html;

    # Assets com cache longo (Vite gera nome com hash)
    location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # SPA fallback — redireciona todas as rotas para index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
# Ativar o site e desativar o default
sudo ln -s /etc/nginx/sites-available/parceria /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Testar e aplicar
sudo nginx -t
sudo systemctl reload nginx
```

**Testar localmente (via VPN):** abra `http://10.12.1.170` no navegador dentro da VPN — deve aparecer a tela de login.  
**Testar em produção:** só funciona após o TI configurar o ALB e o Route 53 (ver Fase 8).

---

## Fase 7 — Script de Deploy (para atualizações futuras)

```bash
sudo mkdir -p /opt/scripts
sudo nano /opt/scripts/deploy-frontend.sh
```

```bash
#!/bin/bash
# Uso: sudo bash /opt/scripts/deploy-frontend.sh
set -e

APP_DIR="/opt/parceria"
WEB_DIR="/var/www/parceria"

echo "=== ParcerIA — Deploy de nova versão ==="

echo "[1/4] Atualizando código..."
cd "$APP_DIR"
git fetch origin
git reset --hard origin/main

echo "[2/4] Instalando dependências..."
npm install --production=false

echo "[3/4] Gerando build..."
npm run build

echo "[4/4] Publicando..."
sudo rsync -a --delete dist/ "$WEB_DIR/"
sudo chown -R www-data:www-data "$WEB_DIR"
sudo systemctl reload nginx

echo "Deploy concluído."
```

```bash
sudo chmod +x /opt/scripts/deploy-frontend.sh
```

---

## Fase 8 — HTTPS via ALB + ACM (feito pelo TI, não pelo Certbot)

A VM não tem IP público, portanto **não é possível usar Certbot/Let's Encrypt**.  
O HTTPS é gerenciado pelo **ALB** com certificado do **AWS Certificate Manager (ACM)**.

### O que o TI precisa fazer (Carlos):

**1. Emitir ou importar o certificado no ACM**
- AWS Console → Certificate Manager → Request certificate
- Domínio: `parceria.agir.com.br` (ou o subdomínio escolhido)
- Validação: via DNS (Carlos adiciona registro CNAME no Route 53 — automático se o domínio já estiver no Route 53)

**2. Configurar o Target Group no ALB**
- AWS Console → EC2 → Load Balancers → selecionar o ALB existente da Agir
- Target Groups → Create target group:
  - Target type: `Instances`
  - Protocol: `HTTP`, Port: `80`
  - Health check: `HTTP`, Path: `/`
  - Registrar a instância `10.12.1.170` como target

**3. Adicionar Listener HTTPS no ALB (se não existir)**
- Listener na porta `443`, protocolo `HTTPS`
- Certificado: o emitido no passo 1
- Action: Forward para o Target Group criado acima

**4. Criar registro no Route 53**
- Tipo: `A` (Alias)
- Nome: `parceria.agir.com.br`
- Alias target: DNS name do ALB (ex: `agir-alb-123456.us-east-1.elb.amazonaws.com`)

**5. Liberar porta 80 no Security Group da VM**
- Regra de entrada: HTTP / TCP / 80 / origem = Security Group do ALB (ou CIDR da VPC)

### O que Pedro faz após o TI concluir:

Verificar que o `server_name` no Nginx está correto e fazer reload:

```bash
# Confirmar server_name
sudo grep server_name /etc/nginx/sites-available/parceria

# Se precisar ajustar:
sudo sed -i 's|server_name .*;|server_name parceria.agir.com.br;|' \
  /etc/nginx/sites-available/parceria
sudo nginx -t && sudo systemctl reload nginx
```

O `Supabase Redirect URLs` no dashboard do Supabase também precisa incluir a URL de produção:
- Acessar `app.supabase.com` → projeto → Authentication → URL Configuration
- Adicionar `https://parceria.agir.com.br` em **Site URL** e **Redirect URLs**

---

## Checklist de Go-Live

```
[x] Fase 1  — Node.js, Git e Nginx instalados
[x] Fase 2  — Repositório clonado em /opt/parceria
[x] Fase 3  — .env.production criado com as chaves do Supabase
[x] Fase 4  — npm install + npm run build executados sem erro
[x] Fase 5  — dist/ copiado para /var/www/parceria
[x] Fase 6  — Nginx configurado e reload feito
              Validar (via VPN): http://10.12.1.170 abre a tela de login ✅
              Validar: fazer login com usuário real funciona ✅
              Validar: navegar entre páginas (sem 404 no F5) ✅
[x] Fase 7  — Script de deploy criado em /opt/scripts/

--- AGUARDANDO TI (Carlos) ---

[ ] Fase 8a — TI: Certificado ACM emitido para parceria.agir.com.br
[ ] Fase 8b — TI: Target Group no ALB apontando para EC2 porta 80
[ ] Fase 8c — TI: Listener HTTPS (443) no ALB com certificado ACM
[ ] Fase 8d — TI: Registro A (Alias) no Route 53 → ALB
[ ] Fase 8e — TI: Security Group da VM liberando porta 80 do ALB

--- PEDRO (após TI concluir 8a–8e) ---

[ ] Fase 9  — Confirmar server_name no Nginx e reload
[ ] Fase 9  — Atualizar Site URL no Supabase para https://parceria.agir.com.br
              Validar: https://parceria.agir.com.br abre sem aviso de segurança
              Validar: login funciona com a URL de produção
[ ]         — Comunicar usuários da nova URL
```

---

## Comandos de Manutenção

```bash
# Atualizar o frontend quando sair nova versão no Gitea
sudo bash /opt/scripts/deploy-frontend.sh

# Ver logs do Nginx
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# Reiniciar Nginx
sudo systemctl restart nginx

# Status do Nginx
sudo systemctl status nginx
```

---

## Portas abertas no Security Group AWS

### Security Group da VM (EC2 10.12.1.170)

| Porta | Protocolo | Origem                      | Motivo                             |
| ----- | --------- | --------------------------- | ---------------------------------- |
| 22    | TCP       | IP da rede interna Agir     | SSH / PuTTY                        |
| 80    | TCP       | Security Group do ALB (VPC) | Nginx recebe tráfego interno do ALB |

> Porta 443 **não precisa** estar aberta na VM — o SSL termina no ALB.  
> A porta 80 deve aceitar apenas tráfego do ALB, não da internet diretamente.

### Security Group / Listener do ALB

| Porta | Protocolo | Origem    | Motivo                                   |
| ----- | --------- | --------- | ---------------------------------------- |
| 443   | TCP       | 0.0.0.0/0 | HTTPS público (certificado ACM)          |
| 80    | TCP       | 0.0.0.0/0 | HTTP → redirecionar para 443 (opcional)  |
