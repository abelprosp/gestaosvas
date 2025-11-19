-- Extensões necessárias
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- Tipos enumerados
create type contract_status as enum ('DRAFT', 'SENT', 'SIGNED', 'CANCELLED');
create type line_type as enum ('TITULAR', 'DEPENDENTE');

-- Tabela de clientes
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  document text not null,
  cost_center text not null default 'LUXUS' check (cost_center in ('LUXUS','NEXUS')),
  company_name text,
  notes text,
  address text,
  city text,
  state text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists clients_document_idx on clients(document);
create unique index if not exists clients_email_idx on clients(email);

-- Templates
create table if not exists contract_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  content text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Contratos
create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  status contract_status not null default 'DRAFT',
  content text not null,
  sign_url text,
  external_id text,
  sent_at timestamptz,
  signed_at timestamptz,
  storage_location text,
  client_id uuid not null references clients(id) on delete cascade,
  template_id uuid references contract_templates(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contracts_client_idx on contracts(client_id);
create index if not exists contracts_status_idx on contracts(status);

-- Linhas telefônicas
create table if not exists lines (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  nickname text,
  phone_number text not null,
  type line_type not null default 'TITULAR',
  document text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lines_client_idx on lines(client_id);
create unique index if not exists lines_phone_idx on lines(phone_number);

-- Serviços cadastráveis
create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(12,2) not null default 0,
  allow_custom_price boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists services_name_idx on services(lower(name));

-- Relação clientes x serviços
create table if not exists client_services (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  service_id uuid not null references services(id) on delete cascade,
  custom_price numeric(12,2),
  created_at timestamptz not null default now(),
  unique (client_id, service_id)
);

-- Acessos Cloud (controle de vencimentos)
create table if not exists cloud_accesses (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  service_id uuid not null references services(id) on delete cascade,
  expires_at date not null,
  is_test boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, service_id)
);

create index if not exists cloud_accesses_client_idx on cloud_accesses(client_id);
create index if not exists cloud_accesses_service_idx on cloud_accesses(service_id);
create index if not exists cloud_accesses_expires_at_idx on cloud_accesses(expires_at);

-- Atualiza automaticamente updated_at
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger clients_set_updated_at
before update on clients
for each row
execute procedure set_updated_at();

create trigger contract_templates_set_updated_at
before update on contract_templates
for each row
execute procedure set_updated_at();

create trigger contracts_set_updated_at
before update on contracts
for each row
execute procedure set_updated_at();

create trigger lines_set_updated_at
before update on lines
for each row
execute procedure set_updated_at();

create trigger services_set_updated_at
before update on services
for each row
execute procedure set_updated_at();

create trigger cloud_accesses_set_updated_at
before update on cloud_accesses
for each row
execute procedure set_updated_at();

-- Contas de TV (cada e-mail atende até 8 usuários)
create table if not exists tv_accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

-- Slots de acesso vinculados às contas de TV
create table if not exists tv_slots (
  id uuid primary key default gen_random_uuid(),
  tv_account_id uuid not null references tv_accounts(id) on delete cascade,
  slot_number smallint not null check (slot_number between 1 and 8),
  username text not null,
  password text not null,
  status text not null default 'AVAILABLE',
  client_id uuid references clients(id) on delete set null,
  sold_by text,
  sold_at timestamptz,
  starts_at date not null default current_date,
  expires_at date,
  notes text,
  plan_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tv_account_id, slot_number)
);

create index if not exists tv_slots_client_idx on tv_slots(client_id);
create index if not exists tv_slots_status_idx on tv_slots(status);

-- Histórico de alterações nos slots
create table if not exists tv_slot_history (
  id uuid primary key default gen_random_uuid(),
  tv_slot_id uuid not null references tv_slots(id) on delete cascade,
  action text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create trigger tv_slots_set_updated_at
before update on tv_slots
for each row
execute procedure set_updated_at();

-- Solicitações de ação (ex: criação de vendedor, autorizações)
create table if not exists action_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  payload jsonb,
  status text not null default 'PENDING',
  created_at timestamptz not null default now()
);

create index if not exists action_requests_status_idx on action_requests(status);
