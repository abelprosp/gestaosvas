# Relatório de Erros e Bugs - Sistema de Gestão de Serviços

**Data:** 18 de Novembro de 2025  
**Versão:** Next.js 14.2.33  
**Status:** 🔴 Problemas Críticos de Performance Identificados

---

## 📊 Resumo Executivo

O sistema apresenta **problemas críticos de performance** que causam lentidão no carregamento das páginas, especialmente na Dashboard. Identificados **5 problemas principais** que precisam ser corrigidos urgentemente.

---

## 🚨 Problemas Críticos

### 1. **POLLING EXCESSIVO - `/api/stats/overview`**
**Severidade:** 🔴 CRÍTICA  
**Impacto:** Alto consumo de recursos, lentidão na Dashboard

**Descrição:**
- O `DashboardPage` está configurado para fazer requisições automáticas a cada **10 segundos** (`refetchInterval: 10 * 1000`)
- Analisando os logs, foram detectadas **26+ requisições consecutivas** em menos de 1 minuto
- Cada requisição faz **4 queries pesadas** no Supabase sem cache
- Isso causa:
  - Sobrecarga no servidor
  - Consumo excessivo de conexões do Supabase
  - Lentidão geral da aplicação
  - Possível rate limiting do Supabase

**Localização:**
```109:111:components/pages/DashboardPage.tsx
    staleTime: 30 * 1000,
    refetchInterval: 10 * 1000,
    placeholderData: placeholder,
```

**Recomendação:**
- Aumentar `refetchInterval` para **60 segundos** (1 minuto) ou mais
- Aumentar `staleTime` para **120 segundos** (2 minutos)
- Implementar cache no lado do servidor para `/api/stats/overview`
- Considerar usar Server-Sent Events (SSE) ou WebSockets apenas se atualização em tempo real for essencial

---

### 2. **ARQUIVOS ESTÁTICOS RETORNANDO 404**
**Severidade:** 🔴 CRÍTICA  
**Impacto:** Página não carrega completamente, CSS/JS não aplicados

**Descrição:**
- Arquivos estáticos do Next.js estão retornando 404:
  - `/_next/static/css/app/layout.css` → 404
  - `/_next/static/chunks/webpack.js` → 404
  - `/_next/static/chunks/main-app.js` → 404
  - `/_next/static/chunks/app-pages-internals.js` → 404
  - Outros chunks JavaScript → 404

**Causa:**
O middleware está verificando apenas alguns tipos de arquivo (linha 12), mas não inclui `.css` e `.js` na verificação inicial:

```9:15:middleware.ts
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|woff|woff2|ttf|eot)$/i)
  ) {
    return NextResponse.next();
  }
```

Embora o `matcher` do middleware exclua esses arquivos, a verificação manual não está completa.

**Recomendação:**
- Adicionar `.css` e `.js` na verificação do middleware
- Verificar se o cache do Next.js está corrompido (limpar `.next/`)

---

### 3. **CACHE DO WEBPACK CORROMPIDO**
**Severidade:** 🟡 MÉDIA  
**Impacto:** Erros no build, possíveis falhas de compilação

**Descrição:**
```
Error: ENOENT: no such file or directory, stat 
'/home/abel/Serviços-Telefonia/.next/cache/webpack/server-development/19.pack.gz'
```

**Causa:**
Cache do webpack corrompido ou arquivos deletados acidentalmente durante desenvolvimento.

**Recomendação:**
- Limpar cache: `rm -rf .next`
- Reiniciar servidor de desenvolvimento
- Verificar permissões do diretório `.next/`

---

### 4. **GOOGLE FONTS FALHANDO**
**Severidade:** 🟡 MÉDIA  
**Impacto:** Fontes não carregam, fallback para fontes do sistema

**Descrição:**
```
request to https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700&display=swap failed
request to https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap failed
Retrying 1/3...
```

**Causa:**
- Problema de conectividade com Google Fonts
- Possível bloqueio de DNS ou firewall
- Next.js está usando `next/font/google` corretamente, mas as fontes estão sendo baixadas em runtime

**Recomendação:**
- Verificar conectividade com `fonts.googleapis.com`
- Considerar usar fontes locais se o problema persistir
- O Next.js já tem fallback configurado (`display: "swap"`), então não impede o carregamento

---

### 5. **API ROUTE `/api/stats/overview` NÃO OTIMIZADA**
**Severidade:** 🟡 MÉDIA  
**Impacto:** Queries lentas no Supabase, alto consumo de recursos

**Descrição:**
A rota faz **4 queries síncronas** no Supabase sem otimização:

```55:71:app/api/stats/overview/route.ts
export const GET = createApiHandler(async (req) => {
  const supabase = createServerClient();
  const [
    { data: clientsData, error: clientsError },
    slotsResult,
    recentContractsResult,
    clientServicesResult,
  ] = await Promise.all([
    supabase.from("clients").select("id, document, created_at"),
    supabase.from("tv_slots").select("client_id, plan_type, status"),
    supabase
      .from("contracts")
      .select("*, client:clients(*)")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("client_services").select("client_id, service:services(id, name)"),
  ]);
```

**Problemas:**
1. Busca **todos os clientes** sem paginação (`select("id, document, created_at")`)
2. Busca **todos os slots de TV** sem filtros
3. Não há cache no lado do servidor
4. Processamento pesado no cliente (JavaScript no servidor)

**Recomendação:**
- Implementar cache no servidor (Next.js `unstable_cache` ou Redis)
- Adicionar limites/paginação nas queries
- Considerar materializar estatísticas em uma tabela separada atualizada via trigger
- Usar índices adequados no Supabase

---

## 🟢 Problemas Menores

### 6. **AVISOS DE VIEWPORT METADATA**
**Severidade:** 🟢 BAIXA  
**Status:** ✅ Já corrigido (mas ainda aparecem avisos)

Os avisos aparecem porque o Next.js ainda está processando arquivos antigos. Após limpar o cache, devem desaparecer.

---

## 📈 Métricas de Performance Observadas

### Tempo de Resposta das APIs:
- `/api/stats/overview`: **200-1000ms** (variável, alto)
- `/api/stats/sales`: **3855ms** na primeira carga (muito alto)
- Múltiplas requisições simultâneas causam degradação

### Requisições por Minuto:
- Dashboard ativa: **~6 requisições/minuto** para `/api/stats/overview`
- Com múltiplas abas: **~12-18 requisições/minuto**
- Total estimado: **500+ requisições/hora** apenas para stats

---

## ✅ Ações Recomendadas (Prioridade)

### 🔴 URGENTE (Fazer Agora):
1. **Reduzir polling do Dashboard** (10s → 60s)
2. **Corrigir middleware para arquivos estáticos** (adicionar `.css` e `.js`)
3. **Limpar cache do Next.js** (`rm -rf .next`)

### 🟡 IMPORTANTE (Fazer em Breve):
4. **Implementar cache no `/api/stats/overview`**
5. **Otimizar queries do Supabase** (limites, índices)
6. **Investigar falhas do Google Fonts**

### 🟢 OPCIONAL (Melhorias):
7. **Implementar Server-Sent Events** para atualizações em tempo real (se necessário)
8. **Materializar estatísticas** em tabela separada
9. **Adicionar monitoramento de performance** (ex: Vercel Analytics)

---

## 🔧 Comandos para Correção Rápida

```bash
# 1. Limpar cache corrompido
rm -rf .next

# 2. Reiniciar servidor
npm run dev

# 3. Verificar logs de performance
# (monitorar tempo de resposta das APIs no terminal)
```

---

## 📝 Notas Finais

- Os problemas **#1** e **#2** são os mais críticos e devem ser corrigidos imediatamente
- O problema **#1** (polling excessivo) é a principal causa da lentidão
- Após as correções, o sistema deve ter uma melhoria significativa de performance
- Recomenda-se monitorar após as correções para validar a melhoria

---

**Relatório gerado automaticamente em:** 2025-11-18  
**Próxima revisão recomendada:** Após aplicação das correções críticas

