alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.migration_batches enable row level security;

create policy profiles_select_own on public.profiles for select using(auth.uid()=user_id);
create policy profiles_update_own on public.profiles for update using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy preferences_all_own on public.user_preferences for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy migration_batches_all_own on public.migration_batches for all using(auth.uid()=user_id) with check(auth.uid()=user_id);

do $$ declare table_name text; begin
 foreach table_name in array array['tenants','rent_payments','tenant_debts','dubai_parts','dubai_sales','dubai_expenses','dubai_cash_movements','businesses','business_contacts','business_items','business_transactions','business_bookings','business_tasks','budget_entries','subscriptions','trips','flights','accommodations','trip_activities','trip_checklist_items','attachments'] loop
  execute format('alter table public.%I enable row level security',table_name);
  execute format('create policy %I on public.%I for select using (auth.uid() = user_id)',table_name||'_select_own',table_name);
  execute format('create policy %I on public.%I for insert with check (auth.uid() = user_id)',table_name||'_insert_own',table_name);
  execute format('create policy %I on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)',table_name||'_update_own',table_name);
  execute format('create policy %I on public.%I for delete using (auth.uid() = user_id)',table_name||'_delete_own',table_name);
 end loop;
end $$;
