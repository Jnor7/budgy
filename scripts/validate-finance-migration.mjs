import { readFileSync } from "node:fs";
import pg from "pg";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
}
const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL_UNPOOLED ou DATABASE_URL manque.");
const sql = readFileSync("supabase/migrations/20261113173942_finance_reconciliation_november_2026.sql", "utf8");
const apply = process.argv.includes("--apply");
const client = new pg.Client({ connectionString });
await client.connect();
try {
  await client.query("begin");
  const before = await client.query("select count(*)::int total from budget_entries");
  await client.query(sql);
  const state = await client.query(`select
    (select count(*)::int from information_schema.tables where table_schema='public' and table_name in ('finance_accounts','budget_envelopes','finance_projects','finance_provisions','finance_sub_expenses','finance_debts')) tables,
    (select count(*)::int from pg_policies where schemaname='public' and tablename in ('finance_accounts','budget_envelopes','finance_projects','finance_provisions','finance_sub_expenses','finance_debts')) policies,
    (select count(*)::int from information_schema.columns where table_schema='public' and table_name='budget_entries' and column_name in ('payment_status','affects_projection','is_archived','exclude_from_average','business_project')) budget_columns`);
  const after = await client.query("select count(*)::int total from budget_entries");
  const result = state.rows[0];
  if (result.tables !== 6 || result.policies < 12 || result.budget_columns !== 5) throw new Error(`Migration Finance incomplète: ${JSON.stringify(result)}`);
  if (before.rows[0].total !== after.rows[0].total) throw new Error("Le volume de budget_entries a changé.");
  await client.query(apply ? "commit" : "rollback");
  console.log(apply ? "FINANCE_MIGRATION_APPLIED OK" : "FINANCE_MIGRATION_VALIDATION OK (transaction rolled back)", result);
} catch (error) {
  await client.query("rollback").catch(() => undefined);
  throw error;
} finally { await client.end(); }
