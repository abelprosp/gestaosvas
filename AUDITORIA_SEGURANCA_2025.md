# 🔒 Auditoria de Segurança Completa - Janeiro 2025

**Data da Auditoria:** Janeiro 2025  
**Versão do Sistema:** Atual  
**Escopo:** Análise completa de segurança do código base

---

## 📊 Resumo Executivo

Esta auditoria identificou **várias vulnerabilidades e pontos de atenção** que precisam ser corrigidos. Embora o sistema tenha boas práticas de segurança implementadas, existem riscos que devem ser endereçados.

**Status Geral:** ⚠️ **ATENÇÃO NECESSÁRIA**

---

## 🔴 VULNERABILIDADES CRÍTICAS

### 1. ⚠️ **VULNERABILIDADE: SQL Injection via String Interpolation**

**Severidade:** 🔴 **CRÍTICA**  
**Localização:** `app/api/clients/route.ts:514`

**Problema:**
```typescript
query = query.or(`document.ilike.%${digits}%,phone.ilike.%${digits}%`);
```

Apesar de usar Supabase (que previne SQL injection), a construção de queries dinâmicas com interpolação de string pode ser vulnerável se houver mudanças na API do Supabase ou se parâmetros não validados forem passados.

**Recomendação:**
```typescript
// Usar métodos seguros do Supabase:
query = query.or(`document.ilike.%${digits}%,phone.ilike.%${digits}%`);
// OU melhor ainda, construir a query de forma mais segura:
const searchPattern = `%${digits}%`;
query = query.or(`document.ilike.${searchPattern},phone.ilike.${searchPattern}`);
```

**Status:** ⚠️ Requer atenção (Supabase protege, mas não é ideal)

---

### 2. 🔴 **VULNERABILIDADE: Logs Expõem Informações Sensíveis**

**Severidade:** 🟡 **MÉDIA**  
**Localização:** Múltiplos arquivos

**Problemas Identificados:**

1. **`app/api/clients/route.ts:564-570`** - Loga payload completo:
```typescript
console.log("[POST /api/clients] Payload recebido:", JSON.stringify({
  name: body.name,
  serviceIds: body.serviceIds,
  serviceSelectionsCount: body.serviceSelections?.length,
  tvSetup: body.tvSetup,
  hasTvSetup: !!body.tvSetup
}, null, 2));
```

2. **`lib/utils/apiHandler.ts:28,35,38`** - Loga URLs completas e emails:
```typescript
console.log(`[createApiHandler] Verificando autenticação para ${req.url}`);
console.log(`[createApiHandler] Usuário autenticado: ${user.email} (role: ${user.role})`);
```

3. **`lib/auth.ts:71`** - Loga emails e roles:
```typescript
console.log(`[requireAuth] Usuário autenticado: ${user.email} (role: ${user.role})`);
```

**Riscos:**
- Emails podem ser expostos em logs de produção
- URLs podem conter tokens ou parâmetros sensíveis
- Payloads podem conter dados de clientes

**Recomendações:**
```typescript
// Remover ou mascarar informações sensíveis:
console.log(`[createApiHandler] Verificando autenticação para ${req.url.split('?')[0]}`); // Remove query params
console.log(`[requireAuth] Usuário autenticado: ${maskEmail(user.email)} (role: ${user.role})`); // Mascarar email
// OU usar biblioteca de logging estruturado que permite filtrar campos sensíveis
```

**Status:** ⚠️ Requer correção antes de produção

---

### 3. 🟡 **VULNERABILIDADE: Falta de Rate Limiting Ativo**

**Severidade:** 🟡 **MÉDIA**  
**Localização:** Sistema completo

**Problema:**
Existe implementação de rate limiting em `lib/utils/rateLimit.ts`, mas **NÃO está sendo utilizada** na maioria das rotas.

**Verificação:**
```bash
# Procurar uso de rateLimit nas rotas:
grep -r "rateLimit\|checkRateLimit" app/api/
# Resultado: NENHUM USO ENCONTRADO
```

**Recomendações:**
1. Aplicar rate limiting em todas as rotas públicas/semi-públicas
2. Aplicar rate limiting especialmente em:
   - `/api/clients/lookup/cnpj/[cnpj]` - Rota pública que pode ser abusada
   - `/api/admin/*` - Rotas admin
   - `/api/auth/*` - Rotas de autenticação (se existirem)

**Status:** ⚠️ Implementação existente, mas não utilizada

---

### 4. 🟡 **VULNERABILIDADE: Falta de Validação de Autorização em Recursos**

**Severidade:** 🟡 **MÉDIA**  
**Localização:** Rotas que acessam recursos específicos

**Problema:**
Algumas rotas verificam autenticação, mas não verificam se o usuário tem permissão para acessar o recurso específico (ex: cliente, contrato).

**Exemplo:**
```typescript
// app/api/clients/[id]/route.ts
export const GET = createApiHandler(async (req, { params }) => {
  const { data } = await supabase.from("clients").select("*").eq("id", params.id);
  // ❌ Não verifica se o usuário tem permissão para ver este cliente
  return NextResponse.json(data);
});
```

**Riscos:**
- Usuários podem acessar dados de outros usuários/clientes
- Falta de controle de acesso baseado em recursos

**Recomendações:**
1. Implementar verificação de propriedade/permissão por recurso
2. Verificar se o usuário tem permissão antes de retornar dados:
```typescript
// Exemplo de verificação:
const { data: client } = await supabase
  .from("clients")
  .select("*, opened_by")
  .eq("id", params.id)
  .single();

if (!client) {
  throw new HttpError(404, "Cliente não encontrado");
}

// Verificar se usuário tem permissão (se não for admin)
if (user.role !== "admin" && client.opened_by !== user.id) {
  throw new HttpError(403, "Acesso negado");
}
```

**Status:** ⚠️ Requer implementação de controle de acesso baseado em recursos

---

### 5. 🟡 **VULNERABILIDADE: Armazenamento de Dados Sensíveis no LocalStorage**

**Severidade:** 🟡 **MÉDIA**  
**Localização:** `components/chat/VirtualAssistantChat.tsx:76-92`

**Problema:**
```typescript
const stored = localStorage.getItem(CHAT_HISTORY_KEY);
localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(limitedMessages));
```

O histórico do chat é armazenado no `localStorage`, que pode conter informações sensíveis sobre clientes ou operações.

**Riscos:**
- Dados acessíveis via XSS (Cross-Site Scripting)
- Dados persistem mesmo após logout
- Dados podem ser lidos por qualquer script na página

**Recomendações:**
1. Mover para armazenamento no servidor (banco de dados)
2. OU usar `sessionStorage` (dados apagados ao fechar aba)
3. OU criptografar dados antes de armazenar
4. OU implementar limpeza automática após logout

**Status:** ⚠️ Requer melhoria

---

### 6. 🟠 **VULNERABILIDADE: Falta de Content Security Policy (CSP)**

**Severidade:** 🟠 **BAIXA-MÉDIA**  
**Localização:** `next.config.js`

**Problema:**
O arquivo `next.config.js` configura vários headers de segurança, mas **NÃO inclui Content-Security-Policy (CSP)**.

**Riscos:**
- Vulnerável a XSS (Cross-Site Scripting)
- Não previne injeção de scripts maliciosos

**Recomendações:**
Adicionar CSP ao `next.config.js`:
```javascript
{
  key: "Content-Security-Policy",
  value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;"
}
```

**Status:** ⚠️ Recomendado adicionar

---

### 7. 🟠 **VULNERABILIDADE: CORS Configurado de Forma Permissiva no Backend Express**

**Severidade:** 🟠 **BAIXA**  
**Localização:** `backend/src/server.ts:13`

**Problema:**
```typescript
app.use(cors()); // Permite todas as origens
```

O backend Express (se ainda estiver em uso) permite CORS de qualquer origem.

**Recomendações:**
1. Se o backend Express não estiver mais em uso, removê-lo
2. Se estiver em uso, configurar CORS adequadamente:
```typescript
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));
```

**Status:** ⚠️ Verificar se backend Express ainda está em uso

---

### 8. 🟠 **VULNERABILIDADE: Exposição de Detalhes de Erro ao Cliente**

**Severidade:** 🟠 **BAIXA**  
**Localização:** `lib/auth.ts:57`

**Problema:**
```typescript
return NextResponse.json({ message: `Sessão inválida: ${error.message}` }, { status: 401 });
```

Mensagens de erro detalhadas podem expor informações sobre o sistema.

**Recomendações:**
```typescript
// Em produção, usar mensagens genéricas:
return NextResponse.json({ message: "Sessão inválida" }, { status: 401 });

// OU usar um handler de erro que mascara detalhes em produção:
const errorHandler = (error: Error, isProduction: boolean) => {
  if (isProduction) {
    return "Erro interno do servidor";
  }
  return error.message;
};
```

**Status:** ⚠️ Melhorar tratamento de erros

---

## ✅ PONTOS POSITIVOS

1. ✅ **Autenticação implementada** - Todas as rotas usam `createApiHandler` com autenticação
2. ✅ **Service Role Key protegida** - Nunca exposta ao cliente
3. ✅ **Headers de segurança configurados** - HSTS, X-Frame-Options, etc.
4. ✅ **Validação de entrada** - Uso de Zod para validação de schemas
5. ✅ **Sanitização de documentos** - Função `sanitizeDocument` implementada
6. ✅ **Variáveis de ambiente protegidas** - `.env` não commitado
7. ✅ **Supabase protege contra SQL injection** - Queries parametrizadas

---

## 📋 RECOMENDAÇÕES PRIORITÁRIAS

### 🔴 Prioridade Alta (Corrigir Imediatamente)

1. **Remover/Mascarar logs sensíveis** - Especialmente emails e dados de clientes
2. **Implementar rate limiting ativo** - Aplicar nas rotas críticas
3. **Implementar autorização baseada em recursos** - Verificar permissões por recurso

### 🟡 Prioridade Média (Corrigir em Breve)

4. **Mover dados sensíveis do localStorage** - Para servidor ou sessionStorage
5. **Adicionar Content Security Policy** - Prevenir XSS
6. **Melhorar tratamento de erros** - Mensagens genéricas em produção
7. **Revisar queries dinâmicas** - Garantir construção segura

### 🟠 Prioridade Baixa (Melhorias)

8. **Revisar configuração de CORS** - Se backend Express ainda está em uso
9. **Implementar logging estruturado** - Com filtros de campos sensíveis
10. **Adicionar testes de segurança** - Para validar proteções

---

## 🔧 AÇÕES IMEDIATAS

### 1. Criar arquivo de utilitários para mascarar dados sensíveis

```typescript
// lib/utils/privacy.ts
export function maskEmail(email?: string): string {
  if (!email) return "N/A";
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const maskedLocal = local.length > 2 
    ? `${local.substring(0, 2)}***` 
    : "***";
  return `${maskedLocal}@${domain}`;
}

export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.search = ""; // Remove query params
    return parsed.toString();
  } catch {
    return url.split("?")[0]; // Fallback
  }
}
```

### 2. Aplicar rate limiting nas rotas críticas

```typescript
// app/api/clients/lookup/cnpj/[cnpj]/route.ts
import { rateLimit, RATE_LIMITS } from "@/lib/utils/rateLimit";

export const GET = async (req: NextRequest) => {
  const rateLimitResult = rateLimit(RATE_LIMITS.CNPJ_LOOKUP)(req);
  if (rateLimitResult) {
    return rateLimitResult; // Retorna 429 se excedido
  }
  // ... resto do código
};
```

### 3. Implementar verificação de autorização por recurso

```typescript
// lib/utils/resourceAuth.ts
export async function checkResourceAccess(
  resourceType: "client" | "contract",
  resourceId: string,
  userId: string,
  userRole: string,
  supabase: SupabaseClient
): Promise<boolean> {
  if (userRole === "admin") {
    return true; // Admin tem acesso a tudo
  }

  if (resourceType === "client") {
    const { data } = await supabase
      .from("clients")
      .select("opened_by")
      .eq("id", resourceId)
      .single();
    
    return data?.opened_by === userId;
  }

  return false;
}
```

---

## 📊 Checklist de Segurança

- [ ] Remover logs que expõem emails e dados sensíveis
- [ ] Implementar rate limiting ativo em rotas críticas
- [ ] Adicionar verificação de autorização baseada em recursos
- [ ] Mover dados sensíveis do localStorage para servidor
- [ ] Adicionar Content Security Policy
- [ ] Melhorar tratamento de erros (mensagens genéricas em produção)
- [ ] Revisar queries dinâmicas para garantir segurança
- [ ] Verificar se backend Express ainda está em uso
- [ ] Implementar logging estruturado
- [ ] Adicionar testes de segurança

---

## 📚 Referências

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security Best Practices](https://nextjs.org/docs/app/building-your-application/configuring/security)
- [Supabase Security](https://supabase.com/docs/guides/platform/security)

---

**Próximos Passos:**
1. Revisar este relatório com a equipe
2. Priorizar correções
3. Implementar correções em ordem de prioridade
4. Realizar nova auditoria após correções

