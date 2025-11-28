-- Script SIMPLES para corrigir o role para admin
-- ⚠️ SUBSTITUA 'thomas.bugs@nexusrs.com.br' pelo seu email ANTES de executar
-- Execute no SQL Editor do Supabase Dashboard

-- Atualizar o role para admin
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"admin"'
)
WHERE email = 'thomas.bugs@nexusrs.com.br'; -- ⚠️ SUBSTITUA PELO SEU EMAIL

-- Verificar se funcionou
SELECT 
  email,
  raw_user_meta_data->>'role' as role
FROM auth.users
WHERE email = 'thomas.bugs@nexusrs.com.br'; -- ⚠️ SUBSTITUA PELO SEU EMAIL

