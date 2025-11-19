# Guia de Migração: React + Express → Next.js

Este documento descreve o processo de migração do projeto de React + Express para Next.js com App Router.

## Estrutura do Projeto Antes e Depois

### Antes (React + Express)
```
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── context/
│   │   └── ...
│   └── package.json
└── backend/
    ├── src/
    │   ├── routes/
    │   ├── middleware/
    │   └── ...
    └── package.json
```

### Depois (Next.js)
```
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── (routes)/
│   └── api/
│       └── (routes)/
├── components/
├── context/
├── lib/
│   ├── supabase/
│   ├── utils/
│   └── auth.ts
├── types/
├── theme/
└── package.json
```

## Principais Mudanças

### 1. Roteamento

**Antes (React Router):**
```tsx
// frontend/src/App.tsx
<Route path="/clientes" element={<ClientsPage />} />
```

**Depois (Next.js App Router):**
```
app/
  clientes/
    page.tsx  // Componente da página
    layout.tsx // Layout opcional
```

### 2. API Routes

**Antes (Express):**
```ts
// backend/src/routes/clients.ts
router.get("/", requireAuth, async (req, res) => {
  res.json(data);
});
```

**Depois (Next.js API Routes):**
```ts
// app/api/clients/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/utils/apiHandler";

export const GET = createApiHandler(async (req, { user }) => {
  // Lógica aqui
  return NextResponse.json(data);
});
```

### 3. Variáveis de Ambiente

**Antes:**
```ts
// frontend: import.meta.env.VITE_API_URL
// backend: process.env.API_URL
```

**Depois:**
```ts
// Cliente: process.env.NEXT_PUBLIC_API_URL
// Servidor: process.env.API_URL (sem NEXT_PUBLIC_)
```

### 4. Supabase Client

**Antes:**
```ts
// frontend/src/lib/supabaseClient.ts
const supabase = createClient(url, anonKey);
```

**Depois:**
```ts
// lib/supabase/client.ts (cliente)
const supabase = createClient(url, anonKey);

// lib/supabase/server.ts (servidor)
export function createServerClient() {
  return createClient(url, serviceRoleKey);
}
```

## Passos para Completar a Migração

### 1. Migrar Componentes

Os componentes React podem ser migrados quase diretamente:

1. Mover `frontend/src/components/` → `components/`
2. Ajustar imports:
   - `@/components` em vez de caminhos relativos
   - Remover `.tsx` das extensões se necessário

### 2. Migrar Páginas

1. Criar diretórios em `app/` para cada rota
2. Mover conteúdo de `frontend/src/pages/*` para `app/*/page.tsx`
3. Ajustar imports e hooks do Next.js

**Exemplo:**
```tsx
// app/clientes/page.tsx
"use client"; // Necessário para usar hooks

import { ClientsPage } from "@/components/pages/Clients";

export default function ClientesPage() {
  return <ClientsPage />;
}
```

### 3. Migrar Rotas da API

Para cada rota Express:

1. Criar `app/api/[route-name]/route.ts`
2. Converter handlers do Express para Next.js:

```ts
// Antes
router.get("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  res.json(data);
});

// Depois
export const GET = createApiHandler(
  async (req, { user, params }) => {
    const { id } = params;
    return NextResponse.json(data);
  },
  { requireAuth: true }
);
```

### 4. Migrar Middleware

O middleware do Express precisa ser convertido:

1. Autenticação: `middleware.ts` (Next.js edge middleware)
2. Erros: `lib/utils/errorHandler.ts`
3. API handler wrapper: `lib/utils/apiHandler.ts`

### 5. Configurar Ambiente

1. Copiar `.env.local.example` para `.env.local`
2. Preencher todas as variáveis
3. No Vercel, configurar variáveis no painel

## Rotas a Migrar

### Frontend (Páginas)
- [ ] `/` → `app/page.tsx` (Dashboard)
- [ ] `/login` → `app/login/page.tsx`
- [ ] `/clientes` → `app/clientes/page.tsx`
- [ ] `/contratos` → `app/contratos/page.tsx`
- [ ] `/templates` → `app/templates/page.tsx`
- [ ] `/servicos` → `app/servicos/page.tsx`
- [ ] `/usuarios` → `app/usuarios/page.tsx`
- [ ] `/usuarios-cloud` → `app/usuarios-cloud/page.tsx`
- [ ] `/usuarios-hub` → `app/usuarios-hub/page.tsx`
- [ ] `/usuarios-tele` → `app/usuarios-tele/page.tsx`
- [ ] `/relatorios/servicos` → `app/relatorios/servicos/page.tsx`
- [ ] `/admin/usuarios` → `app/admin/usuarios/page.tsx`
- [ ] `/perfil` → `app/perfil/page.tsx`
- [ ] `/guia` → `app/guia/page.tsx`

### Backend (API Routes)
- [ ] `/api/clients` → `app/api/clients/route.ts`
- [ ] `/api/contracts` → `app/api/contracts/route.ts`
- [ ] `/api/templates` → `app/api/templates/route.ts`
- [ ] `/api/services` → `app/api/services/route.ts`
- [ ] `/api/tv` → `app/api/tv/route.ts`
- [ ] `/api/cloud` → `app/api/cloud/route.ts`
- [ ] `/api/users` → `app/api/users/route.ts`
- [ ] `/api/stats` → `app/api/stats/route.ts`
- [ ] `/api/reports` → `app/api/reports/route.ts`
- [ ] `/api/requests` → `app/api/requests/route.ts`
- [ ] `/api/assistant` → `app/api/assistant/route.ts`
- [ ] `/api/admin/users` → `app/api/admin/users/route.ts`

## Ajustes Necessários

### 1. Imports

Substituir em todos os arquivos:
```ts
// Antes
import { api } from "../api/client";
import supabase from "../lib/supabaseClient";

// Depois
import axios from "axios";
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "/api",
});
import { supabase } from "@/lib/supabase/client";
```

### 2. Navegação

```ts
// Antes (React Router)
import { useNavigate } from "react-router-dom";
const navigate = useNavigate();
navigate("/clientes");

// Depois (Next.js)
import { useRouter } from "next/navigation";
const router = useRouter();
router.push("/clientes");
```

### 3. Hooks do Next.js

Adicionar `"use client"` no topo de componentes que usam:
- `useState`, `useEffect`, `useContext`
- Event handlers
- Browser APIs

### 4. Server Components

Componentes sem interatividade podem ser Server Components:
- Não adicionar `"use client"`
- Podem fazer fetch direto no servidor
- Não podem usar hooks do React

## Comandos Úteis

```bash
# Instalar dependências
npm install

# Desenvolvimento
npm run dev

# Build
npm run build

# Produção
npm start

# Type checking
npm run type-check

# Lint
npm run lint
```

## Dependências Principais

### Mantidas
- `@chakra-ui/react` - UI Framework
- `@supabase/supabase-js` - Database/Auth
- `@tanstack/react-query` - Data fetching
- `axios` - HTTP client
- `react-hook-form` - Forms
- `zod` - Validation

### Adicionadas
- `next` - Framework
- `react` e `react-dom` - Atualizados para versão compatível

### Removidas
- `vite` - Substituído pelo Next.js
- `react-router-dom` - Roteamento nativo do Next.js
- `express` - API Routes do Next.js

## Próximos Passos

1. Migrar todas as páginas restantes
2. Migrar todas as rotas da API
3. Testar autenticação completa
4. Testar todas as funcionalidades
5. Configurar CI/CD no Vercel
6. Deploy de teste
7. Deploy em produção

## Notas Importantes

- ⚠️ Sempre teste cada rota/página após migrar
- ⚠️ Verifique que variáveis de ambiente estão configuradas
- ⚠️ Certifique-se de que autenticação está funcionando
- ⚠️ Teste permissões de admin vs user
- ⚠️ Verifique que nenhuma chave está hardcoded

---

**Última atualização:** 2025-01-17





