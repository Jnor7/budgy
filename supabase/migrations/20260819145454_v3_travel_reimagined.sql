-- Budgy V3 — Travel Reimagined.
-- Migration strictement additive : les tables collaboratives V2 sont réutilisées.

-- 1. Métadonnées destination et cartes enrichies ----------------------------
alter table public.trips
  add column if not exists country_name text not null default '',
  add column if not exists country_code varchar(2) not null default '',
  add column if not exists cover_image_provider text not null default '',
  add column if not exists cover_image_id text not null default '',
  add column if not exists cover_photographer text not null default '',
  add column if not exists cover_photographer_url text not null default '',
  add column if not exists cover_attribution text not null default '';

alter table public.flights
  add column if not exists airline_code varchar(3) not null default '',
  add column if not exists flight_number text not null default '',
  add column if not exists departure_terminal text not null default '',
  add column if not exists arrival_terminal text not null default '',
  add column if not exists gate text not null default '',
  add column if not exists booking_reference text not null default '';

alter table public.accommodations
  add column if not exists check_in_time time,
  add column if not exists check_out_time time,
  add column if not exists image_url text not null default '';

alter table public.trip_activities
  add column if not exists duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  add column if not exists price_per_person boolean not null default false,
  add column if not exists category text not null default 'visite';

-- 2. Annuaire OurAirports, non personnel et en lecture seule côté client -----
create table if not exists public.airports (
  id bigint primary key,
  ident text not null unique,
  iata_code varchar(3),
  icao_code varchar(4),
  name text not null,
  municipality text not null default '',
  country_code varchar(2) not null,
  latitude double precision,
  longitude double precision,
  type text not null check (type in ('large_airport', 'medium_airport')),
  imported_at timestamptz not null default now()
);

create index if not exists airports_iata_idx on public.airports (upper(iata_code)) where iata_code is not null;
create index if not exists airports_municipality_idx on public.airports (lower(municipality));
create index if not exists airports_country_idx on public.airports (country_code, type);

alter table public.airports enable row level security;
revoke all on table public.airports from anon, authenticated;
grant select on table public.airports to authenticated;
drop policy if exists airports_read_authenticated on public.airports;
create policy airports_read_authenticated on public.airports
for select to authenticated using (true);

create or replace function public.search_airports(p_query text, p_limit integer default 20)
returns table (
  id bigint, ident text, iata_code varchar, icao_code varchar, name text,
  municipality text, country_code varchar, latitude double precision,
  longitude double precision, type text
)
language sql stable security invoker set search_path = '' as $$
  select a.id, a.ident, a.iata_code, a.icao_code, a.name, a.municipality,
         a.country_code, a.latitude, a.longitude, a.type
  from public.airports a
  where auth.uid() is not null
    and a.iata_code is not null
    and (
      trim(coalesce(p_query, '')) = ''
      or upper(a.iata_code) = upper(trim(p_query))
      or lower(a.municipality) like '%' || lower(trim(p_query)) || '%'
      or lower(a.name) like '%' || lower(trim(p_query)) || '%'
      or lower(a.ident) like '%' || lower(trim(p_query)) || '%'
    )
  order by
    case when upper(a.iata_code) = upper(trim(p_query)) then 0
         when lower(a.municipality) = lower(trim(p_query)) then 1
         when a.type = 'large_airport' then 2 else 3 end,
    a.municipality, a.name
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

revoke all on function public.search_airports(text, integer) from public;
grant execute on function public.search_airports(text, integer) to authenticated;

-- 3. Amis de voyage : domaine limité à Voyages ------------------------------
create table if not exists public.travel_friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint travel_friend_request_distinct check (sender_id <> recipient_id)
);

create unique index if not exists travel_friend_requests_pending_unique
  on public.travel_friend_requests (least(sender_id, recipient_id), greatest(sender_id, recipient_id))
  where status = 'pending';
create index if not exists travel_friend_requests_recipient_idx
  on public.travel_friend_requests (recipient_id, status, created_at desc);

create table if not exists public.travel_friends (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint travel_friends_canonical check (user_a::text < user_b::text),
  constraint travel_friends_unique unique (user_a, user_b)
);
create index if not exists travel_friends_user_a_idx on public.travel_friends(user_a);
create index if not exists travel_friends_user_b_idx on public.travel_friends(user_b);

alter table public.travel_friend_requests enable row level security;
alter table public.travel_friends enable row level security;
revoke all on table public.travel_friend_requests from anon, authenticated;
revoke all on table public.travel_friends from anon, authenticated;
grant select on table public.travel_friend_requests, public.travel_friends to authenticated;

drop policy if exists travel_friend_requests_select_concerned on public.travel_friend_requests;
create policy travel_friend_requests_select_concerned on public.travel_friend_requests
for select to authenticated
using ((select auth.uid()) in (sender_id, recipient_id));

drop policy if exists travel_friends_select_concerned on public.travel_friends;
create policy travel_friends_select_concerned on public.travel_friends
for select to authenticated
using ((select auth.uid()) in (user_a, user_b));
-- Aucun INSERT/UPDATE/DELETE direct : les transitions passent par les RPC ci-dessous.

create or replace function public.has_travel_friend_context(p_user_id uuid, p_viewer_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select p_viewer_id is not null and (
    exists (
      select 1 from public.travel_friends f
      where (f.user_a = p_viewer_id and f.user_b = p_user_id)
         or (f.user_b = p_viewer_id and f.user_a = p_user_id)
    )
    or exists (
      select 1 from public.travel_friend_requests r
      where r.status = 'pending'
        and ((r.sender_id = p_viewer_id and r.recipient_id = p_user_id)
          or (r.recipient_id = p_viewer_id and r.sender_id = p_user_id))
    )
  );
$$;

drop policy if exists profiles_select_shared_trip on public.profiles;
create policy profiles_select_travel_context on public.profiles
for select to authenticated
using (
  (select auth.uid()) = user_id
  or public.shares_trip_with(user_id)
  or public.has_travel_friend_context(user_id)
);

create or replace function public.find_travel_user(p_handle text)
returns table (user_id uuid, username text, avatar_url text)
language sql stable security definer set search_path = '' as $$
  select p.user_id, p.username, p.avatar_url
  from public.profiles p
  where auth.uid() is not null
    and length(trim(coalesce(p_handle, ''))) >= 2
    and lower(p.username) = lower(trim(p_handle))
    and p.user_id <> auth.uid()
  limit 1;
$$;

create or replace function public.send_travel_friend_request(p_handle text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_target uuid;
  v_actor_name text;
  v_request_id uuid;
begin
  if v_actor is null then raise exception 'authentication required'; end if;
  select p.user_id into v_target from public.profiles p
    where lower(p.username) = lower(trim(p_handle)) and p.user_id <> v_actor limit 1;
  if v_target is null then raise exception 'user not found'; end if;
  if exists (
    select 1 from public.travel_friends f
    where (f.user_a = least(v_actor, v_target) and f.user_b = greatest(v_actor, v_target))
  ) then raise exception 'already friends'; end if;

  insert into public.travel_friend_requests(sender_id, recipient_id)
  values (v_actor, v_target)
  returning id into v_request_id;

  select username into v_actor_name from public.profiles where user_id = v_actor;
  insert into public.notifications(user_id, kind, title, body, payload)
  values (v_target, 'travel_friend_request',
    coalesce(v_actor_name, 'Un voyageur') || ' souhaite devenir votre ami de voyage',
    'Retrouvez cette demande dans Voyages.',
    jsonb_build_object('friend_request_id', v_request_id));

  return jsonb_build_object('status', 'pending', 'request_id', v_request_id, 'user_id', v_target);
end; $$;

create or replace function public.respond_travel_friend_request(p_request_id uuid, p_accept boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_request public.travel_friend_requests%rowtype;
  v_actor_name text;
begin
  if v_actor is null then raise exception 'authentication required'; end if;
  select * into v_request from public.travel_friend_requests where id = p_request_id for update;
  if not found then raise exception 'request not found'; end if;
  if v_request.recipient_id <> v_actor then raise exception 'request not addressed to you'; end if;
  if v_request.status <> 'pending' then return jsonb_build_object('status', v_request.status); end if;

  update public.travel_friend_requests
    set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now()
    where id = p_request_id;

  if p_accept then
    insert into public.travel_friends(user_a, user_b)
    values (least(v_request.sender_id, v_request.recipient_id), greatest(v_request.sender_id, v_request.recipient_id))
    on conflict (user_a, user_b) do nothing;
    select username into v_actor_name from public.profiles where user_id = v_actor;
    insert into public.notifications(user_id, kind, title, body, payload)
    values (v_request.sender_id, 'travel_friend_accepted',
      coalesce(v_actor_name, 'Un voyageur') || ' a accepté votre demande',
      'Vous pouvez maintenant l’inviter plus vite à un voyage.',
      jsonb_build_object('user_id', v_actor));
  end if;

  update public.notifications set read_at = coalesce(read_at, now())
    where user_id = v_actor and payload->>'friend_request_id' = p_request_id::text;
  return jsonb_build_object('status', case when p_accept then 'accepted' else 'declined' end);
end; $$;

create or replace function public.remove_travel_friend(p_friend_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'authentication required'; end if;
  delete from public.travel_friends
    where id = p_friend_id and v_actor in (user_a, user_b);
end; $$;

revoke all on function public.has_travel_friend_context(uuid, uuid) from public;
revoke all on function public.find_travel_user(text) from public;
revoke all on function public.send_travel_friend_request(text) from public;
revoke all on function public.respond_travel_friend_request(uuid, boolean) from public;
revoke all on function public.remove_travel_friend(uuid) from public;
grant execute on function public.has_travel_friend_context(uuid, uuid) to authenticated;
grant execute on function public.find_travel_user(text) to authenticated;
grant execute on function public.send_travel_friend_request(text) to authenticated;
grant execute on function public.respond_travel_friend_request(uuid, boolean) to authenticated;
grant execute on function public.remove_travel_friend(uuid) to authenticated;

-- 4. Notifications utiles, déclenchées uniquement sur événements structurants -
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'trip_invitation','trip_member_joined','trip_expense','trip_task_assigned',
  'travel_friend_request','travel_friend_accepted',
  'rent_due','business_task','system'
));

create or replace function public.notify_trip_expense_created()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null then return new; end if;
  insert into public.notifications(user_id, kind, title, body, payload)
  select participant.user_id, 'trip_expense', 'Nouvelle dépense · ' || new.title,
         trim(to_char(new.amount, 'FM999999990D00')) || ' ' || new.currency,
         jsonb_build_object('trip_id', new.trip_id, 'expense_id', new.id)
  from (
    select t.user_id from public.trips t where t.id = new.trip_id
    union
    select m.user_id from public.trip_members m where m.trip_id = new.trip_id and m.status = 'accepted'
  ) participant
  where participant.user_id is distinct from v_actor;
  return new;
end; $$;

drop trigger if exists trip_expense_notify_members on public.trip_expenses;
create trigger trip_expense_notify_members after insert on public.trip_expenses
for each row execute function public.notify_trip_expense_created();

create or replace function public.notify_trip_checklist_assignment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null then return new; end if;
  if new.assigned_to is not null
    and new.assigned_to is distinct from v_actor
    and (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to) then
    insert into public.notifications(user_id, kind, title, body, payload)
    values (new.assigned_to, 'trip_task_assigned', 'Une tâche vous a été assignée', new.title,
      jsonb_build_object('trip_id', new.trip_id, 'checklist_item_id', new.id));
  end if;
  return new;
end; $$;

drop trigger if exists trip_checklist_notify_assignment on public.trip_checklist_items;
create trigger trip_checklist_notify_assignment after insert or update of assigned_to on public.trip_checklist_items
for each row execute function public.notify_trip_checklist_assignment();

revoke all on function public.notify_trip_expense_created() from public;
revoke all on function public.notify_trip_checklist_assignment() from public;

-- 5. Realtime : la base reste la source de vérité pour les co-voyageurs -------
do $$
declare v_table text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach v_table in array array[
      'trips','flights','accommodations','trip_activities','trip_checklist_items',
      'trip_members','trip_invitations','notifications','trip_expenses','trip_expense_splits',
      'travel_friend_requests','travel_friends'
    ] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_table
      ) then
        execute format('alter publication supabase_realtime add table public.%I', v_table);
      end if;
    end loop;
  end if;
end $$;
