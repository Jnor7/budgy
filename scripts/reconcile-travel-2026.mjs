import { readFileSync } from "node:fs";
import pg from "pg";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
}
const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL_UNPOOLED ou DATABASE_URL manque.");
const apply = process.argv.includes("--apply");
const client = new pg.Client({ connectionString });
await client.connect();

try {
  await client.query("begin");
  const profile = await client.query("select user_id from profiles where lower(username)=lower('Jnor7')");
  if (profile.rowCount !== 1) throw new Error(`Profil Jnor7 introuvable ou ambigu (${profile.rowCount}).`);
  const userId = profile.rows[0].user_id;

  // Source primaire : export Budget JR importé, mouvement réalisé intitulé
  // "Voyage Miami". Aucune autre date ou ventilation n'est extrapolée.
  const miamiTrace = (await client.query(
    `select id,amount,currency,date,status from dubai_cash_movements
     where user_id=$1 and legacy_id='dubai_cash_movement_000001'
       and lower(trim(title))='voyage miami' and status='done'`, [userId],
  )).rows[0];
  if (!miamiTrace || Number(miamiTrace.amount) !== 800 || miamiTrace.currency !== "EUR") {
    throw new Error("La trace Budget JR Miami attendue (800 EUR réalisés) est absente ou ambiguë.");
  }

  const archived = await client.query(
    `update trips set is_completed=true,
       notes=case when notes like '[ARCHIVED]%' then notes else concat('[ARCHIVED] Voyage de démonstration masqué · ',coalesce(notes,'')) end
     where user_id=$1 and (
       lower(trim(title)) = any($2::text[])
       or (lower(trim(title))='test' and lower(trim(destination_summary))='tokyo')
     ) returning id,title`,
    [userId, ["vacances benin", "gabon", "voyage malaisie", "rome", "congo", "dakar", "tokyo"]],
  );

  const road = await client.query(
    `update trips set title='Turquie & Crète — road trip',destination_summary='Istanbul · Crète',
       country_name='Turquie & Grèce',country_code='TR',is_completed=true,
       notes='[TOTAL_PARTIEL] 1 127 € connus : vols et logements enregistrés.'
     where user_id=$1 and lower(trim(title)) in ('road trip mai ✈️','turquie & crète — road trip') returning id`, [userId],
  );
  const marrakech = await client.query(
    `update trips set title='Marrakech Trip',destination_summary='Marrakech',country_name='Maroc',country_code='MA',is_completed=true,
       notes='[DONNEES_PARTIELLES] Dates et budget cible historiques ; dépenses détaillées indisponibles.'
     where user_id=$1 and lower(trim(title))='marrakech trip' returning id`, [userId],
  );
  const china = await client.query(
    `update trips set title='Business Chine 2026',destination_summary='Chine · Hong Kong',country_name='Chine',country_code='CN',
       start_date='2026-10-29T12:00:00.000Z',end_date='2026-11-08T12:00:00.000Z',target_budget=1000,is_completed=true,
       notes='[TOTAL_ESTIME] 1 000 € · Estimation historique, aucune ventilation fiable disponible. · Business'
     where user_id=$1 and lower(trim(title)) in ('business chine','business chine 2026') returning id`, [userId],
  );
  const miami = await client.query(
    `insert into trips(user_id,legacy_id,title,destination_summary,start_date,end_date,people_count,target_budget,notes,is_completed,country_name,country_code)
     values($1,'reconstructed_miami_2026','Miami 2026','Miami','2026-01-11','2026-01-11',1,$2,
       '[TOTAL_PARTIEL] 800 € connus · Trace Budget JR « Voyage Miami » réalisée le 11/01/2026. Dates de séjour et ventilation à compléter.',true,'États-Unis','US')
     on conflict(user_id,legacy_id) where legacy_id is not null do update set
       title=excluded.title,destination_summary=excluded.destination_summary,start_date=excluded.start_date,end_date=excluded.end_date,
       target_budget=excluded.target_budget,notes=excluded.notes,is_completed=true,country_name=excluded.country_name,country_code=excluded.country_code
     returning id`, [userId, Number(miamiTrace.amount)],
  );
  await client.query(
    `insert into trip_expenses(user_id,legacy_id,trip_id,paid_by,title,amount,currency,date,category,note)
     values($1,'reconstructed_miami_trace_2026',$2,$1,'Trace bancaire — Voyage Miami',$3,$4,'2026-01-11','Voyage',
       'Import Budget JR : mouvement réalisé dubai_cash_movement_000001. Aucune ventilation disponible.')
     on conflict(user_id,legacy_id) where legacy_id is not null do update set
       trip_id=excluded.trip_id,paid_by=excluded.paid_by,title=excluded.title,amount=excluded.amount,currency=excluded.currency,
       date=excluded.date,category=excluded.category,note=excluded.note`,
    [userId, miami.rows[0].id, Number(miamiTrace.amount), miamiTrace.currency],
  );

  if (archived.rowCount < 8) throw new Error(`Nettoyage incomplet : ${archived.rowCount}/8 voyages fictifs trouvés.`);
  if (road.rowCount !== 1 || marrakech.rowCount !== 1 || china.rowCount !== 1 || miami.rowCount !== 1) throw new Error("Un voyage historique fiable est introuvable.");
  const roadTotal = await client.query(
    `select coalesce((select sum(price) from flights where trip_id=$1),0)+coalesce((select sum(price) from accommodations where trip_id=$1),0)+coalesce((select sum(price) from trip_activities where trip_id=$1),0) total`,
    [road.rows[0].id],
  );
  if (Number(roadTotal.rows[0].total) !== 1127) throw new Error(`Total partiel road trip inattendu : ${roadTotal.rows[0].total}`);

  await client.query(apply ? "commit" : "rollback");
  console.log(apply ? "TRAVEL_RECONCILIATION_APPLIED OK" : "TRAVEL_RECONCILIATION_VALIDATION OK (transaction rolled back)", {
    archived: archived.rows.map((row) => row.title), roadTripKnownTotal: Number(roadTotal.rows[0].total),
    preserved: ["Miami 2026 — 800 EUR connus", "Marrakech Trip", "Business Chine 2026"], missingReliableTraces: ["Suisse"],
  });
} catch (error) {
  await client.query("rollback").catch(() => undefined);
  throw error;
} finally { await client.end(); }
