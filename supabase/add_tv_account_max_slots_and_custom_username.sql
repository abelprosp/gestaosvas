-- =====================================================
-- Migração: Adicionar max_slots e custom_username
-- =====================================================
-- IMPORTANTE: Execute primeiro o arquivo schema.sql se as tabelas não existirem
-- =====================================================

DO $$
BEGIN
  -- Verificar se a tabela tv_accounts existe
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tv_accounts') THEN
    -- Adicionar campo max_slots na tabela tv_accounts
    -- Este campo define quantos slots cada email deve ter (padrão: 8)
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'tv_accounts' AND column_name = 'max_slots') THEN
      ALTER TABLE tv_accounts 
      ADD COLUMN max_slots INTEGER NOT NULL DEFAULT 8 CHECK (max_slots > 0 AND max_slots <= 8);
      
      COMMENT ON COLUMN tv_accounts.max_slots IS 'Quantidade máxima de slots que este email deve ter (padrão: 8)';
      
      RAISE NOTICE '✅ Campo max_slots adicionado à tabela tv_accounts';
    ELSE
      RAISE NOTICE 'ℹ️ Campo max_slots já existe na tabela tv_accounts';
    END IF;
  ELSE
    RAISE WARNING '⚠️ Tabela tv_accounts não existe. Execute primeiro o arquivo schema.sql';
  END IF;

  -- Verificar se a tabela tv_slots existe
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tv_slots') THEN
    -- Adicionar campo custom_username na tabela tv_slots
    -- Este campo permite nomes personalizados para os usuários (ex: "João", "Maria" ao invés de "#1", "#2")
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'tv_slots' AND column_name = 'custom_username') THEN
      ALTER TABLE tv_slots 
      ADD COLUMN custom_username TEXT;
      
      COMMENT ON COLUMN tv_slots.custom_username IS 'Nome personalizado do usuário. Se NULL, usa o padrão baseado no slot_number';
      
      RAISE NOTICE '✅ Campo custom_username adicionado à tabela tv_slots';
    ELSE
      RAISE NOTICE 'ℹ️ Campo custom_username já existe na tabela tv_slots';
    END IF;
  ELSE
    RAISE WARNING '⚠️ Tabela tv_slots não existe. Execute primeiro o arquivo schema.sql';
  END IF;
END $$;

