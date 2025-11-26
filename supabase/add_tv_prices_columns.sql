-- Adiciona colunas para preços personalizados de TV Essencial e Premium
-- Esses são fragmentos do serviço TV, não serviços separados

DO $$ 
BEGIN 
  -- Adicionar coluna para preço TV Essencial
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'client_services' 
    AND column_name = 'custom_price_essencial'
  ) THEN
    ALTER TABLE client_services ADD COLUMN custom_price_essencial NUMERIC(12,2);
    RAISE NOTICE 'Coluna custom_price_essencial adicionada com sucesso à tabela client_services';
  ELSE
    RAISE NOTICE 'Coluna custom_price_essencial já existe na tabela client_services';
  END IF;

  -- Adicionar coluna para preço TV Premium
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'client_services' 
    AND column_name = 'custom_price_premium'
  ) THEN
    ALTER TABLE client_services ADD COLUMN custom_price_premium NUMERIC(12,2);
    RAISE NOTICE 'Coluna custom_price_premium adicionada com sucesso à tabela client_services';
  ELSE
    RAISE NOTICE 'Coluna custom_price_premium já existe na tabela client_services';
  END IF;
END $$;




