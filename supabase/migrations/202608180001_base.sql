create extension if not exists pgcrypto;

create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (char_length(username) between 2 and 40),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  dubai_display_currency text not null default 'AED' check (dubai_display_currency in ('AED','EUR','FCFA','USD')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.migration_batches (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  source text not null default 'budget-jr', format_version integer not null, checksum text,
  status text not null default 'processing' check (status in ('processing','completed','failed','rolled_back')),
  inserted_count integer not null default 0, skipped_count integer not null default 0,
  report jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), completed_at timestamptz
);

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger preferences_updated_at before update on public.user_preferences for each row execute function public.set_updated_at();

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(user_id,username) values(new.id,coalesce(nullif(new.raw_user_meta_data->>'username',''),split_part(new.email,'@',1),'Budgy'));
  insert into public.user_preferences(user_id) values(new.id);
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
