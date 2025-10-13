# 🚀 Quick Start - ParcerIA

## Instalação em 5 Minutos

### 1. Instalar Dependências
```bash
npm install
```

### 2. Configurar Supabase

Acesse: https://supabase.com/dashboard/project/qszqzdnlhxpgllyqthht

**SQL Editor** → Execute `supabase-init.sql`

### 3. Criar Admin

**Authentication** → **Add User**
- Email: admin@agir.com
- Password: admin123456

Copie o UUID do usuário criado.

**SQL Editor** → Execute:
```sql
INSERT INTO usuarios (id, email, nome, cpf, tipo)
VALUES ('COLE_UUID_AQUI', 'admin@agir.com', 'Administrador', '00000000000', 'administrador-agir');
```

### 4. (Opcional) Dados de Teste

**SQL Editor** → Execute `exemplo-importacao-acessos.sql`

### 5. Iniciar

```bash
npm run dev
```

Acesse: http://localhost:5173

Login:
- Email: admin@agir.com
- Senha: admin123456

## 📁 Estrutura do Projeto

```
gestaodeacesso/
├── public/
│   └── logodaagir.png           # Logo da Agir
├── src/
│   ├── components/
│   │   ├── auth/
│   │   │   └── ProtectedRoute.tsx   # Proteção de rotas
│   │   └── layout/
│   │       └── Layout.tsx           # Layout principal
│   ├── contexts/
│   │   └── AuthContext.tsx          # Context de autenticação
│   ├── lib/
│   │   ├── supabase.ts              # Cliente Supabase
│   │   └── theme.ts                 # Tema Material-UI
│   ├── pages/
│   │   ├── Login.tsx                # Tela de login
│   │   ├── Dashboard.tsx            # Dashboard principal
│   │   ├── Usuarios.tsx             # Gestão de usuários
│   │   └── Contratos.tsx            # Gestão de contratos
│   ├── types/
│   │   └── database.types.ts        # Tipos TypeScript
│   ├── App.tsx                      # App principal
│   ├── main.tsx                     # Entry point
│   └── index.css                    # Estilos globais
├── .env                             # Variáveis de ambiente
├── package.json                     # Dependências
├── tsconfig.json                    # Config TypeScript
├── vite.config.ts                   # Config Vite
├── tailwind.config.js               # Config Tailwind
└── supabase-init.sql                # Script SQL inicial
```

## 🎯 Fluxo de Uso

### Admin Agir
1. Login → Dashboard
2. Criar Contratos
3. Criar Usuários
4. Visualizar Acessos

### Admin Terceiro
1. Login → Dashboard
2. Ver apenas seus colaboradores

### Terceiro
1. Login → Dashboard
2. Ver apenas seus próprios dados

## 🔧 Comandos Úteis

```bash
# Desenvolvimento
npm run dev

# Build para produção
npm run build

# Preview da build
npm run preview

# Lint
npm run lint
```

## 🎨 Tema e Cores

### Cores Principais
- **Primary**: #0ea5e9 (Sky Blue)
- **Secondary**: #8b5cf6 (Purple)
- **Success**: #10b981 (Green)
- **Error**: #ef4444 (Red)

### Gradientes
```css
background: linear-gradient(135deg, #0ea5e9 0%, #8b5cf6 100%);
```

## 📊 Tabelas do Banco

### usuarios
- id, email, nome, cpf, tipo, contrato_id

### contratos
- id, nome, empresa, data_inicio, data_fim, ativo

### acessos
- id, tipo, matricula, nome, cpf, data_acesso, sentido

### usuario_contrato
- id, usuario_id, contrato_id, cpf

## 🔐 Tipos de Usuário

| Tipo | Acesso | Permissões |
|------|--------|------------|
| administrador-agir | Total | CRUD em tudo |
| administrador-terceiro | Dashboard | Visualiza seu contrato |
| terceiro | Dashboard | Visualiza seus dados |

## 🛠️ Troubleshooting

### Erro de Login
✅ Usuário criado no Auth?
✅ Registro na tabela usuarios?
✅ UUID correto?

### Página em Branco
✅ Console do navegador (F12)?
✅ RLS policies criadas?

### Erro de Conexão
✅ Arquivo .env existe?
✅ Credenciais corretas?

## 📚 Documentação Completa

- [README.md](README.md) - Documentação completa
- [INSTALACAO.md](INSTALACAO.md) - Guia detalhado de instalação
- [FEATURES.md](FEATURES.md) - Lista de funcionalidades

## 🆘 Ajuda

- Supabase Docs: https://supabase.com/docs
- Material-UI: https://mui.com
- React: https://react.dev

---

**Pronto! Você está pronto para usar o ParcerIA! 🤝✨**
