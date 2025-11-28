# Teste de Sessão - Diagnóstico de Erro 401

## Como Testar se a Sessão Está Funcionando

Abra o **Console do navegador** (F12 > Console) e execute estes comandos:

### 1. Verificar se o Supabase está configurado

```javascript
console.log("Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
```

### 2. Verificar a sessão atual

```javascript
const { data, error } = await supabase.auth.getSession();
console.log("Sessão:", data.session);
console.log("Erro:", error);
console.log("Token presente:", data.session?.access_token ? "SIM" : "NÃO");
```

### 3. Verificar se o token está expirado

```javascript
const { data } = await supabase.auth.getSession();
if (data.session) {
  const expiresAt = data.session.expires_at;
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = expiresAt - now;
  console.log("Token expira em:", expiresIn, "segundos");
  if (expiresIn < 0) {
    console.error("❌ Token EXPIRADO! Faça login novamente.");
  } else if (expiresIn < 60) {
    console.warn("⚠️ Token expira em menos de 1 minuto!");
  } else {
    console.log("✅ Token válido");
  }
} else {
  console.error("❌ Nenhuma sessão encontrada! Faça login.");
}
```

### 4. Tentar fazer refresh manual

```javascript
const { data, error } = await supabase.auth.refreshSession();
console.log("Refresh - Sessão:", data.session);
console.log("Refresh - Erro:", error);
```

### 5. Verificar se o interceptor está funcionando

No Console, procure por mensagens que começam com `[API Interceptor]` quando você faz uma requisição.

## Solução Rápida

Se a sessão não existir ou estiver expirada:

1. **Faça logout** na aplicação
2. **Faça login novamente**
3. **Limpe o cache do navegador** (`Ctrl+Shift+R`)
4. **Teste novamente**

## O que Fazer se Nada Funcionar

1. Verifique se você está realmente logado (veja o nome do usuário no topo da página)
2. Se estiver logado mas ainda der erro 401, pode ser um problema com o role do usuário
3. Execute o script SQL para corrigir o role (veja `supabase/fix_user_role_simple.sql`)

