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

const entry = async (userId, item) => {
  const found = await client.query(`select id from budget_entries where user_id=$1 and trim(lower(title))=trim(lower($2)) and date_trunc('month',date)=date_trunc('month',$3::date) order by (title=$2) desc,id limit 1`, [userId,item.title,item.date]);
  const values=[item.title,item.amount,item.type,item.category,item.bucket,item.scope??"Personnel",item.date,item.note??"",item.potentialAmount??item.amount,item.status,item.account??"LCL",item.paymentStatus,item.affectsProjection,item.beforeSnapshot??false,item.archived??false,item.exceptional??false,item.excludeAverage??false,item.context??null,item.businessProject??null,item.recurringKey??null];
  if(found.rows[0]) await client.query(`update budget_entries set title=$2,amount=$3,type=$4,category=$5,bucket=$6,scope=$7,date=$8,note=$9,potential_amount=$10,status=$11,account_name=$12,payment_status=$13,affects_projection=$14,is_before_snapshot=$15,is_archived=$16,is_exceptional=$17,exclude_from_average=$18,context=$19,business_project=$20,recurring_key=$21 where id=$1`,[found.rows[0].id,...values]);
  else await client.query(`insert into budget_entries(user_id,title,amount,type,category,bucket,scope,date,note,potential_amount,status,account_name,payment_status,affects_projection,is_before_snapshot,is_archived,is_exceptional,exclude_from_average,context,business_project,recurring_key) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,[userId,...values]);
};
const planned = (title,amount,date,type="depense",extra={}) => ({title,amount,date,type,category:extra.category??(type==="revenu"?"Revenus":"Charges fixes"),bucket:extra.bucket??(type==="revenu"?"Rentrées":"Charges fixes"),status:"non",paymentStatus:"planned",affectsProjection:true,...extra});

try {
  await client.query("begin");
  const profile = await client.query("select user_id as id,username from profiles where lower(username)=lower('Jnor7')");
  if (profile.rowCount !== 1) throw new Error(`Profil Jnor7 introuvable ou ambigu (${profile.rowCount}).`);
  const userId=profile.rows[0].id;
  const accounts=[["LCL","BANK",8671.71,true,"Solde vérifié au 13 novembre 2026"],["Revolut","BANK",46.03,true,"Solde vérifié au 13 novembre 2026"],["Swile","MEAL_VOUCHER",0,false,"Crédit repas séparé : environ 150 € par mois, solde à renseigner"]];
  for(const [name,type,balance,include,note] of accounts) await client.query(`insert into finance_accounts(user_id,name,account_type,balance,snapshot_date,include_in_cash,note) values($1,$2,$3,$4,'2026-11-13',$5,$6) on conflict(user_id,name) do update set account_type=excluded.account_type,balance=excluded.balance,snapshot_date=excluded.snapshot_date,include_in_cash=excluded.include_in_cash,note=excluded.note,updated_at=now()`,[userId,name,type,balance,include,note]);

  const received=(title,amount,type,category,bucket,date="2026-11-01",note="")=>({title,amount,type,category,bucket,date,note,status:"recu",paymentStatus:type==="revenu"?"received":"paid",affectsProjection:false,beforeSnapshot:true});
  const november=[
    received("Paye de l'alternance",2452.29,"revenu","Salaire","Rentrées","2026-11-01","Arrivée fin octobre, affectée à novembre."),
    received("CAF",452.01,"revenu","Aides","Rentrées","2026-11-05"),received("BABA",40,"revenu","Divers","Rentrées","2026-11-03"),
    received("Internet",38.98,"depense","Abonnements","Abonnements","2026-11-05"),received("phone",16.98,"depense","Abonnements","Abonnements","2026-11-05"),
    received("Basic Fit",22.99,"depense","Abonnements","Abonnements","2026-11-10"),received("Apple Music",5.99,"depense","Abonnements","Abonnements","2026-11-10"),
    received("Metal",18.99,"depense","Abonnements","Abonnements","2026-11-05"),received("Polo 5 assurance",55.90,"depense","Transport","Charges fixes","2026-11-10"),
    received("Assurance Clio",54.87,"depense","Transport","Charges fixes","2026-11-08"),received("ChatGPT",21.57,"depense","Abonnements","Abonnements","2026-11-06"),
    received("Meshy AI",13.68,"depense","Abonnements","Abonnements","2026-11-11","À résilier."),
    planned("Loyer Mennecy",1320,"2026-11-14","depense",{category:"Logement",bucket:"Charges fixes"}),planned("Dernier remboursement LCL",500,"2026-11-22"),
    planned("Frais carte",2,"2026-11-27"),planned("Assurance moyens de paiement",2.25,"2026-11-20"),planned("Destin coloc",450,"2026-11-30","revenu",{category:"Loyer",bucket:"Rentrées",note:"Arriérés : 0 € reçu au snapshot."}),
    planned("Claude",21.60,"2026-11-26", "depense",{category:"Abonnements",bucket:"Abonnements"}),planned("Google One",10.99,"2026-11-28","depense",{category:"Abonnements",bucket:"Abonnements"})
  ];
  for(const item of november) await entry(userId,item);
  await client.query(`update budget_entries set is_archived=true,payment_status='cancelled',affects_projection=false,note=concat_ws(' · ',nullif(note,''),'Archivé lors de la réconciliation du 13/11/2026') where user_id=$1 and date between '2026-11-01' and '2026-11-30' and (
    trim(lower(title)) in ('loyer jr','maman','électricité','tontine chloé','revolut','téléphone','chat gpt','clio 2 assurance','prêt flexible lcl','claude code','courses','essence polo 5 part 1','yvann')
    or (title like 'Paye de%alternance' and amount=1500)
    or (trim(lower(title))='caf' and amount=450)
    or (trim(lower(title))='internet' and amount=40)
    or (trim(lower(title))='polo 5 assurance' and title<>trim(title))
    or (trim(lower(title))='loyer mennecy' and amount=660)
    or (trim(lower(title))='destin coloc' and title<>trim(title))
  )`,[userId]);

  const recurring=[["CAF",450,"revenu","Aides","Rentrées"],["BABA",40,"revenu","Divers","Rentrées"],["Destin coloc",350,"revenu","Loyer","Rentrées"],["Arriérés Destin",450,"revenu","Loyer","Rentrées"],["Tontine reçue maman",107,"revenu","Tontine","Rentrées"],["Loyer Mennecy",660,"depense","Logement","Charges fixes"],["Tontine maman",450,"depense","Tontine","Charges fixes"],["Polo 5 assurance",55.90,"depense","Transport","Charges fixes"],["Assurance Clio",54.87,"depense","Transport","Charges fixes"],["Basic Fit",22.99,"depense","Abonnements","Abonnements"],["Internet",38.98,"depense","Abonnements","Abonnements"],["phone",16.98,"depense","Abonnements","Abonnements"],["Metal",18.99,"depense","Abonnements","Abonnements"],["ChatGPT",21.57,"depense","Abonnements","Abonnements"],["Claude",21.60,"depense","Abonnements","Abonnements"],["Google One",10.99,"depense","Abonnements","Abonnements"],["Apple Music",5.99,"depense","Abonnements","Abonnements"],["Frais carte",2,"depense","Banque","Charges fixes"],["Assurance moyens de paiement",2.25,"depense","Banque","Charges fixes"]];
  for(const month of ["2026-12","2027-01"]) for(const [title,amount,type,category,bucket] of recurring) await entry(userId,planned(title,amount,`${month}-${title.includes("Loyer")?"05":"15"}`,type,{category,bucket,recurringKey:title.toLowerCase().replaceAll(" ","-")}));

  for(const month of ["2026-11-01","2026-12-01","2027-01-01"]) for(const [name,target] of [["Courses",120],["Restaurants",130],["Essence",120],["Sorties",80],["Shopping",100],["Divers",70]]) await client.query(`insert into budget_envelopes(user_id,month,name,category,target_amount,note) values($1,$2,$3,$3,$4,'Plafond mensuel conseillé') on conflict(user_id,month,name) do update set target_amount=excluded.target_amount,category=excluded.category,note=excluded.note,updated_at=now()`,[userId,month,name,target]);
  const projects=[["Voyage Chine 2026","TRAVEL","COMPLETED","2026-10-29","2026-11-08",null,"Exclu des moyennes mensuelles."],["Zhongda","BUSINESS","PLANNED",null,null,5850,"Montant prévu 5 850 USD ; acompte 2 925 USD non payé."],["Get Your Wig","BUSINESS","PLANNED",null,null,null,"Montant encore inconnu."]];
  for(const [name,kind,status,start,end,amount,note] of projects) await client.query(`insert into finance_projects(user_id,name,kind,status,start_date,end_date,exclude_from_average,planned_amount,note) values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict(user_id,name) do update set kind=excluded.kind,status=excluded.status,start_date=excluded.start_date,end_date=excluded.end_date,exclude_from_average=excluded.exclude_from_average,planned_amount=excluded.planned_amount,note=excluded.note,updated_at=now()`,[userId,name,kind,status,start,end,kind==="TRAVEL",amount,note]);
  await client.query(`update budget_entries set is_exceptional=true,exclude_from_average=true,context='TRAVEL_CHINA_2026' where user_id=$1 and type='depense' and date between '2026-10-29' and '2026-11-08'`,[userId]);
  const provisions=[["Noël 2026",1000,"2026-12-20",false,"Budget cadeaux"],["Révision voiture décembre",150,"2026-12-20",true,"Date flexible"],["Révision voiture janvier",150,"2027-01-20",true,"Date flexible"]];
  for(const [name,amount,date,flexible,note] of provisions) await client.query(`insert into finance_provisions(user_id,name,amount,target_date,flexible,note) values($1,$2,$3,$4,$5,$6) on conflict(user_id,name,target_date) do update set amount=excluded.amount,flexible=excluded.flexible,note=excluded.note,updated_at=now()`,[userId,name,amount,date,flexible,note]);
  const christmas=(await client.query(`select id from finance_provisions where user_id=$1 and name='Noël 2026'`,[userId])).rows[0].id;
  for(const name of ["Maman","Chloé","Petite sœur","Papa","Autres"]) await client.query(`insert into finance_sub_expenses(user_id,provision_id,name,beneficiary,planned_amount) select $1,$2,'Cadeau',$3,0 where not exists(select 1 from finance_sub_expenses where user_id=$1 and provision_id=$2 and beneficiary=$3)`,[userId,christmas,name]);
  await client.query(`insert into finance_debts(user_id,name,principal,monthly_payment,remaining_months,creditor,starts_on,note) values($1,'Prêt familial maman',5000,118,54,'Maman','2026-11-09','Dette, pas un revenu. Échéance intégrée à la tontine : pas de double débit bancaire.') on conflict(user_id,name) do update set principal=excluded.principal,monthly_payment=excluded.monthly_payment,remaining_months=excluded.remaining_months,creditor=excluded.creditor,starts_on=excluded.starts_on,note=excluded.note,updated_at=now()`,[userId]);

  const subscriptions=[["Apple Music",5.99,"ACTIVE","EUR","2026-12-10"],["Basic Fit",22.99,"ACTIVE","EUR","2026-12-10"],["ChatGPT",21.57,"ACTIVE","USD","2026-12-06"],["Google One",10.99,"ACTIVE","EUR","2026-12-28"],["Internet",38.98,"ACTIVE","EUR","2026-12-05"],["Metal",18.99,"ACTIVE","EUR","2026-12-05"],["phone",16.98,"ACTIVE","EUR","2026-12-05"],["Claude",21.60,"TO_CHECK","EUR","2026-11-26"],["Meshy AI",13.68,"TO_CANCEL","EUR","2026-12-11"],["ElevenLabs",0,"TO_CHECK","USD",null],["Anthropic API",0,"API_CREDIT","USD",null],["Apple / iCloud",0,"TO_CHECK","EUR",null],["IONOS",0,"TO_CHECK","EUR",null]];
  for(const [title,amount,lifecycle,currency,next] of subscriptions){const existing=await client.query(`select id from subscriptions where user_id=$1 and lower(title)=lower($2) limit 1`,[userId,title]);if(existing.rows[0])await client.query(`update subscriptions set amount=$2,currency=$3,lifecycle_status=$4,next_expected_payment=$5,is_active=$6,note=concat_ws(' · ',nullif(note,''),'Réconcilié le 13/11/2026') where id=$1`,[existing.rows[0].id,amount,currency,lifecycle,next,lifecycle!=="CANCELLED"]);else await client.query(`insert into subscriptions(user_id,title,amount,due_day,category,system_image,color_hex,scope,is_active,note,currency,lifecycle_status,next_expected_payment) values($1,$2,$3,1,'Service','', '#7c5ce7','Personnel',$4,'Réconcilié le 13/11/2026',$5,$6,$7)`,[userId,title,amount,lifecycle!=="CANCELLED",currency,lifecycle,next]);}
  const check=await client.query(`select (select coalesce(sum(balance),0) from finance_accounts where user_id=$1 and include_in_cash) real_cash,(select count(*) from budget_envelopes where user_id=$1) envelopes,(select count(*) from finance_provisions where user_id=$1) provisions`,[userId]);
  if(Number(check.rows[0].real_cash)!==8717.74) throw new Error(`Snapshot incorrect: ${check.rows[0].real_cash}`);
  await client.query("set local role budgy_finance_server");
  await client.query("select set_config('budgy.finance_user_id',$1,true)",[userId]);
  const scoped=await client.query("select (select count(*) from finance_accounts) accounts,(select count(*) from budget_entries) entries");
  if(Number(scoped.rows[0].accounts)!==3||Number(scoped.rows[0].entries)===0) throw new Error("Le périmètre RLS Finance est invalide.");
  await client.query(apply?"commit":"rollback");
  console.log(apply?"FINANCE_RECONCILIATION_APPLIED OK":"FINANCE_RECONCILIATION_VALIDATION OK (transaction rolled back)",{...check.rows[0],scoped:scoped.rows[0]});
} catch(error){await client.query("rollback").catch(()=>undefined);throw error;} finally {await client.end();}
