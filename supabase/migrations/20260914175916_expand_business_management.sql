-- Budgy Business management: additive schema only.
-- Existing rows remain valid through defaults and nullable foreign keys.

alter table public.businesses
  add column if not exists reporting_currency text not null default 'EUR',
  add column if not exists default_purchase_currency text not null default 'EUR',
  add column if not exists default_sale_currency text not null default 'EUR';

alter table public.business_items
  add column if not exists description text not null default '',
  add column if not exists category text not null default 'Autre',
  add column if not exists purchase_currency text not null default 'EUR',
  add column if not exists sale_currency text not null default 'EUR',
  add column if not exists purchase_exchange_rate numeric(18,8) not null default 1,
  add column if not exists purchase_price_reporting numeric(14,2) not null default 0,
  add column if not exists sale_exchange_rate numeric(18,8) not null default 1,
  add column if not exists sale_price_reporting numeric(14,2) not null default 0,
  add column if not exists stock_minimum integer not null default 0,
  add column if not exists supplier_contact_id uuid references public.business_contacts(id) on delete set null,
  add column if not exists track_stock boolean not null default true;

alter table public.business_transactions
  add column if not exists transaction_kind text not null default 'other',
  add column if not exists contact_id uuid references public.business_contacts(id) on delete set null,
  add column if not exists original_amount numeric(14,2),
  add column if not exists original_currency text,
  add column if not exists exchange_rate numeric(18,8),
  add column if not exists converted_amount numeric(14,2),
  add column if not exists reporting_currency text,
  add column if not exists exchange_rate_date date,
  add column if not exists discount numeric(14,2) not null default 0,
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists amount_paid numeric(14,2) not null default 0,
  add column if not exists status text not null default 'active',
  add column if not exists created_at timestamptz not null default now();

-- Populate compatible snapshots for historical transactions and articles.
update public.business_items
set purchase_price_reporting = purchase_price,
    sale_price_reporting = sale_price
where purchase_price_reporting = 0 and sale_price_reporting = 0;

update public.business_transactions
set original_amount = amount,
    original_currency = 'EUR',
    exchange_rate = 1,
    converted_amount = amount,
    reporting_currency = 'EUR',
    exchange_rate_date = date,
    transaction_kind = case when type = 'revenu' then 'sale' else 'expense' end
where original_amount is null;

create table if not exists public.business_transaction_lines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.budgy_users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  transaction_id uuid not null references public.business_transactions(id) on delete cascade,
  item_id uuid references public.business_items(id) on delete set null,
  description text not null,
  quantity numeric(14,3) not null default 1 check (quantity > 0),
  unit_price_original numeric(14,2) not null default 0 check (unit_price_original >= 0),
  original_currency text not null default 'EUR',
  exchange_rate numeric(18,8) not null default 1 check (exchange_rate > 0),
  unit_price_reporting numeric(14,2) not null default 0 check (unit_price_reporting >= 0),
  line_total_reporting numeric(14,2) not null default 0 check (line_total_reporting >= 0),
  stock_effect smallint not null default 0 check (stock_effect in (-1, 0, 1)),
  created_at timestamptz not null default now()
);

alter table public.business_transaction_lines
  add column if not exists unit_cost_reporting numeric(14,2) not null default 0 check (unit_cost_reporting >= 0);

create table if not exists public.business_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.budgy_users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  transaction_id uuid not null references public.business_transactions(id) on delete cascade,
  amount_original numeric(14,2) not null check (amount_original > 0),
  currency text not null default 'EUR',
  exchange_rate numeric(18,8) not null default 1 check (exchange_rate > 0),
  amount_reporting numeric(14,2) not null check (amount_reporting > 0),
  reporting_currency text not null default 'EUR',
  date date not null default current_date,
  method text not null default 'other',
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.business_stock_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.budgy_users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  item_id uuid not null references public.business_items(id) on delete cascade,
  transaction_id uuid references public.business_transactions(id) on delete set null,
  date timestamptz not null default now(),
  quantity_before numeric(14,3) not null,
  variation numeric(14,3) not null,
  quantity_after numeric(14,3) not null,
  movement_type text not null,
  reason text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists business_items_low_stock_idx on public.business_items(business_id, quantity, stock_minimum) where is_active and track_stock;
create index if not exists business_transaction_lines_transaction_idx on public.business_transaction_lines(transaction_id);
create index if not exists business_transaction_lines_item_idx on public.business_transaction_lines(item_id) where item_id is not null;
create index if not exists business_payments_transaction_date_idx on public.business_payments(transaction_id, date desc);
create index if not exists business_stock_movements_item_date_idx on public.business_stock_movements(item_id, date desc);

alter table public.business_transaction_lines enable row level security;
alter table public.business_payments enable row level security;
alter table public.business_stock_movements enable row level security;

revoke all on table public.business_transaction_lines, public.business_payments, public.business_stock_movements from public, authenticated;
grant select on table public.business_transaction_lines, public.business_payments, public.business_stock_movements to authenticated;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='business_transaction_lines' and policyname='business_transaction_lines_select_own') then
    create policy business_transaction_lines_select_own on public.business_transaction_lines
    for select to authenticated using (user_id = (select public.current_budgy_user_id()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='business_payments' and policyname='business_payments_select_own') then
    create policy business_payments_select_own on public.business_payments
    for select to authenticated using (user_id = (select public.current_budgy_user_id()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='business_stock_movements' and policyname='business_stock_movements_select_own') then
    create policy business_stock_movements_select_own on public.business_stock_movements
    for select to authenticated using (user_id = (select public.current_budgy_user_id()));
  end if;
end $$;

create or replace function public.save_business_transaction(
  p_transaction_id uuid,
  p_business_id uuid,
  p_title text,
  p_kind text,
  p_date date,
  p_contact_id uuid,
  p_discount numeric,
  p_note text,
  p_original_amount numeric,
  p_original_currency text,
  p_exchange_rate numeric,
  p_reporting_currency text,
  p_lines jsonb default '[]'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := public.current_budgy_user_id();
  v_transaction uuid;
  v_line jsonb;
  v_item public.business_items%rowtype;
  v_old record;
  v_quantity numeric;
  v_effect smallint;
  v_before numeric;
  v_after numeric;
  v_total numeric;
  v_rate numeric := greatest(coalesce(p_exchange_rate, 1), 0.00000001);
begin
  if v_actor is null or not exists (
    select 1 from public.businesses where id = p_business_id and user_id = v_actor
  ) then raise exception 'Business inaccessible'; end if;
  if p_kind not in ('sale','purchase','expense','refund','adjustment','other') then
    raise exception 'Type de transaction invalide';
  end if;
  if p_contact_id is not null and not exists (
    select 1 from public.business_contacts where id=p_contact_id and business_id=p_business_id and user_id=v_actor
  ) then raise exception 'Contact inaccessible'; end if;
  if jsonb_typeof(coalesce(p_lines,'[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_lines,'[]'::jsonb)) = 0 then
    raise exception 'Une transaction doit contenir au moins une ligne';
  end if;
  select round(greatest(coalesce(sum(
    greatest(coalesce((value->>'quantity')::numeric,1),0.001)
    * greatest(coalesce((value->>'unit_price')::numeric,0),0)
    * greatest(coalesce((value->>'exchange_rate')::numeric,v_rate),0.00000001)
  ),0)-greatest(coalesce(p_discount,0),0),0),2)
  into v_total from jsonb_array_elements(p_lines);

  if p_transaction_id is not null then
    select id into v_transaction from public.business_transactions
    where id = p_transaction_id and business_id = p_business_id and user_id = v_actor and status = 'active'
    for update;
    if v_transaction is null then raise exception 'Transaction inaccessible'; end if;

    for v_old in
      select l.*, i.track_stock from public.business_transaction_lines l
      left join public.business_items i on i.id = l.item_id
      where l.transaction_id = v_transaction for update of l
    loop
      if v_old.item_id is not null and coalesce(v_old.track_stock, false) and v_old.stock_effect <> 0 then
        select * into v_item from public.business_items where id = v_old.item_id and user_id = v_actor for update;
        v_before := v_item.quantity;
        v_after := v_before - (v_old.quantity * v_old.stock_effect);
        update public.business_items set quantity = v_after where id = v_item.id;
        insert into public.business_stock_movements(user_id,business_id,item_id,transaction_id,quantity_before,variation,quantity_after,movement_type,reason)
        values(v_actor,p_business_id,v_item.id,v_transaction,v_before,-(v_old.quantity*v_old.stock_effect),v_after,'adjustment','Annulation de la version précédente');
      end if;
    end loop;
    delete from public.business_transaction_lines where transaction_id = v_transaction;
  else
    v_transaction := gen_random_uuid();
  end if;

  insert into public.business_transactions(
    id,user_id,business_id,title,type,amount,category,date,note,transaction_kind,contact_id,
    original_amount,original_currency,exchange_rate,converted_amount,reporting_currency,
    exchange_rate_date,discount,payment_status,amount_paid,status
  ) values (
    v_transaction,v_actor,p_business_id,trim(p_title),
    case when p_kind = 'sale' then 'revenu' else 'depense' end,
    round(v_total*v_rate,2),case when p_kind = 'sale' then 'Vente' when p_kind = 'purchase' then 'Achat' else 'Autre' end,
    p_date,coalesce(p_note,''),p_kind,p_contact_id,v_total,p_original_currency,v_rate,
    round(v_total*v_rate,2),p_reporting_currency,p_date,greatest(coalesce(p_discount,0),0),'unpaid',0,'active'
  ) on conflict (id) do update set
    title=excluded.title,type=excluded.type,amount=excluded.amount,category=excluded.category,date=excluded.date,
    note=excluded.note,transaction_kind=excluded.transaction_kind,contact_id=excluded.contact_id,
    original_amount=excluded.original_amount,original_currency=excluded.original_currency,
    exchange_rate=excluded.exchange_rate,converted_amount=excluded.converted_amount,
    reporting_currency=excluded.reporting_currency,exchange_rate_date=excluded.exchange_rate_date,
    discount=excluded.discount,status='active';

  if exists (
    select 1 from public.business_transactions
    where id=v_transaction and amount_paid>converted_amount+0.01
  ) then
    raise exception 'Le nouveau total est inférieur aux paiements déjà enregistrés';
  end if;
  update public.business_transactions
  set payment_status=case
    when amount_paid<=0 then 'unpaid'
    when amount_paid>=converted_amount-0.01 then 'paid'
    else 'partial'
  end
  where id=v_transaction;

  for v_line in select value from jsonb_array_elements(coalesce(p_lines,'[]'::jsonb))
  loop
    v_quantity := greatest(coalesce((v_line->>'quantity')::numeric,1),0.001);
    v_effect := case when p_kind = 'sale' then -1 when p_kind = 'purchase' then 1 else 0 end;
    if nullif(v_line->>'item_id','') is not null then
      select * into v_item from public.business_items
      where id=(v_line->>'item_id')::uuid and business_id=p_business_id and user_id=v_actor for update;
      if v_item.id is null then raise exception 'Article inaccessible'; end if;
      if not v_item.track_stock then v_effect := 0; end if;
      if v_effect <> 0 then
        v_before := v_item.quantity;
        v_after := v_before + v_quantity*v_effect;
        if v_after < 0 then raise exception 'Stock insuffisant pour %', v_item.title; end if;
        update public.business_items set quantity=v_after where id=v_item.id;
        insert into public.business_stock_movements(user_id,business_id,item_id,transaction_id,date,quantity_before,variation,quantity_after,movement_type,reason)
        values(v_actor,p_business_id,v_item.id,v_transaction,p_date,v_before,v_quantity*v_effect,v_after,
          case when p_kind='sale' then 'sale' else 'purchase' end,trim(p_title));
      end if;
    else v_item := null; end if;

    insert into public.business_transaction_lines(
      user_id,business_id,transaction_id,item_id,description,quantity,unit_price_original,original_currency,
      exchange_rate,unit_price_reporting,unit_cost_reporting,line_total_reporting,stock_effect
    ) values (
      v_actor,p_business_id,v_transaction,nullif(v_line->>'item_id','')::uuid,
      coalesce(nullif(trim(v_line->>'description'),''),v_item.title,trim(p_title)),v_quantity,
      coalesce((v_line->>'unit_price')::numeric,0),coalesce(v_line->>'currency',p_original_currency),
      greatest(coalesce((v_line->>'exchange_rate')::numeric,v_rate),0.00000001),
      round(coalesce((v_line->>'unit_price')::numeric,0)*greatest(coalesce((v_line->>'exchange_rate')::numeric,v_rate),0.00000001),2),
      coalesce(v_item.purchase_price_reporting,0),
      round(v_quantity*coalesce((v_line->>'unit_price')::numeric,0)*greatest(coalesce((v_line->>'exchange_rate')::numeric,v_rate),0.00000001),2),v_effect
    );
  end loop;
  return v_transaction;
end;
$$;

create or replace function public.cancel_business_transaction(p_transaction_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_actor uuid:=public.current_budgy_user_id(); v_old record; v_item public.business_items%rowtype; v_before numeric; v_after numeric;
begin
  if not exists(select 1 from public.business_transactions where id=p_transaction_id and user_id=v_actor and status='active' for update)
  then raise exception 'Transaction inaccessible'; end if;
  for v_old in select l.*,i.track_stock from public.business_transaction_lines l left join public.business_items i on i.id=l.item_id where l.transaction_id=p_transaction_id for update of l
  loop
    if v_old.item_id is not null and coalesce(v_old.track_stock,false) and v_old.stock_effect<>0 then
      select * into v_item from public.business_items where id=v_old.item_id and user_id=v_actor for update;
      v_before:=v_item.quantity; v_after:=v_before-(v_old.quantity*v_old.stock_effect);
      update public.business_items set quantity=v_after where id=v_item.id;
      insert into public.business_stock_movements(user_id,business_id,item_id,transaction_id,quantity_before,variation,quantity_after,movement_type,reason)
      values(v_actor,v_old.business_id,v_item.id,p_transaction_id,v_before,-(v_old.quantity*v_old.stock_effect),v_after,'cancellation','Transaction annulée');
    end if;
  end loop;
  update public.business_transactions set status='cancelled' where id=p_transaction_id;
end; $$;

create or replace function public.record_business_payment(
  p_transaction_id uuid,p_amount numeric,p_currency text,p_exchange_rate numeric,p_date date,p_method text,p_note text default ''
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_actor uuid:=public.current_budgy_user_id(); v_tx public.business_transactions%rowtype; v_id uuid:=gen_random_uuid(); v_converted numeric; v_paid numeric;
begin
  select * into v_tx from public.business_transactions where id=p_transaction_id and user_id=v_actor and status='active' for update;
  if v_tx.id is null then raise exception 'Transaction inaccessible'; end if;
  if p_amount<=0 or p_exchange_rate<=0 then raise exception 'Paiement invalide'; end if;
  v_converted:=round(p_amount*p_exchange_rate,2);
  if v_tx.amount_paid+v_converted>coalesce(v_tx.converted_amount,v_tx.amount)+0.01 then raise exception 'Le paiement dépasse le reste à payer'; end if;
  insert into public.business_payments(id,user_id,business_id,transaction_id,amount_original,currency,exchange_rate,amount_reporting,reporting_currency,date,method,note)
  values(v_id,v_actor,v_tx.business_id,v_tx.id,p_amount,p_currency,p_exchange_rate,v_converted,coalesce(v_tx.reporting_currency,'EUR'),p_date,p_method,coalesce(p_note,''));
  v_paid:=v_tx.amount_paid+v_converted;
  update public.business_transactions set amount_paid=v_paid,payment_status=case when v_paid>=coalesce(converted_amount,amount)-0.01 then 'paid' else 'partial' end where id=v_tx.id;
  return v_id;
end; $$;

create or replace function public.adjust_business_stock(
  p_item_id uuid,p_new_quantity numeric,p_movement_type text,p_reason text
) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_actor uuid:=public.current_budgy_user_id(); v_item public.business_items%rowtype;
begin
  select * into v_item from public.business_items where id=p_item_id and user_id=v_actor for update;
  if v_item.id is null then raise exception 'Article inaccessible'; end if;
  if not v_item.track_stock then raise exception 'Le stock ne s’applique pas à ce service'; end if;
  if p_new_quantity<0 then raise exception 'Le stock ne peut pas être négatif'; end if;
  if p_new_quantity=v_item.quantity then return; end if;
  update public.business_items set quantity=p_new_quantity where id=v_item.id;
  insert into public.business_stock_movements(
    user_id,business_id,item_id,quantity_before,variation,quantity_after,movement_type,reason
  ) values (
    v_actor,v_item.business_id,v_item.id,v_item.quantity,p_new_quantity-v_item.quantity,p_new_quantity,
    coalesce(nullif(trim(p_movement_type),''),'correction'),coalesce(nullif(trim(p_reason),''),'Correction inventaire')
  );
end; $$;

revoke all on function public.save_business_transaction(uuid,uuid,text,text,date,uuid,numeric,text,numeric,text,numeric,text,jsonb) from public;
revoke all on function public.cancel_business_transaction(uuid) from public;
revoke all on function public.record_business_payment(uuid,numeric,text,numeric,date,text,text) from public;
revoke all on function public.adjust_business_stock(uuid,numeric,text,text) from public;
grant execute on function public.save_business_transaction(uuid,uuid,text,text,date,uuid,numeric,text,numeric,text,numeric,text,jsonb) to authenticated;
grant execute on function public.cancel_business_transaction(uuid) to authenticated;
grant execute on function public.record_business_payment(uuid,numeric,text,numeric,date,text,text) to authenticated;
grant execute on function public.adjust_business_stock(uuid,numeric,text,text) to authenticated;
