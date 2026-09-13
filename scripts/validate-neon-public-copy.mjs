import pg from "pg";

const { Client } = pg;
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  const result = await client.query(`
    select
      (select count(*) from pg_tables where schemaname = 'public')::int as tables,
      (select count(*) from pg_constraint co
        join pg_class c on c.oid = co.conrelid
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public')::int as constraints,
      (select count(*) from pg_indexes where schemaname = 'public')::int as indexes,
      (select count(*) from pg_proc where pronamespace = 'public'::regnamespace)::int as functions,
      (select count(*) from pg_trigger t
        join pg_class c on c.oid = t.tgrelid
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and not t.tgisinternal)::int as triggers,
      (select count(*) from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity)::int as rls_tables,
      (select count(*) from pg_namespace
        where nspname in ('auth', 'storage', 'realtime', 'supabase_realtime'))::int as forbidden_schemas
  `);
  console.log(JSON.stringify(result.rows[0]));
} finally {
  await client.end();
}
