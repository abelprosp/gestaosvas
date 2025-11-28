# Como Corrigir Erro 401 (Unauthorized)

## Problema
Você está vendo erros `401 (Unauthorized)` nas requisições da API, o que significa que o token de autenticação não está sendo enviado ou está inválido.

## Solução Rápida

### 1. Verificar se você está logado

Abra o **Console do navegador** (F12 > Console) e execute:

```javascript
// Verificar sessão atual
const { data } = await supabase.auth.getSession();
console.log("Sessão:", data.session);
console.log("Token:", data.session?.access_token ? "Presente" : "Ausente");
```

### 2. Se não houver sessão, faça login novamente

1. Vá para a página de login
2. Faça logout (se estiver logado)
3. Faça login novamente

### 3. Verificar logs do interceptor

Após fazer login, abra o Console (F12) e procure por mensagens como:
- `[API Interceptor] Token adicionado para: ...`
- `[API Interceptor] Erro ao obter sessão: ...`
- `[API Interceptor] Nenhuma sessão encontrada`

## Correções Aplicadas

✅ **Interceptor melhorado** em `lib/api/client.ts`:
- Sempre obtém a sessão mais recente
- Tenta atualizar o token automaticamente se estiver próximo de expirar
- Logs de debug para identificar problemas
- Melhor tratamento de erros

## Passos para Testar

1. **Limpe o cache do navegador**:
   - `Ctrl+Shift+Delete` > Limpar dados de navegação
   - Ou `Ctrl+Shift+R` (hard refresh)

2. **Faça logout e login novamente**:
   - Isso garante que você tenha uma sessão válida

3. **Verifique o Console**:
   - Abra DevTools (F12) > Console
   - Procure por mensagens do `[API Interceptor]`
   - Se aparecer "Nenhuma sessão encontrada", você precisa fazer login

4. **Teste uma requisição**:
   - Tente abrir a página de usuários TV
   - Verifique se os erros 401 desapareceram

## Se o Problema Persistir

### Verificar se o Supabase está configurado corretamente

No Console do navegador, execute:

```javascript
console.log("Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log("Supabase Key:", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "Configurado" : "Não configurado");
```

### Verificar se o token está sendo enviado

No Console, procure por requisições que falharam com 401:
- Clique na requisição
- Vá na aba "Headers"
- Procure por "Authorization: Bearer ..."
- Se não existir, o token não está sendo enviado

### Verificar se o token está válido

No Console:

```javascript
const { data } = await supabase.auth.getSession();
if (data.session) {
  const expiresAt = data.session.expires_at;
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = expiresAt - now;
  console.log("Token expira em:", expiresIn, "segundos");
  if (expiresIn < 0) {
    console.error("Token expirado! Faça login novamente.");
  }
} else {
  console.error("Nenhuma sessão encontrada! Faça login.");
}
```

## Próximos Passos

1. ✅ Faça logout e login novamente
2. ✅ Limpe o cache do navegador
3. ✅ Verifique os logs no Console
4. ✅ Teste novamente

Se ainda tiver problemas, os logs do `[API Interceptor]` no Console vão mostrar exatamente o que está acontecendo.
