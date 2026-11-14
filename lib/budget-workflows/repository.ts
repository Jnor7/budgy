import "server-only";
import { Pool, type PoolClient } from "pg";
import type { BudgetDetailView } from "./models";

let pool: Pool | undefined;
const money = (value: unknown) => Number(value ?? 0);

export class BudgetWorkflowRepository {
  constructor(
    readonly userId: string,
    private readonly testPool?: Pool,
  ) {}
  private async transaction<T>(run: (db: PoolClient) => Promise<T>) {
    const connectionString = process.env.DATABASE_URL;
    if (!this.testPool && !connectionString)
      throw new Error("Budget indisponible");
    const db = await (
      this.testPool ??
      (pool ??= new Pool({
        connectionString,
        max: 3,
        connectionTimeoutMillis: 5000,
      }))
    ).connect();
    try {
      await db.query("begin");
      await db.query("set local role budgy_finance_server");
      await db.query("select set_config('budgy.finance_user_id',$1,true)", [
        this.userId,
      ]);
      const value = await run(db);
      await db.query("commit");
      return value;
    } catch (error) {
      await db.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      db.release();
    }
  }
  details(entryId: string): Promise<BudgetDetailView[]> {
    return this.transaction(async (db) => {
      const owned = await db.query("select 1 from budget_entries where id=$1", [
        entryId,
      ]);
      if (!owned.rowCount) throw new Error("Transaction introuvable");
      const rows = (
        await db.query(
          "select id,name,beneficiary,planned_amount,actual_amount,status from finance_sub_expenses where budget_entry_id=$1 and status<>'CANCELLED' order by created_at,id",
          [entryId],
        )
      ).rows;
      return rows.map((row) => ({
        id: String(row.id),
        entryId,
        name: String(row.name),
        beneficiary: row.beneficiary,
        plannedAmount: money(row.planned_amount),
        actualAmount: money(row.actual_amount),
        status: row.status,
      }));
    });
  }
  detailsForMonth(month: string): Promise<BudgetDetailView[]> {
    return this.transaction(async (db) => {
      const rows = (await db.query(
        `select d.id,d.budget_entry_id,d.name,d.beneficiary,d.planned_amount,d.actual_amount,d.status
         from finance_sub_expenses d
         join budget_entries b on b.id=d.budget_entry_id
         where b.date >= $1::date and b.date < ($1::date + interval '1 month')
           and d.status <> 'CANCELLED'
         order by d.created_at,d.id`,
        [month],
      )).rows;
      return rows.map((row) => ({
        id: String(row.id), entryId: String(row.budget_entry_id), name: String(row.name),
        beneficiary: row.beneficiary, plannedAmount: money(row.planned_amount),
        actualAmount: money(row.actual_amount), status: row.status,
      }));
    });
  }
  addDetail(input: {
    entryId: string;
    name: string;
    beneficiary?: string;
    plannedAmount: number;
  }) {
    return this.transaction(async (db) => {
      const owned = await db.query("select 1 from budget_entries where id=$1", [
        input.entryId,
      ]);
      if (!owned.rowCount) throw new Error("Transaction introuvable");
      const result = await db.query(
        "insert into finance_sub_expenses(user_id,budget_entry_id,name,beneficiary,planned_amount) values($1,$2,$3,$4,$5) returning id",
        [
          this.userId,
          input.entryId,
          input.name,
          input.beneficiary || null,
          input.plannedAmount,
        ],
      );
      return String(result.rows[0].id);
    });
  }
  removeDetail(id: string) {
    return this.transaction(async (db) => {
      const result = await db.query(
        "update finance_sub_expenses set status='CANCELLED',updated_at=now() where id=$1 returning id",
        [id],
      );
      if (!result.rowCount) throw new Error("Détail introuvable");
    });
  }
  report(input: { entryId: string; date: string; title?: string }) {
    return this.transaction(async (db) => {
      const source = (
        await db.query("select * from budget_entries where id=$1 for update", [
          input.entryId,
        ])
      ).rows[0];
      if (!source) throw new Error("Transaction introuvable");
      const existing = (
        await db.query(
          "select id from budget_entries where original_entry_id=$1 and rollover_status='carried_in' and not is_archived limit 1",
          [input.entryId],
        )
      ).rows[0];
      if (existing) return String(existing.id);
      await db.query(
        "update budget_entries set status='non',payment_status='cancelled',affects_projection=false,rollover_status='carried_out' where id=$1",
        [input.entryId],
      );
      const title = input.title?.trim() || `Arriéré ${source.title}`;
      const result = await db.query(
        `insert into budget_entries(user_id,title,amount,type,category,bucket,scope,date,note,potential_amount,status,account_name,payment_status,affects_projection,is_before_snapshot,is_archived,is_internal_transfer,is_exceptional,exclude_from_average,context,business_project,owner_advance,recurring_key,is_variable_estimate,currency,counts_as_earned_income,rollover_status,original_entry_id,original_month,linked_debt_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'non',$11,'planned',true,false,false,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,'carried_in',$23,date_trunc('month',$24::date)::date,$25) returning id`,
        [
          this.userId,
          title,
          source.amount,
          source.type,
          source.category,
          source.bucket,
          source.scope,
          input.date,
          source.note,
          source.potential_amount,
          source.account_name,
          source.is_internal_transfer,
          source.is_exceptional,
          source.exclude_from_average,
          source.context,
          source.business_project,
          source.owner_advance,
          source.recurring_key,
          source.is_variable_estimate,
          source.currency,
          source.counts_as_earned_income,
          input.entryId,
          source.date,
          source.linked_debt_id,
        ],
      );
      return String(result.rows[0].id);
    });
  }
}
