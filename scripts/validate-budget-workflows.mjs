import { readFileSync } from "node:fs";
import pg from "pg";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (match && !process.env[match[1]])
    process.env[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
}
const connectionString =
  process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connectionString)
  throw new Error("DATABASE_URL_UNPOOLED ou DATABASE_URL manque.");
const sql = readFileSync(
  "supabase/migrations/20261113180914_budget_line_workflows.sql",
  "utf8",
);
const apply = process.argv.includes("--apply");
const client = new pg.Client({ connectionString });
await client.connect();
try {
  await client.query("begin");
  const before = await client.query(
    "select count(*)::int total from budget_entries",
  );
  await client.query(sql);
  const state = (
    await client.query(
      `select (select count(*)::int from information_schema.columns where table_schema='public' and table_name='budget_entries' and column_name in ('currency','counts_as_earned_income','rollover_status','original_entry_id','original_month','linked_debt_id')) columns,(select count(*)::int from information_schema.columns where table_schema='public' and table_name='finance_sub_expenses' and column_name='budget_entry_id') detail_column,(select count(*)::int from pg_policies where schemaname='public' and tablename='budget_entries' and policyname='finance_server_scope' and with_check is not null) scoped_policy`,
    )
  ).rows[0];
  const after = await client.query(
    "select count(*)::int total from budget_entries",
  );
  if (
    state.columns !== 6 ||
    state.detail_column !== 1 ||
    state.scoped_policy !== 1
  )
    throw new Error(`Migration Budget incomplète: ${JSON.stringify(state)}`);
  if (before.rows[0].total !== after.rows[0].total)
    throw new Error("Le volume de budget_entries a changé.");
  await client.query(apply ? "commit" : "rollback");
  console.log(
    apply
      ? "BUDGET_WORKFLOWS_MIGRATION_APPLIED OK"
      : "BUDGET_WORKFLOWS_MIGRATION_VALIDATION OK (transaction rolled back)",
    state,
  );
} catch (error) {
  await client.query("rollback").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
