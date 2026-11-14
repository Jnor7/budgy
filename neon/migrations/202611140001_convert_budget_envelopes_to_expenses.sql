begin;

-- Les anciennes enveloppes deviennent des dépenses variables ordinaires.
-- La table source reste volontairement en place comme archive de migration et
-- point de retour ; le runtime Budgy ne la consulte plus.
with envelope_source as (
  select
    e.user_id,
    e.month,
    case
      when e.name = 'Restaurants' then 'Restaurants / fast-food'
      when e.name = 'Divers' then 'Divers / plaisir'
      else e.name
    end as title,
    e.target_amount
  from public.budget_envelopes e
), matched as (
  select
    source.*,
    (
      select entry.id
      from public.budget_entries entry
      where entry.user_id = source.user_id
        and entry.type = 'depense'
        and not entry.is_archived
        and entry.status <> 'recu'
        and entry.date >= source.month
        and entry.date < source.month + interval '1 month'
        and lower(trim(entry.title)) in (
          lower(trim(source.title)),
          case
            when source.title = 'Restaurants / fast-food' then 'restaurants'
            when source.title = 'Divers / plaisir' then 'divers'
            else lower(trim(source.title))
          end
        )
      order by entry.date, entry.id
      limit 1
    ) as entry_id
  from envelope_source source
), updated as (
  update public.budget_entries entry
  set
    title = matched.title,
    category = matched.title,
    bucket = 'Variable',
    potential_amount = greatest(entry.potential_amount, matched.target_amount),
    affects_projection = true,
    is_variable_estimate = true
  from matched
  where entry.id = matched.entry_id
  returning entry.id
)
insert into public.budget_entries (
  user_id,
  title,
  amount,
  potential_amount,
  type,
  category,
  bucket,
  scope,
  date,
  note,
  status,
  payment_status,
  affects_projection,
  is_variable_estimate,
  currency
)
select
  matched.user_id,
  matched.title,
  matched.target_amount,
  matched.target_amount,
  'depense',
  matched.title,
  'Variable',
  'Perso',
  matched.month,
  'Budget mensuel converti depuis un ancien objectif',
  'non',
  'planned',
  true,
  true,
  'EUR'
from matched
where matched.entry_id is null;

commit;
