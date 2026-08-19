-- Recherche prefixée et minimale pour le typeahead Travel.
-- SECURITY DEFINER est nécessaire ici car profiles ne rend volontairement pas
-- l'annuaire complet lisible via RLS. La fonction n'expose que le profil public.
create or replace function public.search_travel_profiles(p_query text, p_limit integer default 6)
returns table (user_id uuid, username text, avatar_url text)
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_actor uuid := (select auth.uid());
  v_query text := regexp_replace(trim(coalesce(p_query, '')), '[%_]', '', 'g');
  v_limit integer := least(greatest(coalesce(p_limit, 6), 1), 8);
begin
  if v_actor is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if char_length(v_query) < 2 then
    return;
  end if;

  return query
  select p.user_id, p.username, coalesce(p.avatar_url, '')
  from public.profiles p
  where p.user_id <> v_actor
    and lower(p.username) like lower(v_query) || '%'
  order by lower(p.username), p.user_id
  limit v_limit;
end;
$$;

revoke all on function public.search_travel_profiles(text, integer) from public, anon;
grant execute on function public.search_travel_profiles(text, integer) to authenticated;

comment on function public.search_travel_profiles(text, integer) is
  'Typeahead Travel privé: préfixe >= 2 caractères, 8 résultats max, aucun email ni donnée financière.';

