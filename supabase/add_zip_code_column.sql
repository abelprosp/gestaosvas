-- Adiciona coluna zip_code (CEP) na tabela clients
-- Execute este script no Supabase SQL Editor

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

