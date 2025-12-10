# 🔧 Solução para Erro de Build no Vercel

## ❌ Erro Atual

```
Error: Failed to collect page data for /api/admin/users/[id]
Error: Command "npm run build" exited with 1
```

## 🔍 Causa do Problema

O erro está acontecendo porque:

1. **Variáveis de ambiente incorretas no Vercel:**
   - Você configurou `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`
   - Mas o Next.js precisa de `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`

2. **Variável faltando:**
   - `SUPABASE_SERVICE_ROLE_KEY` não está configurada

3. **Durante o build:**
   - O Next.js tenta validar o código
   - O código precisa das variáveis de ambiente corretas
   - Como estão faltando/erradas, o build falha

## ✅ Solução Completa

### Passo 1: Remover Variáveis Erradas no Vercel

1. Acesse: https://vercel.com/dashboard
2. Selecione seu projeto
3. Vá em **Settings** → **Environment Variables**
4. **DELETE** estas variáveis:
   - ❌ `VITE_SUPABASE_URL`
   - ❌ `VITE_SUPABASE_PUBLISHABLE_KEY`

### Passo 2: Adicionar Variáveis Corretas

Adicione as seguintes 3 variáveis:

#### 1. **NEXT_PUBLIC_SUPABASE_URL**
- **Key:** `NEXT_PUBLIC_SUPABASE_URL`
- **Value:** Use o valor que estava em `VITE_SUPABASE_URL`
- **Environment:** ✅ Production, ✅ Preview, ✅ Development

#### 2. **NEXT_PUBLIC_SUPABASE_ANON_KEY**
- **Key:** `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Value:** Use o valor que estava em `VITE_SUPABASE_PUBLISHABLE_KEY`
- **Environment:** ✅ Production, ✅ Preview, ✅ Development

#### 3. **SUPABASE_SERVICE_ROLE_KEY** (NOVA - OBRIGATÓRIA!)
- **Key:** `SUPABASE_SERVICE_ROLE_KEY`
- **Value:** Vá ao Supabase → Settings → API → `service_role` (secret) → Copie
- **Environment:** ✅ Production, ✅ Preview, ✅ Development

### Passo 3: Verificar Configuração no Supabase

1. Acesse: https://app.supabase.com/
2. Selecione seu projeto
3. Vá em **Settings** → **API**
4. Você verá:
   - **Project URL** → Use para `NEXT_PUBLIC_SUPABASE_URL`
   - **`anon` `public`** → Use para `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **`service_role` `secret`** → Use para `SUPABASE_SERVICE_ROLE_KEY` ⚠️

### Passo 4: Fazer Redeploy

Após corrigir as variáveis:

1. No Vercel, vá em **Deployments**
2. Clique nos **3 pontinhos** (...) do último deploy
3. Selecione **Redeploy**
4. Aguarde o build completar

O erro deve desaparecer! ✅

---

## 📋 Checklist Final

Após configurar, você deve ter estas variáveis no Vercel:

- [ ] ✅ `NEXT_PUBLIC_SUPABASE_URL`
- [ ] ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] ✅ `SUPABASE_SERVICE_ROLE_KEY`

**NÃO deve ter:**
- [ ] ❌ `VITE_SUPABASE_URL` (remover)
- [ ] ❌ `VITE_SUPABASE_PUBLISHABLE_KEY` (remover)

---

## 🔒 Sobre a Service Role Key

**A Service Role Key está 100% segura:**
- ✅ Ela NÃO aparece no código
- ✅ Ela NÃO vai para o navegador
- ✅ Ela só existe no servidor do Vercel
- ✅ Apenas você (dono do projeto) pode ver no painel do Vercel

**É a forma correta e segura de fazer!** 🛡️

---

**Documento criado em:** 19 de Novembro de 2025


