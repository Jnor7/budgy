-- Budgy V3.0.4.1 - pays disponibles derives de l'annuaire OurAirports.

create or replace function public.list_airport_country_codes()
returns table (country_code varchar)
language sql
stable
security invoker
set search_path = ''
as $$
  select distinct airport.country_code
  from public.airports as airport
  where auth.uid() is not null
    and airport.country_code <> ''
  order by airport.country_code;
$$;

revoke all on function public.list_airport_country_codes() from public, anon;
grant execute on function public.list_airport_country_codes() to authenticated;
