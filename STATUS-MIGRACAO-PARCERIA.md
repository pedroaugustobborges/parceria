# ParcerIA — Documento de Status da Migração

**Data:** Junho 2026  
**Responsável técnico:** Pedro Borges  
**Versão:** 1.0

---

# PARTE 1 — PARA A DIRETORIA

## O que é o ParcerIA?

O ParcerIA é o sistema interno da Agir para gestão de acesso e contratos de terceiros nas unidades hospitalares (HUGOL, HECAD, CRER). Ele permite controlar quem entra e sai, gerenciar contratos com parceiros, acompanhar produtividade de médicos, e conta com um assistente de inteligência artificial para análise de dados e documentos.

---

## O que estava acontecendo antes?

O sistema funcionava dividido em dois serviços externos pagos:

| Serviço      | Função                                                               | Custo              |
| ------------ | -------------------------------------------------------------------- | ------------------ |
| **Vercel**   | Hospedava a tela do sistema (o que o usuário vê no navegador)        | Plano pago por uso |
| **Supabase** | Banco de dados, autenticação de usuários e armazenamento de arquivos | Plano pago mensal  |

Ambos funcionam "na nuvem" — ou seja, os dados e o sistema ficavam em servidores de empresas americanas.

---

## Como o sistema fica acessível publicamente?

A VM não tem IP público (acesso direto). O serviço fica público através da infraestrutura da Agir:

```
Internet → Route 53 (DNS) → ALB (IP público, HTTPS/443) → VM 10.12.1.170 (HTTP/80)
```

O ALB (Application Load Balancer) já é usado por outros sistemas da Agir com esse mesmo padrão. O certificado SSL fica no ALB (via ACM — AWS Certificate Manager). Nenhum software de certificado precisa ser instalado na VM.

---

## O que foi decidido migrar?

Após análise, a decisão foi:

- **Sair do Vercel** → a tela do sistema passa a rodar em uma máquina virtual (VM) fornecida pela TI da Agir na AWS
- **Manter o Supabase** → o banco de dados, autenticação e arquivos continuam no Supabase gerenciado (sem mudança para o usuário final)

Essa decisão foi tomada porque:

1. Elimina o custo do Vercel
2. Coloca o controle da aplicação dentro da infraestrutura da Agir
3. Evita a complexidade e o risco de migrar o banco de dados

---

## Qual é o status atual?

| Etapa                                                      | Status                                       |
| ---------------------------------------------------------- | -------------------------------------------- |
| Servidor AWS configurado com Node.js e Nginx               | ✅ Concluído                                 |
| Sistema buildado e publicado no servidor                   | ✅ Concluído                                 |
| Nginx configurado para servir o sistema (porta 80)         | ✅ Concluído                                 |
| Sistema validado e acessível (via VPN)                     | ✅ Concluído — login e navegação funcionando |
| Certificado SSL emitido no ACM (AWS Certificate Manager)   | ⏳ Aguardando TI (Carlos)                   |
| Target Group no ALB apontando para a VM (porta 80)         | ⏳ Aguardando TI (Carlos)                   |
| Listener HTTPS (443) no ALB com certificado ACM            | ⏳ Aguardando TI (Carlos)                   |
| Registro DNS no Route 53 apontando para o ALB              | ⏳ Aguardando TI (Carlos)                   |
| Security Group da VM liberando porta 80 do ALB             | ⏳ Aguardando TI (Carlos)                   |
| URL de produção configurada no Supabase (Redirect URLs)    | ⏳ Aguardando domínio final                  |
| Certificado de segurança HTTPS ativo                       | ⏳ Aguardando etapas acima                  |

**Arquitetura confirmada:** A VM não tem IP público — o acesso externo passa pelo ALB da Agir (Route 53 → ALB → VM).  
**Em resumo:** o sistema está pronto e rodando. O que falta é o TI (Carlos) configurar o ALB e o DNS no Route 53.

---

## Quanto custa?

| Item                            | Antes        | Depois                     |
| ------------------------------- | ------------ | -------------------------- |
| Vercel (hospedagem do frontend) | Custo mensal | **Eliminado**              |
| Supabase (banco de dados)       | Custo mensal | Mantido (sem mudança)      |
| VM AWS (fornecida pela TI Agir) | —            | Custo já coberto pela Agir |

A migração **reduz custo** ao eliminar o Vercel, sem adicionar novos custos além da VM que a TI já provisionou.

---

## Quando vai estar pronto para uso?

O sistema já funciona tecnicamente. Faltam apenas dois passos burocráticos/administrativos:

1. **TI liberar a porta 80/443** no firewall da AWS (Security Group) — estimativa: menos de 1 hora de trabalho
2. **TI apontar o domínio** escolhido para o IP `10.12.1.170` — estimativa: até 24h para propagação do DNS

---

---

# PARTE 2 — PARA O TIME DE TI

## Glossário: o que é cada tecnologia no contexto do ParcerIA

### O que é o Route 53?

Route 53 é o serviço de DNS (Domain Name System) da AWS — funciona como a "lista telefônica" da internet. Quando um usuário digita `parceria.agir.com.br` no navegador, o Route 53 é consultado para saber para onde deve ser direcionada essa requisição.

**No contexto do ParcerIA:** o Route 53 terá um registro que diz "quando alguém acessar `parceria.agir.com.br`, encaminhe para o ALB da Agir". Sem esse registro, o endereço simplesmente não existe na internet — ninguém consegue acessar o sistema pelo nome.

**Analogia:** pense no Route 53 como o GPS da empresa. O usuário diz o destino (`parceria.agir.com.br`) e o GPS diz qual caminho pegar (o ALB).

---

### O que é o ALB (Application Load Balancer)?

ALB é um serviço da AWS que recebe o tráfego da internet e o distribui para uma ou mais máquinas virtuais internas. Ele é o único ponto com IP público — a VM em si fica protegida, sem exposição direta.

**No contexto do ParcerIA:** o ALB recebe as requisições HTTPS vindas da internet e as repassa para a VM `10.12.1.170` na porta 80. A Agir já usa esse padrão para outros sistemas — o ParcerIA entrará no mesmo ALB existente, com uma nova regra de roteamento.

**Analogia:** o ALB é a recepção do hospital. Quem chega de fora fala com a recepção (ALB), que então direciona a pessoa para o setor correto (a VM).

---

### O que é SSL e o certificado SSL?

SSL (Secure Sockets Layer, hoje tecnicamente chamado de TLS) é o protocolo que criptografa a comunicação entre o navegador do usuário e o servidor. É o que faz o endereço começar com `https://` em vez de `http://`, e exibe o cadeado na barra do navegador.

O **certificado SSL** é um arquivo digital que prova que o servidor é legítimo — ele é emitido por uma autoridade certificadora (como a Amazon com o ACM) e contém o nome do domínio para o qual é válido.

**No contexto do ParcerIA:** sem certificado, o navegador exibe aviso de "conexão não segura" e muitos usuários (e o próprio navegador) bloqueiam o acesso. Com o certificado no ALB, toda a comunicação entre o usuário e o sistema é criptografada e o cadeado aparece normalmente.

---

### O que é o ACM (AWS Certificate Manager)?

ACM é o serviço da AWS que emite e gerencia certificados SSL gratuitamente para domínios hospedados na AWS. Diferente do Let's Encrypt (que exige acesso direto ao servidor), o ACM valida o domínio via DNS — basta adicionar um registro no Route 53, que é automático quando ambos estão na mesma conta AWS.

**No contexto do ParcerIA:** como a VM não tem IP público, o Certbot (método tradicional) não funciona. O ACM resolve isso — o certificado fica instalado no ALB, não na VM. A renovação é automática e sem prazo de validade visível para o usuário.

**Analogia:** o ACM é como a carteira de identidade do sistema. Ele prova para o navegador do usuário que `parceria.agir.com.br` é mesmo o sistema da Agir, e não um site falso.

---

### O que é o Target Group?

Target Group (grupo de destino) é uma configuração do ALB que define quais máquinas receberão o tráfego e como verificar se estão funcionando. O ALB não encaminha para um IP diretamente — ele encaminha para um Target Group, que por sua vez contém as instâncias.

**No contexto do ParcerIA:** será criado um Target Group com a instância `10.12.1.170` na porta 80. O ALB faz periodicamente uma verificação de saúde (health check) — uma requisição simples ao endereço `/` esperando resposta 200 OK. Se a VM estiver respondendo, o ALB envia tráfego para ela. Se não estiver (VM desligada, Nginx parado), o ALB para de enviar tráfego automaticamente.

**Analogia:** o Target Group é a lista de funcionários disponíveis. Antes de encaminhar um visitante (requisição), a recepção (ALB) verifica quem está presente e apto para atender.

---

### O que é o Nginx?

Nginx (pronuncia-se "engine-x") é um servidor web — funciona como o "porteiro" do sistema. Quando um usuário digita o endereço do ParcerIA no navegador, o Nginx é o primeiro a receber essa solicitação. Ele olha o que está sendo pedido e entrega o arquivo correto (a tela de login, o dashboard, etc.).

**No contexto do ParcerIA:** o Nginx está instalado na VM AWS e serve os arquivos estáticos do sistema (HTML, CSS, JavaScript) para o navegador do usuário. Ele também garante que qualquer rota do sistema (como `/dashboard` ou `/contratos`) funcione corretamente — sem ele, o usuário receberia erro 404 ao tentar acessar uma página diretamente ou ao pressionar F5.

### O que é o Node.js?

Node.js é um ambiente de execução JavaScript que permite rodar código JavaScript fora do navegador, diretamente no servidor. No contexto do ParcerIA, o Node.js **não roda em produção** — ele é usado apenas para **construir** o sistema.

**No contexto do ParcerIA:** o código-fonte do ParcerIA é escrito em React (uma biblioteca JavaScript). Para que esse código funcione no navegador de qualquer usuário, ele precisa ser "compilado" — transformado em arquivos otimizados (HTML, CSS e JS minificados). O Node.js executa essa compilação através do comando `npm run build`. O resultado é a pasta `dist/`, que contém o sistema pronto para ser entregue pelo Nginx.

**Analogia:** pense no Node.js como uma gráfica. O código-fonte é o arquivo editável do designer. A gráfica (Node.js) transforma esse arquivo em material impresso (pasta `dist/`) para ser distribuído. Após a impressão, a gráfica não participa mais — quem entrega o material é o Nginx.

### O que é o Supabase?

Supabase é uma plataforma que fornece, em conjunto:

- **Banco de dados** (PostgreSQL): onde ficam todos os dados — usuários, contratos, acessos, escalas médicas
- **Autenticação**: o sistema de login, logout e reset de senha
- **Armazenamento de arquivos**: onde ficam os PDFs de contratos e documentos de gestão
- **Edge Functions**: os programas de inteligência artificial (chat, geração de insights, processamento de PDFs)

**No contexto do ParcerIA:** o Supabase **permanece gerenciado** pela própria empresa Supabase (hospedado nos servidores deles). Nenhum dado foi movido. O sistema na VM AWS se comunica com o Supabase exatamente como fazia quando estava no Vercel — via internet, usando chaves de API seguras.

### O que é o React?

React é a biblioteca com a qual o ParcerIA foi construído. É o código que define cada tela, botão, tabela e comportamento do sistema. O código React é transformado pelo Node.js em arquivos que qualquer navegador consegue entender.

### O que é um "build"?

Build é o processo de pegar o código-fonte (escrito pelos desenvolvedores) e transformá-lo em arquivos prontos para produção. No ParcerIA, o build:

- Compacta e otimiza todos os arquivos JavaScript (de ~50 MB de código-fonte para ~3 MB entregues ao navegador)
- Gera nomes de arquivo com hash (ex: `index-BICqv7OR.js`) para garantir que o navegador sempre carregue a versão mais recente
- Incorpora as variáveis de ambiente (URL do Supabase, chaves de API)

**Importante:** sempre que o código do sistema for atualizado, um novo build precisa ser gerado e publicado.

---

## O que foi feito passo a passo

### 1. Configuração inicial do servidor

No servidor AWS (`10.12.1.170`), foram instalados:

- **Node.js 20**: para gerar o build do sistema
- **Git**: para baixar o código do repositório Gitea
- **Nginx**: para servir o sistema aos usuários
- **rsync**: para copiar os arquivos do build para o diretório do Nginx

### 2. Clone do repositório

O código-fonte foi clonado do Gitea interno da Agir:

```
http://10.12.1.251:8000/pedro.borges/parceria
```

Destino no servidor: `/opt/parceria/`

### 3. Configuração das variáveis de ambiente

Foi criado o arquivo `/opt/parceria/.env.production` com as credenciais do Supabase gerenciado. Esse arquivo aponta o sistema para o banco de dados correto e não contém a chave de administrador do banco (por segurança).

### 4. Build do sistema

Executado `npm run build` dentro de `/opt/parceria/`. O processo levou ~11 minutos e gerou a pasta `dist/` com os arquivos prontos para produção.

Arquivos gerados:

```
dist/
├── index.html                  (0.74 kB)
├── assets/
│   ├── index-BICqv7OR.css     (5.92 kB)
│   ├── index-B1fS6wJl.js      (2.88 MB — bundle principal)
│   └── ... (outros chunks)
├── logodaagir.png
└── manual-usuario.html
```

### 5. Publicação no Nginx

Os arquivos foram copiados para `/var/www/parceria/` e o Nginx foi configurado para servi-los.

### 6. Configuração do Nginx

O arquivo `/etc/nginx/sites-available/parceria` já existia com configuração prévia compatível. Foi adicionado o header `Referrer-Policy` e confirmado que o symlink `/etc/nginx/sites-enabled/parceria` já estava ativo.

A configuração inclui:

- SPA fallback (rotas do React funcionam sem erro 404)
- Cache agressivo de assets estáticos (performance)
- Headers de segurança
- Compressão gzip

---

## Problemas encontrados e como foram resolvidos

| Problema                                                        | Causa                                                            | Solução                                                                                |
| --------------------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `rsync: command not found`                                      | rsync não estava instalado por padrão                            | `sudo apt install -y rsync`                                                            |
| Symlink já existia (`ln: File exists`)                          | Arquivo de configuração Nginx já tinha sido criado anteriormente | Ignorado — o symlink já estava correto                                                 |
| Site inacessível (`ERR_CONNECTION_TIMED_OUT`)                   | Security Group AWS bloqueando porta 80                           | **Pendente com TI**                                                                    |
| Disco com 14 GB livres (insuficiente para Supabase self-hosted) | VM provisionada com 20 GB                                        | Contornado: decisão de manter Supabase gerenciado elimina a necessidade de mais espaço |

---

## Como o Supabase funciona neste contexto

```
Navegador do usuário
        │
        │ HTTPS (porta 443)
        ▼
   VM AWS 10.12.1.170
   Nginx serve o sistema React
        │
        │ O sistema React faz chamadas de API
        │ diretamente do navegador do usuário
        ▼
   Supabase Gerenciado
   https://qszqzdnlhxpglllyqtht.supabase.co
   ├── Banco de dados (tabelas, RLS, queries)
   ├── Autenticação (login, tokens JWT)
   ├── Storage (PDFs dos contratos)
   └── Edge Functions (chat IA, insights, processamento PDF)
```

**Ponto importante:** o Nginx na VM **não faz proxy** para o Supabase. As chamadas ao banco de dados, autenticação e IA partem diretamente do navegador do usuário para os servidores do Supabase. A VM serve apenas os arquivos estáticos do sistema.

**Implicação:** se o Supabase tiver instabilidade, o sistema exibirá erros independentemente do status da VM. O monitoramento do Supabase pode ser feito em `status.supabase.com`.

---

## O que o TI precisa fazer

> **Contexto:** a VM não tem IP público. O padrão da Agir é usar Route 53 → ALB → instância, igual a outros serviços. Carlos confirmou isso.

### Tarefa 1 — Emitir certificado SSL no ACM (~15 min)

- AWS Console → **Certificate Manager** → Request certificate
- Tipo: Public certificate
- Domínio: `parceria.agir.com.br` (confirmar o subdomínio com Pedro/diretoria)
- Validação: DNS — se o domínio já está no Route 53, a validação é automática
- Aguardar status `Issued`

### Tarefa 2 — Configurar Target Group no ALB (~15 min)

- AWS Console → **EC2** → Target Groups → Create target group
  - Target type: `Instances`
  - Protocol: `HTTP` / Port: `80`
  - Health check: `HTTP`, path `/`
- Registrar a instância `10.12.1.170` como target (porta 80)
- Associar esse Target Group ao ALB existente da Agir

### Tarefa 3 — Adicionar Listener HTTPS no ALB (~10 min)

- No ALB existente da Agir: adicionar (ou verificar) Listener na porta `443`
- Protocolo: HTTPS
- Certificado: o emitido na Tarefa 1 (ACM)
- Ação: Forward → Target Group criado na Tarefa 2

### Tarefa 4 — Criar registro no Route 53 (~5 min)

- AWS Console → **Route 53** → Hosted Zone do domínio agir.com.br
- Criar registro:
  - Tipo: `A` — **Alias**
  - Nome: `parceria` (resulta em `parceria.agir.com.br`)
  - Alias target: DNS name do ALB (ex: `agir-alb-xxxxxxx.us-east-1.elb.amazonaws.com`)

### Tarefa 5 — Liberar porta 80 no Security Group da VM (~5 min)

- Security Group da instância `10.12.1.170`:
  - Adicionar regra de entrada: HTTP / TCP / 80 / origem = Security Group do ALB
  - **Não abrir porta 80 para 0.0.0.0/0** — apenas o ALB deve acessar diretamente

### Tarefa 6 — Avisar Pedro Borges após concluir as tarefas acima

Pedro executa na VM (apenas verificação e Supabase):

```bash
# Verificar server_name no Nginx
sudo grep server_name /etc/nginx/sites-available/parceria
# Deve mostrar: server_name parceria.agir.com.br;

# Se precisar ajustar:
sudo sed -i 's|server_name .*;|server_name parceria.agir.com.br;|' \
  /etc/nginx/sites-available/parceria
sudo nginx -t && sudo systemctl reload nginx
```

Depois acessar `app.supabase.com` → projeto → Authentication → URL Configuration:
- **Site URL**: `https://parceria.agir.com.br`
- **Redirect URLs**: adicionar `https://parceria.agir.com.br/**`

---

## Perguntas e Respostas — Para o TI

**P: O sistema usa Docker?**  
R: Não. O frontend (React) é servido diretamente pelo Nginx como arquivos estáticos. Não há containers rodando.

**P: Tem algum processo Node.js rodando continuamente?**  
R: Não. O Node.js foi usado apenas para gerar o build. Em produção, só o Nginx está rodando.

**P: O que precisa estar sempre ligado na VM para o sistema funcionar?**  
R: Apenas o Nginx. Ele já está configurado para iniciar automaticamente com o servidor. Para verificar:

```bash
sudo systemctl status nginx
```

**P: Como atualizar o sistema quando houver nova versão?**  
R: Executar o script de deploy:

```bash
sudo bash /opt/scripts/deploy-frontend.sh
```

Esse script puxa o código novo do Gitea, gera o build e publica automaticamente.

**P: O banco de dados fica na VM?**  
R: Não. O banco de dados, autenticação e arquivos ficam no Supabase gerenciado (servidores da empresa Supabase). A VM só serve as telas do sistema.

**P: Precisa de backup da VM?**  
R: Os dados em si não ficam na VM. O que precisa de backup é:

- O arquivo `/opt/parceria/.env.production` (contém as chaves do Supabase)
- O arquivo `/etc/nginx/sites-available/parceria` (configuração do Nginx)
  O código-fonte está no Gitea e o banco no Supabase — ambos já têm seus próprios backups.

**P: Quanto de CPU e RAM o sistema usa?**  
R: O Nginx em repouso usa menos de 50 MB de RAM e praticamente 0% de CPU. O processamento pesado (IA, banco de dados) acontece nos servidores do Supabase, não na VM.

**P: O certificado SSL precisa ser renovado?**  
R: Sim, o certificado Let's Encrypt dura 90 dias. O Certbot configura renovação automática via systemd timer. Não requer intervenção manual.

**P: Como apontar o domínio se a VM tem IP privado (10.x.x.x)?**  
R: Confirmado com o TI (Carlos): a Agir já usa esse padrão para outros serviços. O DNS aponta para o ALB (que tem IP público), e o ALB encaminha o tráfego para a VM internamente. O registro no Route 53 deve ser do tipo A Alias apontando para o DNS name do ALB, não para o IP `10.12.1.170` diretamente.

---

## Perguntas e Respostas — Para a Diretoria

**P: O sistema já está funcionando?**  
R: Tecnicamente sim — o sistema está instalado, configurado e pronto no servidor. O que impede o acesso externo agora é uma configuração de firewall que precisa ser ajustada pelo TI (liberar as portas 80 e 443). Isso leva menos de uma hora de trabalho.

**P: Os usuários precisarão criar uma nova conta?**  
R: Não. O banco de dados e o sistema de login continuam no Supabase, sem qualquer alteração. Usuários, senhas e histórico estão preservados.

**P: Os dados estão seguros durante e após a migração?**  
R: Sim. Os dados (contratos, acessos, produtividade) permanecem no Supabase, que não foi tocado nesta migração. A mudança foi apenas no endereço de onde o sistema é servido — equivalente a mudar o endereço de uma loja sem mexer no estoque.

**P: O que acontece se o servidor cair?**  
R: O Nginx é configurado para reiniciar automaticamente. Se a VM inteira cair, o TI precisará reiniciá-la pelo Console AWS. Os dados no Supabase não são afetados. Tempo estimado para recuperação: 2 a 5 minutos.

**P: A URL do sistema vai mudar?**  
R: Sim, a URL mudará do endereço Vercel atual para o domínio que a Agir escolher (ex: `parceria.agir.com.br`). Os usuários precisarão ser informados da nova URL. O acesso continua por navegador normalmente.

**P: Economizamos algo com essa mudança?**  
R: Sim. O custo mensal do Vercel é eliminado. O Supabase continua com o mesmo custo de antes. A VM AWS já estava provisionada pela TI e não gera custo adicional para este sistema.

**P: O assistente de IA continua funcionando?**  
R: Sim. O assistente de IA (chat, insights, processamento de PDFs) roda nos servidores do Supabase e da OpenAI — não foi afetado pela migração.

---

## Resumo de Responsabilidades — Próximos Passos

| Ação                                                        | Responsável           | Prazo estimado                        |
| ----------------------------------------------------------- | --------------------- | ------------------------------------- |
| Definir o subdomínio final (ex: parceria.agir.com.br)       | Diretoria / TI        | A definir                             |
| Emitir certificado SSL no ACM                               | TI Agir (Carlos)      | ~15 min                               |
| Configurar Target Group no ALB (porta 80 → VM)              | TI Agir (Carlos)      | ~15 min                               |
| Listener HTTPS no ALB com certificado ACM                   | TI Agir (Carlos)      | ~10 min                               |
| Registro A Alias no Route 53 → ALB                          | TI Agir (Carlos)      | ~5 min                                |
| Security Group da VM: liberar porta 80 do ALB               | TI Agir (Carlos)      | ~5 min                                |
| Atualizar server_name no Nginx e URL no Supabase            | Pedro Borges          | ~15 min (após TI concluir)            |
| Comunicar usuários com a nova URL                           | Pedro Borges / Gestão | Após HTTPS ativo                      |

**Total estimado de trabalho do TI:** ~50 minutos.
