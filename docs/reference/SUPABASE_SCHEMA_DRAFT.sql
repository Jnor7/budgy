-- SUPABASE_SCHEMA_DRAFT.sql
-- Budget JR Phase 2 architecture draft only.
-- Do not run on production without review.

create extension if not exists pgcrypto;

-- =====================================================
-- Helpers
-- =====================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =====================================================
-- Auth profile and preferences
-- =====================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username is null or username ~ '^[a-zA-Z0-9_]{3,32}$')
);

create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dubai_display_currency text not null default 'AED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_preferences_user_unique unique (user_id),
  constraint user_preferences_dubai_currency check (dubai_display_currency in ('AED', 'EUR', 'FCFA', 'USD'))
);

create table if not exists public.migration_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  export_version integer not null,
  exported_at timestamptz,
  imported_at timestamptz,
  source_app_version text,
  source_platform text default 'ios-swiftdata',
  file_hash text not null,
  status text not null default 'pending',
  entities_count integer not null default 0,
  attachments_count integer not null default 0,
  error_log jsonb,
  report jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint migration_batches_status check (status in ('pending', 'running', 'attachments_uploading', 'completed', 'partial_failed', 'failed', 'rolled_back')),
  constraint migration_batches_file_unique unique (user_id, file_hash)
);

-- =====================================================
-- Tenants
-- =====================================================

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legacy_id text,
  migration_batch_id uuid references public.migration_batches(id) on delete set null,
  name text not null,
  monthly_rent numeric(14,2) not null,
  due_day integer not null,
  note text not null default '',
  source_created_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenants_monthly_rent_nonnegative check (monthly_rent >= 0),
  constraint tenants_due_day_range check (due_day between 1 and 31)
);

create unique index if not exists tenants_user_legacy_unique
  on public.tenants(user_id, legacy_id) where legacy_id is not null;
create index if not exists tenants_user_created_idx on public.tenants(user_id, source_created_at);

create table if not exists public.rent_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legacy_id text,
  migration_batch_id uuid references public.migration_batches(id) on delete set null,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  month integer not null,
  year integer not null,
  is_paid boolean not null default false,
  paid_date date,
  amount_due numeric(14,2) not null default 0,
  amount_received numeric(14,2) not null default 0,
  carry_over numeric(14,2) not null default 0,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rent_payments_month_range check (month between 1 and 12),
  constraint rent_payments_year_range check (year between 2000 and 2100),
  constraint rent_payments_amount_due_nonnegative check (amount_due >= 0),
  constraint rent_payments_amount_received_nonnegative check (amount_received >= 0),
  constraint rent_payments_carry_over_nonnegative check (carry_over >= 0),
  constraint rent_payments_one_month unique (user_id, tenant_id, month, year)
);

create unique index if not exists rent_payments_user_legacy_unique
  on public.rent_payments(user_id, legacy_id) where legacy_id is not null;
create index if not exists rent_payments_user_tenant_idx on public.rent_payments(user_id, tenant_id);
create index if not exists rent_payments_user_month_idx on public.rent_payments(user_id, year, month);

create table if not exists public.tenant_debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legacy_id text,
  migration_batch_id uuid references public.migration_batches(id) on delete set null,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  label text not null,
  amount numeric(14,2) not null,
  month integer not null,
  year integer not null,
  is_paid boolean not null default false,
  source_created_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_debts_amount_nonnegative check (amount >= 0),
  constraint tenant_debts_month_range check (month between 1 and 12),
  constraint tenant_debts_year_range check (year between 2000 and 2100)
);

create unique index if not exists tenant_debts_user_legacy_unique
  on public.tenant_debts(user_id, legacy_id) where legacy_id is not null;
create index if not exists tenant_debts_user_tenant_idx on public.tenant_debts(user_id, tenant_id);
create index if not exists tenant_debts_user_month_idx on public.tenant_debts(user_id, year, month);

-- =====================================================
-- Dubai
-- =====================================================

create table if not exists public.dubai_parts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legacy_id text,
  migration_batch_id uuid references public.migration_batches(id) on delete set null,
  name text not null,
  category text not null,
  quantity_bought integer not null,
  quantity_sold integer not null default 0,
  purchase_price_aed numeric(14,2) not null,
  target_sale_price_aed numeric(14,2) not null default 0,
  note text not null default '',
  cash_withdrawn_aed numeric(14,2) not null default 0,
  source_created_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dubai_parts_qty_bought_nonnegative check (quantity_bought >= 0),
  constraint dubai_parts_qty_sold_nonnegative check (quantity_sold >= 0),
  constraint dubai_parts_purchase_nonnegative check (purchase_price_aed >= 0),
  constraint dubai_parts_target_nonnegative check (target_sale_price_aed >= 0),
  constraint dubai_parts_withdrawn_nonnegative check (cash_withdrawn_aed >= 0)
);

create unique index if not exists dubai_parts_user_legacy_unique
  on public.dubai_parts(user_id, legacy_id) where legacy_id is not null;
create index if not exists dubai_parts_user_created_idx on public.dubai_parts(user_id, source_created_at);

create table if not exists public.dubai_sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legacy_id text,
  migration_batch_id uuid references public.migration_batches(id) on delete set null,
  part_id uuid not null references public.dubai_parts(id) on delete cascade,
  quantity integer not null,
  unit_sale_price_amount numeric(14,2) not null,
  currency text not null default 'AED',
  sale_date date not null default current_date,
  customer_name text not null default '',
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dubai_sales_qty_positive check (quantity > 0),
  constraint dubai_sales_price_nonnegative check (unit_sale_price_amount >= 0),
  constraint dubai_sales_currency check (currency in ('AED', 'EUR', 'FCFA', 'USD'))
);

create unique index if not exists dubai_sales_user_legacy_unique
  on public.dubai_sales(user_id, legacy_id) where legacy_id is not null;
create index if not exists dubai_sales_user_part_idx on public.dubai_sales(user_id, part_id);
create index if not exists dubai_sales_user_date_idx on public.dubai_sales(user_id, sale_date desc);

create table if not exists public.dubai_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legacy_id text,
  migration_batch_id uuid references public.migration_batches(id) on delete set null,
  part_id uuid references public.dubai_parts(id) on delete cascade,
  title text not null,
  amount numeric(14,2) not null,
  currency text not null default 'AED',
  expense_date date not null default current_date,
  category text not null default 'Autre',
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dubai_expenses_amount_nonnegative check (amount >= 0),
  constraint dubai_expenses_currency check (currency in ('AED', 'EUR', 'FCFA', 'USD'))
);

create unique index if not exists dubai_expenses_user_legacy_unique
  on public.dubai_expenses(user_id, legacy_id) where legacy_id is not null;
create index if not exists dubai_expenses_user_part_idx on public.dubai_expenses(user_id, part_id);
create index if not exists dubai_expenses_user_date_idx on public.dubai_expenses(user_id, expense_date desc);

create table if not exists public.dubai_cash_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legacy_id text,
  migration_batch_id uuid references public.migration_batches(id) on delete set null,
  title text not null,
  amount numeric(14,2) not null,
  currency text not null default 'AED',
  movement_date date not null default current_date,
  type text not null,
  category text not null default 'Autre',
  note text not null default '',
  status text not null default 'done',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dubai_cash_movements_amount_nonnegative check (amount >= 0),
  constraint dubai_cash_movements_currency check (currency in ('AED', 'EUR', 'FCFA', 'USD')),
  constraint dubai_cash_movements_type check (type in ('withdrawal', 'cash_out', 'cash_in')),
  constraint dubai_cash_movements_status check (status in ('done', 'planned'))
);

create unique index if not exists dubai_cash_movements_user_legacy_unique
  on public.dubai_cash_movements(user_id, legacy_id) where legacy_id is not null;
create index if not exists dubai_cash_movements_user_date_idx on public.dubai_cash_movements(user_id, movement_date desc);
create index if not exists dubai_cash_movements_user_status_idx on public.dubai_cash_movements(user_id, status);

-- =====================================================
-- Businesses
-- =====================================================

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legacy_id text,
  migration_batch_id uuid references public.migration_batches(id) on delete set null,
  name text not null,
  type text not null,
  icon text not null default 'briefcase.fill',
  color_hex text not null default '#5B5CE6',
  note text not null default '',
  is_active boolean not null default true,
  module_clients boolean not null default true,
  module_suppliers boolean not null default false,
  module_stock boolean not null default false,
  module_purchases boolean not null default false,
  module_sales boolean not null default false,
  module_reservations boolean not null default false,
  module_services boolean not null default false,
  module_tasks boolean not null default false,
  module_payments boolean not null default true,
  module_documents boolean not null default false,
  module_kpi boolean not null default true,
  source_created_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists businesses_user_legacy_unique
  on public.businesses(user_id, legacy_id) where legacy_id is not null;
create index if not exists businesses_user_created_idx on public.businesses(user_id, source_created_at);

create table if not exists public.business_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legacy_id text,
  migration_batch_id uuid references public.migration_batches(id) on delete set null,
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  role text not null,
  phone text not null default '',
  email text not null default '',
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists business_contacts_user_legacy_unique
  on public.business_contacts(user_id, legacy_id) where legacy_id is not null;
create index if not exists business_contacts_user_business_idx on public.business_contacts(user_id, business_id);

create table if not exists public.business_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legacy_id text,
  migration_batch_id uuid references public.migration_batches(id) on delete set null,
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null,
  kind text not null,
  sku text not null default '',
  quantity integer not null default 0,
  purchase_price numeric(14,2) not null default 0,
  sale_price numeric(14,2) not null default 0,
  is_active boolean not null default true,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_items_quantity_nonnegative check (quantity >= 0),
  constraint business_items_purchase_nonnegative check (purchase_price >= 0),
  constraint business_items_sale_nonnegative check (sale_price >= 0)
);

create unique index if not exists business_items_user_legacy_unique
  on public.business_items(user_id, legacy_id) where legacy_id is not null;
create index if not exists business_items_user_business_idx on public.business_items(user_id, business_id);

create table if not exists public.business_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legacy_id text,
  migration_batch_id uuid references public.migration_batches(id) on delete set null,
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null,
  type text not null,
  amount numeric(14,2) not null,
  category text not null,
  transaction_date date not null default current_date,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_transactions_type check (type in ('revenu', 'depense')),
  constraint business_transactions_amount_nonnegative check (amount >= 0)
);

create unique index if not exists business_transactions_user_legacy_unique
  on public.business_transactions(user_id, legacy_id) where legacy_id is not null;
create index if not exists business_transactions_user_business_idx on public.business_transactions(user_id, business_id);
create index if not exists business_transactions_user_date_idx on public.business_transactions(user_id, transaction_date desc);

create table if not exists public.business_bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legacy_id text,
  migration_batch_id uuid references public.migration_batches(id) on delete set null,
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null,
  customer_name text not null,
  start_date date not null,
  end_date date not null,
  price numeric(14,2) not null default 0,
  status text not null default 'a_preparer',
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_bookings_price_nonnegative check (price >= 0),
  constraint business_bookings_date_order check (end_date >= start_date)
);

create unique index if not exists business_bookings_user_legacy_unique
  on public.business_bookings(user_id, legacy_id) where legacy_id is not null;
create index if not exists business_bookings_user_business_idx on public.business_bookings(user_id, business_id);
create index if not exists business_bookings_user_start_idx on public.business_bookings(user_id, start_date);

create table if not exists public.business_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legacy_id text,
  migration_batch_id uuid references public.migration_batches(id) on delete set null,
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null,
  due_date date not null default current_date,
  is_done boolean not null default false,
  priority text not null default 'moyenne',
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_tasks_priority check (priority in ('basse', 'moyenne', 'haute'))
);

create unique index if not exists business_tasks_user_legacy_unique
  on public.business_tasks(user_id, legacy_id) where legacy_id is not null;
create index if not exists business_tasks_user_business_idx on public.business_tasks(user_id, business_id);
create index if not exists business_tasks_user_due_idx on public.business_tasks(user_id, due_date);

-- =====================================================
-- Budget and subscriptions
-- =====================================================

create table if not exists public.budget_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legacy_id text,
  migration_batch_id uuid references public.migration_batches(id) on delete set null,
  title text not null,
  amount numeric(14,2) not null,
  type text not null,
  category text not null,
  bucket text not null,
  scope text not null default 'Perso',
  entry_date date not null default current_date,
  note text not null default '',
  potential_amount numeric(14,2) not null default 0,
  status text not null default 'recu',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budget_entries_amount_nonnegative check (amount >= 0),
  constraint budget_entries_potential_nonnegative check (potential_amount >= 0),
  constraint budget_entries_type check (type in ('revenu', 'depense')),
  constraint budget_entries_status check (status in ('recu', 'non', 'peu'))
);

create unique index if not exists budget_entries_user_legacy_unique
  on public.budget_entries(user_id, legacy_id) where legacy_id is not null;
create index if not exists budget_entries_user_date_idx on public.budget_entries(user_id, entry_date desc);
create index if not exists budget_entries_user_status_idx on public.budget_entries(user_id, status);
create index if not exists budget_entries_user_bucket_idx on public.budget_entries(user_id, bucket);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legacy_id text,
  migration_batch_id uuid references public.migration_batches(id) on delete set null,
  title text not null,
  amount numeric(14,2) not null,
  due_day integer not null,
  category text not null default 'Abonnement',
  system_image text not null default 'creditcard.fill',
  color_hex text not null default '#7B61FF',
  scope text not null default 'Perso',
  is_active boolean not null default true,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_amount_nonnegative check (amount >= 0),
  constraint subscriptions_due_day_range check (due_day between 1 and 31)
);

create unique index if not exists subscriptions_user_legacy_unique
  on public.subscriptions(user_id, legacy_id) where legacy_id is not null;
create index if not exists subscriptions_user_active_idx on public.subscriptions(user_id, is_active);
create index if not exists subscriptions_user_due_day_idx on public.subscriptions(user_id, due_day);

-- =====================================================
-- Trips
-- =====================================================

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legacy_id text,
  migration_batch_id uuid references public.migration_batches(id) on delete set null,
  title text not null,
  destination_summary text not null,
  start_date date not null,
  end_date date not null,
  people_count integer not null default 1,
  target_budget numeric(14,2) not null default 0,
  notes text not null default '',
  is_completed boolean not null default false,
  source_created_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trips_people_positive check (people_count > 0),
  constraint trips_budget_nonnegative check (target_budget >= 0),
  constraint trips_date_order check (end_date >= start_date)
);

create unique index if not exists trips_user_legacy_unique
  on public.trips(user_id, legacy_id) where legacy_id is not null;
create index if not exists trips_user_start_idx on public.trips(user_id, start_date);

create table if not exists public.flights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legacy_id text,
  migration_batch_id uuid references public.migration_batches(id) on delete set null,
  trip_id uuid not null references public.trips(id) on delete cascade,
  airline text not null,
  from_code text not null,
  to_code text not null,
  depart_at timestamptz not null,
  arrive_at timestamptz not null,
  price numeric(14,2) not null default 0,
  booking_link text not null default '',
  attachment_note text not null default '',
  status text not null default 'a_reserver',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint flights_price_nonnegative check (price >= 0),
  constraint flights_status check (status in ('a_reserver', 'reserve', 'termine', 'annule')),
  constraint flights_iata_lengths check (char_length(from_code) between 2 and 4 and char_length(to_code) between 2 and 4)
);

create unique index if not exists flights_user_legacy_unique
  on public.flights(user_id, legacy_id) where legacy_id is not null;
create index if not exists flights_user_trip_idx on public.flights(user_id, trip_id);
create index if not exists flights_user_depart_idx on public.flights(user_id, depart_at);

create table if not exists public.accommodations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legacy_id text,
  migration_batch_id uuid references public.migration_batches(id) on delete set null,
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null,
  city text not null,
  start_date date not null,
  end_date date not null,
  price numeric(14,2) not null default 0,
  booking_link text not null default '',
  attachment_note text not null default '',
  status text not null default 'a_reserver',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accommodations_price_nonnegative check (price >= 0),
  constraint accommodations_status check (status in ('a_reserver', 'reserve', 'termine', 'annule')),
  constraint accommodations_date_order check (end_date >= start_date)
);

create unique index if not exists accommodations_user_legacy_unique
  on public.accommodations(user_id, legacy_id) where legacy_id is not null;
create index if not exists accommodations_user_trip_idx on public.accommodations(user_id, trip_id);
create index if not exists accommodations_user_start_idx on public.accommodations(user_id, start_date);

create table if not exists public.trip_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legacy_id text,
  migration_batch_id uuid references public.migration_batches(id) on delete set null,
  trip_id uuid not null references public.trips(id) on delete cascade,
  title text not null,
  city text not null default '',
  activity_at timestamptz not null default now(),
  price numeric(14,2) not null default 0,
  link text not null default '',
  status text not null default 'a_prevoir',
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_activities_price_nonnegative check (price >= 0),
  constraint trip_activities_status check (status in ('a_prevoir', 'reserve', 'fait', 'annule'))
);

create unique index if not exists trip_activities_user_legacy_unique
  on public.trip_activities(user_id, legacy_id) where legacy_id is not null;
create index if not exists trip_activities_user_trip_idx on public.trip_activities(user_id, trip_id);
create index if not exists trip_activities_user_activity_idx on public.trip_activities(user_id, activity_at);

create table if not exists public.trip_checklist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legacy_id text,
  migration_batch_id uuid references public.migration_batches(id) on delete set null,
  trip_id uuid not null references public.trips(id) on delete cascade,
  title text not null,
  category text not null default 'Général',
  is_done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists trip_checklist_items_user_legacy_unique
  on public.trip_checklist_items(user_id, legacy_id) where legacy_id is not null;
create index if not exists trip_checklist_items_user_trip_idx on public.trip_checklist_items(user_id, trip_id);

-- =====================================================
-- Attachments metadata
-- =====================================================

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legacy_id text,
  migration_batch_id uuid references public.migration_batches(id) on delete set null,
  parent_type text not null,
  dubai_part_id uuid references public.dubai_parts(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete cascade,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null default 0,
  storage_bucket text not null default 'budget-jr-attachments',
  storage_path text not null,
  sha256 text,
  source_created_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attachments_parent_type check (parent_type in ('dubai_part', 'business')),
  constraint attachments_one_parent check (
    (parent_type = 'dubai_part' and dubai_part_id is not null and business_id is null)
    or
    (parent_type = 'business' and business_id is not null and dubai_part_id is null)
  ),
  constraint attachments_size_nonnegative check (size_bytes >= 0)
);

create unique index if not exists attachments_user_legacy_unique
  on public.attachments(user_id, legacy_id) where legacy_id is not null;
create unique index if not exists attachments_storage_path_unique
  on public.attachments(storage_bucket, storage_path);
create index if not exists attachments_user_dubai_part_idx on public.attachments(user_id, dubai_part_id);
create index if not exists attachments_user_business_idx on public.attachments(user_id, business_id);

-- =====================================================
-- Updated_at triggers
-- =====================================================

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger user_preferences_set_updated_at before update on public.user_preferences
  for each row execute function public.set_updated_at();
create trigger migration_batches_set_updated_at before update on public.migration_batches
  for each row execute function public.set_updated_at();
create trigger tenants_set_updated_at before update on public.tenants
  for each row execute function public.set_updated_at();
create trigger rent_payments_set_updated_at before update on public.rent_payments
  for each row execute function public.set_updated_at();
create trigger tenant_debts_set_updated_at before update on public.tenant_debts
  for each row execute function public.set_updated_at();
create trigger dubai_parts_set_updated_at before update on public.dubai_parts
  for each row execute function public.set_updated_at();
create trigger dubai_sales_set_updated_at before update on public.dubai_sales
  for each row execute function public.set_updated_at();
create trigger dubai_expenses_set_updated_at before update on public.dubai_expenses
  for each row execute function public.set_updated_at();
create trigger dubai_cash_movements_set_updated_at before update on public.dubai_cash_movements
  for each row execute function public.set_updated_at();
create trigger businesses_set_updated_at before update on public.businesses
  for each row execute function public.set_updated_at();
create trigger business_contacts_set_updated_at before update on public.business_contacts
  for each row execute function public.set_updated_at();
create trigger business_items_set_updated_at before update on public.business_items
  for each row execute function public.set_updated_at();
create trigger business_transactions_set_updated_at before update on public.business_transactions
  for each row execute function public.set_updated_at();
create trigger business_bookings_set_updated_at before update on public.business_bookings
  for each row execute function public.set_updated_at();
create trigger business_tasks_set_updated_at before update on public.business_tasks
  for each row execute function public.set_updated_at();
create trigger budget_entries_set_updated_at before update on public.budget_entries
  for each row execute function public.set_updated_at();
create trigger subscriptions_set_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();
create trigger trips_set_updated_at before update on public.trips
  for each row execute function public.set_updated_at();
create trigger flights_set_updated_at before update on public.flights
  for each row execute function public.set_updated_at();
create trigger accommodations_set_updated_at before update on public.accommodations
  for each row execute function public.set_updated_at();
create trigger trip_activities_set_updated_at before update on public.trip_activities
  for each row execute function public.set_updated_at();
create trigger trip_checklist_items_set_updated_at before update on public.trip_checklist_items
  for each row execute function public.set_updated_at();
create trigger attachments_set_updated_at before update on public.attachments
  for each row execute function public.set_updated_at();

-- =====================================================
-- RLS
-- =====================================================

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.migration_batches enable row level security;
alter table public.tenants enable row level security;
alter table public.rent_payments enable row level security;
alter table public.tenant_debts enable row level security;
alter table public.dubai_parts enable row level security;
alter table public.dubai_sales enable row level security;
alter table public.dubai_expenses enable row level security;
alter table public.dubai_cash_movements enable row level security;
alter table public.businesses enable row level security;
alter table public.business_contacts enable row level security;
alter table public.business_items enable row level security;
alter table public.business_transactions enable row level security;
alter table public.business_bookings enable row level security;
alter table public.business_tasks enable row level security;
alter table public.budget_entries enable row level security;
alter table public.subscriptions enable row level security;
alter table public.trips enable row level security;
alter table public.flights enable row level security;
alter table public.accommodations enable row level security;
alter table public.trip_activities enable row level security;
alter table public.trip_checklist_items enable row level security;
alter table public.attachments enable row level security;

create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id);
create policy profiles_insert_own on public.profiles
  for insert with check (auth.uid() = id);
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Generic per-user policies. Keep explicit names for auditability.
create policy user_preferences_all_own on public.user_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy migration_batches_all_own on public.migration_batches
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy tenants_all_own on public.tenants
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy rent_payments_all_own on public.rent_payments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy tenant_debts_all_own on public.tenant_debts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy dubai_parts_all_own on public.dubai_parts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy dubai_sales_all_own on public.dubai_sales
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy dubai_expenses_all_own on public.dubai_expenses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy dubai_cash_movements_all_own on public.dubai_cash_movements
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy businesses_all_own on public.businesses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy business_contacts_all_own on public.business_contacts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy business_items_all_own on public.business_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy business_transactions_all_own on public.business_transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy business_bookings_all_own on public.business_bookings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy business_tasks_all_own on public.business_tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy budget_entries_all_own on public.budget_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy subscriptions_all_own on public.subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy trips_all_own on public.trips
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy flights_all_own on public.flights
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy accommodations_all_own on public.accommodations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy trip_activities_all_own on public.trip_activities
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy trip_checklist_items_all_own on public.trip_checklist_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy attachments_all_own on public.attachments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =====================================================
-- Supabase Storage draft
-- =====================================================

-- Bucket to create manually or in a Supabase migration:
-- insert into storage.buckets (id, name, public)
-- values ('budget-jr-attachments', 'budget-jr-attachments', false)
-- on conflict (id) do nothing;

-- Storage policy draft. It assumes paths like:
-- {user_id}/{attachment_id}/{safe_filename}

create policy storage_attachments_select_own on storage.objects
  for select
  using (
    bucket_id = 'budget-jr-attachments'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy storage_attachments_insert_own on storage.objects
  for insert
  with check (
    bucket_id = 'budget-jr-attachments'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy storage_attachments_update_own on storage.objects
  for update
  using (
    bucket_id = 'budget-jr-attachments'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'budget-jr-attachments'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy storage_attachments_delete_own on storage.objects
  for delete
  using (
    bucket_id = 'budget-jr-attachments'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- =====================================================
-- Future RPC placeholders
-- =====================================================

-- Future:
-- create function public.import_budget_jr_batch(payload jsonb)
-- returns jsonb
-- security definer
-- set search_path = public
-- language plpgsql
-- as $$
-- begin
--   -- Validate auth.uid()
--   -- Create/update migration batch
--   -- Upsert parents then children by user_id + legacy_id
--   -- Return import report
-- end;
-- $$;
