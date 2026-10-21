-- Synchronisation quasi temps réel : un compteur de version par utilisateur et par domaine,
-- incrémenté par des triggers statement-level (une seule écriture par requête SQL, pas par
-- ligne). Les clients interrogent get_sync_versions() (1 petite lecture) et ne rechargent que
-- les domaines dont la version a changé. Toute écriture est couverte : application, import,
-- et ATLAS (atlas_write.apply_operations) puisque les triggers sont au niveau des tables.
-- Migration additive : aucune donnée existante n'est modifiée.

create table if not exists public.sync_versions (
  user_id uuid not null,
  domain text not null,
  version bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, domain)
);
alter table public.sync_versions enable row level security;
drop policy if exists sync_versions_select_own on public.sync_versions;
create policy sync_versions_select_own on public.sync_versions
  for select to authenticated using (user_id = (select public.current_budgy_user_id()));
revoke all on public.sync_versions from public;
grant select on public.sync_versions to authenticated;

create or replace function public.bump_sync_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.sync_versions as s (user_id, domain, version)
  select distinct user_id, tg_argv[0], 1 from new_rows where user_id is not null
  on conflict (user_id, domain) do update set version = s.version + 1, updated_at = now();
  return null;
end $$;

create or replace function public.bump_sync_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.sync_versions as s (user_id, domain, version)
  select distinct user_id, tg_argv[0], 1 from (
    select user_id from new_rows union select user_id from old_rows
  ) u where user_id is not null
  on conflict (user_id, domain) do update set version = s.version + 1, updated_at = now();
  return null;
end $$;

create or replace function public.bump_sync_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.sync_versions as s (user_id, domain, version)
  select distinct user_id, tg_argv[0], 1 from old_rows where user_id is not null
  on conflict (user_id, domain) do update set version = s.version + 1, updated_at = now();
  return null;
end $$;

revoke all on function public.bump_sync_insert(), public.bump_sync_update(), public.bump_sync_delete() from public, authenticated;

do $$
declare
  mapping constant jsonb := '{
    "finance": ["budget_entries","subscriptions"],
    "rent": ["tenants","rent_payments","tenant_debts"],
    "business": ["businesses","business_contacts","business_items","business_transactions","business_transaction_lines","business_payments","business_stock_movements","business_bookings","business_tasks","dubai_parts","dubai_sales","dubai_expenses","dubai_cash_movements"]
  }';
  d text; t text;
begin
  for d in select jsonb_object_keys(mapping) loop
    for t in select jsonb_array_elements_text(mapping -> d) loop
      execute format('drop trigger if exists sync_ins on public.%I', t);
      execute format('drop trigger if exists sync_upd on public.%I', t);
      execute format('drop trigger if exists sync_del on public.%I', t);
      execute format('create trigger sync_ins after insert on public.%I referencing new table as new_rows for each statement execute function public.bump_sync_insert(%L)', t, d);
      execute format('create trigger sync_upd after update on public.%I referencing old table as old_rows new table as new_rows for each statement execute function public.bump_sync_update(%L)', t, d);
      execute format('create trigger sync_del after delete on public.%I referencing old table as old_rows for each statement execute function public.bump_sync_delete(%L)', t, d);
    end loop;
  end loop;
end $$;

create or replace function public.get_sync_versions() returns table (domain text, version bigint)
language sql stable security invoker set search_path = public as $$
  select s.domain, s.version from public.sync_versions s
  where s.user_id = (select public.current_budgy_user_id())
$$;
grant execute on function public.get_sync_versions() to authenticated;
