-- Script para corrigir o role de um usuário para admin
-- ⚠️ SUBSTITUA 'thomas.bugs@nexusrs.com.br' pelo email do seu usuário antes de executar
-- ⚠️ IMPORTANTE: Execute este script no SQL Editor do Supabase Dashboard (não em um cliente SQL externo)

-- Primeiro, verificar se a tabela auth.users existe e tem a coluna user_metadata
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'auth' AND table_name = 'users'
  ) THEN
    RAISE EXCEPTION 'Tabela auth.users não encontrada. Certifique-se de estar executando no Supabase Dashboard.';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'raw_user_meta_data'
  ) THEN
    RAISE EXCEPTION 'Coluna raw_user_meta_data não encontrada. A estrutura da tabela pode ser diferente.';
  END IF;
END $$;

-- Script principal
DO $$
DECLARE
  target_email TEXT := 'thomas.bugs@nexusrs.com.br'; -- ⚠️ SUBSTITUA PELO SEU EMAIL
  user_id UUID;
  current_role TEXT;
  updated_metadata JSONB;
BEGIN
  -- Buscar o ID do usuário pelo email
  -- Nota: Supabase pode usar raw_user_meta_data ao invés de user_metadata
  SELECT 
    id, 
    COALESCE(
      (raw_user_meta_data->>'role'),
      (raw_app_meta_data->>'role'),
      NULL
    ) INTO user_id, current_role
  FROM auth.users
  WHERE email = target_email;
  
  IF user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário com email % não encontrado', target_email;
  END IF;
  
  RAISE NOTICE '✅ Usuário encontrado: ID = %, Role atual = %', user_id, COALESCE(current_role, 'NULL (será definido como admin)');
  
  -- Obter metadata atual (tentar raw_user_meta_data primeiro, depois raw_app_meta_data)
  SELECT 
    COALESCE(
      raw_user_meta_data,
      raw_app_meta_data,
      '{}'::jsonb
    ) INTO updated_metadata
  FROM auth.users
  WHERE id = user_id;
  
  -- Atualizar o role para admin
  updated_metadata := jsonb_set(updated_metadata, '{role}', '"admin"');
  
  -- Atualizar o usuário (usar raw_user_meta_data)
  UPDATE auth.users
  SET raw_user_meta_data = updated_metadata
  WHERE id = user_id;
  
  RAISE NOTICE '✅ Role atualizado para admin com sucesso!';
  RAISE NOTICE '   Email: %', target_email;
  RAISE NOTICE '   ID: %', user_id;
  RAISE NOTICE '   Novo metadata: %', updated_metadata;
  
  -- Verificar a atualização
  SELECT raw_user_meta_data->>'role' INTO current_role
  FROM auth.users
  WHERE id = user_id;
  
  IF current_role = 'admin' THEN
    RAISE NOTICE '✅ Confirmação: Role está definido como "admin"';
  ELSE
    RAISE WARNING '⚠️ Aviso: Role pode não ter sido atualizado corretamente. Valor atual: %', current_role;
  END IF;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao atualizar role: %', SQLERRM;
END $$;

-- Verificar o resultado final
SELECT 
  id,
  email,
  raw_user_meta_data->>'role' as role,
  raw_user_meta_data->>'name' as name,
  raw_user_meta_data as metadata_completo
FROM auth.users
WHERE email = 'thomas.bugs@nexusrs.com.br'; -- ⚠️ SUBSTITUA PELO SEU EMAIL
