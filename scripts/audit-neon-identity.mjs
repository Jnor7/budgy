import { readFileSync } from "node:fs";
import pg from "pg";

function loadLocalEnv() {
  try {
    for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match || process.env[match[1]]) continue;
      const value = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
      process.env[match[1]] = value;
    }
  } catch {}
}

loadLocalEnv();
const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL_UNPOOLED ou DATABASE_URL manque.");

const historical = [
  ["Jnor7", "5dc4ad8a-6dd1-41df-95a8-2062084f1935"],
  ["Chlo", "4ecbd74d-b603-4a29-b04b-72d459ef3e75"],
  ["Abygate", "5567cc9a-521f-429a-88f6-d736f410f981"],
  ["TEST", "da4f81be-7c8a-497a-aef6-75fd17a0fbb7"],
];
const tables = [
  "budget_entries", "subscriptions", "tenants", "rent_payments", "tenant_debts", "businesses",
  "business_contacts", "business_items", "business_transactions", "business_bookings", "business_tasks",
  "dubai_parts", "dubai_sales", "dubai_expenses", "dubai_cash_movements", "trips", "flights",
  "accommodations", "trip_activities", "trip_checklist_items", "trip_members", "trip_invitations",
  "notifications", "trip_expenses", "trip_expense_splits", "travel_friend_requests", "travel_friends",
  "attachments", "user_modules", "user_preferences", "profiles",
];

const client = new pg.Client({ connectionString });
await client.connect();
try {
  await client.query("begin read only");
  const authUsers = await client.query(`select id::text, email, name from neon_auth."user" order by email`);
  console.log("AUTH_USERS", authUsers.rows);
  const mappings = await client.query(`
    select p.username, p.user_id::text, bai.auth_provider, bai.auth_subject,
           u.id::text as neon_auth_id, u.email
    from public.profiles p
    left join public.budgy_auth_identities bai
      on bai.budgy_user_id = p.user_id and bai.auth_provider = 'neon'
    left join neon_auth."user" u on u.id::text = bai.auth_subject
    order by p.username
  `);
  console.log("PROFILE_MAPPINGS", mappings.rows);
  for (const [username, expectedBudgyUserId] of historical) {
    const mapping = mappings.rows.find((row) => row.username === username);
    if (!mapping) throw new Error(`Profil historique absent: ${username}`);
    if (mapping.user_id !== expectedBudgyUserId) {
      throw new Error(`UUID Budgy modifié pour ${username}: ${mapping.user_id}`);
    }
    if (!mapping.neon_auth_id || mapping.auth_subject !== mapping.neon_auth_id) {
      throw new Error(`Mapping Neon invalide pour ${username}`);
    }
  }
  const duplicateSubjects = await client.query(`
    select auth_provider, auth_subject, count(*)::int
    from public.budgy_auth_identities group by 1,2 having count(*) > 1
  `);
  const duplicateUsers = await client.query(`
    select auth_provider, budgy_user_id::text, count(*)::int
    from public.budgy_auth_identities group by 1,2 having count(*) > 1
  `);
  const usersWithoutProfiles = await client.query(`
    select bu.id::text, bu.created_at, bai.auth_provider, bai.auth_subject
    from public.budgy_users bu
    left join public.profiles p on p.user_id = bu.id
    left join public.budgy_auth_identities bai on bai.budgy_user_id = bu.id
    where p.user_id is null order by bu.created_at desc
  `);
  console.log("ANOMALIES", {
    duplicateSubjects: duplicateSubjects.rows,
    duplicateUsers: duplicateUsers.rows,
    usersWithoutProfiles: usersWithoutProfiles.rows,
  });
  if (duplicateSubjects.rowCount || duplicateUsers.rowCount || usersWithoutProfiles.rowCount) {
    throw new Error("Anomalie d'identité Neon détectée.");
  }

  const columns = await client.query(`
    select tc.table_name, kcu.column_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name and tc.constraint_schema = kcu.constraint_schema
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name = tc.constraint_name and ccu.constraint_schema = tc.constraint_schema
    where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'
      and ccu.table_schema = 'public' and ccu.table_name = 'budgy_users'
      and tc.table_name = any($1::text[])
    order by tc.table_name, kcu.column_name
  `, [tables]);
  const ownership = new Map();
  for (const row of columns.rows) {
    const list = ownership.get(row.table_name) ?? [];
    list.push(row.column_name);
    ownership.set(row.table_name, list);
  }
  const counts = {};
  for (const [name, id] of historical) {
    counts[name] = { budgyUserId: id };
    for (const table of tables) {
      const ownerColumns = ownership.get(table) ?? [];
      if (!ownerColumns.length) { counts[name][table] = null; continue; }
      const where = ownerColumns.map((column, index) => `"${column}" = $${index + 1}::uuid`).join(" or ");
      const result = await client.query(`select count(*)::int as count from public."${table}" where ${where}`, ownerColumns.map(() => id));
      counts[name][table] = result.rows[0].count;
    }
  }
  console.log("HISTORICAL_COUNTS", counts);
  if (counts.Jnor7.budget_entries !== 112 || counts.Jnor7.subscriptions !== 7 || counts.Jnor7.tenants !== 3) {
    throw new Error("Les données historiques critiques de Jnor7 ne correspondent plus au snapshot validé.");
  }
  if (counts.Chlo.budget_entries !== 30 || counts.Abygate.trips !== 1 || counts.TEST.profiles !== 1) {
    throw new Error("Le snapshot des comptes historiques ne correspond plus aux valeurs validées.");
  }

  const definitions = await client.query(`
    select p.proname, pg_get_functiondef(p.oid) as definition
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('current_budgy_user_id','ensure_current_budgy_user')
    order by p.proname
  `);
  console.log("IDENTITY_FUNCTIONS", definitions.rows);
  const currentDefinition = definitions.rows.find((row) => row.proname === "current_budgy_user_id")?.definition ?? "";
  const ensureDefinition = definitions.rows.find((row) => row.proname === "ensure_current_budgy_user")?.definition ?? "";
  if (!currentDefinition.includes("budgy_auth_identities") || currentDefinition.includes("gen_random_uuid")) {
    throw new Error("current_budgy_user_id() n'est plus une résolution d'identité stable et sans création.");
  }
  const existingLookup = ensureDefinition.indexOf("INTO v_existing");
  const creation = ensureDefinition.indexOf("gen_random_uuid");
  if (!ensureDefinition.includes("pg_advisory_xact_lock") || existingLookup < 0 || creation < 0 || existingLookup > creation) {
    throw new Error("ensure_current_budgy_user() n'est plus idempotente ou protégée contre la concurrence.");
  }
  console.log("AUDIT_STATUS", "OK");
  await client.query("rollback");
} finally {
  await client.end();
}
