# ✅ Resumo das Correções Aplicadas

## Problemas Corrigidos

### 1. ✅ Erro de Autenticação
- **Arquivo**: `lib/api/client.ts`
- **Correção**: Melhorado o interceptor do axios para atualizar tokens automaticamente quando necessário

### 2. ✅ Botão de Remover Slots
- **Arquivo**: `components/pages/Users/UsersPage.tsx` (linha 1926)
- **Correção**: Adicionada verificação `isAdmin` antes de mostrar o botão

### 3. ✅ Erro de Compilação TypeScript
- **Arquivo**: `app/api/clients/lookup/cnpj/[cnpj]/route.ts` (linha 194)
- **Correção**: Removido `});` extra no final do arquivo

## Como Forçar Recompilação Completa

### Passo 1: Parar o servidor
```bash
# Pressione Ctrl+C no terminal onde o servidor está rodando
```

### Passo 2: Limpar todos os caches
```bash
# Execute o script criado
./rebuild.sh

# Ou manualmente:
rm -rf .next
rm -rf .tsbuildinfo
find . -type d -name "node_modules/.cache" -exec rm -rf {} + 2>/dev/null
```

### Passo 3: Reiniciar o servidor
```bash
npm run dev
```

### Passo 4: Limpar cache do navegador
- **Chrome/Edge**: `Ctrl+Shift+R` (hard refresh)
- **Ou**: Abra DevTools (F12) > Clique direito no botão de recarregar > "Esvaziar cache e atualizar forçadamente"

## Verificar se as Correções Estão Ativas

### 1. Verificar código no navegador
Abra o DevTools (F12) > Console e procure por:
- `[API Interceptor]` - logs do interceptor melhorado
- `[createApiHandler]` - logs do handler

### 2. Verificar botão de remover
- O botão "Remover" deve aparecer apenas em slots com status "AVAILABLE"
- E apenas se você for admin

### 3. Verificar autenticação
- Tente salvar alterações na conta TV
- Se ainda der erro, verifique o role do usuário (veja próxima seção)

## Corrigir Role do Usuário para Admin

### Opção 1: Via Supabase Dashboard (Mais Fácil)

1. Acesse: https://app.supabase.com
2. Vá em **Authentication** > **Users**
3. Encontre seu usuário pelo email
4. Clique no usuário para editar
5. Na seção **User Metadata**, adicione:
   ```json
   {
     "role": "admin"
   }
   ```
6. Salve

### Opção 2: Via SQL (Script Simples)

Execute no **SQL Editor do Supabase Dashboard**:

```sql
-- ⚠️ SUBSTITUA pelo seu email ANTES de executar
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"admin"'
)
WHERE email = 'SEU_EMAIL_AQUI@exemplo.com';

-- Verificar
SELECT email, raw_user_meta_data->>'role' as role
FROM auth.users
WHERE email = 'SEU_EMAIL_AQUI@exemplo.com';
```

## Depois de Corrigir o Role

1. **Faça logout** na aplicação
2. **Faça login novamente**
3. **Limpe o cache do navegador** (`Ctrl+Shift+R`)
4. **Teste novamente**

## Arquivos Modificados

- ✅ `lib/api/client.ts` - Interceptor de autenticação melhorado
- ✅ `components/pages/Users/UsersPage.tsx` - Botão de remover com verificação admin
- ✅ `app/api/clients/lookup/cnpj/[cnpj]/route.ts` - Correção de sintaxe
- ✅ `lib/utils/apiHandler.ts` - Logs de debug melhorados

## Scripts Criados

- ✅ `rebuild.sh` - Script para limpar caches
- ✅ `supabase/fix_user_role_simple.sql` - Script SQL para corrigir role
- ✅ `FORCE_REBUILD.md` - Guia de rebuild completo

## Próximos Passos

1. Execute `./rebuild.sh`
2. Reinicie o servidor (`npm run dev`)
3. Faça hard refresh no navegador (`Ctrl+Shift+R`)
4. Se ainda tiver problemas de autenticação, corrija o role do usuário
5. Faça logout e login novamente

