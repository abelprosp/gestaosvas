
-- Adiciona coluna opened_by na tabela clients se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'opened_by') THEN
        ALTER TABLE clients ADD COLUMN opened_by TEXT;
    END IF;
END $$;

-- Adiciona coluna sold_by na tabela client_services se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_services' AND column_name = 'sold_by') THEN
        ALTER TABLE client_services ADD COLUMN sold_by TEXT;
    END IF;
END $$;

