-- Répare l'import Budget JR v1 sans rendre les montants Dubaï nullables.

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
  invalid_row jsonb;
  source_count integer;
  v_row_count integer;
  v_inserted_count integer := 0;
  v_skipped_count integer := 0;
  detected_modules text[];
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;
  if p_format_version <> 1 then
    raise exception 'unsupported migration format: %', p_format_version;
  end if;
  if jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid migration payload: expected an object';
  end if;

  -- Valider les 21 collections avant toute écriture, y compris lors d'un retry.
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
  end loop;

  detected_modules := array_remove(array[
    case when jsonb_array_length(coalesce(p_payload -> 'budget_entries', '[]'::jsonb)) > 0 then 'budget' end,
    case when jsonb_array_length(coalesce(p_payload -> 'subscriptions', '[]'::jsonb)) > 0 then 'subscriptions' end,
    case when jsonb_array_length(coalesce(p_payload -> 'trips', '[]'::jsonb)) > 0
                or jsonb_array_length(coalesce(p_payload -> 'flights', '[]'::jsonb)) > 0
                or jsonb_array_length(coalesce(p_payload -> 'accommodations', '[]'::jsonb)) > 0
                or jsonb_array_length(coalesce(p_payload -> 'trip_activities', '[]'::jsonb)) > 0
                or jsonb_array_length(coalesce(p_payload -> 'trip_checklist_items', '[]'::jsonb)) > 0 then 'trips' end,
    case when jsonb_array_length(coalesce(p_payload -> 'tenants', '[]'::jsonb)) > 0
                or jsonb_array_length(coalesce(p_payload -> 'rent_payments', '[]'::jsonb)) > 0
                or jsonb_array_length(coalesce(p_payload -> 'tenant_debts', '[]'::jsonb)) > 0 then 'rentals' end,
    case when jsonb_array_length(coalesce(p_payload -> 'businesses', '[]'::jsonb)) > 0
                or jsonb_array_length(coalesce(p_payload -> 'business_contacts', '[]'::jsonb)) > 0
                or jsonb_array_length(coalesce(p_payload -> 'business_items', '[]'::jsonb)) > 0
                or jsonb_array_length(coalesce(p_payload -> 'business_transactions', '[]'::jsonb)) > 0
                or jsonb_array_length(coalesce(p_payload -> 'business_bookings', '[]'::jsonb)) > 0
                or jsonb_array_length(coalesce(p_payload -> 'business_tasks', '[]'::jsonb)) > 0
                or jsonb_array_length(coalesce(p_payload -> 'dubai_parts', '[]'::jsonb)) > 0
                or jsonb_array_length(coalesce(p_payload -> 'dubai_sales', '[]'::jsonb)) > 0
                or jsonb_array_length(coalesce(p_payload -> 'dubai_expenses', '[]'::jsonb)) > 0
                or jsonb_array_length(coalesce(p_payload -> 'dubai_cash_movements', '[]'::jsonb)) > 0 then 'businesses' end
  ]::text[], null);

  if p_checksum is not null then
    select * into existing_batch
    from public.migration_batches
    where user_id = current_user_id and checksum = p_checksum and status = 'completed'
    order by created_at desc limit 1;
    if found then
      insert into public.user_modules(user_id, module_key, enabled)
      select current_user_id, module_key, true from unnest(detected_modules) as module_key
      on conflict (user_id, module_key) do update set enabled = true, updated_at = now();
      return jsonb_build_object(
        'batch_id', existing_batch.id,
        'inserted', 0,
        'skipped', existing_batch.inserted_count + existing_batch.skipped_count,
        'already_imported', true,
        'enabled_modules', to_jsonb(detected_modules)
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
    source_count := jsonb_array_length(source_rows);
    if source_count = 0 then continue; end if;

    -- Diagnostic financier lisible, avant le NOT NULL PostgreSQL.
    if table_name = 'dubai_parts' then
      select item into invalid_row
      from jsonb_array_elements(source_rows) as item
      where coalesce(jsonb_typeof(coalesce(item -> 'purchase_price_aed', item -> 'purchase_price_a_e_d')), 'null') = 'null'
      limit 1;
      if invalid_row is not null then
        raise exception 'Import impossible: DubaiPart "%" purchasePriceAED est absent.',
          coalesce(invalid_row ->> 'name', invalid_row ->> 'legacy_id', 'sans identifiant')
          using errcode = '22023', hint = 'Corrigez l''archive ou utilisez une version de Budgy qui conserve les champs AED.';
      end if;
    end if;

    select coalesce(jsonb_agg(
      (
        case
          when table_name = 'dubai_parts' then
            (item - 'purchase_price_a_e_d' - 'target_sale_price_a_e_d' - 'cash_withdrawn_a_e_d') || jsonb_build_object(
              'purchase_price_aed', coalesce(item -> 'purchase_price_aed', item -> 'purchase_price_a_e_d'),
              'target_sale_price_aed', coalesce(item -> 'target_sale_price_aed', item -> 'target_sale_price_a_e_d'),
              'cash_withdrawn_aed', coalesce(item -> 'cash_withdrawn_aed', item -> 'cash_withdrawn_a_e_d')
            )
          when table_name = 'dubai_sales' then
            (item - 'unit_sale_price_a_e_d') || jsonb_build_object(
              'unit_sale_price_aed', coalesce(item -> 'unit_sale_price_aed', item -> 'unit_sale_price_a_e_d')
            )
          when table_name = 'dubai_expenses' then
            (item - 'amount_a_e_d') || jsonb_build_object(
              'amount_aed', coalesce(item -> 'amount_aed', item -> 'amount_a_e_d')
            )
          when table_name = 'businesses' then
            (item - 'module_k_p_i') || jsonb_build_object(
              'module_kpi', coalesce(item -> 'module_kpi', item -> 'module_k_p_i'),
              'template', case when jsonb_typeof(item -> 'template') = 'string' then item -> 'template' else '"simple"'::jsonb end
            )
          when table_name = 'trips' then
            item || jsonb_build_object(
              'cover_image_url', case when jsonb_typeof(item -> 'cover_image_url') = 'string' then item -> 'cover_image_url' else '""'::jsonb end
            )
          else item
        end
        - 'user_id' - 'migration_batch_id'
      ) || jsonb_build_object('user_id', current_user_id, 'migration_batch_id', batch_id)
    ), '[]'::jsonb)
    into normalized_rows
    from jsonb_array_elements(source_rows) as item;

    execute format(
      'insert into public.%1$I select * from jsonb_populate_recordset(null::public.%1$I, $1) on conflict do nothing',
      table_name
    ) using normalized_rows;
    get diagnostics v_row_count = row_count;
    v_inserted_count := v_inserted_count + v_row_count;
    v_skipped_count := v_skipped_count + source_count - v_row_count;
  end loop;

  insert into public.user_modules(user_id, module_key, enabled)
  select current_user_id, module_key, true from unnest(detected_modules) as module_key
  on conflict (user_id, module_key) do update set enabled = true, updated_at = now();

  update public.migration_batches
  set status = 'completed', inserted_count = v_inserted_count, skipped_count = v_skipped_count,
      report = jsonb_build_object('format_version', p_format_version, 'enabled_modules', to_jsonb(detected_modules)),
      completed_at = now()
  where id = batch_id;

  return jsonb_build_object(
    'batch_id', batch_id,
    'inserted', v_inserted_count,
    'skipped', v_skipped_count,
    'already_imported', false,
    'enabled_modules', to_jsonb(detected_modules)
  );
exception when others then
  -- Toute exception quitte l'appel RPC : PostgreSQL annule donc le batch, les
  -- entités et les activations de modules dans la même transaction.
  raise;
end;
$$;

revoke all on function public.import_budgy_archive(jsonb, integer, text) from public;
grant execute on function public.import_budgy_archive(jsonb, integer, text) to authenticated;
