-- Adicionar coluna opened_by na tabela clients
-- Vendedor que abriu/cadastrou o cliente

alter table clients 
add column if not exists opened_by text;

create index if not exists clients_opened_by_idx on clients(opened_by);
