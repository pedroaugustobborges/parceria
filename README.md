# ParcerIA - Sistema de Gestão de Acessos

![ParcerIA Logo](public/logodaagir.png)

## Sobre o Projeto

ParcerIA é um SaaS desenvolvido para auxiliar a equipe de gestão financeira da Agir Saúde no acompanhamento, gestão e controle de contratos com equipes terceiras. O sistema integra-se com catracas de reconhecimento facial para monitorar e calcular as horas trabalhadas pelos colaboradores terceirizados.

### Características Principais

- **Autenticação Segura**: Sistema de login com diferentes níveis de acesso
- **Dashboard Inteligente**: Visualização de acessos com cálculo automático de horas trabalhadas
- **Filtros Avançados**: Pesquisa por tipo, matrícula, nome, CPF e intervalos de data
- **Gestão de Usuários**: Cadastro e gerenciamento de usuários com diferentes permissões
- **Gestão de Contratos**: Controle completo de contratos com empresas terceiras
- **Interface Moderna**: Design responsivo com tema inspirado em parceria e inovação

## Tecnologias Utilizadas

- **Frontend**:
  - React 18 com TypeScript
  - Material-UI (MUI) v5
  - Tailwind CSS
  - React Router v6
  - Date-fns para manipulação de datas
  - MUI DataGrid para tabelas avançadas

- **Backend**:
  - Supabase (PostgreSQL)
  - Supabase Auth para autenticação
  - Row Level Security (RLS) para segurança de dados

- **Build Tool**:
  - Vite

## Tipos de Usuário

### 1. Administrador Agir
- Acesso total ao sistema
- Visualiza todos os acessos
- Gerencia usuários e permissões
- Gerencia contratos

### 2. Administrador Terceiro
- Acesso ao dashboard
- Visualiza apenas dados de seus colaboradores
- Dados filtrados por contrato

### 3. Terceiro
- Acesso ao dashboard
- Visualiza apenas seus próprios dados

## Pré-requisitos

- Node.js 18+ instalado
- Conta no Supabase
- npm ou yarn

## Configuração do Projeto

### 1. Clone o repositório

```bash
git clone <url-do-repositorio>
cd gestaodeacesso
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure as variáveis de ambiente

O arquivo `.env` já está configurado com as credenciais do Supabase. Caso precise alterar:

```env
VITE_SUPABASE_URL=sua-url-do-supabase
VITE_SUPABASE_ANON_KEY=sua-chave-anon
VITE_SUPABASE_SERVICE_ROLE_KEY=sua-chave-service-role
```

### 4. Configure o banco de dados no Supabase

1. Acesse seu projeto no Supabase
2. Vá para SQL Editor
3. Execute o script `supabase-init.sql`
4. Aguarde a criação de todas as tabelas e políticas

### 5. Crie o primeiro usuário administrador

No Supabase:

1. Vá para Authentication > Users
2. Clique em "Add user"
3. Crie um usuário com email e senha
4. Copie o UUID do usuário criado
5. No SQL Editor, execute:

```sql
INSERT INTO usuarios (id, email, nome, cpf, tipo)
VALUES ('UUID_DO_USUARIO', 'seu-email@exemplo.com', 'Seu Nome', '00000000000', 'administrador-agir');
```

### 6. Importe os dados de acessos (opcional)

Se você tiver o arquivo `Acessos.csv`, crie um script para importar os dados para a tabela `acessos`.

## Executando o Projeto

### Modo de Desenvolvimento

```bash
npm run dev
```

O projeto estará disponível em `http://localhost:5173`

### Build para Produção

```bash
npm run build
```

### Preview da Build

```bash
npm run preview
```

## Estrutura do Projeto

```
gestaodeacesso/
├── public/
│   └── logodaagir.png          # Logo da Agir Saúde
├── src/
│   ├── components/
│   │   ├── auth/
│   │   │   └── ProtectedRoute.tsx
│   │   └── layout/
│   │       └── Layout.tsx
│   ├── contexts/
│   │   └── AuthContext.tsx
│   ├── lib/
│   │   ├── supabase.ts
│   │   └── theme.ts
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Usuarios.tsx
│   │   └── Contratos.tsx
│   ├── types/
│   │   └── database.types.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── .env
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── supabase-init.sql
└── README.md
```

## Funcionalidades Detalhadas

### Dashboard de Acessos

- **Estatísticas em Tempo Real**:
  - Total de pessoas
  - Total de horas trabalhadas
  - Média de horas por pessoa

- **Filtros Avançados**:
  - Tipo (com autocomplete)
  - Matrícula (com autocomplete)
  - Nome (com autocomplete)
  - CPF (com autocomplete)
  - Intervalo de datas (início e fim)

- **Cálculo de Horas**:
  - Sistema pareador de entradas e saídas
  - Cálculo automático baseado em data_acesso
  - Sentido 'E' (Entrada) e 'S' (Saída)

- **Tabela DataGrid**:
  - Ordenação por colunas
  - Paginação
  - Busca rápida
  - Export de dados

### Gestão de Usuários

- Criar, editar e excluir usuários
- Atribuir tipos de acesso
- Vincular usuários a contratos
- Visualizar histórico de cadastro

### Gestão de Contratos

- Criar, editar e excluir contratos
- Definir datas de início e fim
- Ativar/desativar contratos
- Associar usuários terceiros

## Segurança

O sistema implementa múltiplas camadas de segurança:

1. **Autenticação**: Via Supabase Auth com JWT
2. **Row Level Security (RLS)**: Políticas no banco de dados
3. **Rotas Protegidas**: Validação no frontend
4. **Controle de Acesso**: Baseado em tipos de usuário

## Design e UX

O tema visual do ParcerIA foi desenvolvido com:

- **Cores Principais**:
  - Sky Blue (#0ea5e9): Representa parceria e conexão
  - Purple (#8b5cf6): Representa inovação e IA

- **Tipografia**: Inter (moderna e legível)
- **Componentes**: Material-UI com customizações
- **Responsividade**: Mobile-first approach
- **Ícones**: Material Icons

## Roadmap Futuro

- [ ] Integração com IA para análise preditiva
- [ ] Relatórios avançados em PDF
- [ ] Notificações em tempo real
- [ ] Dashboard de análise financeira
- [ ] App mobile
- [ ] Integração com sistemas de folha de pagamento

## Suporte e Contato

Para dúvidas ou suporte, entre em contato com a equipe de TI da Agir Saúde.

## Licença

© 2024 Agir Saúde - Todos os direitos reservados
