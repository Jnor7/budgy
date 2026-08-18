-- Budgy V2 — Voyages collaboratifs : membres, invitations, notifications, RLS.
-- POINT CRITIQUE : seules les policies du domaine Voyages sont modifiées.
-- Budget, loyers, business, abonnements et pièces jointes restent strictement privés.

-- 1. Colonnes additionnelles -------------------------------------------------
alter table public.trips add column if not exists cover_image_url text not null default '';
alter table public.trip_checklist_items
  add column if not exists assigned_to uuid references auth.users(id) on delete set null;

-- 2. Membres -----------------------------------------------------------------
create table if not exists public.trip_members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('owner','editor','viewer')),
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  invited_by uuid references auth.users(id) on delete set null,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  constraint trip_members_unique unique (trip_id, user_id)
);
create index if not exists trip_members_user_idx on public.trip_members(user_id, status);
create index if not exists trip_members_trip_idx on public.trip_members(trip_id);

-- 3. Invitations -------------------------------------------------------------
create table if not exists public.trip_invitations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  inviter_id uuid not null references auth.users(id) on delete cascade,
  invited_user_id uuid references auth.users(id) on delete cascade,
  invited_email text,
  role text not null default 'editor' check (role in ('editor','viewer')),
  token text not null default encode(gen_random_bytes(16), 'hex'),
  status text not null default 'pending' check (status in ('pending','accepted','declined','expired','revoked')),
  expires_at timestamptz not null default now() + interval '30 days',
  created_at timestamptz not null default now(),
  constraint trip_invitations_target check (invited_user_id is not null or invited_email is not null)
);
create index if not exists trip_invitations_invited_idx on public.trip_invitations(invited_user_id, status);
create index if not exists trip_invitations_trip_idx on public.trip_invitations(trip_id);
create unique index if not exists trip_invitations_token_unique on public.trip_invitations(token);

-- 4. Notifications -----------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('trip_invitation','trip_member_joined','trip_expense','rent_due','business_task','system')),
  title text not null,
  body text not null default '',
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications(user_id) where read_at is null;

-- 5. Helpers de permission (SECURITY DEFINER : évitent la récursion RLS) -----
create or replace function public.trip_role(p_trip_id uuid, p_user_id uuid default auth.uid())
returns text language sql stable security definer set search_path = '' as $$
  select case
    when p_user_id is null then null
    when exists (select 1 from public.trips t where t.id = p_trip_id and t.user_id = p_user_id) then 'owner'
    else (
      select m.role from public.trip_members m
      where m.trip_id = p_trip_id and m.user_id = p_user_id and m.status = 'accepted'
      order by case m.role when 'owner' then 0 when 'editor' then 1 else 2 end
      limit 1
    )
  end;
$$;

create or replace function public.can_view_trip(p_trip_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select public.trip_role(p_trip_id, p_user_id) is not null;
$$;

create or replace function public.can_edit_trip(p_trip_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select public.trip_role(p_trip_id, p_user_id) in ('owner','editor');
$$;

create or replace function public.can_manage_trip_members(p_trip_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select public.trip_role(p_trip_id, p_user_id) = 'owner';
$$;

create or replace function public.shares_trip_with(p_user_id uuid, p_viewer_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.trips t
    left join public.trip_members m on m.trip_id = t.id and m.status = 'accepted'
    where (t.user_id = p_viewer_id or m.user_id = p_viewer_id)
      and (t.user_id = p_user_id or exists (
        select 1 from public.trip_members m2
        where m2.trip_id = t.id and m2.user_id = p_user_id and m2.status = 'accepted'
      ))
  );
$$;

-- 6. RLS des voyages et de leurs enfants -------------------------------------
alter table public.trip_members enable row level security;
alter table public.trip_invitations enable row level security;
alter table public.notifications enable row level security;

-- Voyage : lecture élargie aux membres, écriture réservée au propriétaire.
drop policy if exists trips_select_own on public.trips;
drop policy if exists trips_select_visible on public.trips;
create policy trips_select_visible on public.trips
for select using (public.can_view_trip(id));

-- Enfants du voyage : lecture pour tout membre, écriture pour owner/editor.
do $$ declare child text; begin
  foreach child in array array['flights','accommodations','trip_activities','trip_checklist_items'] loop
    execute format('drop policy if exists %I on public.%I', child || '_select_own', child);
    execute format('drop policy if exists %I on public.%I', child || '_insert_own', child);
    execute format('drop policy if exists %I on public.%I', child || '_update_own', child);
    execute format('drop policy if exists %I on public.%I', child || '_delete_own', child);
    execute format('drop policy if exists %I on public.%I', child || '_select_shared', child);
    execute format('drop policy if exists %I on public.%I', child || '_insert_shared', child);
    execute format('drop policy if exists %I on public.%I', child || '_update_shared', child);
    execute format('drop policy if exists %I on public.%I', child || '_delete_shared', child);

    execute format('create policy %I on public.%I for select using (public.can_view_trip(trip_id))',
                   child || '_select_shared', child);
    execute format('create policy %I on public.%I for insert with check (auth.uid() = user_id and public.can_edit_trip(trip_id))',
                   child || '_insert_shared', child);
    execute format('create policy %I on public.%I for update using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id))',
                   child || '_update_shared', child);
    execute format('create policy %I on public.%I for delete using (public.can_edit_trip(trip_id))',
                   child || '_delete_shared', child);
  end loop;
end $$;

-- Membres.
drop policy if exists trip_members_select on public.trip_members;
create policy trip_members_select on public.trip_members
for select using (user_id = auth.uid() or public.can_view_trip(trip_id));

drop policy if exists trip_members_insert on public.trip_members;
create policy trip_members_insert on public.trip_members
for insert with check (public.can_manage_trip_members(trip_id));

drop policy if exists trip_members_update on public.trip_members;
create policy trip_members_update on public.trip_members
for update using (public.can_manage_trip_members(trip_id) or user_id = auth.uid())
with check (public.can_manage_trip_members(trip_id) or user_id = auth.uid());

drop policy if exists trip_members_delete on public.trip_members;
create policy trip_members_delete on public.trip_members
for delete using (public.can_manage_trip_members(trip_id) or user_id = auth.uid());

-- Invitations.
drop policy if exists trip_invitations_select on public.trip_invitations;
create policy trip_invitations_select on public.trip_invitations
for select using (
  inviter_id = auth.uid()
  or invited_user_id = auth.uid()
  or public.can_manage_trip_members(trip_id)
);

drop policy if exists trip_invitations_insert on public.trip_invitations;
create policy trip_invitations_insert on public.trip_invitations
for insert with check (inviter_id = auth.uid() and public.can_manage_trip_members(trip_id));

drop policy if exists trip_invitations_update on public.trip_invitations;
create policy trip_invitations_update on public.trip_invitations
for update using (invited_user_id = auth.uid() or public.can_manage_trip_members(trip_id))
with check (invited_user_id = auth.uid() or public.can_manage_trip_members(trip_id));

drop policy if exists trip_invitations_delete on public.trip_invitations;
create policy trip_invitations_delete on public.trip_invitations
for delete using (public.can_manage_trip_members(trip_id));

-- Notifications : strictement personnelles.
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
for select using (auth.uid() = user_id);

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_delete_own on public.notifications
for delete using (auth.uid() = user_id);
-- Aucune policy INSERT côté client : seules les fonctions SECURITY DEFINER écrivent.

-- 7. Profils visibles entre co-voyageurs uniquement --------------------------
drop policy if exists profiles_select_shared_trip on public.profiles;
create policy profiles_select_shared_trip on public.profiles
for select using (auth.uid() = user_id or public.shares_trip_with(user_id));

-- 8. RPC d'invitation et de réponse ------------------------------------------
create or replace function public.find_budgy_user(p_handle text)
returns table (user_id uuid, username text, avatar_url text)
language sql stable security definer set search_path = '' as $$
  select p.user_id, p.username, p.avatar_url
  from public.profiles p
  where auth.uid() is not null
    and lower(p.username) = lower(trim(p_handle))
    and p.user_id <> auth.uid()
  limit 1;
$$;

create or replace function public.invite_to_trip(
  p_trip_id uuid,
  p_handle text default null,
  p_email text default null,
  p_role text default 'editor'
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_target uuid;
  v_trip public.trips%rowtype;
  v_inviter_name text;
  v_invitation_id uuid;
begin
  if v_actor is null then raise exception 'authentication required'; end if;
  if not public.can_manage_trip_members(p_trip_id, v_actor) then
    raise exception 'only the trip owner can invite';
  end if;
  if p_role not in ('editor','viewer') then raise exception 'invalid role'; end if;

  select * into v_trip from public.trips where id = p_trip_id;
  select username into v_inviter_name from public.profiles where user_id = v_actor;

  if p_handle is not null and length(trim(p_handle)) > 0 then
    select user_id into v_target from public.profiles where lower(username) = lower(trim(p_handle));
  elsif p_email is not null and length(trim(p_email)) > 0 then
    select id into v_target from auth.users where lower(email) = lower(trim(p_email));
  end if;

  if v_target = v_actor then raise exception 'cannot invite yourself'; end if;

  insert into public.trip_invitations (trip_id, inviter_id, invited_user_id, invited_email, role)
  values (p_trip_id, v_actor, v_target, nullif(trim(coalesce(p_email,'')), ''), p_role)
  returning id into v_invitation_id;

  if v_target is not null then
    insert into public.trip_members (trip_id, user_id, role, status, invited_by)
    values (p_trip_id, v_target, p_role, 'pending', v_actor)
    on conflict (trip_id, user_id) do update set role = excluded.role, invited_by = excluded.invited_by;

    insert into public.notifications (user_id, kind, title, body, payload)
    values (
      v_target, 'trip_invitation',
      coalesce(v_inviter_name, 'Un utilisateur') || ' vous invite à rejoindre ' || v_trip.title,
      'Rôle proposé : ' || p_role,
      jsonb_build_object('trip_id', p_trip_id, 'invitation_id', v_invitation_id, 'role', p_role)
    );
  end if;

  return jsonb_build_object(
    'invitation_id', v_invitation_id,
    'resolved', v_target is not null,
    'status', case when v_target is not null then 'sent' else 'pending_email' end
  );
end; $$;

create or replace function public.respond_trip_invitation(p_invitation_id uuid, p_accept boolean)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_invitation public.trip_invitations%rowtype;
  v_actor_name text;
begin
  if v_actor is null then raise exception 'authentication required'; end if;

  select * into v_invitation from public.trip_invitations where id = p_invitation_id;
  if not found then raise exception 'invitation not found'; end if;
  if v_invitation.invited_user_id is distinct from v_actor then raise exception 'invitation not addressed to you'; end if;
  if v_invitation.status <> 'pending' then return jsonb_build_object('status', v_invitation.status); end if;
  if v_invitation.expires_at < now() then
    update public.trip_invitations set status = 'expired' where id = p_invitation_id;
    return jsonb_build_object('status', 'expired');
  end if;

  update public.trip_invitations
  set status = case when p_accept then 'accepted' else 'declined' end
  where id = p_invitation_id;

  update public.trip_members
  set status = case when p_accept then 'accepted' else 'declined' end,
      joined_at = case when p_accept then now() else null end
  where trip_id = v_invitation.trip_id and user_id = v_actor;

  update public.notifications
  set read_at = coalesce(read_at, now())
  where user_id = v_actor and payload->>'invitation_id' = p_invitation_id::text;

  if p_accept then
    select username into v_actor_name from public.profiles where user_id = v_actor;
    insert into public.notifications (user_id, kind, title, body, payload)
    values (
      v_invitation.inviter_id, 'trip_member_joined',
      coalesce(v_actor_name, 'Un utilisateur') || ' a rejoint le voyage',
      '', jsonb_build_object('trip_id', v_invitation.trip_id)
    );
  end if;

  return jsonb_build_object('status', case when p_accept then 'accepted' else 'declined' end);
end; $$;

revoke all on function public.invite_to_trip(uuid, text, text, text) from public;
revoke all on function public.respond_trip_invitation(uuid, boolean) from public;
revoke all on function public.find_budgy_user(text) from public;
grant execute on function public.invite_to_trip(uuid, text, text, text) to authenticated;
grant execute on function public.respond_trip_invitation(uuid, boolean) to authenticated;
grant execute on function public.find_budgy_user(text) to authenticated;
grant execute on function public.trip_role(uuid, uuid) to authenticated;
grant execute on function public.can_view_trip(uuid, uuid) to authenticated;
grant execute on function public.can_edit_trip(uuid, uuid) to authenticated;
grant execute on function public.can_manage_trip_members(uuid, uuid) to authenticated;
