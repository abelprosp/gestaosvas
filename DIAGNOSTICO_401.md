# Diagnóstico do Erro 401

## O que está acontecendo

Pelos logs do console, vejo que:

1. ✅ O token **está sendo adicionado** (`[API Interceptor] Token adicionado para: /admin/users...`)
2. ✅ O refresh **está funcionando** (`[API Interceptor] Sessão atualizada com sucesso`)
3. ❌ Mas ainda recebe **401** mesmo após o refresh

## Possíveis Causas

### 1. Token inválido após refresh
O token pode estar sendo atualizado, mas ainda não ser válido no backend.

### 2. Problema com validação no backend
O backend pode não estar recebendo o token corretamente após o refresh.

### 3. Sessão realmente expirada
A sessão pode ter expirado completamente e o refresh não está funcionando.

## Como Diagnosticar

### Passo 1: Verificar logs do servidor

No terminal onde você executou `npm run dev`, procure por mensagens como:

```
[requireAuth] Erro ao validar token: ...
[createApiHandler] Falha na autenticação para ...
```

Isso vai mostrar **por que** o backend está rejeitando o token.

### Passo 2: Testar a sessão no console

Abra o Console do navegador (F12) e execute:

```javascript
// Verificar sessão atual
const { data, error } = await supabase.auth.getSession();
console.log("Sessão:", data.session);
console.log("Token presente:", data.session?.access_token ? "SIM" : "NÃO");
console.log("Token (primeiros 20 chars):", data.session?.access_token?.substring(0, 20));

// Verificar se o token está expirado
if (data.session) {
  const expiresAt = data.session.expires_at;
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = expiresAt - now;
  console.log("Token expira em:", expiresIn, "segundos");
}
```

### Passo 3: Verificar se o role está correto

```javascript
const { data } = await supabase.auth.getSession();
if (data.session?.user) {
  console.log("Role do usuário:", data.session.user.user_metadata?.role);
  console.log("Deve ser 'admin':", data.session.user.user_metadata?.role === "admin");
}
```

## Solução Imediata

### Opção 1: Fazer logout e login novamente

1. Faça **logout** na aplicação
2. Faça **login novamente**
3. Isso garante uma sessão completamente nova e válida

### Opção 2: Verificar o role do usuário

Se você ainda não executou o script SQL para corrigir o role:

1. Acesse o **Supabase Dashboard**
2. Vá em **Authentication** > **Users**
3. Encontre seu usuário
4. Verifique se o **User Metadata** tem `"role": "admin"`

Se não tiver, adicione:

```json
{
  "role": "admin"
}
```

### Opção 3: Limpar tudo e recomeçar

1. **Limpe o cache do navegador** completamente (`Ctrl+Shift+Delete`)
2. **Faça logout**
3. **Feche todas as abas** do localhost:3000
4. **Abra uma nova aba** e faça login novamente
5. **Teste novamente**

## Próximos Passos

1. ✅ Verifique os **logs do servidor** (terminal do `npm run dev`)
2. ✅ Execute os **comandos de teste** no console do navegador
3. ✅ Verifique se o **role está como "admin"** no Supabase
4. ✅ Se necessário, **faça logout e login novamente**

Os logs do servidor vão mostrar exatamente por que o token está sendo rejeitado.
