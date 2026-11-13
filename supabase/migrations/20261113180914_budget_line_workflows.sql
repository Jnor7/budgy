begin;

alter table public.budget_entries
  add column if not exists currency text not null default 'EUR',
  add column if not exists counts_as_earned_income boolean not null default true,
  add column if not exists rollover_status text not null default 'none'
    check (rollover_status in ('none','carried_out','carried_in')),
  add column if not exists original_entry_id uuid references public.budget_entries(id) on delete set null,
  add column if not exists original_month date,
  add column if not exists linked_debt_id uuid references public.finance_debts(id) on delete set null;

alter table public.finance_sub_expenses
  alter column provision_id drop not null,
  add column if not exists budget_entry_id uuid references public.budget_entries(id) on delete cascade;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.finance_sub_expenses'::regclass
      and conname='finance_sub_expenses_one_parent'
  ) then
    alter table public.finance_sub_expenses
      add constraint finance_sub_expenses_one_parent
      check (num_nonnulls(provision_id,budget_entry_id)=1) not valid;
    alter table public.finance_sub_expenses validate constraint finance_sub_expenses_one_parent;
  end if;
end $$;

create index if not exists budget_entries_rollover_idx
  on public.budget_entries(user_id,rollover_status,date) where not is_archived;
create index if not exists budget_entries_original_idx
  on public.budget_entries(original_entry_id) where original_entry_id is not null;
create index if not exists finance_sub_expenses_budget_entry_idx
  on public.finance_sub_expenses(budget_entry_id,status) where budget_entry_id is not null;

grant select,insert,update on public.budget_entries to budgy_finance_server;
drop policy if exists finance_server_scope on public.budget_entries;
create policy finance_server_scope on public.budget_entries to budgy_finance_server
  using (user_id=nullif(current_setting('budgy.finance_user_id',true),'')::uuid)
  with check (user_id=nullif(current_setting('budgy.finance_user_id',true),'')::uuid);

commit;
