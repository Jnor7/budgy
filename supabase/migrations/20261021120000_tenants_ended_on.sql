-- Date de fin de location : nullable, aucune donnée existante modifiée.
alter table public.tenants add column if not exists ended_on date;
