# Como Configurar SUPABASE_SERVICE_ROLE_KEY no Vercel

## 🔑 O que é a Service Role Key?

A `SUPABASE_SERVICE_ROLE_KEY` é uma chave privada e poderosa que permite operações administrativas no Supabase, como:
- Listar todos os usuários
- Criar usuários
- Modificar usuários
- Acessar dados sem restrições de Row Level Security (RLS)

⚠️ **IMPORTANTE**: Esta chave é **ultra secreta** e nunca deve ser exposta no frontend!

## 📋 Passo a Passo

### 1. Obter a Service Role Key no Supabase

1. Acesse o [Dashboard do Supabase](https://app.supabase.com/)
2. Selecione seu projeto
3. No menu lateral, vá em **Settings** (⚙️ Configurações)
4. Clique em **API**
5. Na seção **Project API keys**, encontre:
   - **`anon` `public`** - Esta é a chave pública (já deve estar configurada como `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   - **`service_role` `secret`** - Esta é a chave privada que você precisa

6. Clique no ícone de **olho** 👁️ ao lado de `service_role` para revelar a chave
7. Clique em **Copy** para copiar a chave (ela é bem longa!)

### 2. Configurar no Vercel

1. Acesse o [Dashboard do Vercel](https://vercel.com/dashboard)
2. Selecione seu projeto (`gestaosvas`)
3. Vá em **Settings** (⚙️ Configurações)
4. No menu lateral, clique em **Environment Variables**
5. Clique em **Add New** para adicionar uma nova variável

6. Preencha:
   - **Name**: `SUPABASE_SERVICE_ROLE_KEY`
   - **Value**: Cole a chave que você copiou do Supabase
   - **Environment**: Selecione todas as opções:
     - ✅ Production
     - ✅ Preview
     - ✅ Development

7. Clique em **Save**

### 3. Fazer Redeploy (Opcional mas Recomendado)

Após adicionar a variável, você precisa fazer um novo deploy para que ela seja aplicada:

1. No Vercel, vá em **Deployments**
2. Clique nos **3 pontinhos** (...) do último deploy
3. Selecione **Redeploy**
4. Ou simplesmente faça um novo commit/push para o repositório

## ✅ Verificação

Após configurar e fazer o redeploy:

1. Aguarde 1-2 minutos para o deploy completar
2. Acesse a página `/admin/usuarios` no seu site
3. Os usuários devem aparecer na lista

## 🔒 Segurança

- ✅ A Service Role Key **nunca** deve aparecer no código
- ✅ Ela só deve estar configurada como variável de ambiente no Vercel
- ✅ Não compartilhe essa chave publicamente
- ✅ Se a chave for exposta, gere uma nova no Supabase e atualize no Vercel

## 🆘 Problemas Comuns

### "Ainda não funciona após configurar"

1. Verifique se a variável está configurada para o ambiente correto (Production, Preview, Development)
2. Faça um redeploy após adicionar a variável
3. Verifique se você copiou a chave completa (ela é bem longa!)
4. Verifique os Runtime Logs no Vercel para ver se há outros erros

### "Onde encontro a Service Role Key no Supabase?"

- Vá em: Settings → API → Project API keys
- Procure por `service_role` (não `anon`!)
- Ela está marcada como `secret`

