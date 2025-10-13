# Configurar Proxy para Supabase

## Se sua empresa usa proxy, siga estes passos:

### 1. Descobrir configurações do proxy

Pergunte ao TI da Agir Saúde:
- Endereço do proxy (ex: proxy.agirsaude.org.br)
- Porta (ex: 8080)
- Usuário e senha (se necessário)

### 2. Configurar proxy no Windows

```cmd
set HTTP_PROXY=http://usuario:senha@proxy.agirsaude.org.br:8080
set HTTPS_PROXY=http://usuario:senha@proxy.agirsaude.org.br:8080
```

### 3. Configurar no Python

Crie arquivo `.env.local`:

```
HTTP_PROXY=http://proxy.agirsaude.org.br:8080
HTTPS_PROXY=http://proxy.agirsaude.org.br:8080
```

### 4. Solicitar Liberação ao TI

Peça para liberar:
- `*.supabase.co` (todos os domínios Supabase)
- Porta 443 (HTTPS)
