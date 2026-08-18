create table public.tenants (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, legacy_id text, migration_batch_id uuid references public.migration_batches(id) on delete set null,
 name text not null, monthly_rent numeric(14,2) not null check(monthly_rent>=0), due_day smallint not null check(due_day between 1 and 31), note text not null default '', created_at timestamptz not null default now()
);
create table public.rent_payments (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, legacy_id text, migration_batch_id uuid references public.migration_batches(id) on delete set null,
 tenant_id uuid not null references public.tenants(id) on delete cascade, month smallint not null check(month between 1 and 12), year integer not null, is_paid boolean not null default false, paid_date date,
 amount_due numeric(14,2) not null default 0, amount_received numeric(14,2) not null default 0, carry_over numeric(14,2) not null default 0, note text not null default ''
);
create table public.tenant_debts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, legacy_id text, migration_batch_id uuid references public.migration_batches(id) on delete set null,
 tenant_id uuid not null references public.tenants(id) on delete cascade, label text not null, amount numeric(14,2) not null check(amount>=0), month smallint not null check(month between 1 and 12), year integer not null, is_paid boolean not null default false, created_at timestamptz not null default now()
);
create table public.dubai_parts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, legacy_id text, migration_batch_id uuid references public.migration_batches(id) on delete set null,
 name text not null, category text not null, quantity_bought integer not null default 0 check(quantity_bought>=0), quantity_sold integer not null default 0 check(quantity_sold>=0), purchase_price_aed numeric(16,4) not null default 0, target_sale_price_aed numeric(16,4) not null default 0, note text not null default '', created_at timestamptz not null default now(), cash_withdrawn_aed numeric(16,4) not null default 0
);
create table public.dubai_sales (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, legacy_id text, migration_batch_id uuid references public.migration_batches(id) on delete set null,
 part_id uuid not null references public.dubai_parts(id) on delete cascade, quantity integer not null check(quantity>0), unit_sale_price_aed numeric(16,4) not null check(unit_sale_price_aed>=0), currency text not null default 'AED' check(currency in ('AED','EUR','FCFA','USD')), date date not null, customer_name text not null default '', note text not null default ''
);
create table public.dubai_expenses (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, legacy_id text, migration_batch_id uuid references public.migration_batches(id) on delete set null,
 part_id uuid references public.dubai_parts(id) on delete cascade, title text not null, amount_aed numeric(16,4) not null check(amount_aed>=0), currency text not null default 'AED' check(currency in ('AED','EUR','FCFA','USD')), date date not null, category text not null, note text not null default ''
);
create table public.dubai_cash_movements (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, legacy_id text, migration_batch_id uuid references public.migration_batches(id) on delete set null,
 title text not null, amount numeric(16,4) not null check(amount>=0), currency text not null default 'AED' check(currency in ('AED','EUR','FCFA','USD')), date date not null,
 type text not null check(type in ('cash_in','cash_out','withdrawal')), category text not null, note text not null default '', status text not null default 'done' check(status in ('done','planned'))
);
create table public.businesses (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, legacy_id text, migration_batch_id uuid references public.migration_batches(id) on delete set null,
 name text not null, type text not null, icon text not null, color_hex text not null, note text not null default '', is_active boolean not null default true, created_at timestamptz not null default now(),
 module_clients boolean not null default false, module_suppliers boolean not null default false, module_stock boolean not null default false, module_purchases boolean not null default false, module_sales boolean not null default false, module_reservations boolean not null default false, module_services boolean not null default false, module_tasks boolean not null default false, module_payments boolean not null default false, module_documents boolean not null default false, module_kpi boolean not null default false
);
create table public.business_contacts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, legacy_id text, migration_batch_id uuid references public.migration_batches(id) on delete set null,
 business_id uuid not null references public.businesses(id) on delete cascade, name text not null, role text not null, phone text not null default '', email text not null default '', note text not null default ''
);
create table public.business_items (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, legacy_id text, migration_batch_id uuid references public.migration_batches(id) on delete set null,
 business_id uuid not null references public.businesses(id) on delete cascade, title text not null, kind text not null, sku text not null default '', quantity integer not null default 0, purchase_price numeric(14,2) not null default 0, sale_price numeric(14,2) not null default 0, is_active boolean not null default true, note text not null default ''
);
create table public.business_transactions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, legacy_id text, migration_batch_id uuid references public.migration_batches(id) on delete set null,
 business_id uuid not null references public.businesses(id) on delete cascade, title text not null, type text not null check(type in ('revenu','depense')), amount numeric(14,2) not null check(amount>=0), category text not null, date date not null, note text not null default ''
);
create table public.business_bookings (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, legacy_id text, migration_batch_id uuid references public.migration_batches(id) on delete set null,
 business_id uuid not null references public.businesses(id) on delete cascade, title text not null, customer_name text not null, start_date date not null, end_date date not null, price numeric(14,2) not null default 0, status text not null default 'a_preparer', note text not null default ''
);
create table public.business_tasks (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, legacy_id text, migration_batch_id uuid references public.migration_batches(id) on delete set null,
 business_id uuid not null references public.businesses(id) on delete cascade, title text not null, due_date date not null, is_done boolean not null default false, priority text not null default 'moyenne' check(priority in ('basse','moyenne','haute')), note text not null default ''
);
create table public.budget_entries (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, legacy_id text, migration_batch_id uuid references public.migration_batches(id) on delete set null,
 title text not null, amount numeric(14,2) not null check(amount>=0), type text not null check(type in ('revenu','depense')), category text not null, bucket text not null, scope text not null, date date not null, note text not null default '', potential_amount numeric(14,2) not null default 0, status text not null default 'recu' check(status in ('recu','peu','non'))
);
create table public.subscriptions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, legacy_id text, migration_batch_id uuid references public.migration_batches(id) on delete set null,
 title text not null, amount numeric(14,2) not null check(amount>=0), due_day smallint not null check(due_day between 1 and 31), category text not null default 'Abonnement', system_image text not null default 'creditcard.fill', color_hex text not null default '#7B61FF', scope text not null default 'Perso', is_active boolean not null default true, note text not null default ''
);
create table public.trips (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, legacy_id text, migration_batch_id uuid references public.migration_batches(id) on delete set null,
 title text not null, destination_summary text not null, start_date date not null, end_date date not null, people_count integer not null default 1 check(people_count>0), target_budget numeric(14,2) not null default 0, notes text not null default '', is_completed boolean not null default false, created_at timestamptz not null default now()
);
create table public.flights (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, legacy_id text, migration_batch_id uuid references public.migration_batches(id) on delete set null,
 trip_id uuid not null references public.trips(id) on delete cascade, airline text not null, from_code text not null, to_code text not null, depart_date timestamptz not null, arrive_date timestamptz not null, price numeric(14,2) not null default 0, booking_link text not null default '', attachment_note text not null default '', status text not null default 'a_reserver'
);
create table public.accommodations (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, legacy_id text, migration_batch_id uuid references public.migration_batches(id) on delete set null,
 trip_id uuid not null references public.trips(id) on delete cascade, name text not null, city text not null, start_date date not null, end_date date not null, price numeric(14,2) not null default 0, booking_link text not null default '', attachment_note text not null default '', status text not null default 'a_reserver'
);
create table public.trip_activities (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, legacy_id text, migration_batch_id uuid references public.migration_batches(id) on delete set null,
 trip_id uuid not null references public.trips(id) on delete cascade, title text not null, city text not null default '', activity_date timestamptz not null, price numeric(14,2) not null default 0, link text not null default '', status text not null default 'a_prevoir', note text not null default ''
);
create table public.trip_checklist_items (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, legacy_id text, migration_batch_id uuid references public.migration_batches(id) on delete set null,
 trip_id uuid not null references public.trips(id) on delete cascade, title text not null, category text not null default 'Général', is_done boolean not null default false
);
create table public.attachments (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, legacy_id text, migration_batch_id uuid references public.migration_batches(id) on delete set null,
 file_name text not null, mime_type text not null, storage_path text not null, size_bytes bigint not null default 0, created_at timestamptz not null default now(), dubai_part_id uuid references public.dubai_parts(id) on delete cascade, business_id uuid references public.businesses(id) on delete cascade,
 constraint attachment_one_parent check((dubai_part_id is not null)::int + (business_id is not null)::int = 1)
);
