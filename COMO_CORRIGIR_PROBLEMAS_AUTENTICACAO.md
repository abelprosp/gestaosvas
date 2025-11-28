# Como Corrigir Problemas de Autenticação e Permissões

## Problemas Identificados

1. **Erro de autenticação ao salvar alterações**: "Erro de autenticação. Por favor, faça login novamente."
2. **Botão de remover slots não aparece**: O botão só deve aparecer para administradores.

## Correções Aplicadas

### 1. Autenticação Melhorada
- ✅ Melhorado o interceptor do axios para atualizar tokens automaticamente
- ✅ Verificação de expiração de token antes de fazer requisições
- ✅ Tratamento de erros melhorado

### 2. Botão de Remover Slots
- ✅ Adicionada verificação `isAdmin` antes de mostrar o botão
- ✅ O botão só aparece para slots com status "AVAILABLE" E para usuários admin

## Scripts SQL para Corrigir Role do Usuário

### ⚠️ IMPORTANTE: Use `raw_user_meta_data`, não `user_metadata`

O Supabase armazena os metadados do usuário na coluna `raw_user_meta_data`, não `user_metadata`.

### Opção 1: Script Simples (Recomendado)

Execute no **SQL Editor do Supabase Dashboard**:

```sql
-- ⚠️ SUBSTITUA 'SEU_EMAIL_AQUI@exemplo.com' pelo seu email ANTES de executar

-- Atualizar o role para admin
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"admin"'
)
WHERE email = 'SEU_EMAIL_AQUI@exemplo.com'; -- ⚠️ SUBSTITUA AQUI

-- Verificar se funcionou
SELECT 
  email,
  raw_user_meta_data->>'role' as role
FROM auth.users
WHERE email = 'SEU_EMAIL_AQUI@exemplo.com'; -- ⚠️ SUBSTITUA AQUI
```

### Opção 2: Via Supabase Dashboard (Mais Fácil)

1. Acesse o **Supabase Dashboard**
2. Vá em **Authentication** > **Users**
3. Encontre seu usuário pelo email
4. Clique no usuário para editar
5. Na seção **User Metadata** (ou **Raw User Meta Data**), adicione ou edite:
   ```json
   {
     "role": "admin"
   }
   ```
6. Clique em **Save**

### Opção 3: Verificar o Role Atual

```sql
SELECT 
  email,
  raw_user_meta_data->>'role' as role
FROM auth.users
WHERE email = 'SEU_EMAIL_AQUI@exemplo.com'; -- ⚠️ SUBSTITUA PELO SEU EMAIL
```

## Arquivos de Scripts Criados

Criei dois arquivos SQL na pasta `supabase/`:

1. **`check_user_role.sql`**: Scripts para verificar roles de usuários
2. **`fix_user_role_admin.sql`**: Script completo para corrigir o role para admin

## Próximos Passos

1. **Execute o script SQL** no Supabase Dashboard para corrigir o role
2. **Faça logout e login novamente** na aplicação para atualizar a sessão
3. **Limpe o cache do navegador** (Ctrl+Shift+Delete) ou faça um hard refresh (Ctrl+Shift+R)
4. **Teste novamente**:
   - Tentar salvar alterações na conta TV
   - Verificar se o botão "Remover" aparece nos slots disponíveis

## Se o Problema Persistir

1. **Verifique os logs do console do navegador** (F12) para ver erros detalhados
2. **Verifique os logs do servidor** para ver erros de autenticação
3. **Confirme que o email usado no SQL é o mesmo do login**
4. **Tente fazer logout e login novamente** após executar o SQL

## Notas Importantes

- ⚠️ **SEMPRE substitua o email** nos scripts SQL pelo seu email real
- ⚠️ **Execute os scripts no SQL Editor do Supabase Dashboard**, não no código
- ⚠️ **Faça logout e login novamente** após alterar o role no banco de dados
