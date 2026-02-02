# ParcerIA - Setup do Ambiente na VM (AWS)

**Empresa:** Agir Saude
**Servidor:** 42_WEBAPP_DAHERLAB_PRD (instancia EC2 - Debian GNU/Linux)
**IP privado:** 10.12.1.69
**SO:** Debian 13 (Trixie) - kernel 6.12
**Acesso:** SSH via PuTTY (usuario `admin`, autenticacao por chave publica `AgirChave02`)
**Infraestrutura:** AWS

---

## Visao geral da arquitetura

```
Internet
   |
   v
[Route 53 - DNS] --> parceria.agirsaude.com.br
   |
   v
[Application Load Balancer (ALB)] -- porta 443 (HTTPS) -- certificado via ACM
   |
   v
[Security Group] -- libera portas 80/443
   |
   v
[EC2: 42_WEBAPP_DAHERLAB_PRD] -- Debian Linux -- IP privado 10.12.1.69
   |
   v
[Nginx servindo a aplicacao React em /var/www/parceria]
```

---

## Informacoes importantes antes de comecar

### A VM nao tem interface grafica

Esta VM e um **servidor Linux headless** (sem desktop, sem navegador, sem mouse).
Toda interacao e feita via **terminal de texto** (linha de comando) pelo PuTTY.
Voce digita comandos e le as respostas no terminal. Nao ha janelas, botoes ou menus.

### O codigo NAO atualiza automaticamente na VM

Quando voce faz `git push` do VS Code para o GitHub, **a VM nao recebe essa
atualizacao automaticamente**. O `git clone` que voce faz na VM cria apenas uma
**copia local naquele momento**. Para atualizar, voce tem duas opcoes:

1. **Manual** - Acessar a VM via PuTTY e rodar `git pull` + `npm run build`
   (descrito na secao 13 deste tutorial)
2. **Automatico (CI/CD)** - Configurar o GitHub Actions para, a cada push,
   conectar na VM via SSH e executar o deploy automaticamente
   (descrito na secao 14 deste tutorial)

### Sobre repositorio publico vs privado

- Enquanto o repositorio estiver **publico**, o `git clone` funciona sem autenticacao.
- Quando voce tornar o repositorio **privado**, a VM precisara de autenticacao para
  fazer `git pull`. A secao 4 explica como configurar isso.

---

## PARTE 1 - Configuracao da VM (voce faz)

### 1. Acessar a VM via SSH (PuTTY)

1. Abra o **PuTTY** no seu computador
2. Em **Host Name**, digite: `10.12.1.69`
3. Em **Port**, mantenha: `22`
4. Em **Connection > SSH > Auth > Credentials**, carregue a chave privada (`AgirChave02.ppk`)
5. Clique em **Open**
6. No campo `login as:`, digite: `admin`
7. Voce vera algo como:

```
admin@ip-10-12-1-69:~$
```

Isso e o **prompt de comando**. O cursor piscando significa que a VM esta pronta
para receber comandos. Tudo que voce digitar e confirmar com Enter sera executado.

> **Dica:** Para colar texto no PuTTY, basta **clicar com o botao direito do mouse**.
> Ctrl+V nao funciona no PuTTY.

---

### 2. Atualizar o sistema operacional

Antes de instalar qualquer coisa, atualize os pacotes do Debian.
Copie e cole (botao direito no PuTTY) cada comando abaixo, um por vez:

```bash
sudo apt update
```

```bash
sudo apt upgrade -y
```

> `sudo` = executar como administrador (root).
> O sistema pode pedir confirmacao; digite `Y` e Enter se solicitado.

---

### 3. Instalar o Node.js

No Linux, nao se baixa instaladores. Tudo e feito via terminal.
Vamos instalar o Node.js LTS usando o NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
```

Aguarde finalizar. Depois:

```bash
sudo apt install -y nodejs
```

Valide a instalacao:

```bash
node --version
```

```bash
npm --version
```

Ambos devem retornar um numero de versao (ex: `v22.x.x` e `10.x.x`).

---

### 4. Instalar o Git

O Git ja pode estar instalado no Debian. Verifique:

```bash
git --version
```

Se retornar um numero de versao, pule para o proximo passo.
Se der erro, instale:

```bash
sudo apt install -y git
```

---

### 5. Clonar o repositorio

Crie a pasta e clone o projeto:

```bash
sudo mkdir -p /var/www
cd /var/www
sudo git clone https://github.com/pedroaugustobborges/parceria.git parceria
```

> Substitua `SEU_USUARIO/SEU_REPOSITORIO` pela URL real do seu repositorio no GitHub.
> Exemplo: `https://github.com/pedro-agir/parceria.git`

Ajuste as permissoes para o usuario admin poder editar os arquivos:

```bash
sudo chown -R admin:admin /var/www/parceria
```

**Quando o repositorio for privado**, voce precisara autenticar.
Configure um Personal Access Token (PAT) do GitHub:

1. No GitHub, va em: Settings > Developer settings > Personal access tokens > Tokens (classic)
2. Gere um token com permissao `repo`
3. Na VM, configure o Git para lembrar a credencial:

```bash
git config --global credential.helper store
```

4. Na proxima vez que fizer `git pull`, informe seu usuario e use o token como senha.
   O Git vai salvar e nao pedira novamente.

---

### 6. Configurar variaveis de ambiente (.env)

Entre na pasta do projeto:

```bash
cd /var/www/parceria
```

Crie o arquivo `.env` usando o editor `nano` (editor de texto no terminal):

```bash
nano .env
```

O terminal vai mudar para uma tela de edicao. Cole (botao direito no PuTTY) o conteudo:

```
VITE_SUPABASE_URL=https://xxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxxxxxxxxxxxxxxxxxxxxxx
```

> Substitua pelos valores reais do seu projeto. Consulte o `.env` que voce usa
> localmente no VS Code ou o `.env.example` do projeto.

Para salvar e sair do `nano`:

1. Pressione `Ctrl + O` (letra O, nao zero) para salvar
2. Pressione `Enter` para confirmar o nome do arquivo
3. Pressione `Ctrl + X` para sair

Verifique se o arquivo foi criado corretamente:

```bash
cat .env
```

Deve exibir o conteudo que voce colou.

---

### 7. Instalar dependencias e fazer o build

```bash
cd /var/www/parceria
npm install
npm run build
```

> O `npm install` baixa todas as bibliotecas do projeto.
> O `npm run build` gera a pasta `dist/` com os arquivos otimizados para producao.

Valide que a pasta foi criada:

```bash
ls dist/
```

Voce deve ver arquivos como `index.html` e uma pasta `assets/`.

---

### 8. Instalar o Nginx

O **Nginx** e o servidor web que vai servir a aplicacao (equivalente ao IIS no Windows
ou ao servidor da Vercel). Ele recebe as requisicoes HTTP e entrega os arquivos da
pasta `dist/`.

```bash
sudo apt install -y nginx
```

Valide que esta rodando:

```bash
sudo systemctl status nginx
```

Deve aparecer `active (running)` em verde.

---

### 9. Configurar o Nginx para a aplicacao

Crie o arquivo de configuracao do site:

```bash
sudo nano /etc/nginx/sites-available/parceria
```

Cole o seguinte conteudo (botao direito no PuTTY):

```nginx
server {
    listen 80;
    server_name parceria.agirsaude.com.br;

    root /var/www/parceria/dist;
    index index.html;

    # Configuracao essencial para SPA (React Router)
    # Sem isso, acessar /login diretamente retornaria erro 404
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache para arquivos estaticos (CSS, JS, imagens)
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Salve e saia (`Ctrl + O`, `Enter`, `Ctrl + X`).

Agora ative o site criando um link simbolico:

```bash
sudo ln -s /etc/nginx/sites-available/parceria /etc/nginx/sites-enabled/
```

Remova o site padrao do Nginx (para evitar conflito na porta 80):

```bash
sudo rm /etc/nginx/sites-enabled/default
```

Teste se a configuracao esta correta (sem erros de sintaxe):

```bash
sudo nginx -t
```

Deve retornar:

```
nginx: configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

Reinicie o Nginx para aplicar:

```bash
sudo systemctl restart nginx
```

---

### 10. Testar na VM

Faca um teste rapido para ver se o Nginx esta servindo a aplicacao:

```bash
curl -I http://localhost
```

Deve retornar `HTTP/1.1 200 OK`. Para ver o HTML:

```bash
curl http://localhost | head -20
```

Deve mostrar o inicio do HTML da aplicacao (com tags como `<div id="root">`).

Se aparecer `200 OK` e o HTML correto, a aplicacao esta rodando na VM.

---

### 11. Atualizar o Supabase (no seu computador)

Apos o dominio estar funcionando, atualize as configuracoes no Supabase.
Isso e feito no **seu navegador**, nao na VM:

1. Acesse https://supabase.com/dashboard
2. Selecione o projeto
3. Va em **Authentication > URL Configuration**
4. Altere o **Site URL** para: `https://parceria.agirsaude.com.br`
5. Em **Redirect URLs**, adicione: `https://parceria.agirsaude.com.br/**`
6. Mantenha as URLs antigas (da Vercel) temporariamente para nao quebrar sessoes ativas

---

### 12. Remover o deploy da Vercel (no seu computador)

Apos confirmar que tudo funciona no novo dominio:

1. Acesse https://vercel.com
2. Va no projeto ParcerIA
3. Em **Settings > General**, role ate o final
4. Clique em **Delete Project**

> So faca isso apos validar que o novo dominio esta 100% funcional.

---

### 13. Atualizar a aplicacao manualmente (deploy manual)

Toda vez que voce fizer alteracoes no codigo e der push para o GitHub, acesse a
VM via PuTTY e execute:

```bash
cd /var/www/parceria
git pull
npm install
npm run build
sudo systemctl restart nginx
```

Isso:

1. Baixa as ultimas alteracoes do GitHub (`git pull`)
2. Atualiza dependencias se houver mudancas (`npm install`)
3. Gera o novo build (`npm run build`)
4. Reinicia o Nginx (`sudo systemctl restart nginx`)

> O `sudo systemctl restart nginx` nem sempre e necessario (o Nginx serve arquivos
> estaticos direto do disco), mas garante que nao haja cache.

---

### 14. (Opcional) Deploy automatico com GitHub Actions

Para que a VM atualize automaticamente a cada push no GitHub, voce pode configurar
um pipeline de CI/CD com GitHub Actions.

#### 14.1. Na VM, gere uma chave SSH para o GitHub Actions

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/deploy_key -N ""
```

Copie a chave publica:

```bash
cat ~/.ssh/deploy_key.pub
```

Adicione essa chave publica ao arquivo de chaves autorizadas da VM:

```bash
cat ~/.ssh/deploy_key.pub >> ~/.ssh/authorized_keys
```

Copie a chave privada (voce vai precisar dela no proximo passo):

```bash
cat ~/.ssh/deploy_key
```

> Selecione todo o conteudo (de `-----BEGIN` ate `-----END`) e copie.

#### 14.2. No GitHub, configure os secrets

No repositorio do GitHub, va em **Settings > Secrets and variables > Actions**.
Crie os seguintes secrets:

| Nome         | Valor                                                              |
| ------------ | ------------------------------------------------------------------ |
| `VM_SSH_KEY` | Conteudo da chave privada (`~/.ssh/deploy_key`)                    |
| `VM_HOST`    | IP publico da VM (ou IP privado se o runner estiver na mesma rede) |
| `VM_USER`    | `admin`                                                            |

#### 14.3. Crie o arquivo de workflow

No seu projeto local (VS Code), crie o arquivo `.github/workflows/deploy.yml`:

```yaml
name: Deploy ParcerIA

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VM_HOST }}
          username: ${{ secrets.VM_USER }}
          key: ${{ secrets.VM_SSH_KEY }}
          script: |
            cd /var/www/parceria
            git pull origin main
            npm install
            npm run build
            sudo systemctl restart nginx
```

Faca commit e push desse arquivo. A partir de agora, **todo push na branch `main`**
vai disparar o deploy automatico na VM.

> **Importante:** Para que o GitHub Actions alcance a VM, ela precisa ter um IP publico
> ou o runner precisa estar na mesma rede. Isso depende da configuracao da TI
> (veja PARTE 2).

---

## PARTE 2 - Pendencias com a TI (infraestrutura AWS)

Os itens abaixo sao responsabilidade da equipe de TI e necessarios para que a
aplicacao fique acessivel pela internet.

### 2.1. Security Group da EC2

Liberar as seguintes portas de entrada (inbound rules) no Security Group da instancia:

| Porta | Protocolo | Origem                | Finalidade                            |
| ----- | --------- | --------------------- | ------------------------------------- |
| 80    | TCP       | 0.0.0.0/0 (ou do ALB) | HTTP                                  |
| 443   | TCP       | 0.0.0.0/0 (ou do ALB) | HTTPS                                 |
| 22    | TCP       | IP da rede Agir Saude | SSH (acesso remoto - manter restrito) |

> Se for usar ALB, as portas 80/443 podem ser abertas apenas para o ALB,
> e o ALB fica exposto para 0.0.0.0/0.

### 2.2. Expor a instancia para a internet

A instancia tem IP privado `10.12.1.69`. Opcoes para acesso externo via AWS:

**Opcao recomendada - Application Load Balancer (ALB):**

- Criar um ALB publico na mesma VPC
- Criar um Target Group apontando para a instancia EC2 (porta 80)
- Configurar listener na porta 443 (HTTPS) com certificado SSL do ACM
- Configurar listener na porta 80 com redirect automatico para 443
- O ALB fica na subnet publica; a EC2 pode permanecer na subnet privada (mais seguro)

**Opcao alternativa - Elastic IP:**

- Associar um Elastic IP (IP publico fixo) diretamente a instancia EC2
- Mais simples, porem a EC2 fica exposta diretamente (menos seguro)
- O SSL teria que ser configurado diretamente no Nginx com Certbot/Let's Encrypt

### 2.3. Certificado SSL (HTTPS) via AWS Certificate Manager (ACM)

1. No console AWS, acessar **Certificate Manager (ACM)**
2. Solicitar um certificado publico para: `parceria.agirsaude.com.br`
3. Validar via DNS (o ACM fornece um registro CNAME de validacao)
4. Apos validado, associar o certificado ao ALB (listener 443)

> O ACM emite e renova certificados SSL **gratuitamente** quando usados com ALB.

### 2.4. DNS via Route 53

1. No console AWS, acessar **Route 53**
2. Na hosted zone do dominio da empresa (ex: `agirsaude.com.br`), criar o registro:

| Tipo          | Nome                        | Valor                                    |
| ------------- | --------------------------- | ---------------------------------------- |
| **A (Alias)** | `parceria.agirsaude.com.br` | Apontar para o ALB (selecionar na lista) |

> Se usar Elastic IP em vez de ALB, o registro A aponta diretamente para o Elastic IP.

### 2.5. Redirect HTTP -> HTTPS

Se usar ALB, configurar o listener da porta 80 para **redirecionar automaticamente**
para 443. Isso garante que todos os acessos usem HTTPS.

---

## Mensagem sugerida para a TI

> Ola! Sobre a aplicacao ParcerIA na VM `42_WEBAPP_DAHERLAB_PRD` (IP `10.12.1.69`),
> precisamos que ela fique acessivel pela internet. Como usamos AWS, segue o que
> seria necessario:
>
> 1. **Security Group** - liberar portas 80 e 443 (inbound) na instancia EC2
> 2. **Application Load Balancer** - criar um ALB publico apontando para a EC2
>    na porta 80 (ou, se preferirem, associar um Elastic IP)
> 3. **Certificado SSL** - emitir um certificado no ACM para
>    `parceria.agirsaude.com.br` e associar ao ALB
> 4. **DNS (Route 53)** - criar registro A (alias) para
>    `parceria.agirsaude.com.br` apontando para o ALB
> 5. **Redirect HTTP->HTTPS** - configurar no ALB o redirect da porta 80 para 443
>
> Do meu lado, a aplicacao ja esta configurada e rodando na VM com Nginx.
> Falta apenas a parte de rede/DNS/SSL para ficar acessivel externamente.
>
> Qualquer duvida sobre a aplicacao, estou a disposicao. Obrigado!

---

## Resumo: checklist de validacao

### Sua parte (VM):

- [ ] Conseguiu acessar a VM via PuTTY (SSH)
- [ ] Sistema atualizado (`sudo apt update && sudo apt upgrade`)
- [ ] Node.js instalado (`node --version` funciona)
- [ ] Git instalado (`git --version` funciona)
- [ ] Repositorio clonado em `/var/www/parceria`
- [ ] Arquivo `.env` configurado com as variaveis do Supabase
- [ ] `npm run build` executado com sucesso (pasta `dist/` criada)
- [ ] Nginx instalado e rodando (`sudo systemctl status nginx`)
- [ ] Site ParcerIA configurado no Nginx
- [ ] `curl http://localhost` retorna o HTML da aplicacao
- [ ] URLs atualizadas no dashboard do Supabase
- [ ] (Opcional) GitHub Actions configurado para deploy automatico

### Parte da TI (AWS):

- [ ] Security Group com portas 80/443 liberadas
- [ ] ALB criado e apontando para a EC2 (ou Elastic IP associado)
- [ ] Certificado SSL emitido no ACM e validado
- [ ] Certificado associado ao listener 443 do ALB
- [ ] Redirect HTTP -> HTTPS configurado no ALB
- [ ] Registro DNS `parceria.agirsaude.com.br` criado no Route 53

### Pos-deploy:

- [ ] Aplicacao acessivel via `https://parceria.agirsaude.com.br`
- [ ] HTTPS funcionando (cadeado verde no navegador)
- [ ] Rotas internas funcionando (ex: acessar `/login` diretamente no navegador)
- [ ] Login/autenticacao do Supabase funcionando com o novo dominio
- [ ] Deploy da Vercel removido
