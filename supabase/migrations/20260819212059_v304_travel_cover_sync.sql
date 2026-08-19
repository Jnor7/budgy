-- Budgy V3.0.4 - persistance atomique des couvertures Travel partagees.
-- Les autres donnees du voyage conservent leurs policies actuelles.

alter table public.trips
  add column if not exists cover_updated_at timestamptz;

create or replace function public.update_trip_cover(
  p_trip_id uuid,
  p_cover_image_url text,
  p_cover_image_provider text,
  p_cover_image_id text,
  p_cover_photographer text,
  p_cover_photographer_url text,
  p_cover_attribution text
)
returns table (
  id uuid,
  cover_image_url text,
  cover_image_provider text,
  cover_image_id text,
  cover_photographer text,
  cover_photographer_url text,
  cover_attribution text,
  cover_updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'authentication required';
  end if;
  if not public.can_edit_trip(p_trip_id, v_actor) then
    raise exception 'trip cover update forbidden';
  end if;
  if trim(coalesce(p_cover_image_url, '')) = ''
     or lower(trim(coalesce(p_cover_image_provider, ''))) <> 'unsplash'
     or trim(coalesce(p_cover_image_id, '')) = ''
     or trim(coalesce(p_cover_photographer, '')) = '' then
    raise exception 'invalid trip cover metadata';
  end if;

  return query
  update public.trips as trip
  set cover_image_url = trim(p_cover_image_url),
      cover_image_provider = 'unsplash',
      cover_image_id = trim(p_cover_image_id),
      cover_photographer = trim(p_cover_photographer),
      cover_photographer_url = trim(coalesce(p_cover_photographer_url, '')),
      cover_attribution = trim(coalesce(p_cover_attribution, '')),
      cover_updated_at = clock_timestamp()
  where trip.id = p_trip_id
  returning trip.id, trip.cover_image_url, trip.cover_image_provider,
            trip.cover_image_id, trip.cover_photographer,
            trip.cover_photographer_url, trip.cover_attribution,
            trip.cover_updated_at;

  if not found then
    raise exception 'trip not found';
  end if;
end;
$$;

revoke all on function public.update_trip_cover(uuid, text, text, text, text, text, text) from public, anon;
grant execute on function public.update_trip_cover(uuid, text, text, text, text, text, text) to authenticated;
