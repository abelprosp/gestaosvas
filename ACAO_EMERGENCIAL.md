# 🚨 AÇÃO EMERGENCIAL - Site em Produção Quebrado

## Situação Atual

O site em produção (https://gestaosvas.vercel.app) está com problemas:
- ❌ Erro ao carregar emails
- ❌ Não mostra emails de acesso
- ❌ Opções de edição sumiram

## ⚠️ PROBLEMA CRÍTICO

O último commit em produção é `e7fca54 (teste)`, que pode ter alterações problemáticas.

## Solução Imediata

### Opção 1: Reverter para commit anterior (RECOMENDADO)

```bash
# 1. Ver commits anteriores
git log --oneline -10

# 2. Reverter para commit antes de "teste" (5d3b97f "proteção")
git checkout 5d3b97f

# 3. Criar branch de hotfix
git checkout -b hotfix/restaurar-producao

# 4. Fazer push
git push origin hotfix/restaurar-producao

# 5. No Vercel, fazer deploy dessa branch
```

### Opção 2: Fazer rollback no Vercel (MAIS RÁPIDO)

1. Acesse: https://vercel.com/dashboard
2. Selecione o projeto `gestaosvas`
3. Vá em **Deployments**
4. Encontre o deploy do commit `5d3b97f (proteção)` ou anterior
5. Clique nos **3 pontos** > **Promote to Production**

### Opção 3: Desabilitar auto-deploy temporariamente

1. Vercel Dashboard > Settings > Git
2. **Desabilite** auto-deploy
3. Isso impede que novos commits sejam deployados automaticamente

## Verificar o que quebrou

O commit `e7fca54 (teste)` pode ter alterações que quebraram o site. Para ver o que mudou:

```bash
git show e7fca54 --stat
git diff 5d3b97f e7fca54
```

## Prevenir Problemas Futuros

1. **NUNCA** faça commit direto na branch `main` sem testar
2. **SEMPRE** teste localmente antes de fazer deploy
3. **USE** branches de desenvolvimento para testar alterações
4. **DESABILITE** auto-deploy no Vercel se não quiser deploys automáticos

## Arquivos Modificados Localmente (NÃO COMMITAR)

Estes arquivos têm alterações locais que **NÃO devem ir para produção** ainda:

- `lib/api/client.ts` - Alterações de autenticação (em teste)
- `lib/auth.ts` - Logs de debug (não devem ir para produção)
- `lib/utils/apiHandler.ts` - Logs de debug
- `components/pages/Users/UsersPage.tsx` - Alterações em desenvolvimento

**NÃO faça commit desses arquivos até resolver os problemas!**

## Próximos Passos Após Restaurar

1. ✅ Restaurar site para versão estável
2. ✅ Testar todas as funcionalidades
3. ✅ Verificar se emails de acesso estão aparecendo
4. ✅ Verificar se opções de edição estão funcionando
5. ✅ Só então fazer novas alterações em branch separada
