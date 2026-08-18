-- Budgy V2 — Modules utilisateur, profil enrichi, préférences et templates business.
-- Additive uniquement : aucune table ni policy V1 n'est supprimée ici.

-- 1. Modules utilisateur -----------------------------------------------------
create table if not exists public.user_modules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module_key text not null check (module_key in ('budget','subscriptions','trips','rentals','businesses')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_modules_unique unique (user_id, module_key)
);

create index if not exists user_modules_user_idx on public.user_modules(user_id) where enabled;

drop trigger if exists user_modules_updated_at on public.user_modules;
create trigger user_modules_updated_at before update on public.user_modules
for each row execute function public.set_updated_at();

alter table public.user_modules enable row level security;

drop policy if exists user_modules_all_own on public.user_modules;
create policy user_modules_all_own on public.user_modules
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2. Profil : avatar + marqueur de configuration V2 --------------------------
alter table public.profiles add column if not exists avatar_url text not null default '';
alter table public.profiles add column if not exists modules_configured_at timestamptz;

-- Autorise l'insertion de son propre profil (utile si le trigger auth a échoué).
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
for insert with check (auth.uid() = user_id);

-- 3. Préférences étendues ----------------------------------------------------
alter table public.user_preferences add column if not exists main_currency text not null default 'EUR';
alter table public.user_preferences add column if not exists business_currency text not null default 'EUR';
alter table public.user_preferences add column if not exists locale text not null default 'fr';
alter table public.user_preferences add column if not exists compact_amounts boolean not null default false;

do $$ begin
  alter table public.user_preferences
    add constraint user_preferences_main_currency_check check (main_currency in ('AED','EUR','FCFA','USD'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.user_preferences
    add constraint user_preferences_business_currency_check check (business_currency in ('AED','EUR','FCFA','USD'));
exception when duplicate_object then null; end $$;

-- 4. Templates business ------------------------------------------------------
alter table public.businesses add column if not exists template text not null default 'simple';

do $$ begin
  alter table public.businesses
    add constraint businesses_template_check
    check (template in ('simple','commerce','services','rental','import_export'));
exception when duplicate_object then null; end $$;

-- 5. Backfill des comptes existants (V1 -> V2) -------------------------------
-- Un module est activé lorsque le compte possède déjà des données du domaine.
-- modules_configured_at reste NULL : l'app proposera l'écran de personnalisation.
insert into public.user_modules (user_id, module_key, enabled)
select p.user_id, m.module_key, m.enabled
from public.profiles p
cross join lateral (values
  ('budget',        exists (select 1 from public.budget_entries e where e.user_id = p.user_id)),
  ('subscriptions', exists (select 1 from public.subscriptions s where s.user_id = p.user_id)),
  ('trips',         exists (select 1 from public.trips t where t.user_id = p.user_id)),
  ('rentals',       exists (select 1 from public.tenants t where t.user_id = p.user_id)),
  ('businesses',    exists (select 1 from public.businesses b where b.user_id = p.user_id)
                    or exists (select 1 from public.dubai_parts d where d.user_id = p.user_id))
) as m(module_key, enabled)
where not exists (select 1 from public.user_modules um where um.user_id = p.user_id)
on conflict (user_id, module_key) do nothing;

-- Un compte V1 totalement vide reçoit une base minimale plutôt qu'une app vide.
update public.user_modules um
set enabled = true
where um.module_key = 'budget'
  and not exists (
    select 1 from public.user_modules other
    where other.user_id = um.user_id and other.enabled
  );

-- 6. Les business existants marqués "Dubaï" gardent le template import/export.
-- Aucune donnée personnelle n'est créée : on ne fait que qualifier l'existant.
update public.businesses
set template = 'import_export'
where template = 'simple'
  and module_stock and module_purchases and module_sales;
