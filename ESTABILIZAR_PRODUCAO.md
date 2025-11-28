# 🚨 URGENTE: Estabilizar Site em Produção

## Problema Identificado

O site em produção (https://gestaosvas.vercel.app) está sofrendo alterações que não deveriam estar acontecendo:
- ❌ Sumiram opções
- ❌ Erro ao carregar email
- ❌ Não mostra mais emails de acesso que vão ser criados
- ❌ Não mostra mais opção para editar

## ⚠️ IMPORTANTE: O site em produção NÃO deveria mudar sem commit

## Ações Imediatas Necessárias

### 1. Verificar se há auto-deploy configurado no Vercel

1. Acesse: https://vercel.com/dashboard
2. Selecione o projeto `gestaosvas`
3. Vá em **Settings** > **Git**
4. Verifique se há **auto-deploy** habilitado para alguma branch
5. **DESABILITE** auto-deploy se estiver ativo para branches que não sejam `main` ou `master`

### 2. Verificar qual commit está em produção

No Vercel Dashboard:
1. Vá em **Deployments**
2. Veja qual commit está deployado atualmente
3. Compare com o commit mais recente no repositório

### 3. Reverter para um commit estável (se necessário)

Se o site em produção está quebrado:

```bash
# 1. Identifique o último commit que funcionava
git log --oneline -20

# 2. Crie uma branch de hotfix
git checkout -b hotfix/reverter-producao

# 3. Reverta para o último commit estável (substitua COMMIT_HASH)
git revert COMMIT_HASH

# 4. Force push para produção (CUIDADO!)
# git push origin hotfix/reverter-producao:main --force
```

**⚠️ CUIDADO**: Só faça force push se tiver certeza absoluta!

### 4. Garantir que alterações locais não sejam deployadas

**NUNCA faça push de alterações não testadas para produção!**

Verifique o status atual:

```bash
# Ver arquivos modificados
git status

# Ver diferenças
git diff

# Se houver alterações que não devem ir para produção:
git stash  # Salva alterações temporariamente
```

### 5. Verificar variáveis de ambiente no Vercel

1. Acesse Vercel Dashboard > Settings > Environment Variables
2. Verifique se todas as variáveis necessárias estão configuradas:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Outras variáveis necessárias

### 6. Limpar cache do Vercel

No Vercel Dashboard:
1. Vá em **Deployments**
2. Clique nos 3 pontos do último deploy
3. Selecione **Redeploy** (isso limpa o cache)

## Arquivos Modificados Localmente (NÃO COMMITADOS)

Estes arquivos foram modificados localmente e **NÃO devem ser deployados** até serem testados:

- `app/api/clients/lookup/cnpj/[cnpj]/route.ts`
- `app/api/tv/slots/[id]/route.ts`
- `components/pages/Users/UsersPage.tsx`
- `context/AuthContext.tsx`
- `lib/api/client.ts`
- `lib/auth.ts`
- `lib/utils/apiHandler.ts`
- `next.config.js`

## Recomendações

1. **NÃO faça commit** dessas alterações até resolver os problemas de autenticação
2. **Teste tudo localmente** antes de fazer deploy
3. **Use uma branch de desenvolvimento** para testar alterações
4. **Só faça merge para main** quando tudo estiver funcionando

## Se o Site em Produção Está Quebrado

### Opção 1: Reverter para último commit estável

```bash
# Ver histórico
git log --oneline -10

# Reverter para commit específico (substitua COMMIT_HASH)
git checkout COMMIT_HASH
git checkout -b hotfix/restaurar-producao
git push origin hotfix/restaurar-producao
```

Depois, no Vercel, faça deploy dessa branch.

### Opção 2: Fazer rollback no Vercel

1. Vá em **Deployments**
2. Encontre o último deploy que funcionava
3. Clique nos 3 pontos > **Promote to Production**

## Próximos Passos

1. ✅ Verifique o Vercel Dashboard para ver qual commit está em produção
2. ✅ Desabilite auto-deploy se estiver ativo
3. ✅ Verifique se as variáveis de ambiente estão corretas
4. ✅ Se necessário, faça rollback para um commit estável
5. ✅ Teste tudo localmente antes de fazer novos deploys

