create unique index profiles_username_ci_unique on public.profiles(lower(username));
create index migration_batches_user_created_idx on public.migration_batches(user_id,created_at desc);
create unique index rent_payments_user_legacy_unique on public.rent_payments(user_id,legacy_id) where legacy_id is not null;
create unique index budget_entries_user_legacy_unique on public.budget_entries(user_id,legacy_id) where legacy_id is not null;
create unique index tenants_user_legacy_unique on public.tenants(user_id,legacy_id) where legacy_id is not null;
create unique index dubai_parts_user_legacy_unique on public.dubai_parts(user_id,legacy_id) where legacy_id is not null;
create unique index businesses_user_legacy_unique on public.businesses(user_id,legacy_id) where legacy_id is not null;
create unique index trips_user_legacy_unique on public.trips(user_id,legacy_id) where legacy_id is not null;
create index budget_entries_user_date_idx on public.budget_entries(user_id,date desc);
create index subscriptions_user_active_idx on public.subscriptions(user_id,is_active);
create index rent_payments_tenant_month_idx on public.rent_payments(tenant_id,year,month);
create index tenant_debts_tenant_month_idx on public.tenant_debts(tenant_id,year,month);
create index dubai_sales_part_date_idx on public.dubai_sales(part_id,date desc);
create index dubai_expenses_user_date_idx on public.dubai_expenses(user_id,date desc);
create index dubai_cash_user_date_idx on public.dubai_cash_movements(user_id,date desc);
create index business_contacts_parent_idx on public.business_contacts(business_id);
create index business_items_parent_idx on public.business_items(business_id);
create index business_transactions_parent_date_idx on public.business_transactions(business_id,date desc);
create index business_bookings_parent_start_idx on public.business_bookings(business_id,start_date);
create index business_tasks_parent_due_idx on public.business_tasks(business_id,due_date);
create index flights_trip_idx on public.flights(trip_id);
create index accommodations_trip_idx on public.accommodations(trip_id);
create index trip_activities_trip_idx on public.trip_activities(trip_id);
create index trip_checklist_trip_idx on public.trip_checklist_items(trip_id);
create index attachments_dubai_part_idx on public.attachments(dubai_part_id) where dubai_part_id is not null;
create index attachments_business_idx on public.attachments(business_id) where business_id is not null;

do $$ declare table_name text; begin
 foreach table_name in array array['tenant_debts','dubai_sales','dubai_expenses','dubai_cash_movements','business_contacts','business_items','business_transactions','business_bookings','business_tasks','subscriptions','flights','accommodations','trip_activities','trip_checklist_items','attachments'] loop
  execute format('create unique index %I on public.%I(user_id,legacy_id) where legacy_id is not null',table_name||'_user_legacy_unique',table_name);
 end loop;
end $$;
