# 🚀 Como Configurar Variáveis de Ambiente no Vercel

## 📋 Variáveis Necessárias

Você precisa configurar **3 variáveis de ambiente** no Vercel:

1. **`NEXT_PUBLIC_SUPABASE_URL`** - URL do seu projeto Supabase
2. **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** - Chave pública (anon) do Supabase
3. **`SUPABASE_SERVICE_ROLE_KEY`** - Chave privada (service_role) do Supabase ⚠️ **Essa é a que estava faltando!**

---

## 🔍 Onde Encontrar as Chaves no Supabase

1. Acesse: https://app.supabase.com/
2. Selecione seu projeto
3. Vá em **Settings** → **API**
4. Na seção **Project API keys**, você verá:
   - **`anon` `public`** → Esta é a `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **`service_role` `secret`** → Esta é a `SUPABASE_SERVICE_ROLE_KEY` ⚠️ **Importante!**
5. Em **Project URL** → Esta é a `NEXT_PUBLIC_SUPABASE_URL`

---

## ⚙️ Como Configurar no Vercel

### Passo 1: Acessar o Painel do Vercel
1. Acesse: https://vercel.com/dashboard
2. Selecione seu projeto (`gestaosvas`)

### Passo 2: Ir em Environment Variables
1. Clique em **Settings** (⚙️ Configurações)
2. No menu lateral, clique em **Environment Variables**

### Passo 3: Adicionar as Variáveis

Para cada uma das 3 variáveis, faça:

1. Clique em **Add New**
2. Preencha:
   - **Key**: O nome da variável (ex: `NEXT_PUBLIC_SUPABASE_URL`)
   - **Value**: O valor da variável (cole do Supabase)
   - **Environment**: Selecione **todas as opções**:
     - ✅ Production
     - ✅ Preview
     - ✅ Development
3. Clique em **Save**

**Repita o processo para todas as 3 variáveis!**

---

## 📝 Checklist

Verifique se todas essas variáveis estão configuradas:

- [ ] `NEXT_PUBLIC_SUPABASE_URL` → URL do projeto Supabase
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Chave `anon` do Supabase
- [ ] `SUPABASE_SERVICE_ROLE_KEY` → Chave `service_role` do Supabase ⚠️ **Essa é crítica para a página admin!**

---

## 🔄 Fazer Redeploy

Após adicionar as variáveis, você **precisa fazer um novo deploy**:

### Opção 1: Redeploy Manual
1. No Vercel, vá em **Deployments**
2. Clique nos **3 pontinhos** (...) do último deploy
3. Selecione **Redeploy**
4. Aguarde 1-2 minutos

### Opção 2: Novo Commit (Automatico)
- Faça qualquer mudança no código e faça commit
- O Vercel vai fazer deploy automaticamente com as novas variáveis

---

## ✅ Verificar se Funcionou

Após o redeploy (1-2 minutos):

1. Acesse a página: `https://gestaosvas.vercel.app/admin/usuarios`
2. Os usuários devem aparecer na lista
3. Não deve mais aparecer o erro de "Service Role Key não encontrada"

---

## 🔒 Segurança Importante

⚠️ **NUNCA faça isso:**
- ❌ Colocar as chaves no código
- ❌ Commitar arquivos `.env` com as chaves
- ❌ Compartilhar as chaves publicamente
- ❌ Especialmente a `SUPABASE_SERVICE_ROLE_KEY` - ela é ultra secreta!

✅ **SEMPRE faça isso:**
- ✅ Configure apenas no Vercel (Environment Variables)
- ✅ Use variáveis de ambiente
- ✅ Mantenha as chaves seguras e privadas

---

## 🆘 Problemas Comuns

### "Ainda não funciona após configurar"
1. Verifique se você fez o **redeploy** após adicionar as variáveis
2. Verifique se as variáveis estão configuradas para **Production, Preview e Development**
3. Verifique se você copiou a chave completa (elas são bem longas!)
4. Verifique os **Runtime Logs** no Vercel para ver erros específicos

### "Como saber qual variável está faltando?"
- Veja os **Runtime Logs** no Vercel (Settings → Logs)
- Os erros vão mostrar exatamente qual variável está faltando

### "As variáveis já estão configuradas mas não funcionam"
- Certifique-se de que fez o **redeploy** após adicionar/modificar as variáveis
- Verifique se não há espaços extras no início ou fim dos valores
- Verifique se está usando o nome exato da variável (case-sensitive)

---

## 📞 Precisa de Ajuda?

Se ainda tiver problemas após seguir este guia:
1. Verifique os **Runtime Logs** no Vercel
2. Tire um print das variáveis configuradas (sem mostrar os valores, apenas os nomes)
3. Me envie o erro específico que aparece

