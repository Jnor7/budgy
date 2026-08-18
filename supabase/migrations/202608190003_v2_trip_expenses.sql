-- Budgy V2 — Dépenses de voyage en commun, répartition et avatars.

-- 1. Dépenses partagées ------------------------------------------------------
create table if not exists public.trip_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legacy_id text,
  migration_batch_id uuid references public.migration_batches(id) on delete set null,
  trip_id uuid not null references public.trips(id) on delete cascade,
  paid_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null default 'EUR' check (currency in ('AED','EUR','FCFA','USD')),
  date date not null default current_date,
  category text not null default 'Général',
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists trip_expenses_trip_idx on public.trip_expenses(trip_id, date desc);
create unique index if not exists trip_expenses_user_legacy_unique
  on public.trip_expenses(user_id, legacy_id) where legacy_id is not null;

-- 2. Répartition -------------------------------------------------------------
create table if not exists public.trip_expense_splits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expense_id uuid not null references public.trip_expenses(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  amount numeric(14,2) not null check (amount >= 0),
  is_settled boolean not null default false,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint trip_expense_splits_unique unique (expense_id, user_id)
);
create index if not exists trip_expense_splits_trip_idx on public.trip_expense_splits(trip_id);
create index if not exists trip_expense_splits_user_idx on public.trip_expense_splits(user_id, is_settled);

-- 3. RLS : mêmes règles que les autres enfants de voyage ---------------------
alter table public.trip_expenses enable row level security;
alter table public.trip_expense_splits enable row level security;

drop policy if exists trip_expenses_select on public.trip_expenses;
create policy trip_expenses_select on public.trip_expenses
for select using (public.can_view_trip(trip_id));

drop policy if exists trip_expenses_insert on public.trip_expenses;
create policy trip_expenses_insert on public.trip_expenses
for insert with check (auth.uid() = user_id and public.can_edit_trip(trip_id));

drop policy if exists trip_expenses_update on public.trip_expenses;
create policy trip_expenses_update on public.trip_expenses
for update using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));

drop policy if exists trip_expenses_delete on public.trip_expenses;
create policy trip_expenses_delete on public.trip_expenses
for delete using (public.can_edit_trip(trip_id));

drop policy if exists trip_expense_splits_select on public.trip_expense_splits;
create policy trip_expense_splits_select on public.trip_expense_splits
for select using (public.can_view_trip(trip_id));

drop policy if exists trip_expense_splits_write on public.trip_expense_splits;
create policy trip_expense_splits_write on public.trip_expense_splits
for insert with check (public.can_edit_trip(trip_id));

drop policy if exists trip_expense_splits_update on public.trip_expense_splits;
create policy trip_expense_splits_update on public.trip_expense_splits
for update using (public.can_edit_trip(trip_id) or user_id = auth.uid())
with check (public.can_edit_trip(trip_id) or user_id = auth.uid());

drop policy if exists trip_expense_splits_delete on public.trip_expense_splits;
create policy trip_expense_splits_delete on public.trip_expense_splits
for delete using (public.can_edit_trip(trip_id));

-- 4. Avatars (bucket public : seules des photos de profil y transitent) ------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('budgy-avatars', 'budgy-avatars', true, 5242880,
        array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/png','image/jpeg','image/webp'];

drop policy if exists avatars_storage_read on storage.objects;
create policy avatars_storage_read on storage.objects
for select using (bucket_id = 'budgy-avatars');

drop policy if exists avatars_storage_insert on storage.objects;
create policy avatars_storage_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'budgy-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_storage_update on storage.objects;
create policy avatars_storage_update on storage.objects
for update to authenticated
using (bucket_id = 'budgy-avatars' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'budgy-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_storage_delete on storage.objects;
create policy avatars_storage_delete on storage.objects
for delete to authenticated
using (bucket_id = 'budgy-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
