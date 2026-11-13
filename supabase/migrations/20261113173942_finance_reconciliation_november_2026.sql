begin;

alter table public.budget_entries
  add column if not exists account_name text,
  add column if not exists payment_status text not null default 'planned' check (payment_status in ('planned','paid','received','cancelled')),
  add column if not exists affects_projection boolean not null default true,
  add column if not exists is_before_snapshot boolean not null default false,
  add column if not exists is_archived boolean not null default false,
  add column if not exists is_internal_transfer boolean not null default false,
  add column if not exists is_exceptional boolean not null default false,
  add column if not exists exclude_from_average boolean not null default false,
  add column if not exists context text,
  add column if not exists business_project text,
  add column if not exists owner_advance boolean not null default false,
  add column if not exists recurring_key text,
  add column if not exists is_variable_estimate boolean not null default false;

update public.budget_entries
set payment_status = case when status='recu' and type='revenu' then 'received' when status='recu' then 'paid' else 'planned' end,
    affects_projection = status <> 'recu';

alter table public.subscriptions
  add column if not exists provider text,
  add column if not exists currency text not null default 'EUR',
  add column if not exists expected_date date,
  add column if not exists frequency text not null default 'MONTHLY',
  add column if not exists payment_account text,
  add column if not exists lifecycle_status text not null default 'ACTIVE' check (lifecycle_status in ('ACTIVE','TO_CHECK','TO_CANCEL','CANCELLED','ONE_OFF','API_CREDIT')),
  add column if not exists last_payment date,
  add column if not exists next_expected_payment date,
  add column if not exists cancel_requested boolean not null default false,
  add column if not exists expected_window text;

do $$ begin
  if not exists (select 1 from pg_roles where rolname='budgy_finance_server') then
    create role budgy_finance_server nologin;
  end if;
  execute format('grant budgy_finance_server to %I', current_user);
end $$;
grant usage on schema public to budgy_finance_server;
grant select on public.budget_entries,public.subscriptions to budgy_finance_server;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='budget_entries' and policyname='finance_server_scope') then
    create policy finance_server_scope on public.budget_entries to budgy_finance_server
      using (user_id=nullif(current_setting('budgy.finance_user_id',true),'')::uuid);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='subscriptions' and policyname='finance_server_scope') then
    create policy finance_server_scope on public.subscriptions to budgy_finance_server
      using (user_id=nullif(current_setting('budgy.finance_user_id',true),'')::uuid);
  end if;
end $$;

create table if not exists public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.budgy_users(id) on delete cascade,
  name text not null,
  account_type text not null check (account_type in ('BANK','CASH','MEAL_VOUCHER')),
  currency text not null default 'EUR',
  balance numeric(14,2) not null default 0,
  snapshot_date date not null,
  include_in_cash boolean not null default true,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,name)
);

create table if not exists public.budget_envelopes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.budgy_users(id) on delete cascade,
  month date not null check (extract(day from month)=1),
  name text not null,
  category text not null,
  target_amount numeric(14,2) not null check (target_amount>=0),
  historical_average numeric(14,2),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,month,name)
);

create table if not exists public.finance_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.budgy_users(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('PERSONAL','TRAVEL','BUSINESS')),
  status text not null default 'ACTIVE' check (status in ('PLANNED','ACTIVE','COMPLETED','CANCELLED')),
  start_date date,
  end_date date,
  exclude_from_average boolean not null default false,
  planned_amount numeric(14,2),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,name)
);

create table if not exists public.finance_provisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.budgy_users(id) on delete cascade,
  project_id uuid references public.finance_projects(id) on delete set null,
  name text not null,
  amount numeric(14,2) not null check (amount>=0),
  target_date date not null,
  category text not null default 'Provision',
  status text not null default 'PLANNED' check (status in ('PLANNED','FUNDED','SPENT','CANCELLED')),
  flexible boolean not null default false,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,name,target_date)
);

create table if not exists public.finance_sub_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.budgy_users(id) on delete cascade,
  provision_id uuid not null references public.finance_provisions(id) on delete cascade,
  name text not null,
  beneficiary text,
  planned_amount numeric(14,2) not null default 0 check (planned_amount>=0),
  actual_amount numeric(14,2) not null default 0 check (actual_amount>=0),
  status text not null default 'PLANNED' check (status in ('PLANNED','BOUGHT','CANCELLED')),
  purchase_date date,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.budgy_users(id) on delete cascade,
  name text not null,
  principal numeric(14,2) not null check (principal>=0),
  monthly_payment numeric(14,2) not null default 0 check (monthly_payment>=0),
  remaining_months integer check (remaining_months>=0),
  creditor text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','PAID','PAUSED','CANCELLED')),
  starts_on date,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,name)
);

create index if not exists budget_entries_projection_idx on public.budget_entries(user_id,date,affects_projection) where not is_archived;
create index if not exists budget_entries_average_idx on public.budget_entries(user_id,date,category) where not exclude_from_average and not is_archived;
create index if not exists budget_envelopes_month_idx on public.budget_envelopes(user_id,month);
create index if not exists finance_provisions_target_idx on public.finance_provisions(user_id,target_date,status);
create index if not exists finance_sub_expenses_parent_idx on public.finance_sub_expenses(provision_id,status);

do $$
declare finance_table text;
begin
  foreach finance_table in array array['finance_accounts','budget_envelopes','finance_projects','finance_provisions','finance_sub_expenses','finance_debts']
  loop
    execute format('alter table public.%I enable row level security', finance_table);
    execute format('alter table public.%I force row level security', finance_table);
    execute format('revoke all on public.%I from public, authenticated', finance_table);
    execute format('grant select,insert,update,delete on public.%I to budgy_finance_server', finance_table);
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=finance_table and policyname='finance_owner_read') then
      execute format('create policy finance_owner_read on public.%I for select to authenticated using (user_id=(select public.current_budgy_user_id()))', finance_table);
    end if;
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=finance_table and policyname='finance_server_scope') then
      execute format('create policy finance_server_scope on public.%I to budgy_finance_server using (user_id=nullif(current_setting(''budgy.finance_user_id'',true),'''')::uuid) with check (user_id=nullif(current_setting(''budgy.finance_user_id'',true),'''')::uuid)', finance_table);
    end if;
  end loop;
end $$;

grant select on public.finance_accounts,public.budget_envelopes,public.finance_projects,public.finance_provisions,public.finance_sub_expenses,public.finance_debts to authenticated;

commit;
