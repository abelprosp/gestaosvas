-- Adicionar coluna sold_by na tabela client_services
ALTER TABLE client_services 
ADD COLUMN IF NOT EXISTS sold_by text;

-- Adicionar índice para melhor performance
CREATE INDEX IF NOT EXISTS client_services_sold_by_idx ON client_services(sold_by);

