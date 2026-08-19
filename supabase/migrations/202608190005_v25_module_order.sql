-- Budgy V2.5 — ordre personnel des modules.
-- Migration additive : aucune donnée métier n'est supprimée ni recalculée.

alter table public.user_modules
  add column if not exists sort_order integer;

update public.user_modules
set sort_order = case module_key
  when 'budget' then 0
  when 'rentals' then 1
  when 'trips' then 2
  when 'businesses' then 3
  when 'subscriptions' then 4
  else 99
end
where sort_order is null;

alter table public.user_modules
  alter column sort_order set default 99,
  alter column sort_order set not null;

create index if not exists user_modules_user_sort_idx
  on public.user_modules(user_id, sort_order);

comment on column public.user_modules.sort_order is
  'Ordre d’affichage choisi par l’utilisateur ; les trois premiers modules actifs alimentent la navigation principale.';
