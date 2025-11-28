# Alternativa: Corrigir Role do Usuário via API do Supabase

Se o SQL direto não funcionar, você pode usar a API do Supabase Admin. Aqui estão duas opções:

## Opção 1: Usar o Script TypeScript (Recomendado)

Execute o script `create-admin.ts` que já existe no projeto:

```bash
npm run create-admin
# ou
npx ts-node create-admin.ts
```

Este script usa a API do Supabase Admin para atualizar o role corretamente.

## Opção 2: Usar o Supabase Dashboard (Mais Fácil)

1. Acesse o **Supabase Dashboard**
2. Vá em **Authentication** > **Users**
3. Encontre seu usuário pelo email
4. Clique no usuário para editar
5. Na seção **User Metadata**, adicione ou edite:
   ```json
   {
     "role": "admin"
   }
   ```
6. Clique em **Save**

## Opção 3: Usar SQL no Supabase Dashboard (Corrigido)

O script SQL foi corrigido para usar `raw_user_meta_data` ao invés de `user_metadata`.

1. Acesse o **Supabase Dashboard**
2. Vá em **SQL Editor**
3. Cole o script de `supabase/fix_user_role_admin.sql`
4. **Substitua o email** no script pelo seu email
5. Execute o script

## Verificar se Funcionou

Após qualquer uma das opções acima, execute no SQL Editor:

```sql
SELECT 
  email,
  raw_user_meta_data->>'role' as role
FROM auth.users
WHERE email = 'SEU_EMAIL_AQUI';
```

O campo `role` deve mostrar `admin`.

## Importante

- ⚠️ **Sempre faça logout e login novamente** após alterar o role
- ⚠️ **Limpe o cache do navegador** (Ctrl+Shift+R)
- ⚠️ O Supabase usa `raw_user_meta_data` na tabela `auth.users`, não `user_metadata`
