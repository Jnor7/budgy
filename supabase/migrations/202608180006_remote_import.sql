create unique index if not exists migration_batches_user_checksum_unique
on public.migration_batches(user_id, checksum)
where checksum is not null and status = 'completed';

create or replace function public.import_budgy_archive(
  p_payload jsonb,
  p_format_version integer,
  p_checksum text default null
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  batch_id uuid;
  existing_batch public.migration_batches%rowtype;
  table_name text;
  source_rows jsonb;
  normalized_rows jsonb;
  source_count integer;
  row_count integer;
  v_inserted_count integer := 0;
  v_skipped_count integer := 0;
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;
  if p_format_version <> 1 then
    raise exception 'unsupported migration format: %', p_format_version;
  end if;

  if p_checksum is not null then
    select * into existing_batch
    from public.migration_batches
    where user_id = current_user_id and checksum = p_checksum and status = 'completed'
    order by created_at desc limit 1;
    if found then
      return jsonb_build_object(
        'batch_id', existing_batch.id,
        'inserted', 0,
        'skipped', existing_batch.inserted_count + existing_batch.skipped_count,
        'already_imported', true
      );
    end if;
  end if;

  insert into public.migration_batches(user_id, source, format_version, checksum, status)
  values(current_user_id, 'budget-jr', p_format_version, p_checksum, 'processing')
  returning id into batch_id;

  foreach table_name in array array[
    'tenants','dubai_parts','businesses','budget_entries','subscriptions','trips',
    'rent_payments','tenant_debts','dubai_sales','dubai_expenses','dubai_cash_movements',
    'business_contacts','business_items','business_transactions','business_bookings',
    'business_tasks','flights','accommodations','trip_activities','trip_checklist_items','attachments'
  ] loop
    source_rows := coalesce(p_payload -> table_name, '[]'::jsonb);
    if jsonb_typeof(source_rows) <> 'array' then
      raise exception 'invalid payload for table %', table_name;
    end if;
    source_count := jsonb_array_length(source_rows);
    if source_count = 0 then continue; end if;

    select coalesce(jsonb_agg(
      (item - 'user_id' - 'migration_batch_id') ||
      jsonb_build_object('user_id', current_user_id, 'migration_batch_id', batch_id)
    ), '[]'::jsonb)
    into normalized_rows
    from jsonb_array_elements(source_rows) as item;

    execute format(
      'insert into public.%1$I select * from jsonb_populate_recordset(null::public.%1$I, $1) on conflict do nothing',
      table_name
    ) using normalized_rows;
    get diagnostics row_count = row_count;
    v_inserted_count := v_inserted_count + row_count;
    v_skipped_count := v_skipped_count + source_count - row_count;
  end loop;

  update public.migration_batches
  set status = 'completed', inserted_count = v_inserted_count, skipped_count = v_skipped_count,
      report = jsonb_build_object('format_version', p_format_version), completed_at = now()
  where id = batch_id;

  return jsonb_build_object('batch_id', batch_id, 'inserted', v_inserted_count, 'skipped', v_skipped_count);
exception when others then
  raise;
end;
$$;

revoke all on function public.import_budgy_archive(jsonb, integer, text) from public;
grant execute on function public.import_budgy_archive(jsonb, integer, text) to authenticated;
