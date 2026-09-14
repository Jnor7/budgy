import { readFileSync } from "node:fs";
import pg from "pg";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (!match || process.env[match[1]]) continue;
  process.env[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
}
const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL_UNPOOLED ou DATABASE_URL manque.");
const sql = readFileSync("supabase/migrations/20260914175916_expand_business_management.sql", "utf8");
const apply = process.argv.includes("--apply");
const verify = process.argv.includes("--verify");
const existingTables = ["businesses", "business_contacts", "business_items", "business_transactions", "business_bookings", "business_tasks"];
const client = new pg.Client({ connectionString });
await client.connect();
try {
  if (verify) {
    const result = await client.query(`
      select
        (select count(*)::int from information_schema.tables where table_schema='public' and table_name in ('business_transaction_lines','business_payments','business_stock_movements')) as tables,
        (select count(*)::int from pg_class where relnamespace='public'::regnamespace and relname in ('business_transaction_lines','business_payments','business_stock_movements') and relrowsecurity) as rls_tables,
        (select count(*)::int from pg_policies where schemaname='public' and tablename in ('business_transaction_lines','business_payments','business_stock_movements')) as policies,
        (select count(*)::int from pg_proc where pronamespace='public'::regnamespace and proname in ('save_business_transaction','cancel_business_transaction','record_business_payment','adjust_business_stock')) as functions
    `);
    const state = result.rows[0];
    if (state.tables !== 3 || state.rls_tables !== 3 || state.policies !== 3 || state.functions !== 4) throw new Error("La migration Business distante est incomplète.");
    const volumes = await client.query(`select relname, n_live_tup::bigint as rows from pg_stat_user_tables where relname = any($1) order by relname`, [existingTables]);
    console.log("BUSINESS_MIGRATION_VERIFY OK", JSON.stringify({ ...state, existing: volumes.rows }));
  } else {
    await client.query("begin");
    const before = await client.query(`select relname, n_live_tup::bigint as count from pg_stat_user_tables where relname = any($1)`, [existingTables]);
    await client.query(sql);
    const result = await client.query(`
      select count(*)::int as count from information_schema.tables
      where table_schema='public' and table_name in ('business_transaction_lines','business_payments','business_stock_movements')
    `);
    if (result.rows[0]?.count !== 3) throw new Error("Les trois tables Business ne sont pas disponibles.");
    const after = await client.query(`select relname, n_live_tup::bigint as count from pg_stat_user_tables where relname = any($1)`, [existingTables]);
    const counts = (rows) => new Map(rows.map((row) => [row.relname, Number(row.count)]));
    const beforeCounts = counts(before.rows); const afterCounts = counts(after.rows);
    for (const table of existingTables) {
      if ((beforeCounts.get(table) ?? 0) !== (afterCounts.get(table) ?? 0)) throw new Error(`Le nombre de lignes existantes a changé pour ${table}.`);
    }
    await client.query(apply ? "commit" : "rollback");
    console.log(apply ? "BUSINESS_MIGRATION_APPLIED OK" : "BUSINESS_MIGRATION_VALIDATION OK (transaction rolled back)");
  }
} catch (error) {
  await client.query("rollback").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
