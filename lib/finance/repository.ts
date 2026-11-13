import "server-only";
import { Pool,type PoolClient } from "pg";
import { envelopeProgress,treasuryHierarchy } from "./calculations";
import type { FinanceOverview } from "./models";

let pool:Pool|undefined;
const number=(value:unknown)=>Number(value??0);
const isoDate=(value:unknown)=>value instanceof Date?value.toISOString().slice(0,10):String(value??"").slice(0,10);
const camel=(row:Record<string,unknown>)=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key.replace(/_([a-z])/g,(_,letter:string)=>letter.toUpperCase()),value]));

export class FinanceRepository{
  constructor(readonly userId:string,private readonly testPool?:Pool){}
  private async transaction<T>(run:(db:PoolClient)=>Promise<T>){
    const connectionString=process.env.DATABASE_URL;
    if(!this.testPool&&!connectionString) throw new Error("Finance indisponible");
    const db=await(this.testPool??(pool??=new Pool({connectionString,max:3,connectionTimeoutMillis:5000}))).connect();
    try{await db.query("begin");await db.query("set local role budgy_finance_server");await db.query("select set_config('budgy.finance_user_id',$1,true)",[this.userId]);const value=await run(db);await db.query("commit");return value;}catch(error){await db.query("rollback").catch(()=>undefined);throw error;}finally{db.release();}
  }
  overview(month="2026-11-01"):Promise<FinanceOverview>{return this.transaction(async(db)=>{
    const monthDate=new Date(`${month}T12:00:00Z`);const next=new Date(Date.UTC(monthDate.getUTCFullYear(),monthDate.getUTCMonth()+1,1)).toISOString().slice(0,10);
    const elapsed=month===new Date().toISOString().slice(0,7)+"-01"?Math.min(new Date().getUTCDate()/new Date(Date.UTC(monthDate.getUTCFullYear(),monthDate.getUTCMonth()+1,0)).getUTCDate(),1):1;
    const accounts=(await db.query(`select id,name,account_type,currency,balance,snapshot_date,include_in_cash from finance_accounts order by include_in_cash desc,name`)).rows.map((row)=>{const value=camel(row);return{...value,balance:number(value.balance)};}) as FinanceOverview["accounts"];
    const snapshotDate=accounts.filter(a=>a.includeInCash).map(a=>isoDate(a.snapshotDate)).sort().at(-1)??month;
    const entries=(await db.query(`select id,title,amount,type,date,business_project,affects_projection,payment_status from budget_entries where not is_archived and date >= $1::date and date < $2::date order by date,title`,[month,next])).rows;
    const planned=entries.filter(row=>row.affects_projection!==false&&row.payment_status==='planned');
    const committed=planned.filter(row=>row.type==='depense').reduce((sum,row)=>sum+number(row.amount),0);
    const futureIncome=planned.filter(row=>row.type==='revenu').reduce((sum,row)=>sum+number(row.amount),0);
    const provisionsRaw=(await db.query(`select p.*,coalesce(sum(case when s.status='BOUGHT' then s.actual_amount else 0 end),0) spent from finance_provisions p left join finance_sub_expenses s on s.provision_id=p.id where p.status<>'CANCELLED' group by p.id order by p.target_date,p.name`)).rows;
    const provisioned=provisionsRaw.filter(row=>isoDate(row.target_date).slice(0,7)===month.slice(0,7)&&row.status==='PLANNED').reduce((sum,row)=>sum+number(row.amount),0);
    const hierarchy=treasuryHierarchy(accounts.filter(a=>a.includeInCash).reduce((sum,a)=>sum+a.balance,0),committed,provisioned,futureIncome);
    const envelopes=await Promise.all((await db.query(`select * from budget_envelopes where month=$1::date order by id`,[month])).rows.map(async row=>{const spent=number((await db.query(`select coalesce(sum(amount),0) spent from budget_entries where not is_archived and type='depense' and status='recu' and not exclude_from_average and date >= $1::date and date < $2::date and category=$3`,[month,next,row.category])).rows[0]?.spent);return{id:String(row.id),name:String(row.name),category:String(row.category),target:number(row.target_amount),spent,historicalAverage:row.historical_average===null?null:number(row.historical_average),...envelopeProgress(number(row.target_amount),spent,elapsed)};}));
    const items=(await db.query(`select * from finance_sub_expenses order by created_at,id`)).rows;
    const provisions=provisionsRaw.map(row=>{const children=items.filter(item=>item.provision_id===row.id).map(item=>({id:item.id,name:item.name,beneficiary:item.beneficiary,planned:number(item.planned_amount),actual:number(item.actual_amount),status:item.status}));const spent=number(row.spent);return{id:row.id,name:row.name,amount:number(row.amount),targetDate:isoDate(row.target_date),status:row.status,flexible:row.flexible,spent,remaining:Math.max(number(row.amount)-spent,0),items:children};});
    const debts=(await db.query(`select id,name,principal,monthly_payment,remaining_months,creditor,status,note from finance_debts order by status,name`)).rows.map(row=>({id:row.id,name:row.name,principal:number(row.principal),monthlyPayment:number(row.monthly_payment),remainingMonths:row.remaining_months,creditor:row.creditor,status:row.status,note:row.note}));
    const projects=(await db.query(`select p.*,coalesce(sum(case when b.type='depense' and not b.is_archived then b.amount else 0 end),0) spent from finance_projects p left join budget_entries b on b.business_project=p.name group by p.id order by p.kind,p.name`)).rows.map(row=>({id:row.id,name:row.name,kind:row.kind,status:row.status,plannedAmount:row.planned_amount===null?null:number(row.planned_amount),spent:number(row.spent),note:row.note}));
    const subscriptions=(await db.query(`select title,amount,lifecycle_status,next_expected_payment from subscriptions where lifecycle_status<>'CANCELLED'`)).rows;const today=new Date();
    const monthRows=[];for(const start of ["2026-11-01","2026-12-01","2027-01-01"]){const end=new Date(`${start}T12:00:00Z`);end.setUTCMonth(end.getUTCMonth()+1);const rows=(await db.query(`select type,amount,affects_projection,payment_status from budget_entries where not is_archived and date >= $1::date and date < $2::date`,[start,end.toISOString().slice(0,10)])).rows;const monthProvisions=provisionsRaw.filter(row=>isoDate(row.target_date).slice(0,7)===start.slice(0,7)&&row.status==='PLANNED').reduce((sum,row)=>sum+number(row.amount),0);const income=rows.filter(r=>r.type==='revenu').reduce((s,r)=>s+number(r.amount),0);const expenses=rows.filter(r=>r.type==='depense').reduce((s,r)=>s+number(r.amount),0);monthRows.push({month:start,income,expenses,committed:rows.filter(r=>r.type==='depense'&&r.affects_projection&&r.payment_status==='planned').reduce((s,r)=>s+number(r.amount),0),provisioned:monthProvisions,projectedBalance:income-expenses-monthProvisions});}
    return{snapshotDate,...hierarchy,accounts,envelopes,provisions,debts,projects,months:monthRows,subscriptions:{active:subscriptions.filter(s=>s.lifecycle_status==='ACTIVE').length,toCheck:subscriptions.filter(s=>['TO_CHECK','API_CREDIT'].includes(s.lifecycle_status)).length,toCancel:subscriptions.filter(s=>s.lifecycle_status==='TO_CANCEL').length,monthly:subscriptions.filter(s=>s.lifecycle_status==='ACTIVE').reduce((sum,s)=>sum+number(s.amount),0),renewalAlerts:subscriptions.filter(s=>s.lifecycle_status==='TO_CANCEL'&&s.next_expected_payment).map(s=>({title:s.title,days:Math.ceil((new Date(s.next_expected_payment).getTime()-today.getTime())/86400000)}))},upcoming:planned.slice(0,12).map(row=>({id:row.id,title:row.title,amount:number(row.amount),type:row.type,date:isoDate(row.date),businessProject:row.business_project}))};
  });}
  addSubExpense(input:{provisionId:string;name:string;beneficiary?:string;plannedAmount:number}){return this.transaction(async db=>{const result=await db.query(`insert into finance_sub_expenses(user_id,provision_id,name,beneficiary,planned_amount) values($1,$2,$3,$4,$5) returning id`,[this.userId,input.provisionId,input.name,input.beneficiary||null,input.plannedAmount]);return result.rows[0]?.id as string;});}
}
