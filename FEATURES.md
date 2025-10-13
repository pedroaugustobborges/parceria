# Funcionalidades do ParcerIA

## 🎨 Design e Interface

### Tema Visual
- **Paleta de Cores**:
  - Primary: Sky Blue (#0ea5e9) - Representa parceria e conexão
  - Secondary: Purple (#8b5cf6) - Representa inovação e IA
  - Gradientes modernos em botões e cards
  - Sombras suaves para profundidade

### Componentes
- Interface totalmente responsiva (desktop, tablet, mobile)
- Cards com animações hover
- Ícones Material Design
- Tipografia Inter (moderna e legível)
- Layout sidebar com navegação intuitiva

## 🔐 Autenticação e Segurança

### Sistema de Login
- Login com email e senha via Supabase Auth
- Toggle para mostrar/ocultar senha
- Mensagens de erro amigáveis
- Logo da Agir Saúde em destaque
- Design com gradientes e backdrop blur

### Níveis de Acesso
1. **Administrador Agir**
   - Acesso total ao sistema
   - Pode criar/editar/excluir usuários
   - Pode criar/editar/excluir contratos
   - Visualiza todos os acessos

2. **Administrador Terceiro**
   - Acesso ao dashboard
   - Visualiza apenas colaboradores de seu contrato
   - Não pode gerenciar usuários ou contratos

3. **Terceiro**
   - Acesso ao dashboard
   - Visualiza apenas seus próprios dados
   - Não pode gerenciar nada

### Row Level Security (RLS)
- Políticas de segurança no banco de dados
- Isolamento de dados por tipo de usuário
- Queries automáticas filtradas por permissão

## 📊 Dashboard de Acessos

### Estatísticas em Tempo Real
- **Total de Pessoas**: Contador de CPFs únicos no período
- **Total de Horas**: Soma de todas as horas trabalhadas
- **Média de Horas**: Média de horas por pessoa

### Filtros Avançados
Todos com Autocomplete:
- **Tipo**: Filtra por tipo de colaborador
- **Matrícula**: Busca por matrícula específica
- **Nome**: Busca por nome (pesquisa parcial)
- **CPF**: Busca por CPF específico
- **Data Início**: Define início do período
- **Data Fim**: Define fim do período

### Tabela de Dados (DataGrid)
Colunas:
- Nome e Matrícula
- CPF
- Tipo (com chip colorido)
- Total de Horas (com ícone de relógio)
- Entradas (chip verde)
- Saídas (chip vermelho)
- Último Acesso (formatado)

Recursos:
- Ordenação por qualquer coluna
- Paginação (10, 25, 50, 100 por página)
- Busca rápida global
- Export para CSV/Excel via toolbar
- Responsivo

### Cálculo de Horas
O sistema calcula automaticamente as horas trabalhadas:

1. Agrupa acessos por CPF
2. Separa entradas (E) e saídas (S)
3. Ordena cronologicamente
4. Pareia cada entrada com a próxima saída
5. Calcula a diferença em minutos
6. Converte para horas (com 2 casas decimais)

**Exemplo**:
- Entrada: 08:00
- Saída: 12:00
- Entrada: 13:00
- Saída: 17:00
- **Total**: 8 horas (4h + 4h)

## 👥 Gestão de Usuários

### Funcionalidades
- **Criar Usuário**:
  - Nome completo
  - Email (único)
  - CPF (único)
  - Senha (mínimo 6 caracteres)
  - Tipo de usuário
  - Contrato (se aplicável)

- **Editar Usuário**:
  - Atualizar nome, CPF, tipo
  - Email não pode ser alterado
  - Vincular/desvincular de contratos

- **Excluir Usuário**:
  - Confirmação obrigatória
  - Remove do Auth e da tabela

### Interface
- Tabela com DataGrid
- Chips coloridos para tipos
- Ícones de ação (editar/excluir)
- Dialog modal para criar/editar
- Busca rápida
- Toolbar completa

## 📝 Gestão de Contratos

### Funcionalidades
- **Criar Contrato**:
  - Nome do contrato
  - Empresa contratada
  - Data de início (obrigatória)
  - Data de fim (opcional - indeterminado)
  - Status ativo/inativo

- **Editar Contrato**:
  - Atualizar qualquer informação
  - Alterar datas
  - Mudar status

- **Excluir Contrato**:
  - Confirmação obrigatória
  - Remove vínculos

- **Ativar/Desativar**:
  - Click no chip de status
  - Atualização instantânea

### Interface
- Tabela com DataGrid
- Chip de status (verde=ativo, cinza=inativo)
- Ícones de ação
- Dialog modal com DatePickers
- Switch para ativo/inativo

## 🎯 Recursos Técnicos

### Performance
- Lazy loading de componentes
- Memoização de cálculos pesados
- Índices no banco de dados
- Cache de queries

### UX
- Loading states em todas as operações
- Mensagens de erro/sucesso
- Confirmações para ações destrutivas
- Tooltips informativos
- Skeleton loaders

### Responsividade
- Sidebar colapsível em mobile
- Tabelas com scroll horizontal
- Breakpoints: xs, sm, md, lg, xl
- Menu hambúrguer em telas pequenas

## 🔄 Fluxo de Uso

### Para Administrador Agir

1. **Login**
   - Acessa com credenciais
   - Redirecionado para Dashboard

2. **Visualizar Dashboard**
   - Vê estatísticas gerais
   - Aplica filtros
   - Analisa horas trabalhadas
   - Exporta relatórios

3. **Gerenciar Contratos**
   - Cria novos contratos
   - Edita contratos existentes
   - Ativa/desativa conforme necessário

4. **Gerenciar Usuários**
   - Cria novos usuários
   - Define permissões
   - Vincula a contratos
   - Remove usuários inativos

### Para Administrador Terceiro

1. **Login**
   - Acessa com credenciais
   - Redirecionado para Dashboard

2. **Visualizar Dashboard**
   - Vê apenas dados de seus colaboradores
   - Aplica filtros
   - Analisa horas da equipe
   - Exporta relatórios

### Para Terceiro

1. **Login**
   - Acessa com credenciais
   - Redirecionado para Dashboard

2. **Visualizar Dashboard**
   - Vê apenas seus próprios dados
   - Verifica suas horas
   - Confere histórico de acessos

## 🚀 Futuras Melhorias (Roadmap)

### Curto Prazo
- [ ] Relatórios em PDF
- [ ] Notificações por email
- [ ] Gráficos de tendência
- [ ] Export personalizado

### Médio Prazo
- [ ] Dashboard de análise financeira
- [ ] Integração com folha de pagamento
- [ ] API REST pública
- [ ] Aplicativo mobile

### Longo Prazo
- [ ] IA para detecção de anomalias
- [ ] Previsão de custos com ML
- [ ] Reconhecimento facial direto
- [ ] Integração com sistemas hospitalares

## 📱 Compatibilidade

### Navegadores
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

### Dispositivos
- ✅ Desktop (Windows, Mac, Linux)
- ✅ Tablet (iPad, Android)
- ✅ Mobile (iOS, Android)

### Requisitos
- Conexão com internet
- JavaScript habilitado
- Cookies habilitados (para autenticação)

## 🎨 Identidade Visual

### Logo
- Logo da Agir Saúde em branco na tela de login
- Logo em cores no sidebar

### Nome
- **Parcer**IA (com IA em destaque)
- Representa: Parceria + Inteligência Artificial

### Ícones
- 🤝 Handshake: Representa parceria
- ⏰ AccessTime: Representa horas
- 👥 People: Representa colaboradores
- 📊 Dashboard: Representa análise
- 📝 Description: Representa contratos

---

**ParcerIA** - Gestão Inteligente de Acessos e Contratos
© 2024 Agir Saúde
