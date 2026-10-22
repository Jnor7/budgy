-- Report d'une ligne Budgy au mois suivant : la copie reportée référence la ligne d'origine.
-- Nullable, aucune donnée existante modifiée.
alter table public.budget_entries add column if not exists carried_from_id uuid;
create index if not exists budget_entries_carried_from_id_idx on public.budget_entries (carried_from_id);
