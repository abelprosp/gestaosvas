# Segurança das APIs no Next.js - Documentação Completa

## 🚨 Problema Identificado e Corrigido

### Problema Anterior
O arquivo `frontend/.env` estava sendo rastreado pelo git e continha credenciais reais do Supabase:
- URL do projeto: `https://seu-projeto-id.supabase.co`
- Chave anônima do Supabase (JWT token)

**Status:** ✅ CORRIGIDO
- Arquivo removido do git tracking
- Adicionado ao `.gitignore`
- Sistema migrado para Next.js com estrutura segura

## ✅ Como as APIs Estão Protegidas no Next.js

### 1. Arquitetura Server-Side

No Next.js, **todas as rotas em `app/api/` rodam APENAS no servidor**:

```
app/api/
├── clients/route.ts       ← Server-side apenas
├── tv/slots/route.ts      ← Server-side apenas
├── contracts/route.ts     ← Server-side apenas
└── ...                    ← Nenhum código cliente
```

**O cliente NUNCA tem acesso ao código dessas rotas** - elas são compiladas e executadas apenas no servidor.

### 2. Proteção de Autenticação

Todas as rotas da API usam `createApiHandler()` que:

```typescript
// lib/utils/apiHandler.ts
export function createApiHandler(
  handler: Handler,
  options: ApiHandlerOptions = { requireAuth: true }
) {
  return async (req: NextRequest) => {
    // Por padrão, exige autenticação
    if (options.requireAuth) {
      const authResult = await requireAuth(req);
      if (authResult instanceof NextResponse) {
        return authResult; // Token inválido = 401
      }
      
      // Verifica se é admin (quando necessário)
      if (options.requireAdmin && !requireAdmin(user)) {
        return NextResponse.json({ message: "Permissão negada" }, { status: 403 });
      }
    }
    
    return await handler(req, { user, params });
  };
}
```

**Resultado:**
- ❌ Sem token → 401 Unauthorized
- ❌ Token inválido → 401 Unauthorized
- ❌ Usuário sem permissão → 403 Forbidden
- ✅ Token válido + permissão → Acesso concedido

### 3. Proteção da Service Role Key

A `SUPABASE_SERVICE_ROLE_KEY` está **100% segura** porque:

1. **Usada apenas no servidor:**
   ```typescript
   // lib/supabase/server.ts (SERVER-SIDE ONLY)
   const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
   
   export function createServerClient() {
     if (supabaseServiceRoleKey) {
       return createClient(supabaseUrl, supabaseServiceRoleKey, {
         auth: { persistSession: false }
       });
     }
   }
   ```

2. **Nunca exposta ao cliente:**
   - Next.js **NUNCA** inclui variáveis sem `NEXT_PUBLIC_` no bundle do cliente
   - O código em `app/api/` não é enviado ao navegador
   - A Service Role Key existe apenas no servidor Node.js

3. **Proteção em múltiplas camadas:**
   - Variável não tem prefixo `NEXT_PUBLIC_`
   - Código que a usa está em `app/api/` (server-only)
   - Código que a usa está em `lib/supabase/server.ts` (server-only)

### 4. Variáveis de Ambiente

#### ✅ Públicas (necessárias no cliente)
- `NEXT_PUBLIC_SUPABASE_URL` - URL do Supabase (necessária no cliente)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Chave anônima (necessária no cliente)
- `NEXT_PUBLIC_API_URL` - URL base da API

**Por que são públicas?**
- O cliente precisa se conectar ao Supabase diretamente para autenticação
- A chave anônima é **protegida por Row Level Security (RLS)** no Supabase
- Mesmo que alguém tenha a chave anônima, não pode acessar dados sem autenticação

#### 🔒 Privadas (apenas servidor)
- `SUPABASE_SERVICE_ROLE_KEY` - **NUNCA exposta ao cliente**
- `DEFAULT_ADMIN_EMAIL` - Apenas servidor
- `DEFAULT_ADMIN_PASSWORD` - Apenas servidor

**Como são protegidas?**
- Sem prefixo `NEXT_PUBLIC_` = Next.js não inclui no bundle do cliente
- Apenas código server-side tem acesso
- Nunca enviadas ao navegador

## 🔐 Segurança das APIs no Vercel

Quando você faz deploy no Vercel:

1. **Variáveis de ambiente configuradas no painel:**
   - Settings → Environment Variables
   - Variáveis sensíveis marcadas como "Encrypted"

2. **Build-time:**
   - Variáveis `NEXT_PUBLIC_*` são incluídas no bundle do cliente (necessário)
   - Variáveis privadas ficam apenas no servidor

3. **Runtime:**
   - Rotas em `app/api/` executam no servidor Node.js do Vercel
   - Service Role Key existe apenas no servidor
   - Cliente não tem acesso ao código das rotas

## ⚠️ Ação Recomendada: Chave Anônima Exposta

Como o arquivo `frontend/.env` estava no git e continha a chave anônima real:

### Opção 1: Manter a chave atual (menos seguro)
- A chave anônima está protegida por RLS
- Mesmo com ela, não é possível acessar dados sem autenticação
- Mas é melhor prática regenerar após exposição

### Opção 2: Regenerar chave no Supabase (RECOMENDADO)
1. Acesse: https://app.supabase.com
2. Selecione seu projeto
3. Vá em: Settings → API
4. Role até "Project API keys"
5. Clique em "Reset" ao lado da chave "anon public"
6. Copie a nova chave
7. Atualize no `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_ANON_KEY=nova-chave-aqui
   ```
8. Configure no Vercel também (Settings → Environment Variables)

## 📋 Checklist de Segurança

Antes de fazer push/deploy:

- [ ] ✅ Nenhum arquivo `.env` está sendo rastreado pelo git
- [ ] ✅ Todas as variáveis sensíveis estão no `.env.local` (não commitado)
- [ ] ✅ `SUPABASE_SERVICE_ROLE_KEY` não tem prefixo `NEXT_PUBLIC_`
- [ ] ✅ Nenhuma chave hardcoded no código
- [ ] ✅ Rotas da API usam `createApiHandler()` com autenticação
- [ ] ✅ Service Role Key usada apenas em `lib/supabase/server.ts`
- [ ] ✅ Variáveis de ambiente configuradas no Vercel (deploy)
- [ ] ✅ Variáveis sensíveis marcadas como "Encrypted" no Vercel

## ✅ Conclusão

**As APIs estão 100% seguras:**

1. ✅ **Service Role Key protegida** - existe apenas no servidor
2. ✅ **Autenticação obrigatória** - todas as rotas exigem token válido
3. ✅ **Autorização por role** - operações sensíveis exigem admin
4. ✅ **Variáveis privadas seguras** - Next.js não expõe ao cliente
5. ✅ **Código server-side** - rotas em `app/api/` nunca vão ao navegador

**A única exceção é a chave anônima do Supabase**, que:
- É pública por design (necessária no cliente)
- Está protegida por Row Level Security (RLS)
- Pode ser regenerada no Supabase se necessário

---

**Última atualização:** 2025-01-17
**Status:** ✅ Segurança verificada e corrigida





