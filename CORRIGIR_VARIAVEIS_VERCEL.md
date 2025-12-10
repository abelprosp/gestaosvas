# 🔧 CORREÇÃO: Variáveis de Ambiente no Vercel

## ❌ Problema Identificado

Você configurou variáveis com prefixo **`VITE_`** (do Vite), mas seu projeto é **Next.js** que precisa de **`NEXT_PUBLIC_`**.

**Variáveis ERRADAS que você configurou:**
- ❌ `VITE_SUPABASE_URL`
- ❌ `VITE_SUPABASE_PUBLISHABLE_KEY`

**Variáveis CORRETAS que você precisa:**
- ✅ `NEXT_PUBLIC_SUPABASE_URL`
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- ✅ `SUPABASE_SERVICE_ROLE_KEY`

---

## ✅ SOLUÇÃO: Configurar Variáveis Corretas

### Passo 1: Remover Variáveis Erradas

1. Acesse: https://vercel.com/dashboard
2. Selecione seu projeto
3. Vá em **Settings** → **Environment Variables**
4. **DELETE** as variáveis com prefixo `VITE_`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`

### Passo 2: Adicionar Variáveis Corretas

Adicione as seguintes variáveis com os valores que você já copiou:

#### 1. **NEXT_PUBLIC_SUPABASE_URL**
- **Key:** `NEXT_PUBLIC_SUPABASE_URL`
- **Value:** Cole o valor que você tinha em `VITE_SUPABASE_URL`
- **Environment:** ✅ Production, ✅ Preview, ✅ Development

#### 2. **NEXT_PUBLIC_SUPABASE_ANON_KEY**
- **Key:** `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Value:** Cole o valor que você tinha em `VITE_SUPABASE_PUBLISHABLE_KEY` (é a mesma chave, só o nome muda)
- **Environment:** ✅ Production, ✅ Preview, ✅ Development

#### 3. **SUPABASE_SERVICE_ROLE_KEY** (NOVA - Você precisa adicionar!)
- **Key:** `SUPABASE_SERVICE_ROLE_KEY`
- **Value:** Vá ao Supabase → Settings → API → `service_role` (secret) → Copie
- **Environment:** ✅ Production, ✅ Preview, ✅ Development
- ⚠️ **IMPORTANTE:** Esta chave é diferente da `anon` key!

---

## 🔍 Onde Encontrar a Service Role Key

1. Acesse: https://app.supabase.com/
2. Selecione seu projeto
3. Vá em **Settings** → **API**
4. Na seção **Project API keys**, você verá:
   - **`anon` `public`** → Esta é a `NEXT_PUBLIC_SUPABASE_ANON_KEY` (já copiou)
   - **`service_role` `secret`** → Esta é a `SUPABASE_SERVICE_ROLE_KEY` ⚠️ **Copie esta também!**

---

## 📋 Checklist Final

Após configurar, você deve ter estas 3 variáveis no Vercel:

- [ ] ✅ `NEXT_PUBLIC_SUPABASE_URL` → URL do projeto Supabase
- [ ] ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Chave `anon` do Supabase
- [ ] ✅ `SUPABASE_SERVICE_ROLE_KEY` → Chave `service_role` do Supabase

**NÃO deve ter mais:**
- ❌ `VITE_SUPABASE_URL` (remover)
- ❌ `VITE_SUPABASE_PUBLISHABLE_KEY` (remover)

---

## 🔄 Fazer Redeploy

Após corrigir as variáveis:

1. No Vercel, vá em **Deployments**
2. Clique nos **3 pontinhos** (...) do último deploy
3. Selecione **Redeploy**
4. Aguarde o build completar

O erro deve desaparecer! ✅

---

## ❓ Por que o Erro Aconteceu?

O Next.js não reconhece variáveis com prefixo `VITE_`. Ele só reconhece:
- `NEXT_PUBLIC_*` para variáveis públicas (acessíveis no cliente)
- Variáveis sem prefixo para variáveis privadas (apenas servidor)

Durante o build, o código tentou acessar `process.env.NEXT_PUBLIC_SUPABASE_URL`, mas essa variável não existia, causando o erro de build.

---

**Documento criado em:** 19 de Novembro de 2025


