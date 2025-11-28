-- Script para verificar o role de um usuário no Supabase
-- Execute este script no SQL Editor do Supabase Dashboard
-- ⚠️ IMPORTANTE: Execute no Supabase Dashboard, não em um cliente SQL externo

-- 1. Listar todos os usuários com seus roles
SELECT 
  id,
  email,
  COALESCE(
    raw_user_meta_data->>'role',
    raw_app_meta_data->>'role',
    'user'
  ) as role,
  COALESCE(
    raw_user_meta_data->>'name',
    raw_app_meta_data->>'name',
    NULL
  ) as name,
  created_at
FROM auth.users
ORDER BY created_at DESC;

-- 2. Verificar um usuário específico por email (substitua o email)
SELECT 
  id,
  email,
  COALESCE(
    raw_user_meta_data->>'role',
    raw_app_meta_data->>'role',
    'user'
  ) as role,
  COALESCE(
    raw_user_meta_data->>'name',
    raw_app_meta_data->>'name',
    NULL
  ) as name,
  raw_user_meta_data as metadata_completo
FROM auth.users
WHERE email = 'thomas.bugs@nexusrs.com.br'; -- ⚠️ SUBSTITUA PELO SEU EMAIL

-- 3. Atualizar o role de um usuário específico para admin (substitua o email)
-- ⚠️ ATENÇÃO: Execute apenas se tiver certeza que quer tornar o usuário admin
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"admin"'
)
WHERE email = 'thomas.bugs@nexusrs.com.br'; -- ⚠️ SUBSTITUA PELO SEU EMAIL

-- 4. Verificar se a atualização funcionou
SELECT 
  id,
  email,
  raw_user_meta_data->>'role' as role,
  raw_user_meta_data as metadata_completo
FROM auth.users
WHERE email = 'thomas.bugs@nexusrs.com.br'; -- ⚠️ SUBSTITUA PELO SEU EMAIL
