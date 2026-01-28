-- Adiciona coluna has_telephony na tabela clients
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'clients'
      AND column_name = 'has_telephony'
  ) THEN
    ALTER TABLE clients ADD COLUMN has_telephony BOOLEAN DEFAULT FALSE;
    RAISE NOTICE 'Coluna has_telephony adicionada com sucesso à tabela clients';
  ELSE
    RAISE NOTICE 'Coluna has_telephony já existe na tabela clients';
  END IF;
END $$;
