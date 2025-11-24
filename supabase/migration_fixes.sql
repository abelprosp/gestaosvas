-- ============================================
-- MIGRAÇÃO: Correções e melhorias
-- ============================================
-- Execute este script no Supabase SQL Editor
-- Data: 2024-11-24

-- 1. Adicionar coluna opened_by (vendedor que abriu o cliente)
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'clients' 
    AND column_name = 'opened_by'
  ) THEN
    ALTER TABLE clients ADD COLUMN opened_by TEXT;
    CREATE INDEX IF NOT EXISTS clients_opened_by_idx ON clients(opened_by);
    RAISE NOTICE 'Coluna opened_by adicionada com sucesso à tabela clients';
  ELSE
    RAISE NOTICE 'Coluna opened_by já existe na tabela clients';
  END IF;
END $$;

-- 2. Verificar se zip_code existe (já deve existir, mas garantindo)
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'clients' 
    AND column_name = 'zip_code'
  ) THEN
    ALTER TABLE clients ADD COLUMN zip_code TEXT;
    RAISE NOTICE 'Coluna zip_code adicionada com sucesso à tabela clients';
  ELSE
    RAISE NOTICE 'Coluna zip_code já existe na tabela clients';
  END IF;
END $$;

-- 3. Separar serviço TV em TV ESSENCIAL e TV PREMIUM
-- Primeiro, verificar se já existem os novos serviços
DO $$
DECLARE
  tv_essencial_id UUID;
  tv_premium_id UUID;
  tv_old_id UUID;
BEGIN
  -- Verificar se TV ESSENCIAL já existe
  SELECT id INTO tv_essencial_id FROM services WHERE LOWER(name) = 'tv essencial';
  
  -- Verificar se TV PREMIUM já existe
  SELECT id INTO tv_premium_id FROM services WHERE LOWER(name) = 'tv premium';
  
  -- Buscar serviço TV antigo (se existir)
  SELECT id INTO tv_old_id FROM services WHERE LOWER(name) = 'tv' AND LOWER(name) NOT IN ('tv essencial', 'tv premium');
  
  -- Criar TV ESSENCIAL se não existir
  IF tv_essencial_id IS NULL THEN
    INSERT INTO services (name, description, price, allow_custom_price)
    VALUES ('TV ESSENCIAL', 'Serviço de TV Essencial com acesso a conteúdo básico', 0, false)
    RETURNING id INTO tv_essencial_id;
    RAISE NOTICE 'Serviço TV ESSENCIAL criado com ID: %', tv_essencial_id;
  ELSE
    RAISE NOTICE 'Serviço TV ESSENCIAL já existe com ID: %', tv_essencial_id;
  END IF;
  
  -- Criar TV PREMIUM se não existir
  IF tv_premium_id IS NULL THEN
    INSERT INTO services (name, description, price, allow_custom_price)
    VALUES ('TV PREMIUM', 'Serviço de TV Premium com acesso a conteúdo completo', 0, false)
    RETURNING id INTO tv_premium_id;
    RAISE NOTICE 'Serviço TV PREMIUM criado com ID: %', tv_premium_id;
  ELSE
    RAISE NOTICE 'Serviço TV PREMIUM já existe com ID: %', tv_premium_id;
  END IF;
  
  -- Migrar clientes que tinham serviço TV antigo
  -- ATENÇÃO: Esta migração assume que todos os clientes com TV antiga serão migrados para TV ESSENCIAL
  -- Você pode ajustar a lógica conforme necessário
  IF tv_old_id IS NOT NULL THEN
    -- Migrar para TV ESSENCIAL (ou você pode fazer uma lógica mais complexa baseada em plan_type)
    UPDATE client_services 
    SET service_id = tv_essencial_id 
    WHERE service_id = tv_old_id;
    
    RAISE NOTICE 'Clientes migrados do serviço TV antigo para TV ESSENCIAL';
    
    -- Opcional: Remover serviço TV antigo (descomente se quiser)
    -- DELETE FROM services WHERE id = tv_old_id;
    -- RAISE NOTICE 'Serviço TV antigo removido';
  END IF;
END $$;

-- 4. Verificar estrutura da tabela tv_accounts (para cadastro manual)
-- A tabela já deve existir, mas garantindo que tem a estrutura correta
DO $$
BEGIN
  -- Verificar se a tabela existe
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tv_accounts') THEN
    RAISE NOTICE 'Tabela tv_accounts existe';
  ELSE
    RAISE EXCEPTION 'Tabela tv_accounts não existe!';
  END IF;
END $$;

-- Fim da migração
RAISE NOTICE 'Migração concluída com sucesso!';

