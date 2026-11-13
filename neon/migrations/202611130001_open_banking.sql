begin;

-- The migration and DATABASE_URL must use the same Neon role. Only this role
-- may assume the banking writer role. The Data API retains user-scoped reads.
create role budgy_banking_server nologin;
grant budgy_banking_server to current_user;
grant usage on schema public to budgy_banking_server;

create table public.bank_connections (
  id uuid primary key default gen_random_uuid(),
  budgy_user_id uuid not null,
  provider text not null,
  institution_id text not null,
  institution_name text not null,
  requisition_id text,
  agreement_id text,
  status text not null default 'pending' check (status in ('active', 'pending', 'expired', 'revoked', 'error')),
  consent_state_hash text unique,
  consent_started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_synced_at timestamptz,
  expires_at timestamptz,
  next_sync_at timestamptz,
  operation_id uuid,
  operation_until timestamptz,
  unique (budgy_user_id, provider, institution_id),
  unique (budgy_user_id, id)
);

create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  budgy_user_id uuid not null,
  bank_connection_id uuid not null,
  provider_account_id text not null,
  account_identity text,
  name text not null,
  display_name text not null,
  iban text,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  account_type text,
  current_balance numeric,
  available_balance numeric,
  active boolean not null default true,
  last_synced_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (budgy_user_id, bank_connection_id)
    references public.bank_connections (budgy_user_id, id) on delete cascade,
  unique (budgy_user_id, id),
  unique (bank_connection_id, provider_account_id, currency)
);
create index bank_accounts_identity_idx on public.bank_accounts (bank_connection_id, account_identity, currency);

create table public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  budgy_user_id uuid not null,
  bank_account_id uuid not null,
  provider_transaction_id text,
  dedupe_key text not null,
  booking_date date,
  value_date date,
  amount numeric not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  description text not null,
  counterparty text,
  status text not null check (status in ('booked', 'pending')),
  raw_category text,
  budgy_category text,
  budget_entry_id uuid references public.budget_entries (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (budgy_user_id, bank_account_id)
    references public.bank_accounts (budgy_user_id, id) on delete cascade,
  unique (bank_account_id, dedupe_key),
  unique (budgy_user_id, budget_entry_id)
);
create index bank_transactions_timeline_idx on public.bank_transactions
  (budgy_user_id, (coalesce(booking_date, value_date)) desc nulls last, id);
create index bank_transactions_budget_idx on public.bank_transactions (budget_entry_id)
  where budget_entry_id is not null;

create table public.bank_sync_runs (
  id uuid primary key,
  budgy_user_id uuid not null,
  bank_connection_id uuid not null,
  status text not null check (status in ('running', 'success', 'error')),
  error_code text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  foreign key (budgy_user_id, bank_connection_id)
    references public.bank_connections (budgy_user_id, id) on delete cascade
);
create index bank_sync_runs_connection_idx on public.bank_sync_runs (budgy_user_id, bank_connection_id, started_at desc);

do $$
declare
  banking_table text;
begin
  foreach banking_table in array array['bank_connections', 'bank_accounts', 'bank_transactions', 'bank_sync_runs']
  loop
    execute format('alter table public.%I enable row level security', banking_table);
    execute format('alter table public.%I force row level security', banking_table);
    execute format('revoke all on public.%I from public, anonymous, authenticated', banking_table);
    execute format('grant select, insert, update, delete on public.%I to budgy_banking_server', banking_table);
    execute format(
      'create policy bank_owner_read on public.%I for select to authenticated using (budgy_user_id = (select public.current_budgy_user_id()))',
      banking_table
    );
    execute format(
      'create policy bank_server_scope on public.%I to budgy_banking_server using (budgy_user_id = nullif(current_setting(''budgy.banking_user_id'', true), '''')::uuid) with check (budgy_user_id = nullif(current_setting(''budgy.banking_user_id'', true), '''')::uuid)',
      banking_table
    );
  end loop;
end;
$$;

grant select (id, budgy_user_id, provider, institution_id, institution_name, status, created_at,
  updated_at, last_synced_at, expires_at) on public.bank_connections to authenticated;
grant select (id, budgy_user_id, bank_connection_id, name, display_name, currency, account_type,
  current_balance, available_balance, active, last_synced_at, created_at, updated_at)
  on public.bank_accounts to authenticated;
grant select (id, budgy_user_id, bank_account_id, booking_date, value_date, amount, currency,
  description, counterparty, status, raw_category, budgy_category, budget_entry_id, created_at, updated_at)
  on public.bank_transactions to authenticated;
grant select on public.bank_sync_runs to authenticated;

commit;
