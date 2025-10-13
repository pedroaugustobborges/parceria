# Guia Rápido de Instalação - ParcerIA

## Passo 1: Instalar Dependências

Abra o terminal na pasta do projeto e execute:

```bash
npm install
```

## Passo 2: Configurar o Banco de Dados no Supabase

### 2.1. Acessar o Supabase
1. Acesse https://supabase.com
2. Faça login ou crie uma conta
3. O projeto já está configurado com a URL: `qszqzdnlhxpgllyqthht.supabase.co`

### 2.2. Executar Script SQL
1. No painel do Supabase, vá para **SQL Editor**
2. Clique em **New Query**
3. Copie todo o conteúdo do arquivo `supabase-init.sql`
4. Cole no editor e clique em **Run**
5. Aguarde a mensagem de sucesso

### 2.3. Criar Primeiro Administrador
1. No Supabase, vá para **Authentication** > **Users**
2. Clique em **Add user** > **Create new user**
3. Preencha:
   - Email: seu-email@exemplo.com
   - Password: sua-senha-segura
   - Confirme a senha
4. Clique em **Create user**
5. **IMPORTANTE**: Copie o UUID do usuário criado (aparece na lista)

### 2.4. Vincular Usuário à Tabela
1. Volte para **SQL Editor**
2. Execute o seguinte comando (substitua os valores):

```sql
INSERT INTO usuarios (id, email, nome, cpf, tipo)
VALUES (
  'COLE_O_UUID_AQUI',
  'seu-email@exemplo.com',
  'Seu Nome Completo',
  '00000000000',
  'administrador-agir'
);
```

## Passo 3: Importar Dados de Acessos (Opcional)

Se você possui o arquivo `Acessos.csv`:

1. No Supabase, vá para **Table Editor**
2. Selecione a tabela `acessos`
3. Clique em **Insert** > **Insert via spreadsheet**
4. Cole os dados do CSV ou use a interface de importação
5. Certifique-se de mapear as colunas corretamente:
   - tipo → tipo
   - matricula → matricula
   - nome → nome
   - cpf → cpf
   - data_acesso → data_acesso
   - sentido → sentido (E ou S)

## Passo 4: Executar o Projeto

```bash
npm run dev
```

O projeto abrirá em: http://localhost:5173

## Passo 5: Fazer Login

1. Acesse http://localhost:5173
2. Use o email e senha do administrador criado no Passo 2.3
3. Você será redirecionado para o Dashboard

## Solução de Problemas Comuns

### Erro "Invalid login credentials"
- Verifique se o usuário foi criado no Authentication
- Verifique se o registro foi inserido na tabela `usuarios`
- Confirme que o UUID está correto

### Erro "relation usuarios does not exist"
- Execute o script SQL completo do `supabase-init.sql`
- Aguarde alguns segundos e tente novamente

### Erro de conexão com Supabase
- Verifique se o arquivo `.env` existe
- Confirme que as credenciais estão corretas
- Verifique sua conexão com a internet

### Página em branco após login
- Abra o Console do navegador (F12)
- Verifique se há erros
- Confirme que as políticas RLS foram criadas corretamente

## Estrutura de Permissões

### Administrador Agir
- Visualiza todos os dados
- Acessa: Dashboard, Usuários, Contratos
- Pode criar/editar/excluir tudo

### Administrador Terceiro
- Visualiza apenas dados de seus colaboradores (vinculados ao seu contrato)
- Acessa: Dashboard
- Não pode gerenciar usuários ou contratos

### Terceiro
- Visualiza apenas seus próprios dados (baseado no CPF)
- Acessa: Dashboard
- Não pode gerenciar nada

## Próximos Passos

1. **Criar Contratos**: Vá para Contratos e cadastre os contratos com empresas terceiras
2. **Criar Usuários**: Vá para Usuários e cadastre os colaboradores
3. **Importar Acessos**: Importe os dados das catracas
4. **Explorar Dashboard**: Use os filtros para analisar as horas trabalhadas

## Contatos e Suporte

Para dúvidas:
- Documentação completa: README.md
- Suporte Supabase: https://supabase.com/docs

---

**Boa sorte com o ParcerIA!** 🤝✨
